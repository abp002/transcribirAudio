// =============================================================
// Voz - Transcriptor en español
// Lógica principal del hilo de UI
// =============================================================

// ---- Estado global ----
const state = {
  worker: null,
  backend: null,
  modelReady: false,
  currentModel: null,
  selectedModel: localStorage.getItem('voz.model') || 'Xenova/whisper-small',
  mediaStream: null,
  workletNode: null,
  pcmChunks: [],
  audioContext: null,
  analyser: null,
  startTime: 0,
  timerInterval: null,
  waveformInterval: null,
  previewInterval: null,
  previewBusy: false,
  lastPreviewText: '',
  finalText: '',
  finalSegments: null,
  finalStats: null,
  finalDuration: 0,
};

// ---- Referencias DOM ----
const $ = (id) => document.getElementById(id);
const screens = {
  loading: $('screen-loading'),
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
// Detección de backend local (whisperX + pyannote)
// =============================================================
async function detectBackend() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) return await r.json();
  } catch {}
  return null;
}

// =============================================================
// Worker (modelo Whisper en navegador) o backend local
// =============================================================
async function initWorker() {
  state.backend = await detectBackend();
  if (state.backend) {
    console.log('[App] Backend local detectado:', state.backend);
    state.modelReady = true;
    $('model-select').style.display = 'none';
    showBackendBadge(state.backend);
    showScreen('idle');
    return;
  }

  // Fallback: Whisper in-browser via Web Worker
  state.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  state.worker.onmessage = (e) => {
    const msg = e.data;
    switch (msg.type) {
      case 'progress': onModelProgress(msg); break;
      case 'ready': onModelReady(); break;
      case 'transcription': onTranscription(msg); break;
      case 'error': onWorkerError(msg); break;
    }
  };
  loadModel(state.selectedModel);
}

function showBackendBadge(info) {
  const el = document.getElementById('backend-badge');
  if (!el) return;
  const diar = info.diarization ? ' con diarización' : '';
  el.textContent = `Modo local (${info.device}/${info.model})${diar}`;
  el.style.display = 'inline-block';
}

function loadModel(model) {
  state.modelReady = false;
  state.currentModel = model;
  showScreen('loading');

  const alreadyLoaded = localStorage.getItem(`voz.loaded.${model}`) === '1';
  if (alreadyLoaded) {
    $('loading-title').textContent = 'Cargando el motor';
    $('loading-subtitle').textContent = 'Tu modelo ya está guardado en este navegador. Solo lo pasamos a memoria (15-30 s).';
    $('progress-label').textContent = 'Leyendo caché local…';
  } else {
    $('loading-title').textContent = 'Preparando el motor de transcripción';
    $('loading-subtitle').textContent = 'Solo la primera vez. Se descarga el modelo de IA y se guarda en tu navegador. Después funciona sin conexión.';
    $('progress-label').textContent = 'Comprobando caché…';
  }

  $('progress-bar').style.width = '0%';
  $('model-select').disabled = true;

  state.worker.postMessage({ type: 'load', model });
}

function onModelProgress(msg) {
  // msg: { status, file, progress, loaded, total }
  const { status, file, progress, loaded, total } = msg;

  if (status === 'initiate') {
    // Aún no sabemos si es cache-hit (rápido) o descarga real.
    // No pisamos el label para no contradecir "Leyendo caché…" en la 2ª visita.
  } else if (status === 'download') {
    $('progress-label').textContent = `Descargando ${file || 'modelo'} desde la nube…`;
  } else if (status === 'progress') {
    if (typeof progress === 'number') {
      $('progress-bar').style.width = `${Math.min(100, progress)}%`;
    }
    if (loaded && total) {
      const mb = (loaded / 1024 / 1024).toFixed(1);
      const totalMb = (total / 1024 / 1024).toFixed(1);
      $('progress-label').textContent = `Descargando ${mb} MB / ${totalMb} MB`;
    }
  } else if (status === 'loading') {
    $('progress-bar').style.width = '100%';
    $('progress-label').textContent = 'Cargando modelo en memoria…';
  }
}

