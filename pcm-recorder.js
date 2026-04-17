// AudioWorklet: captura Float32 PCM del micro y lo envía al hilo principal.
class PcmRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length > 0) {
      this.port.postMessage(ch.slice());
    }
    return true;
  }
}
registerProcessor('pcm-recorder', PcmRecorder);
