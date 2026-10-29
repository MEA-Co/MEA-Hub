import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTypeScript } from './helpers/load-typescript.mjs';
import { speechSessionFixture } from './helpers/speech-session-fixture.mjs';

const { proxyInterview, coreBaseUrl } = loadTypeScript(
  new URL('../lib/server/interview-proxy.ts', import.meta.url),
);
const originalFetch = globalThis.fetch;
const originalUrl = process.env.CORE_API_URL;
const legacyUrl = process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
const originalWsUrl = process.env.INTERVIEW_SPEECH_WS_URL;
const encoder = new TextEncoder();

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.CORE_API_URL;
  else process.env.CORE_API_URL = originalUrl;
  if (legacyUrl === undefined) delete process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
  else process.env.NEXT_PUBLIC_BACKEND_ORIGIN = legacyUrl;
  if (originalWsUrl === undefined) delete process.env.INTERVIEW_SPEECH_WS_URL;
  else process.env.INTERVIEW_SPEECH_WS_URL = originalWsUrl;
});

function request(body = '{}', contentType = 'application/json') {
  process.env.CORE_API_URL = 'http://core.test';
  return new Request('http://hub.test/api/interview/stream', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
}

test('uses existing backend setting and rejects credentials in URL', () => {
  delete process.env.CORE_API_URL;
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN = 'https://core.test/';
  assert.equal(coreBaseUrl(), 'https://core.test');
  process.env.CORE_API_URL = 'https://user:secret@core.test';
  assert.throws(() => coreBaseUrl());
});

test('forwards incremental SSE without waiting for completion', async () => {
  let controller;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://core.test/api/interview/stream');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(new TextDecoder().decode(options.body), '{}');
    return new Response(
      new ReadableStream({
        start(c) {
          controller = c;
          c.enqueue(encoder.encode('data: {"type":"token","token":"첫"}\n\n'));
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  };
  const response = await proxyInterview(request(), 'stream');
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /첫/);
  controller.enqueue(encoder.encode('data: {"type":"question"}\n\n'));
  controller.close();
  assert.match(
    new TextDecoder().decode((await reader.read()).value),
    /question/,
  );
  assert.equal((await reader.read()).done, true);
  assert.match(response.headers.get('Cache-Control'), /no-transform/);
});

test('does not relay validation bodies containing submitted student data', async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ detail: [{ input: 'PRIVATE_STUDENT_TEXT' }] }),
      { status: 422 },
    );
  const response = await proxyInterview(request(), 'stream');
  assert.equal(response.status, 422);
  const text = await response.text();
  assert.doesNotMatch(text, /PRIVATE_STUDENT_TEXT/);
  assert.match(text, /10개/);
});

test('rejects raw record file uploads on interview stream', async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error();
  };
  const response = await proxyInterview(
    request('PDF', 'application/pdf'),
    'stream',
  );
  assert.equal(response.status, 415);
  assert.equal(called, false);
});

test('rejects malformed JSON and oversized submissions before forwarding', async () => {
  globalThis.fetch = async () => {
    throw new Error('must not call');
  };
  assert.equal(
    (await proxyInterview(request('{broken'), 'stream')).status,
    400,
  );
  assert.equal(
    (await proxyInterview(request('x'.repeat(512 * 1024 + 1)), 'stream'))
      .status,
    413,
  );
});