function onModelReady() {
  state.modelReady = true;
  localStorage.setItem(`voz.loaded.${state.currentModel}`, '1');
  $('model-select').disabled = false;
  showScreen('idle');
}

function onWorkerError(msg) {
  console.error('Worker error:', msg.error);
  $('loading-title').textContent = 'Ha ocurrido un problema';
  $('progress-label').textContent = msg.error || 'Error desconocido al cargar el modelo.';
}

// =============================================================
// Grabación (captura PCM directo con AudioWorklet)
// =============================================================
async function startRecording() {
  if (!state.modelReady) return;
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

  // AudioContext forzado a 16 kHz mono para que Whisper reciba exactamente
  // lo que espera sin tener que resamplear en JS.
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

  console.log(`[App] AudioContext sampleRate real: ${state.audioContext.sampleRate} Hz`);

  state.pcmChunks = [];
  state.workletNode = new AudioWorkletNode(state.audioContext, 'pcm-recorder');
  state.workletNode.port.onmessage = (e) => {
    state.pcmChunks.push(e.data);
  };
  source.connect(state.workletNode);

  state.startTime = Date.now();
  state.lastPreviewText = '';
  $('preview-text').textContent = 'Empieza a hablar. La vista previa aparecerá en unos segundos…';
  $('preview-text').classList.add('empty');
  $('rec-time').textContent = '00:00';

  setupWaveform();
  state.timerInterval = setInterval(updateTimer, 250);
  state.previewInterval = setInterval(requestPreview, 12000);

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

function requestPreview() {
  if (state.previewBusy) return;
  if (!state.pcmChunks || state.pcmChunks.length === 0) return;

  const elapsedMin = (Date.now() - state.startTime) / 60000;
  if (elapsedMin > 15) {
    $('preview-text').textContent = 'Grabación larga en curso. La transcripción completa se mostrará al finalizar.';
    $('preview-text').classList.remove('empty');
    return;
  }

  state.previewBusy = true;
  $('preview-working').style.display = 'inline-block';
  $('preview-working-text').style.display = 'inline';

  const audioData = buildPcmFloat32(state.pcmChunks, state.audioContext.sampleRate);
  if (audioData && audioData.length > 16000) {
    state.worker.postMessage({
      type: 'transcribe',
      audio: audioData,
      isPreview: true,
    }, [audioData.buffer]);
  } else {
    state.previewBusy = false;
    $('preview-working').style.display = 'none';
    $('preview-working-text').style.display = 'none';
  }
}

function stopRecording() {
  if (!state.workletNode) return;
  clearInterval(state.timerInterval);
  clearInterval(state.waveformInterval);
  clearInterval(state.previewInterval);
  state.finalDuration = Math.floor((Date.now() - state.startTime) / 1000);
  try { state.workletNode.disconnect(); } catch {}
  try { state.workletNode.port.close(); } catch {}
  state.workletNode = null;
  onRecordingStopped();
}

function onRecordingStopped() {
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
  }

  showScreen('processing');
  $('processing-detail').textContent = 'Esto puede tardar un rato. Déjalo que termine.';

  try {
    const audioData = buildPcmFloat32(state.pcmChunks, state.audioContext.sampleRate);
    if (!audioData || audioData.length < 16000) {
      showError('La grabación es demasiado corta. Inténtalo de nuevo.');
      showScreen('idle');
      return;
    }
    if (state.backend) {
      transcribeWithBackend(audioData);
    } else {
      state.worker.postMessage({
        type: 'transcribe',
        audio: audioData,
        isPreview: false,
      }, [audioData.buffer]);
    }
  } catch (err) {
    console.error('PCM build error:', err);
    showError('No se pudo procesar el audio grabado.');
    showScreen('idle');
  }
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
    state.finalText = state.finalSegments
      .map(s => `[${s.speaker}]\n${s.text}`)
      .join('\n\n');
    state.finalStats = null;
    displayResult();
  } catch (err) {
    console.error('Backend error:', err);
    showError(`Fallo en el servidor local: ${err.message}`);
    showScreen('idle');
  }
}

