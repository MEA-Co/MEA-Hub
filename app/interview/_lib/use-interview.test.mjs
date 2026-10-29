import assert from 'node:assert/strict';
import test from 'node:test';

import { createInterviewHookRuntime } from '../../../tests/helpers/interview-hook-runtime.mjs';
const settings = {
  duration_minutes: 10,
  show_timer: true,
  ask_self_introduction: false,
  ask_motivation: false,
  ask_final_remarks: false,
};
const question = {
  kind: 'activity',
  text: '자료를 비교할 기준을 어떻게 정했나요?',
  strategy: {
    version: 'video-2026-10-27',
    source: 'activity',
    activity_id: 'activity-1',
    focus: 'reasoning_evidence',
    depth: 0,
    mix_seed: '0123456789abcdef0123456789abcdef',
  },
};
const ready = { type: 'question', question, mode: 'live' };

async function start(t, configuredSettings = settings) {
  const hook = createInterviewHookRuntime();
  t.after(() => hook.dispose());
  hook.act((view) => view.start([], configuredSettings));
  await hook.respond(0, [ready]);
  assert.equal(hook.view.busy, false);
  return hook;
}

test('manual finish retries preserve the actual stop time, reason and unsent draft after a long outage', async (t) => {
  const hook = await start(t);
  hook.advance(45);
  hook.act((view) =>
    view.setAnswer(
      '자료를 같은 조건으로 비교할 수 있도록 측정 기간을 맞췄습니다.',
    ),
  );
  hook.act((view) => view.finish('manual'));
  const original = JSON.parse(JSON.stringify(hook.requests[1].payload));
  assert.equal(original.elapsed_seconds, 45);
  assert.equal(original.history.length, 1);
  assert.equal(original.finish_reason, 'manual');
  await hook.fail(1);
  hook.advance(600);
  hook.act((view) => view.retry());
  const retried = JSON.parse(JSON.stringify(hook.requests[2].payload));
  assert.deepEqual(retried, original);
  assert.equal(
    retried.elapsed_seconds,
    45,
    'waiting for the provider is not interview time',
  );
  assert.equal(
    retried.history[0].strategy.mix_seed,
    question.strategy.mix_seed,
  );
});

test('an automatic deadline finish stays at the deadline on retry', async (t) => {
  const hook = await start(t, { ...settings, duration_minutes: 3 });
  hook.act((view) => view.setAnswer('끝나기 전에 작성한 답변을 보존합니다.'));
  hook.advance(180);
  const original = JSON.parse(JSON.stringify(hook.requests[1].payload));
  assert.equal(original.action, 'finish');
  assert.equal(original.finish_reason, 'timeout');
  assert.equal(original.elapsed_seconds, 180);
  await hook.fail(1);
  hook.advance(90);
  hook.act((view) => view.retry());
  assert.deepEqual(
    JSON.parse(JSON.stringify(hook.requests[2].payload)),
    original,
  );
});

test('a failed answer retry still uses the edited draft and the current interview time', async (t) => {
  const hook = await start(t);
  hook.advance(20);
  hook.act((view) => view.setAnswer('먼저 작성한 답변입니다.'));
  hook.act((view) => view.submit());
  await hook.fail(1, '질문 생성 연결이 끊겼습니다.');
  assert.equal(hook.view.answer, '먼저 작성한 답변입니다.');
  hook.advance(30);
  hook.act((view) => view.setAnswer('다시 검토해서 고친 답변입니다.'));
  hook.act((view) => view.retry());
  const payload = hook.requests[2].payload;
  assert.equal(payload.action, 'answer');
  assert.equal(payload.elapsed_seconds, 50);
  assert.equal(payload.history.length, 1);
  assert.equal(payload.history[0].answer, '다시 검토해서 고친 답변입니다.');
  assert.equal(
    payload.history[0].strategy.mix_seed,
    question.strategy.mix_seed,
  );
});

test('an unanswered manual finish preserves current question metadata across retries', async (t) => {
  const hook = await start(t);
  hook.advance(12);
  hook.act((view) => view.finish('manual'));
  await hook.fail(1);
  hook.advance(25);
  hook.act((view) => view.retry());
  const payload = hook.requests[2].payload;
  assert.equal(payload.elapsed_seconds, 12);
  assert.equal(payload.history.length, 0);
  assert.equal(payload.current_question.text, question.text);
  assert.equal(
    payload.current_question.strategy.mix_seed,
    question.strategy.mix_seed,
  );
});

test('target major is snapshotted across start, answer, finish and retries while transitions stay outside answers', async (t) => {
  const hook = createInterviewHookRuntime();
  t.after(() => hook.dispose());
  const majorQuestion = {
    ...question,
    text: '자료구조를 선택할 때 어떤 기준을 생각하나요?',
    transition: '그럼 다음 질문으로 넘어갈게요.',
    strategy: {
      ...question.strategy,
      source: 'major',
      activity_id: null,
      major_topic: 'foundation',
    },
  };
  hook.act((view) => view.start([], settings, null, ' 컴퓨터공학과 '));
  assert.equal(hook.requests[0].payload.target_major, '컴퓨터공학과');
  assert.equal(hook.view.targetMajorSnapshot, '컴퓨터공학과');
  await hook.fail(0);
  hook.act((view) => view.retry());
  assert.equal(hook.requests[1].payload.target_major, '컴퓨터공학과');
  await hook.respond(1, [
    { type: 'question', question: majorQuestion, mode: 'live' },
  ]);
  assert.equal(hook.view.question.transition, majorQuestion.transition);
  hook.act((view) => view.setAnswer('아직 잘 모르겠습니다.'));
  hook.act((view) => view.submit());
  assert.equal(hook.requests[2].payload.target_major, '컴퓨터공학과');
  assert.equal(
    hook.requests[2].payload.history[0].strategy.major_topic,
    'foundation',
  );
  assert.equal(hook.requests[2].payload.history[0].transition, undefined);
  await hook.fail(2);
  hook.act((view) => view.retry());
  assert.equal(hook.requests[3].payload.target_major, '컴퓨터공학과');
  await hook.respond(3, [ready]);
  assert.equal(hook.view.question.transition, undefined);
  hook.act((view) => view.finish('manual'));
  assert.equal(hook.requests[4].payload.target_major, '컴퓨터공학과');
  await hook.fail(4);
  hook.act((view) => view.retry());
  assert.equal(hook.requests[5].payload.target_major, '컴퓨터공학과');
  hook.act((view) => view.reset());
  assert.equal(hook.view.targetMajorSnapshot, undefined);
});

test('legacy hook callers omit target_major and retain a transition only on an unanswered current question', async (t) => {
  const hook = createInterviewHookRuntime();
  t.after(() => hook.dispose());
  const pending = { ...question, transition: '그럼 다음 질문으로 넘어갈게요.' };
  hook.act((view) => view.start([], settings));
  assert.equal(Object.hasOwn(hook.requests[0].payload, 'target_major'), false);
  await hook.respond(0, [
    { type: 'question', question: pending, mode: 'live' },
  ]);
  hook.act((view) => view.finish('manual'));
  assert.equal(
    hook.requests[1].payload.current_question.transition,
    pending.transition,
  );
  assert.equal(Object.hasOwn(hook.requests[1].payload, 'target_major'), false);
});
