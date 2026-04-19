// =============================================================
// Voz — Transcriptor con diarización (solo modo backend)
// =============================================================

const state = {
  backend: null,
  mediaStream: null,
  workletNode: null,
  pcmChunks: [],
  audioContext: null,
  analyser: null,
  startTime: 0,
  timerInterval: null,
  waveformInterval: null,
  finalText: '',
  finalSegments: null,
  finalDuration: 0,
  speakerNames: new Map(),     // speaker_id → nombre custom
  speakerPalette: new Map(),   // speaker_id → { name, color }
};

const $ = (id) => document.getElementById(id);
const screens = {
  connecting: $('screen-connecting'),
  noBackend: $('screen-no-backend'),
  idle: $('screen-idle'),
  recording: $('screen-recording'),
  processing: $('screen-processing'),
  result: $('screen-result'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
}

function showError(message) {
  const banner = $('error-banner');
  banner.textContent = message;
  banner.classList.add('show');
}

function clearError() {
  $('error-banner').classList.remove('show');
}

function showToast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// =============================================================
// Detección del backend
// =============================================================
async function detectBackend() {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(timeout);
    if (r.ok) return await r.json();
  } catch {}
  return null;
}

async function initApp() {
  showScreen('connecting');
  state.backend = await detectBackend();
  if (!state.backend) {
    showScreen('noBackend');
    return;
  }
  showBackendBadge(state.backend);
  showScreen('idle');
}

function showBackendBadge(info) {
  const el = $('backend-badge');
  if (!el) return;
  const diar = info.diarization ? ' · diarización' : ' · sin diarización';
  el.textContent = `${info.device} · ${info.model}${diar}`;
  el.style.display = 'inline-block';
}

// =============================================================
// Grabación (captura PCM directo con AudioWorklet)
// =============================================================
async function startRecording() {
  if (!state.backend) return;
  clearError();

  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err) {
    showError('No se pudo acceder al micrófono. Revisa los permisos del navegador e inténtalo de nuevo.');
    return;
  }

  try {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  } catch {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  try {
    await state.audioContext.audioWorklet.addModule('./pcm-recorder.js');
  } catch (err) {
    console.error('AudioWorklet load failed:', err);
    showError('Tu navegador no soporta la captura de audio necesaria. Usa Chrome o Edge actualizados.');
    state.mediaStream.getTracks().forEach(t => t.stop());
    return;
  }

  const source = state.audioContext.createMediaStreamSource(state.mediaStream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 64;
  source.connect(state.analyser);

  state.pcmChunks = [];
  state.workletNode = new AudioWorkletNode(state.audioContext, 'pcm-recorder');
  state.workletNode.port.onmessage = (e) => {
    state.pcmChunks.push(e.data);
  };
  source.connect(state.workletNode);

  state.startTime = Date.now();
  $('rec-time').textContent = '00:00';

  setupWaveform();
  state.timerInterval = setInterval(updateTimer, 250);
  showScreen('recording');
}

function setupWaveform() {
  const container = $('waveform');
  container.innerHTML = '';
  const BARS = 32;
  const bars = [];
  for (let i = 0; i < BARS; i++) {
    const el = document.createElement('span');
    container.appendChild(el);
    bars.push(el);
  }
  const data = new Uint8Array(state.analyser.frequencyBinCount);
  state.waveformInterval = setInterval(() => {
    state.analyser.getByteFrequencyData(data);
    for (let i = 0; i < BARS; i++) {
      const v = data[i % data.length] / 255;
      const h = 4 + v * 48;
      bars[i].style.height = `${h}px`;
    }
  }, 80);
}

function updateTimer() {
  const secs = Math.floor((Date.now() - state.startTime) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  $('rec-time').textContent = `${mm}:${ss}`;
}

function stopRecording() {
  if (!state.workletNode) return;
  clearInterval(state.timerInterval);
  clearInterval(state.waveformInterval);
  state.finalDuration = Math.floor((Date.now() - state.startTime) / 1000);
  try { state.workletNode.disconnect(); } catch {}
  try { state.workletNode.port.close(); } catch {}
  state.workletNode = null;
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
  }

  showScreen('processing');
  $('processing-detail').textContent = 'Transcribiendo y detectando hablantes. Puede tardar 1-3 min según la duración.';

  const audioData = buildPcmFloat32(state.pcmChunks, state.audioContext.sampleRate);
  if (!audioData || audioData.length < 16000) {
    showError('La grabación es demasiado corta. Inténtalo de nuevo.');
    showScreen('idle');
    return;
  }
  transcribeWithBackend(audioData);
}

async function transcribeWithBackend(pcm) {
  const wav = pcmToWav(pcm, 16000);
  const fd = new FormData();
  fd.append('audio', new Blob([wav], { type: 'audio/wav' }), 'recording.wav');
  try {
    const r = await fetch('/api/transcribe', { method: 'POST', body: fd });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    state.finalSegments = data.segments || [];
    displayResult();
  } catch (err) {
    console.error('Backend error:', err);
    showError(`Fallo en el servidor: ${err.message}. Avisa al administrador.`);
    showScreen('idle');
  }
}

// =============================================================
// Concat + WAV encoding
// =============================================================
function buildPcmFloat32(chunks, sourceRate) {
  let total = 0;
  for (const c of chunks) total += c.length;
  if (total === 0) return null;

  const pcm = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    pcm.set(c, offset);
    offset += c.length;
  }

  if (sourceRate === 16000) return pcm;
  return resampleLinear(pcm, sourceRate, 16000);
}