test('blocks requests originating from another website', async () => {
  process.env.CORE_API_URL = 'http://core.test';
  const incoming = new Request('http://hub.test/api/interview/stream', {
    method: 'POST',
    headers: {
      Origin: 'http://other.test',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  assert.equal((await proxyInterview(incoming, 'stream')).status, 403);
});

test('allows browser Host when Next reconstructs an internal listener URL', async () => {
  process.env.CORE_API_URL = 'http://core.test';
  globalThis.fetch = async () =>
    new Response('data: {"type":"question"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  const incoming = new Request('http://localhost:3100/api/interview/stream', {
    method: 'POST',
    headers: {
      Host: '127.0.0.1:3100',
      Origin: 'http://127.0.0.1:3100',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const response = await proxyInterview(incoming, 'stream');
  assert.equal(response.status, 200);
  await response.text();
});

test('allows HTTPS public Host behind an HTTP listener', async () => {
  process.env.CORE_API_URL = 'http://core.test';
  globalThis.fetch = async () =>
    new Response('data: {"type":"question"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  const incoming = new Request('http://localhost:3000/api/interview/stream', {
    method: 'POST',
    headers: {
      Host: 'hub.example.com',
      Origin: 'https://hub.example.com',
      'X-Forwarded-Proto': 'https',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const response = await proxyInterview(incoming, 'stream');
  assert.equal(response.status, 200);
  await response.text();
});

test('capabilities are uncached JSON and contain no forwarded browser headers', async () => {
  process.env.CORE_API_URL = 'http://core.test';
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Cookie, undefined);
    return Response.json({ speech_recognition: false, mode: 'demo' });
  };
  const response = await proxyInterview(
    new Request('http://hub.test/api/interview/capabilities'),
    'capabilities',
  );
  assert.deepEqual(await response.json(), {
    speech_recognition: false,
    mode: 'demo',
  });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('client cancellation aborts upstream generation', async () => {
  let signal;
  let cancelled = false;
  globalThis.fetch = async (_url, options) => {
    signal = options.signal;
    return new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  };
  const response = await proxyInterview(request(), 'stream');
  await response.body.cancel();
  assert.equal(signal.aborted, true);
  assert.equal(cancelled, true);
});

test('upstream failures and mismatched stream types become safe errors', async () => {
  globalThis.fetch = async () => {
    throw new Error('SECRET_PROVIDER_DETAILS');
  };
  let response = await proxyInterview(request(), 'stream');
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /SECRET_PROVIDER_DETAILS/);
  globalThis.fetch = async () => Response.json({ bad: true });
  response = await proxyInterview(request(), 'stream');
  assert.equal(response.status, 502);
});

test('broken upstream SSE emits a readable error event', async () => {
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error('PRIVATE_ERROR'));
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  const response = await proxyInterview(request(), 'stream');
  const text = await response.text();
  assert.match(text, /"type":"error"/);
  assert.doesNotMatch(text, /PRIVATE_ERROR/);
});

test('streaming capabilities expose the public Core websocket path', async () => {
  process.env.CORE_API_URL = 'http://127.0.0.1:8000/';
  delete process.env.INTERVIEW_SPEECH_WS_URL;
  globalThis.fetch = async () =>
    Response.json({
      speech_recognition: true,
      speech_streaming: true,
      mode: 'live',
    });
  const response = await proxyInterview(
    new Request('http://127.0.0.1:3001/api/interview/capabilities'),
    'capabilities',
  );
  assert.deepEqual(await response.json(), {
    speech_recognition: true,
    speech_streaming: true,
    speech_websocket_url: 'ws://127.0.0.1:8000/api/interview/speech',
    mode: 'live',
  });
});

test('configured public WSS address works behind HTTPS Hub and private Core HTTP', async () => {
  process.env.CORE_API_URL = 'http://private-core:8000';
  process.env.INTERVIEW_SPEECH_WS_URL =
    'wss://speech.example.com/api/interview/speech';
  globalThis.fetch = async () =>
    Response.json({ speech_recognition: true, speech_streaming: true });
  const response = await proxyInterview(
    new Request('http://localhost:3000/api/interview/capabilities', {
      headers: { 'x-forwarded-proto': 'https' },
    }),
    'capabilities',
  );
  assert.equal(
    (await response.json()).speech_websocket_url,
    'wss://speech.example.com/api/interview/speech',
  );
});

test('HTTPS Hub never advertises mixed-content WS; batch recognition remains available', async () => {
  process.env.CORE_API_URL = 'http://private-core:8000';
  delete process.env.INTERVIEW_SPEECH_WS_URL;
  globalThis.fetch = async () =>
    Response.json({ speech_recognition: true, speech_streaming: true });
  const response = await proxyInterview(
    new Request('https://hub.example.com/api/interview/capabilities'),
    'capabilities',
  );
  assert.deepEqual(await response.json(), {
    speech_recognition: true,
    speech_streaming: false,
  });
});

test('websocket credentials, query secrets and unsupported protocols are never exposed', async () => {
  process.env.CORE_API_URL = 'http://core.test';
  globalThis.fetch = async () =>
    Response.json({ speech_recognition: true, speech_streaming: true });
  for (const address of [
    'wss://user:SECRET@core.test/speech',
    'wss://core.test/speech?key=SECRET',
    'https://core.test/speech',
    'wss://core.test/speech#SECRET',
  ]) {
    process.env.INTERVIEW_SPEECH_WS_URL = address;
    const response = await proxyInterview(
      new Request('http://hub.test/api/interview/capabilities'),
      'capabilities',
    );
    const body = await response.json();
    assert.equal(body.speech_streaming, false);
    assert.equal(body.speech_websocket_url, undefined);
    assert.doesNotMatch(JSON.stringify(body), /SECRET/);
  }
});

test('Core base path and TLS protocol are preserved in derived speech address', async () => {
  process.env.CORE_API_URL = 'https://core.example.com/backend';
  delete process.env.INTERVIEW_SPEECH_WS_URL;
  globalThis.fetch = async () =>
    Response.json({ speech_recognition: true, speech_streaming: true });
  const response = await proxyInterview(
    new Request('https://hub.example.com/api/interview/capabilities'),
    'capabilities',
  );
  assert.equal(
    (await response.json()).speech_websocket_url,
    'wss://core.example.com/backend/api/interview/speech',
  );
});

test('session-based streaming does not advertise the Lambda-derived websocket address', async () => {
  process.env.CORE_API_URL = 'https://lambda.example.com';
  process.env.INTERVIEW_SPEECH_WS_URL = 'wss://obsolete.example.com/speech';
  globalThis.fetch = async () =>
    Response.json({
      speech_recognition: false,
      speech_streaming: true,
      speech_session: true,
    });
  const response = await proxyInterview(
    new Request('https://hub.mea.kr/api/interview/capabilities'),
    'capabilities',
  );
  assert.deepEqual(await response.json(), {
    speech_recognition: false,
    speech_streaming: true,
    speech_session: true,
  });
});

test('speech session POST forwards only verified Origin and returns the bounded temporary connection contract', async () => {
  process.env.CORE_API_URL = 'https://core.test';
  const signed = speechSessionFixture();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://core.test/api/interview/speech/session');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Origin, 'https://hub.mea.kr');
    assert.equal(options.headers.Cookie, undefined);
    assert.equal(new TextDecoder().decode(options.body), '{}');
    return Response.json({
      websocket_url: signed,
      expires_in: 60,
      debug: 'PRIVATE_PROVIDER_DETAILS',
    });
  };
  const response = await proxyInterview(
    new Request('https://hub.mea.kr/api/interview/speech/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://hub.mea.kr',
        Cookie: 'PRIVATE_COOKIE',
      },
      body: '{}',
    }),
    'speech/session',
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), {
    websocket_url: signed,
    expires_in: 60,
  });
});

test('speech session rejects cross-origin requests, unexpected input and untrusted signed addresses', async () => {
  process.env.CORE_API_URL = 'https://core.test';
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({
      websocket_url: 'wss://other.test?PRIVATE_SECRET',
      expires_in: 60,
    });
  };
  const incoming = (origin, body = '{}') =>
    new Request('https://hub.mea.kr/api/interview/speech/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body,
    });
  assert.equal(
    (await proxyInterview(incoming('https://other.test'), 'speech/session'))
      .status,
    403,
  );
  assert.equal(
    (
      await proxyInterview(
        incoming('https://hub.mea.kr', '{"audio":"unexpected"}'),
        'speech/session',
      )
    ).status,
    400,
  );
  assert.equal(calls, 0);
  const rejected = await proxyInterview(
    incoming('https://hub.mea.kr'),
    'speech/session',
  );
  assert.equal(rejected.status, 503);
  assert.doesNotMatch(await rejected.text(), /PRIVATE_SECRET/);
});
