// =============================================================
// Voz - Transcriptor en español
// Lógica principal del hilo de UI
// =============================================================

// ---- Estado global ----
const state = {
  worker: null,
  modelReady: false,
  currentModel: null,
  selectedModel: localStorage.getItem('voz.model') || 'Xenova/whisper-small',
  mediaStream: null,
  mediaRecorder: null,
  audioChunks: [],
  audioContext: null,
  analyser: null,
  startTime: 0,
  timerInterval: null,
  waveformInterval: null,
  previewInterval: null,
  previewBusy: false,
  lastPreviewText: '',
  finalText: '',
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
// Worker (carga del modelo Whisper)
// =============================================================
function initWorker() {
  state.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

  state.worker.onmessage = (e) => {
    const msg = e.data;
    switch (msg.type) {
      case 'progress':
        onModelProgress(msg);
        break;
      case 'ready':
        onModelReady();
        break;
      case 'transcription':
        onTranscription(msg);
        break;
      case 'error':
        onWorkerError(msg);
        break;
    }
  };

  loadModel(state.selectedModel);
}

function loadModel(model) {
  state.modelReady = false;
  state.currentModel = model;
  showScreen('loading');
  $('loading-title').textContent = 'Preparando el motor de transcripción';
  $('progress-bar').style.width = '0%';
  $('progress-label').textContent = 'Iniciando…';
  $('model-select').disabled = true;

  state.worker.postMessage({ type: 'load', model });
}

function onModelProgress(msg) {
  // msg: { status, file, progress, loaded, total }
  const { status, file, progress, loaded, total } = msg;

  if (status === 'initiate' || status === 'download') {
    $('progress-label').textContent = `Descargando ${file || 'modelo'}…`;
  } else if (status === 'progress') {
    if (typeof progress === 'number') {
      $('progress-bar').style.width = `${Math.min(100, progress)}%`;
    }
    if (loaded && total) {
      const mb = (loaded / 1024 / 1024).toFixed(1);
      const totalMb = (total / 1024 / 1024).toFixed(1);
      $('progress-label').textContent = `Descargando… ${mb} MB / ${totalMb} MB`;
    }
  } else if (status === 'done') {
    $('progress-label').textContent = `Listo: ${file || ''}`;
  } else if (status === 'loading') {
    $('progress-bar').style.width = '100%';
    $('progress-label').textContent = 'Cargando modelo en memoria…';
  }
}

function onModelReady() {
  state.modelReady = true;
  $('model-select').disabled = false;
  showScreen('idle');
}

function onWorkerError(msg) {
  console.error('Worker error:', msg.error);
  $('loading-title').textContent = 'Ha ocurrido un problema';
  $('progress-label').textContent = msg.error || 'Error desconocido al cargar el modelo.';
}

// =============================================================
// Grabación
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

  // Audio context para analyser (ondas) y para decodificar luego
  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = state.audioContext.createMediaStreamSource(state.mediaStream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 64;
  source.connect(state.analyser);

  // MediaRecorder captura en chunks
  const mime = pickMime();
  state.audioChunks = [];
  state.mediaRecorder = new MediaRecorder(state.mediaStream, { mimeType: mime });

  state.mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) state.audioChunks.push(e.data);
  };

  state.mediaRecorder.onstop = onRecordingStopped;

  // Timeslice: recibir datos cada 1s → permite preview periódica
  state.mediaRecorder.start(1000);

  state.startTime = Date.now();
  state.lastPreviewText = '';
  $('preview-text').textContent = 'Empieza a hablar. La vista previa aparecerá en unos segundos…';
  $('preview-text').classList.add('empty');
  $('rec-time').textContent = '00:00';

  setupWaveform();
  state.timerInterval = setInterval(updateTimer, 250);
  state.previewInterval = setInterval(requestPreview, 12000); // cada 12s

  showScreen('recording');
}

function pickMime() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
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