// Float32 mono PCM → WAV 16-bit little-endian (ArrayBuffer)
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
  v.setUint32(16, 16, true);       // PCM chunk size
  v.setUint16(20, 1, true);        // PCM format
  v.setUint16(22, 1, true);        // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * bytesPerSample, true);
  v.setUint16(32, bytesPerSample, true);
  v.setUint16(34, 16, true);       // bits per sample
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

function onTranscription(msg) {
  // msg: { text, isPreview, stats }
  if (msg.stats) {
    console.log(`[Whisper->App] ${msg.isPreview ? 'preview' : 'FINAL'} stats:`, msg.stats);
  }
  if (msg.isPreview) {
    if (msg.text && msg.text.trim()) {
      $('preview-text').textContent = msg.text.trim();
      $('preview-text').classList.remove('empty');
      state.lastPreviewText = msg.text.trim();
    }
    state.previewBusy = false;
    $('preview-working').style.display = 'none';
    $('preview-working-text').style.display = 'none';
  } else {
    // Resultado final
    state.finalText = (msg.text || '').trim();
    state.finalStats = msg.stats || null;
    displayResult();
  }
}

function displayResult() {
  const box = $('result-text');
  box.innerHTML = '';
  if (state.finalSegments && state.finalSegments.length > 0) {
    const palette = ['#01896c', '#c14d2b', '#2d6fa6', '#8b4a9c', '#b87333', '#4a8a5a', '#a83e6f', '#5a6c7a'];
    const speakerMap = new Map();
    state.finalSegments.forEach(seg => {
      if (!speakerMap.has(seg.speaker)) {
        speakerMap.set(seg.speaker, {
          name: `Hablante ${speakerMap.size + 1}`,
          color: palette[speakerMap.size % palette.length],
        });
      }
      const info = speakerMap.get(seg.speaker);
      const block = document.createElement('div');
      block.className = 'segment';
      const label = document.createElement('div');
      label.className = 'segment-speaker';
      label.textContent = info.name;
      label.style.color = info.color;
      const text = document.createElement('div');
      text.className = 'segment-text';
      text.textContent = seg.text;
      block.appendChild(label);
      block.appendChild(text);
      box.appendChild(block);
    });
  } else {
    box.textContent = state.finalText || '(Sin texto transcrito)';
  }

  const mm = String(Math.floor(state.finalDuration / 60)).padStart(2, '0');
  const ss = String(state.finalDuration % 60).padStart(2, '0');
  const modelLabel = state.backend
    ? `${state.backend.model} (local)`
    : state.currentModel.split('/').pop();
  let meta = `${mm}:${ss} · modelo ${modelLabel}`;
  if (state.finalStats) {
    const s = state.finalStats;
    meta += ` · audio ${s.durSec.toFixed(1)}s · peak ${s.peak.toFixed(2)} · rms ${s.rms.toFixed(3)}`;
  }
  $('result-meta').textContent = meta;
  showScreen('result');

  // Guardar copia de seguridad
  try {
    localStorage.setItem('voz.lastTranscription', JSON.stringify({
      text: state.finalText,
      duration: state.finalDuration,
      model: state.currentModel,
      date: new Date().toISOString(),
    }));
  } catch {}
}

// =============================================================
// Concatenado de chunks PCM → Float32Array mono a 16 kHz
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
  showScreen('idle');
});

// Selector de modelo
$('model-select').value = state.selectedModel;
$('model-select').addEventListener('change', (e) => {
  const newModel = e.target.value;
  state.selectedModel = newModel;
  localStorage.setItem('voz.model', newModel);
  if (newModel !== state.currentModel) {
    loadModel(newModel);
  }
});

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
  $('btn-install').style.display = 'inline-flex';
});
$('btn-install').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (outcome === 'accepted') $('btn-install').style.display = 'none';
});
window.addEventListener('appinstalled', () => {
  $('btn-install').style.display = 'none';
});

// Arranque
initWorker();