function resampleLinear(input, srcRate, dstRate) {
  if (srcRate === dstRate) return new Float32Array(input);
  const ratio = srcRate / dstRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIdx - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function pcmToWav(pcm, sampleRate) {
  const bytesPerSample = 2;
  const dataSize = pcm.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buffer);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * bytesPerSample, true);
  v.setUint16(32, bytesPerSample, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return buffer;
}

// =============================================================
// Resultado con hablantes (editables)
// =============================================================
function buildSpeakerPalette() {
  const palette = ['#01896c', '#c14d2b', '#2d6fa6', '#8b4a9c', '#b87333', '#4a8a5a', '#a83e6f', '#5a6c7a'];
  state.speakerPalette = new Map();
  state.finalSegments.forEach(seg => {
    if (!state.speakerPalette.has(seg.speaker)) {
      const idx = state.speakerPalette.size;
      state.speakerPalette.set(seg.speaker, {
        name: `Hablante ${idx + 1}`,
        color: palette[idx % palette.length],
      });
    }
  });
}

function speakerDisplayName(spk) {
  const custom = state.speakerNames.get(spk);
  if (custom) return custom;
  const info = state.speakerPalette.get(spk);
  return info ? info.name : spk;
}

function renderSpeakerSegments() {
  const box = $('result-text');
  box.innerHTML = '';
  state.finalSegments.forEach(seg => {
    const info = state.speakerPalette.get(seg.speaker);
    const block = document.createElement('div');
    block.className = 'segment';

    const label = document.createElement('div');
    label.className = 'segment-speaker';
    label.textContent = speakerDisplayName(seg.speaker);
    label.style.color = info.color;
    label.style.cursor = 'pointer';
    label.title = 'Clic para renombrar este hablante';
    label.addEventListener('click', () => {
      const current = speakerDisplayName(seg.speaker);
      const input = window.prompt('¿Cómo se llama este hablante?', current);
      if (input !== null) {
        const trimmed = input.trim();
        if (trimmed) state.speakerNames.set(seg.speaker, trimmed);
        else state.speakerNames.delete(seg.speaker);
        renderSpeakerSegments();
        rebuildFinalText();
      }
    });

    const text = document.createElement('div');
    text.className = 'segment-text';
    text.textContent = seg.text;

    block.appendChild(label);
    block.appendChild(text);
    box.appendChild(block);
  });
}

function rebuildFinalText() {
  if (!state.finalSegments || state.finalSegments.length === 0) return;
  state.finalText = state.finalSegments
    .map(s => `[${speakerDisplayName(s.speaker)}]\n${s.text}`)
    .join('\n\n');
}

function displayResult() {
  if (state.finalSegments && state.finalSegments.length > 0) {
    state.speakerNames = new Map();
    buildSpeakerPalette();
    rebuildFinalText();
    renderSpeakerSegments();
  } else {
    $('result-text').textContent = '(Sin texto transcrito — la grabación parecía vacía)';
  }

  const mm = String(Math.floor(state.finalDuration / 60)).padStart(2, '0');
  const ss = String(state.finalDuration % 60).padStart(2, '0');
  const modelLabel = state.backend ? state.backend.model : '?';
  $('result-meta').textContent = `${mm}:${ss} · modelo ${modelLabel}`;
  showScreen('result');

  try {
    localStorage.setItem('voz.lastTranscription', JSON.stringify({
      segments: state.finalSegments,
      duration: state.finalDuration,
      model: state.backend?.model,
      date: new Date().toISOString(),
    }));
  } catch {}
}

// =============================================================
// Handlers UI
// =============================================================
$('btn-record').addEventListener('click', startRecording);
$('btn-stop').addEventListener('click', stopRecording);

$('btn-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.finalText);
    showToast('Copiado al portapapeles');
  } catch {
    showToast('No se pudo copiar');
  }
});

$('btn-download').addEventListener('click', () => {
  const blob = new Blob([state.finalText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  a.href = url;
  a.download = `transcripcion_${date}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

$('btn-new').addEventListener('click', () => {
  state.finalText = '';
  state.finalSegments = null;
  showScreen('idle');
});

$('btn-retry-backend')?.addEventListener('click', () => initApp());

// Atajo: Espacio para grabar/parar
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  e.preventDefault();
  if (screens.idle.classList.contains('active')) startRecording();
  else if (screens.recording.classList.contains('active')) stopRecording();
});

// Aviso si cierra pestaña durante grabación
window.addEventListener('beforeunload', (e) => {
  if (screens.recording.classList.contains('active')) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW register failed:', err));
  });
}

// Prompt de instalación PWA
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = $('btn-install');
  if (btn) btn.style.display = 'inline-flex';
});
$('btn-install')?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (outcome === 'accepted') $('btn-install').style.display = 'none';
});
window.addEventListener('appinstalled', () => {
  const btn = $('btn-install');
  if (btn) btn.style.display = 'none';
});

// Arranque
initApp();
