import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTypeScript } from './helpers/load-typescript.mjs';
import { speechSessionFixture } from './helpers/speech-session-fixture.mjs';

const { isAgentCoreSpeechSessionUrl } = loadTypeScript(
  new URL('../lib/speech-session-url.ts', import.meta.url),
);
const { requestSpeechSession, SpeechSessionError } = loadTypeScript(
  new URL('../app/interview/_lib/speech-session.ts', import.meta.url),
);

test('origin-bound runtime connection validation keeps static URL credential protections intact', () => {
  assert.equal(isAgentCoreSpeechSessionUrl(speechSessionFixture()), true);
  const changes = [
    (url) => (url.hostname = 'other.example.com'),
    (url) => (url.protocol = 'ws:'),
    (url) => (url.username = 'private'),
    (url) => (url.hash = 'private'),
    (url) => url.searchParams.set('X-Amz-Expires', '300'),
    (url) => url.searchParams.set('X-Amz-SignedHeaders', 'host'),
    (url) =>
      url.searchParams.set(
        'X-Amzn-Bedrock-AgentCore-Runtime-Custom-Speech-Origin',
        'https://other.example.com',
      ),
    (url) => url.searchParams.set('key', 'private'),
    (url) => url.searchParams.append('X-Amz-Date', 'duplicate'),
    (url) => (url.pathname = '/runtimes/not-an-arn/ws'),
  ];
  for (const change of changes) {
    const url = new URL(speechSessionFixture());
    change(url);
    assert.equal(isAgentCoreSpeechSessionUrl(url.toString()), false);
  }
});

test('each recording obtains a fresh temporary URL and preserves cancellation signal', async () => {
  const urls = [
    speechSessionFixture(),
    speechSessionFixture('12345678-90ab-4cde-8fab-0123456789ab'),
  ];
  const abort = new AbortController();
  let calls = 0;
  const fetcher = async (url, options) => {
    assert.equal(url, '/api/interview/speech/session');
    assert.equal(options.method, 'POST');
    assert.equal(options.body, '{}');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, abort.signal);
    return Response.json({ websocket_url: urls[calls++], expires_in: 60 });
  };
  assert.equal(await requestSpeechSession(abort.signal, fetcher), urls[0]);
  assert.equal(await requestSpeechSession(abort.signal, fetcher), urls[1]);
  assert.equal(calls, 2);
});

test('unavailable or malformed session responses never expose provider details or URLs', async () => {
  for (const fetcher of [
    async () => {
      throw new Error('PRIVATE_PROVIDER_URL');
    },
    async () =>
      Response.json({ detail: 'PRIVATE_PROVIDER_URL' }, { status: 403 }),
    async () =>
      Response.json({
        websocket_url: 'wss://other.test/?PRIVATE_PROVIDER_URL',
        expires_in: 60,
      }),
    async () =>
      Response.json({ websocket_url: speechSessionFixture(), expires_in: 300 }),
  ]) {
    await assert.rejects(
      requestSpeechSession(new AbortController().signal, fetcher),
      (error) =>
        error instanceof SpeechSessionError &&
        !/PRIVATE_PROVIDER_URL|X-Amz/.test(error.message),
    );
  }
});
