/* global AudioWorkletProcessor, registerProcessor, sampleRate */
import { pcm16,PcmResampler } from './pcm-resampler.js';

class MeaPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.resampler = new PcmResampler(sampleRate, 16000);
    this.buffer = new ArrayBuffer(3200);
    this.view = new DataView(this.buffer);
    this.count = 0;
    this.total = 0;
    this.stopped = false;
    this.limit = false;
    this.port.onmessage = (event) => {
      if (event.data?.type !== 'flush' || this.stopped) return;
      this.write(this.resampler.flush());
      this.send();
      this.stopped = true;
      this.port.postMessage({ type: 'flushed' });
    };
  }

  send() {
    if (!this.count) return;
    const buffer =
      this.count === 1600 ? this.buffer : this.buffer.slice(0, this.count * 2);
    this.port.postMessage({ type: 'pcm', buffer }, [buffer]);
    this.buffer = new ArrayBuffer(3200);
    this.view = new DataView(this.buffer);
    this.count = 0;
  }

  write(samples) {
    for (const sample of samples) {
      if (this.total >= 120 * 16000) {
        if (!this.limit) {
          this.limit = true;
          this.port.postMessage({ type: 'limit' });
        }
        break;
      }
      this.view.setInt16(this.count * 2, pcm16(sample), true);
      this.count += 1;
      this.total += 1;
      if (this.count === 1600) this.send();
    }
  }

  process(inputs, outputs) {
    for (const channel of outputs[0] ?? []) channel.fill(0);
    if (this.stopped) return false;
    const channels = inputs[0];
    if (!this.limit && channels?.length && channels[0].length) {
      const mono = new Float32Array(channels[0].length);
      for (const channel of channels)
        for (let i = 0; i < mono.length; i += 1)
          mono[i] += (channel[i] ?? 0) / channels.length;
      this.write(this.resampler.push(mono));
    }
    return true;
  }
}

registerProcessor('mea-pcm-capture', MeaPcmCapture);
