import assert from 'node:assert/strict';
import test from 'node:test';

import { recorderHookRuntime } from '../../../tests/helpers/recorder-hook-runtime.mjs';
import { speechSessionFixture } from '../../../tests/helpers/speech-session-fixture.mjs';

test('a new signed connection is requested for every recording rather than retained from page preparation', async (t) => {
  const h = recorderHookRuntime();
  t.after(() => h.dispose());
  assert.equal(h.requests.length, 0);
  const first = h.act((view) => view.start());
  await h.settle();
  assert.equal(h.requests.length, 1);
  h.requests[0].respond({
    websocket_url: speechSessionFixture(),
    expires_in: 60,
  });
  await first;
  await h.settle();
  assert.equal(h.view.recording, true);
  assert.equal(h.sessions[0].options.agentCoreSession, true);
  h.sessions[0].options.onComplete('합성 인식 문장');
  await h.settle();
  assert.deepEqual(h.texts, ['합성 인식 문장']);
  const second = h.act((view) => view.start());
  await h.settle();
  assert.equal(h.requests.length, 2);
  const fresh = speechSessionFixture('12345678-90ab-4cde-8fab-0123456789ab');
  h.requests[1].respond({ websocket_url: fresh, expires_in: 60 });
  await second;
  await h.settle();
  assert.equal(h.sessions[1].options.url, fresh);
});

test('leaving the question during session preparation aborts issuance and stops the granted microphone', async (t) => {
  const h = recorderHookRuntime();
  t.after(() => h.dispose());
  const pending = h.act((view) => view.start());
  await h.settle();
  assert.equal(h.microphones[0].track.stopped, false);
  h.disable();
  await pending;
  await h.settle();
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.microphones[0].track.stopped, true);
  assert.equal(h.sessions.length, 0);
  assert.equal(h.view.error, '');
});

test('malformed session data releases the microphone and exposes no signed-provider details', async (t) => {
  const h = recorderHookRuntime();
  t.after(() => h.dispose());
  const pending = h.act((view) => view.start());
  await h.settle();
  h.requests[0].respond({
    websocket_url: 'wss://other.test/?SYNTHETIC_PRIVATE',
    expires_in: 60,
  });
  await pending;
  await h.settle();
  assert.equal(h.microphones[0].track.stopped, true);
  assert.equal(h.sessions.length, 0);
  assert.match(h.view.error, /실시간 음성 연결/);
  assert.doesNotMatch(h.view.error, /SYNTHETIC_PRIVATE/);
});

test('session-only recognition never starts batch audio on a browser without AudioWorklet', async (t) => {
  const h = recorderHookRuntime({ workletSupported: false });
  t.after(() => h.dispose());
  await h.act((view) => view.start());
  await h.settle();
  assert.equal(h.microphones.length, 0);
  assert.equal(h.requests.length, 0);
  assert.match(h.view.error, /채팅으로 답변/);
});