async function requestPreview() {
  if (state.previewBusy) return;
  if (state.audioChunks.length === 0) return;
  // Evitar previews pesadas en grabaciones muy largas (>15 min)
  const elapsedMin = (Date.now() - state.startTime) / 60000;
  if (elapsedMin > 15) {
    $('preview-text').textContent = 'Grabación larga en curso. La transcripción completa se mostrará al finalizar.';
    $('preview-text').classList.remove('empty');
    return;
  }

  state.previewBusy = true;
  $('preview-working').style.display = 'inline-block';
  $('preview-working-text').style.display = 'inline';

  try {
    const audioData = await blobChunksToFloat32(state.audioChunks);
    if (audioData && audioData.length > 16000) { // al menos 1s
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
  } catch (err) {
    console.warn('Preview error:', err);
    state.previewBusy = false;
    $('preview-working').style.display = 'none';
    $('preview-working-text').style.display = 'none';
  }
}

function stopRecording() {
  if (!state.mediaRecorder) return;
  clearInterval(state.timerInterval);
  clearInterval(state.waveformInterval);
  clearInterval(state.previewInterval);
  state.finalDuration = Math.floor((Date.now() - state.startTime) / 1000);
  try {
    state.mediaRecorder.stop();
  } catch {}
}

async function onRecordingStopped() {
  // Liberar micrófono
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
  }

  showScreen('processing');
  $('processing-detail').textContent = estimatedTimeText(state.finalDuration);

  try {
    const audioData = await blobChunksToFloat32(state.audioChunks);
    if (!audioData || audioData.length < 16000) {
      showError('La grabación es demasiado corta. Inténtalo de nuevo.');
      showScreen('idle');
      return;
    }
    state.worker.postMessage({
      type: 'transcribe',
      audio: audioData,
      isPreview: false,
    }, [audioData.buffer]);
  } catch (err) {
    console.error('Decode error:', err);
    showError('No se pudo procesar el audio grabado.');
    showScreen('idle');
  }
}

function estimatedTimeText(durationSecs) {
  // Estimación muy aproximada según modelo
  const factor = state.currentModel.includes('medium') ? 0.25
               : state.currentModel.includes('small') ? 0.12
               : 0.07;
  const estSecs = Math.max(10, Math.round(durationSecs * factor));
  if (estSecs < 60) return `Esto puede tardar unos ${estSecs} segundos.`;
  const mins = Math.round(estSecs / 60);
  return `Esto puede tardar alrededor de ${mins} ${mins === 1 ? 'minuto' : 'minutos'}.`;
}

function onTranscription(msg) {
  // msg: { text, isPreview }
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
    displayResult();
  }
}

function displayResult() {
  $('result-text').textContent = state.finalText || '(Sin texto transcrito)';
  const mm = String(Math.floor(state.finalDuration / 60)).padStart(2, '0');
  const ss = String(state.finalDuration % 60).padStart(2, '0');
  const modelLabel = state.currentModel.split('/').pop();
  $('result-meta').textContent = `${mm}:${ss} · modelo ${modelLabel}`;
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
// Decodificación de audio: Blob(WebM) → Float32Array a 16kHz mono
// =============================================================
async function blobChunksToFloat32(chunks) {
  const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
  const arrayBuffer = await blob.arrayBuffer();
  const tmpCtx = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuffer;
  try {
    audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    tmpCtx.close();
  }

  // Mono
  const channel = audioBuffer.numberOfChannels > 1
    ? mixToMono(audioBuffer)
    : audioBuffer.getChannelData(0);

  // Resample a 16000 Hz si hace falta
  const targetRate = 16000;
  if (audioBuffer.sampleRate === targetRate) return new Float32Array(channel);

  return resampleLinear(channel, audioBuffer.sampleRate, targetRate);
}

function mixToMono(buffer) {
  const len = buffer.length;
  const out = new Float32Array(len);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] += data[i];
  }
  for (let i = 0; i < len; i++) out[i] /= buffer.numberOfChannels;
  return out;
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

// Arranque
initWorker();
