/** Continuous linear interpolation. The output clock survives every render block. */
export class PcmResampler {
  constructor(sourceRate, targetRate = 16000) {
    if (
      !Number.isFinite(sourceRate) ||
      sourceRate <= 0 ||
      !Number.isFinite(targetRate) ||
      targetRate <= 0
    )
      throw new Error('Invalid audio sample rate');
    this.sourceRate = sourceRate;
    this.targetRate = targetRate;
    this.inputCount = 0;
    this.outputCount = 0;
    this.lastSample = 0;
    this.finished = false;
  }

  push(input) {
    if (this.finished) throw new Error('Audio was already flushed');
    if (!input.length) return new Float32Array();
    const start = this.inputCount;
    const end = start + input.length;
    const output = [];
    while (true) {
      const position = (this.outputCount * this.sourceRate) / this.targetRate;
      const left = Math.floor(position);
      const fraction = position - left;
      if (left >= end || (fraction > 0 && left + 1 >= end)) break;
      const first = left < start ? this.lastSample : input[left - start];
      const second = fraction === 0 ? first : input[left + 1 - start];
      output.push(first + (second - first) * fraction);
      this.outputCount += 1;
    }
    this.inputCount = end;
    this.lastSample = input[input.length - 1];
    return Float32Array.from(output);
  }

  flush() {
    if (this.finished) return new Float32Array();
    this.finished = true;
    const output = [];
    while (
      this.outputCount * this.sourceRate <
      this.inputCount * this.targetRate
    ) {
      output.push(this.lastSample);
      this.outputCount += 1;
    }
    return Float32Array.from(output);
  }
}

export function pcm16(sample) {
  const bounded = Number.isFinite(sample)
    ? Math.max(-1, Math.min(1, sample))
    : 0;
  return Math.round(bounded < 0 ? bounded * 32768 : bounded * 32767);
}
