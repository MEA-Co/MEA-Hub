import assert from 'node:assert/strict';
import test from 'node:test';

import { renderInterviewPage } from '../../../tests/helpers/retry-render.mjs';

for (const stage of ['preparing', 'recording', 'transcribing']) {
  test(`rendered retry and submit buttons both block clicks during microphone ${stage}`, () => {
    const page = renderInterviewPage({ recorder: { [stage]: true } });
    assert.equal(page.button('다시 요청').props.disabled, true);
    assert.equal(page.button('답변 제출').props.disabled, true);
    assert.equal(page.click('다시 요청'), false);
    assert.equal(page.calls.retry, 0);
    assert.equal(page.calls.submit, 0);
  });
}

test('rendered retry button resumes the current answer after microphone finalization', () => {
  const page = renderInterviewPage();
  assert.equal(page.button('다시 요청').props.disabled, false);
  assert.equal(page.click('다시 요청'), true);
  assert.equal(page.calls.retry, 1);
});

test('rendered retry stays blocked during an existing question request', () => {
  const page = renderInterviewPage({ interview: { busy: true } });
  assert.equal(page.button('다시 요청').props.disabled, true);
  assert.equal(page.click('다시 요청'), false);
  assert.equal(page.calls.retry, 0);
});

test('rendered result retry remains available after an evaluation error and microphone cleanup', () => {
  const page = renderInterviewPage({ interview: { ending: true } });
  assert.equal(page.button('결과 정리 다시 요청').props.disabled, false);
  assert.equal(page.click('결과 정리 다시 요청'), true);
  assert.equal(page.calls.retry, 1);
});
