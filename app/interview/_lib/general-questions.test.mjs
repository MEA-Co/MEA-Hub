import assert from 'node:assert/strict';
import test from 'node:test';

import { streamInterview } from './stream.ts';
import {
  FOCUS_LABELS,
  formatResultText,
  GENERAL_TOPIC_LABELS,
  questionTypeLabel,
  resultForExport,
  turnFromQuestion,
} from './types.ts';

const baseStrategy = {
  version: 'video-2026-10-27',
  source: 'general',
  activity_id: null,
  circumstance_id: null,
  general_topic: 'failure_experience',
  mix_seed: '0123456789abcdef0123456789abcdef',
  focus: 'problem_solving',
  depth: 0,
};
const question = {
  text: '결과가 예상과 달랐던 경험이 있다면 하나 설명해 주세요.',
  kind: 'activity',
  strategy: baseStrategy,
};

test('all four independent experience roots have student-readable labels', () => {
  assert.deepEqual(GENERAL_TOPIC_LABELS, {
    meaningful_activity: '의미 있었던 활동',
    failure_experience: '실패 경험',
    collaboration_conflict: '협력·갈등 해결',
    leadership: '리더십 경험',
  });
  for (const [topic, label] of Object.entries(GENERAL_TOPIC_LABELS))
    assert.equal(
      questionTypeLabel({
        kind: 'activity',
        strategy: { ...baseStrategy, general_topic: topic },
      }),
      label,
    );
  assert.equal(
    Object.keys(FOCUS_LABELS).length,
    12,
    'experience sources must not expand the established focus vocabulary',
  );
});

test('experience followups show their focus and keep their independent source', () => {
  const followup = {
    ...question,
    strategy: { ...baseStrategy, depth: 2, focus: 'reflection_change' },
  };
  const turn = turnFromQuestion(
    followup,
    '그 뒤에는 핵심 조건부터 확인하며 판단 기준을 바꿨습니다.',
  );
  assert.equal(questionTypeLabel(turn), '경험 꼬리질문 · 배움과 변화');
  assert.deepEqual(turn.strategy, followup.strategy);
  assert.equal(turn.strategy.activity_id, null);
});

test('automatic general questions roundtrip through answer and unfinished-question finish without a setting flag', async () => {
  const previous = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return new Response(
      `data: ${JSON.stringify({ type: 'question', question, mode: 'live' })}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  };
  try {
    const settings = {
      duration_minutes: 10,
      show_timer: true,
      ask_self_introduction: true,
      ask_motivation: false,
      ask_final_remarks: true,
    };
    const common = {
      settings,
      activities: [],
      consent: true,
      elapsed_seconds: 120,
    };
    let received;
    await streamInterview(
      { ...common, action: 'start', history: [] },
      new AbortController().signal,
      (event) => {
        received = event.question;
      },
    );
    const turn = turnFromQuestion(
      received,
      '목록에 없는 개인 프로젝트에서 기능을 너무 많이 넣으려다 핵심 동작을 놓친 적이 있습니다.',
    );
    await streamInterview(
      { ...common, action: 'answer', history: [turn] },
      new AbortController().signal,
      () => {},
    );
    await streamInterview(
      {
        ...common,
        action: 'finish',
        history: [turn],
        current_question: received,
        finish_reason: 'manual',
      },
      new AbortController().signal,
      () => {},
    );
    assert.equal(
      requests.every(
        (request) => !('include_general_questions' in request.settings),
      ),
      true,
    );
    assert.deepEqual(requests[1].history[0].strategy, baseStrategy);
    assert.equal(
      requests[1].history[0].strategy.mix_seed,
      baseStrategy.mix_seed,
    );
    assert.deepEqual(requests[2].current_question.strategy, baseStrategy);
    assert.equal(
      requests[2].current_question.strategy.mix_seed,
      baseStrategy.mix_seed,
    );
  } finally {
    globalThis.fetch = previous;
  }
});

test('result exports retain experience topics and distinguish roots from followups', () => {
  const turns = [
    turnFromQuestion(question, '예상과 달랐던 경험을 설명했습니다.'),
    turnFromQuestion(
      {
        ...question,
        strategy: { ...baseStrategy, focus: 'limitations', depth: 1 },
      },
      '적용 조건을 더 확인해야 한다고 생각했습니다.',
    ),
  ];
  const result = {
    summary: '판단을 바꾼 과정을 한 사례로 더 구체화해보세요.',
    turns,
    finish_reason: 'manual',
    elapsed_seconds: 180,
  };
  const exported = resultForExport(result);
  assert.equal(exported.turns[0].question_type, '실패 경험');
  assert.equal(exported.turns[1].question_type, '경험 꼬리질문 · 한계와 보완');
  assert.deepEqual(exported.turns[1].strategy, turns[1].strategy);
  assert.match(formatResultText(result), /질문 유형: 실패 경험/);
  assert.match(
    formatResultText(result),
    /질문 유형: 경험 꼬리질문 · 한계와 보완/,
  );
});
