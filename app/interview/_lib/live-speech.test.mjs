import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTypeScript } from '../../../tests/helpers/load-typescript.mjs';
import { speechSessionFixture } from '../../../tests/helpers/speech-session-fixture.mjs';

const { createLiveSpeechSession } = loadTypeScript(
  new URL('./live-speech.ts', import.meta.url),
);

function harness(modulePromise = Promise.resolve(), connection = {}) {
  const events = {
    ready: 0,
    finalizing: 0,
    partials: [],
    complete: [],
    errors: [],
  };
  const track = {
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
  const stream = { getTracks: () => [track] };
  const node = () => ({
    connected: [],
    disconnected: false,
    connect(target) {
      this.connected.push(target);
    },
    disconnect() {
      this.disconnected = true;
    },
  });
  const source = node();
  const gain = { ...node(), gain: { value: 1 } };
  const worklet = {
    ...node(),
    onprocessorerror: null,
    port: {
      onmessage: null,
      requests: [],
      postMessage(message) {
        this.requests.push(message);
      },
    },
  };
  const socket = {
    readyState: 0,
    bufferedAmount: 0,
    sent: [],
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    send(value) {
      this.sent.push(value);
    },
    close() {
      this.readyState = 3;
    },
    open() {
      this.readyState = 1;
      this.onopen?.();
    },
    async deliver(value) {
      await this.onmessage?.({ data: JSON.stringify(value) });
    },
  };
  const context = {
    state: 'running',
    destination: {},
    audioWorklet: { addModule: () => modulePromise },
    createMediaStreamSource: () => source,
    createGain: () => gain,
    resume: async () => undefined,
    async close() {
      this.state = 'closed';
    },
  };
  const session = createLiveSpeechSession(
    {
      url: 'ws://localhost:8100/api/interview/speech',
      ...connection,
      stream,
      onReady: () => {
        events.ready += 1;
      },
      onFinalizing: () => {
        events.finalizing += 1;
      },
      onPartial: (text) => events.partials.push(text),
      onComplete: (text) => events.complete.push(text),
      onError: (message) => events.errors.push(message),
    },
    {
      createSocket: () => socket,
      createContext: () => context,
      createWorklet: () => worklet,
    },
  );
  const start = async () => {
    const promise = session.start();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      source.connected.length,
      0,
      'microphone must wait for provider readiness',
    );
    socket.open();
    await socket.deliver({ type: 'ready' });
    await promise;
  };
  const emit = (message) => worklet.port.onmessage?.({ data: message });
  return {
    session,
    start,
    emit,
    events,
    track,
    socket,
    source,
    gain,
    worklet,
    context,
  };
}

test('streams PCM and cumulative partials before stop; short-tail flush precedes the single stop marker', async () => {
  const h = harness();
  await h.start();
  assert.deepEqual(JSON.parse(h.socket.sent[0]), {
    type: 'start',
    sample_rate: 16000,
    channels: 1,
    format: 'pcm_s16le',
  });
  assert.equal(h.gain.gain.value, 0, 'microphone must never play back');
  assert.equal(h.events.ready, 1);
  h.emit({ type: 'pcm', buffer: new ArrayBuffer(3200) });
  await h.socket.deliver({ type: 'transcript', text: '첫 번째 문장입니다.' });
  assert.deepEqual(h.events.partials, ['첫 번째 문장입니다.']);
  assert.equal(
    h.track.stopped,
    false,
    'partial must arrive with microphone active',
  );
  h.session.stop();
  h.session.stop();
  assert.deepEqual(h.worklet.port.requests, [{ type: 'flush' }]);
  assert.equal(
    h.socket.sent.filter(
      (value) => typeof value === 'string' && JSON.parse(value).type === 'stop',
    ).length,
    0,
  );
  h.emit({ type: 'pcm', buffer: new ArrayBuffer(168) });
  h.emit({ type: 'flushed' });
  assert.equal(h.events.finalizing, 1);
  assert.deepEqual(
    h.socket.sent
      .slice(1)
      .map((value) =>
        typeof value === 'string' ? JSON.parse(value).type : value.byteLength,
      ),
    [3200, 168, 'stop'],
  );
  assert.equal(h.track.stopped, true);
  assert.equal(h.context.state, 'closed');
  await h.socket.deliver({
    type: 'transcript',
    text: '첫 번째 문장입니다. 두 번째 문장입니다.',
  });
  await h.socket.deliver({
    type: 'complete',
    text: '첫 번째 문장입니다. 두 번째 문장입니다.',
  });
  assert.deepEqual(h.events.complete, [
    '첫 번째 문장입니다. 두 번째 문장입니다.',
  ]);
  assert.equal(h.socket.readyState, 3);
  assert.equal(h.events.errors.length, 0);
});

test('backpressure fails safely, stops all audio resources and preserves delivered partials', async () => {
  const h = harness();
  await h.start();
  await h.socket.deliver({ type: 'transcript', text: '여기까지 인식된 문장' });
  h.socket.bufferedAmount = 256 * 1024;
  h.emit({ type: 'pcm', buffer: new ArrayBuffer(3200) });
  assert.equal(h.events.errors.length, 1);
  assert.deepEqual(h.events.partials, ['여기까지 인식된 문장']);
  assert.equal(h.track.stopped, true);
  assert.equal(h.context.state, 'closed');
  assert.equal(h.worklet.disconnected, true);
  assert.equal(h.socket.readyState, 3);
});

