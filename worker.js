// =============================================================
// Worker: carga Whisper (Transformers.js) y transcribe audio
// =============================================================

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

// Permitir descarga desde HF hub
env.allowLocalModels = false;
env.allowRemoteModels = true;

let transcriber = null;
let currentModel = null;
let busy = false;
const queue = [];

// ---- Mensajes desde el hilo principal ----
self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'load') {
    await loadModel(msg.model);
  } else if (msg.type === 'transcribe') {
    queue.push(msg);
    processQueue();
  }
};

// =============================================================
// Carga del modelo
// =============================================================
async function loadModel(model) {
  try {
    if (currentModel === model && transcriber) {
      self.postMessage({ type: 'ready' });
      return;
    }
    transcriber = null;
    currentModel = model;

    // Intentamos WebGPU primero si está disponible (mucho más rápido)
    const device = await detectDevice();

    transcriber = await pipeline('automatic-speech-recognition', model, {
      device,
      dtype: device === 'webgpu' ? 'fp16' : 'q8', // q8 = cuantizado 8-bit (menos memoria)
      progress_callback: (data) => {
        // data puede tener: { status, name, file, progress, loaded, total }
        self.postMessage({
          type: 'progress',
          status: data.status,
          file: data.file || data.name || '',
          progress: data.progress,
          loaded: data.loaded,
          total: data.total,
        });
      },
    });

    self.postMessage({ type: 'ready' });
  } catch (err) {
    console.error('Error cargando modelo:', err);
    // Fallback: si falla con WebGPU, intentar CPU
    try {
      transcriber = await pipeline('automatic-speech-recognition', model, {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: (data) => {
          self.postMessage({
            type: 'progress',
            status: data.status,
            file: data.file || data.name || '',
            progress: data.progress,
            loaded: data.loaded,
            total: data.total,
          });
        },
      });
      self.postMessage({ type: 'ready' });
    } catch (err2) {
      self.postMessage({
        type: 'error',
        error: `No se pudo cargar el modelo: ${err2.message || err2}`
      });
    }
  }
}

async function detectDevice() {
  try {
    if ('gpu' in navigator) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    }
  } catch {}
  return 'wasm';
}

// =============================================================
// Transcripción
// =============================================================
async function processQueue() {
  if (busy) return;
  if (queue.length === 0) return;
  if (!transcriber) return;

  // Para las previews, siempre nos quedamos con la más reciente y descartamos las anteriores
  let job = queue.shift();
  while (job.isPreview && queue.length > 0 && queue[0].isPreview) {
    job = queue.shift();
  }

  busy = true;
  try {
    const audio = new Float32Array(job.audio);

    const options = {
      language: 'spanish',
      task: 'transcribe',
      return_timestamps: false,
      chunk_length_s: 30,
      stride_length_s: 5,
    };

    const output = await transcriber(audio, options);
    const text = Array.isArray(output) ? output.map(o => o.text).join(' ') : (output.text || '');

    self.postMessage({
      type: 'transcription',
      text,
      isPreview: !!job.isPreview,
    });
  } catch (err) {
    console.error('Error de transcripción:', err);
    self.postMessage({
      type: 'transcription',
      text: job.isPreview ? '' : `[Error al transcribir: ${err.message || err}]`,
      isPreview: !!job.isPreview,
    });
  } finally {
    busy = false;
    if (queue.length > 0) processQueue();
  }
}
