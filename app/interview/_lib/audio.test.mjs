import assert from 'node:assert/strict';
import test from 'node:test';

import { pcm16,PcmResampler } from '../../../public/worklets/pcm-resampler.js';

import { withSpeechTranscript } from './speech-text.ts';

function resample(input, rate, blocks) {
  const converter = new PcmResampler(rate);
  const samples = [];
  let offset = 0;
  let index = 0;
  while (offset < input.length) {
    const end = Math.min(input.length, offset + blocks[index % blocks.length]);
    samples.push(...converter.push(input.subarray(offset, end)));
    offset = end;
    index += 1;
  }
  samples.push(...converter.flush());
  return samples;
}

for (const rate of [44100, 48000]) {
  test(`continuous ${rate}Hz resampling preserves phase across changing render quanta`, () => {
    const input = Float32Array.from(
      { length: rate * 2 + 113 },
      (_, index) => Math.sin((index * 2 * Math.PI * 437) / rate) * 0.8,
    );
    const whole = resample(input, rate, [input.length]);
    const streamed = resample(input, rate, [128, 256, 1, 37, 512, 73]);
    assert.equal(streamed.length, Math.ceil((input.length * 16000) / rate));
    assert.equal(streamed.length, whole.length);
    for (let i = 0; i < whole.length; i += 1)
      assert.ok(Math.abs(streamed[i] - whole[i]) < 1e-6, `sample ${i} drifted`);
  });
}

test('resampler flush preserves the last fractional sample and is idempotent', () => {
  const converter = new PcmResampler(44100);
  assert.deepEqual(
    [...converter.push(Float32Array.from([0.2, 0.4, 0.8]))].map((value) =>
      Math.round(value * 10),
    ),
    [2],
  );
  assert.deepEqual(
    [...converter.flush()].map((value) => Math.round(value * 10)),
    [8],
  );
  assert.equal(converter.flush().length, 0);
  assert.throws(() => converter.push(new Float32Array([1])), /already flushed/);
});

test('PCM conversion clips unsafe amplitudes and silences nonfinite samples', () => {
  assert.deepEqual(
    [-2, -1, -0.5, 0, 0.5, 1, 2, NaN, Infinity].map(pcm16),
    [-32768, -32768, -16384, 0, 16384, 32767, 32767, 0, 0],
  );
});

test('cumulative transcript revisions and final text replace one suffix without duplicate prefixes', () => {
  const prefix = '직접 작성한 메모';
  assert.equal(withSpeechTranscript(prefix, '첫 답').text, `${prefix}\n첫 답`);
  assert.equal(
    withSpeechTranscript(prefix, '첫 답변입니다. 두 번째 답변입니다.').text,
    `${prefix}\n첫 답변입니다. 두 번째 답변입니다.`,
  );
  assert.equal(withSpeechTranscript(prefix, '').text, prefix);
  assert.equal(
    withSpeechTranscript(`${prefix}\n`, '수정된 답변').text,
    `${prefix}\n수정된 답변`,
  );
  assert.deepEqual(withSpeechTranscript('가'.repeat(5998), '나나나'), {
    text: '가'.repeat(5998) + '\n나',
    truncated: true,
  });
});

test('worklet batches mono PCM, flushes its short tail before acknowledgment, and outputs silence', async (t) => {
  const oldProcessor = globalThis.AudioWorkletProcessor;
  const oldRegister = globalThis.registerProcessor;
  const oldRate = globalThis.sampleRate;
  let Processor;
  globalThis.AudioWorkletProcessor = class {
    constructor() {
      this.messages = [];
      this.port = {
        onmessage: null,
        postMessage: (message) => this.messages.push(message),
      };
    }
  };
  globalThis.registerProcessor = (name, processor) => {
    assert.equal(name, 'mea-pcm-capture');
    Processor = processor;
  };
  globalThis.sampleRate = 48000;
  try {
    await import('../../../public/worklets/pcm-capture.js');
    await t.test(
      '100ms frames plus a short final tail have the exact sample count and little-endian values',
      () => {
        const processor = new Processor();
        const output = [Float32Array.from({ length: 128 }, () => 1)];
        let count = 0;
        while (count < 5000) {
          const size = Math.min(128, 5000 - count);
          processor.process(
            [[Float32Array.from({ length: size }, () => 0.5)]],
            [output],
          );
          count += size;
        }
        assert.equal(processor.messages.length, 1);
        assert.equal(processor.messages[0].buffer.byteLength, 3200);
        processor.port.onmessage({ data: { type: 'flush' } });
        const pcm = processor.messages.filter(
          (message) => message.type === 'pcm',
        );
        assert.equal(
          pcm.reduce((sum, message) => sum + message.buffer.byteLength / 2, 0),
          Math.ceil(5000 / 3),
        );
        assert.deepEqual(
          processor.messages.map((message) => message.type),
          ['pcm', 'pcm', 'flushed'],
        );
        assert.equal(new DataView(pcm[0].buffer).getInt16(0, true), 16384);
        assert.equal(
          output[0].every((value) => value === 0),
          true,
        );
        assert.equal(processor.process([], [[]]), false);
      },
    );
    await t.test('stereo is averaged before resampling', () => {
      const processor = new Processor();
      processor.process(
        [[new Float32Array(480).fill(1), new Float32Array(480).fill(-1)]],
        [[new Float32Array(480)]],
      );
      processor.port.onmessage({ data: { type: 'flush' } });
      const buffer = processor.messages.find(
        (message) => message.type === 'pcm',
      ).buffer;
      assert.equal(buffer.byteLength, 320);
      assert.equal(
        new Uint8Array(buffer).every((value) => value === 0),
        true,
      );
    });
    await t.test(
      '120 second sample budget stops growth and emits one limit event',
      () => {
        const processor = new Processor();
        processor.total = 120 * 16000 - 5;
        processor.process(
          [[new Float32Array(480).fill(0.2)]],
          [[new Float32Array(480)]],
        );
        processor.process(
          [[new Float32Array(480).fill(0.2)]],
          [[new Float32Array(480)]],
        );
        processor.port.onmessage({ data: { type: 'flush' } });
        assert.equal(processor.total, 120 * 16000);
        assert.equal(
          processor.messages.filter((message) => message.type === 'limit')
            .length,
          1,
        );
        assert.equal(
          processor.messages
            .filter((message) => message.type === 'pcm')
            .reduce((sum, message) => sum + message.buffer.byteLength, 0),
          10,
        );
      },
    );
  } finally {
    globalThis.AudioWorkletProcessor = oldProcessor;
    globalThis.registerProcessor = oldRegister;
    globalThis.sampleRate = oldRate;
  }
});