test('cancellation suppresses stale websocket/worklet callbacks and closes the microphone immediately', async () => {
  const h = harness();
  await h.start();
  const staleMessage = h.socket.onmessage;
  const stalePcm = h.worklet.port.onmessage;
  h.session.cancel();
  const sentCount = h.socket.sent.length;
  await staleMessage({
    data: JSON.stringify({ type: 'transcript', text: '늦게 도착한 문장' }),
  });
  stalePcm({ data: { type: 'pcm', buffer: new ArrayBuffer(3200) } });
  assert.equal(h.socket.sent.length, sentCount);
  assert.deepEqual(h.events.partials, []);
  assert.equal(h.track.stopped, true);
  assert.equal(h.context.state, 'closed');
  assert.equal(h.events.errors.length, 0);
});

test('an interrupted websocket keeps recognized text and releases resources', async () => {
  const h = harness();
  await h.start();
  await h.socket.deliver({
    type: 'transcript',
    text: '연결 종료 전 인식된 답변',
  });
  h.socket.onclose();
  assert.deepEqual(h.events.partials, ['연결 종료 전 인식된 답변']);
  assert.equal(h.events.complete.length, 0);
  assert.equal(h.events.errors.length, 1);
  assert.equal(h.track.stopped, true);
  assert.equal(h.context.state, 'closed');
});

test('the finalization timeout is bounded and never clears the latest partial', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  await h.start();
  await h.socket.deliver({
    type: 'transcript',
    text: '마지막으로 확인된 문장',
  });
  h.session.stop();
  h.emit({ type: 'flushed' });
  t.mock.timers.tick(20001);
  assert.deepEqual(h.events.partials, ['마지막으로 확인된 문장']);
  assert.match(h.events.errors[0], /시간이 초과/);
  assert.equal(h.track.stopped, true);
  assert.equal(h.socket.readyState, 3);
});

test('capture automatically requests flush at 120 seconds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  await h.start();
  t.mock.timers.tick(120000);
  assert.deepEqual(h.worklet.port.requests, [{ type: 'flush' }]);
  assert.equal(h.events.finalizing, 1);
  assert.equal(h.track.stopped, true);
  h.session.cancel();
});

test('stalled worklet setup has a finite deadline and closes an already-granted microphone', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let release;
  const pendingModule = new Promise((resolve) => {
    release = resolve;
  });
  const h = harness(pendingModule);
  const pending = h.session.start();
  t.mock.timers.tick(15001);
  assert.equal(h.track.stopped, true);
  assert.equal(h.context.state, 'closed');
  release();
  await assert.rejects(pending, /연결하지 못했습니다/);
  assert.equal(h.events.errors.length, 1);
});

test('odd byte PCM frames are rejected before network transmission', async () => {
  const h = harness();
  await h.start();
  h.emit({ type: 'pcm', buffer: new ArrayBuffer(3) });
  assert.equal(
    h.socket.sent.filter((value) => value instanceof ArrayBuffer).length,
    0,
  );
  assert.equal(h.events.errors.length, 1);
  assert.equal(h.track.stopped, true);
});

test('large even worklet frames are split into ordered AgentCore-sized pieces', async () => {
  const h = harness();
  await h.start();
  const frame = new Uint8Array(65536);
  frame.fill(3, 0, 32768);
  frame.fill(7, 32768);
  h.emit({ type: 'pcm', buffer: frame.buffer });
  const sent = h.socket.sent.filter((value) => value instanceof ArrayBuffer);
  assert.deepEqual(
    sent.map((value) => value.byteLength),
    [32768, 32768],
  );
  assert.equal(new Uint8Array(sent[0])[0], 3);
  assert.equal(new Uint8Array(sent[1])[0], 7);
  h.session.cancel();
});

test('only explicitly requested signed sessions can carry origin-bound AWS query signatures', async () => {
  const valid = harness(Promise.resolve(), {
    url: speechSessionFixture(),
    agentCoreSession: true,
  });
  await valid.start();
  valid.session.cancel();
  for (const connection of [
    { url: speechSessionFixture() },
    {
      url: 'wss://other.example.com/ws?key=synthetic-private-key',
      agentCoreSession: true,
    },
  ]) {
    const rejected = harness(Promise.resolve(), connection);
    await assert.rejects(rejected.session.start());
    assert.equal(rejected.track.stopped, true);
    assert.equal(rejected.events.errors.length, 1);
    assert.doesNotMatch(
      rejected.events.errors[0],
      /synthetic-private-key|X-Amz/,
    );
  }
});

test('a managed runtime cold start has its own bounded 45-second readiness budget', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let release;
  const h = harness(
    new Promise((resolve) => {
      release = resolve;
    }),
    { url: speechSessionFixture(), agentCoreSession: true },
  );
  const pending = h.session.start();
  t.mock.timers.tick(15001);
  assert.equal(h.track.stopped, false);
  assert.equal(h.events.errors.length, 0);
  t.mock.timers.tick(30000);
  assert.equal(h.track.stopped, true);
  release();
  await assert.rejects(pending, /연결하지 못했습니다/);
  assert.equal(h.events.errors.length, 1);
});
