import assert from 'node:assert/strict';
import test from 'node:test';

import { streamInterview } from './stream.ts';
import {
  FOCUS_LABELS,
  formatResultText,
  questionTypeLabel,
  resultForExport,
  turnFromQuestion,
} from './types.ts';

const strategy = {
  version: 'video-2026-10-27',
  mix_seed: 'fedcba9876543210fedcba9876543210',
  activity_id: 'activity-7',
  focus: 'counterargument',
  depth: 2,
};
const question = {
  kind: 'activity',
  text: '이 제안과 다른 관점에서는 어떤 한계가 있을까요?',
  strategy,
};
const settings = {
  duration_minutes: 10,
  show_timer: true,
  ask_self_introduction: false,
  ask_motivation: false,
  ask_final_remarks: true,
};
const activities = Array.from({ length: 10 }, (_, index) => ({
  id: `activity-${index + 1}`,
  category: 'subject',
  grade: 2,
  title: `탐구 ${index + 1}`,
  core_content:
    '관찰 자료를 분류하고 기준에 따라 다른 결과를 비교하며 탐구 과정을 정리했다.',
  reflection: '근거를 확인하고 다른 해석 가능성을 검토하는 태도를 배웠다.',
}));
const payload = {
  action: 'start',
  settings,
  activities,
  history: [],
  elapsed_seconds: 0,
  consent: true,
};

async function withServer(event, callback) {
  const previous = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return new Response(`data: ${JSON.stringify(event)}\n\n`, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };
  try {
    await callback(requests);
  } finally {
    globalThis.fetch = previous;
  }
}

test('server question strategy survives streamed reception, answer conversion and wire submission', async () => {
  let received;
  await withServer({ type: 'question', question, mode: 'live' }, async () => {
    await streamInterview(payload, new AbortController().signal, (event) => {
      received = event.question;
    });
  });
  assert.deepEqual(received.strategy, strategy);
  const turn = turnFromQuestion(
    received,
    '불편을 겪을 수 있는 이용자의 관점을 함께 검토해야 한다고 생각합니다.',
  );
  await withServer(
    {
      type: 'question',
      question: {
        ...question,
        strategy: { ...strategy, activity_id: 'activity-8', depth: 0 },
      },
      mode: 'live',
    },
    async (requests) => {
      await streamInterview(
        { ...payload, action: 'answer', history: [turn], elapsed_seconds: 80 },
        new AbortController().signal,
        () => {},
      );
      assert.deepEqual(requests[0].history[0].strategy, strategy);
      assert.equal(requests[0].history[0].answer, turn.answer);
    },
  );
});

test('finishing with an unfinished draft preserves its activity, focus and depth once', async () => {
  const turn = turnFromQuestion(
    question,
    '아직 검토하지 못한 적용 조건을 추가로 확인하겠습니다.',
  );
  const result = {
    summary: '구체적인 보완 행동을 연습해보세요.',
    turns: [turn],
    finish_reason: 'timeout',
    elapsed_seconds: 600,
  };
  await withServer(
    { type: 'result', result, mode: 'live' },
    async (requests) => {
      let received;
      await streamInterview(
        {
          ...payload,
          action: 'finish',
          history: [turn],
          elapsed_seconds: 600,
          finish_reason: 'timeout',
        },
        new AbortController().signal,
        (event) => {
          received = event.result;
        },
      );
      assert.equal(requests[0].history.length, 1);
      assert.deepEqual(requests[0].history[0].strategy, strategy);
      assert.equal('current_question' in requests[0], false);
      assert.deepEqual(received.turns[0].strategy, strategy);
    },
  );
});

test('finishing an unanswered question retains strategy in current_question', async () => {
  const result = {
    summary: '아직 답변이 없어 확인하지 못한 내용이 있습니다.',
    turns: [{ ...turnFromQuestion(question, '') }],
    finish_reason: 'manual',
    elapsed_seconds: 90,
  };
  await withServer(
    { type: 'result', result, mode: 'live' },
    async (requests) => {
      await streamInterview(
        {
          ...payload,
          action: 'finish',
          history: [],
          current_question: question,
          elapsed_seconds: 90,
          finish_reason: 'manual',
        },
        new AbortController().signal,
        () => {},
      );
      assert.deepEqual(requests[0].current_question.strategy, strategy);
      assert.equal(requests[0].history.length, 0);
    },
  );
});

test('legacy and null-strategy questions remain valid without fabricated planning metadata', () => {
  const legacy = turnFromQuestion(
    { text: '본인이 맡은 일을 설명해주세요.', kind: 'activity' },
    '자료 분류를 맡았습니다.',
  );
  assert.equal('strategy' in legacy, false);
  assert.equal(questionTypeLabel(legacy), '활동 기반 질문');
  assert.equal(
    questionTypeLabel({ kind: 'self_introduction', strategy: null }),
    '자기소개',
  );
  assert.equal(
    'strategy' in
      turnFromQuestion(
        { kind: 'activity', text: '설명해주세요.', strategy: null },
        '답변',
      ),
    false,
  );
});

test('all twelve focus labels are available and exports retain metadata with readable question types', () => {
  assert.equal(Object.keys(FOCUS_LABELS).length, 12);
  assert.equal(FOCUS_LABELS.limitations, '한계와 보완');
  assert.equal(FOCUS_LABELS.counterargument, '다른 관점');
  const turn = Object.freeze(
    turnFromQuestion(question, '대안을 비교해보겠습니다.'),
  );
  const result = Object.freeze({
    summary: '다른 관점을 검토한 근거가 드러났습니다.',
    turns: Object.freeze([turn]),
    finish_reason: 'manual',
    elapsed_seconds: 91,
  });
  const exported = resultForExport(result);
  assert.equal(exported.turns[0].question_type, '다른 관점');
  assert.deepEqual(exported.turns[0].strategy, strategy);
  assert.equal(
    'question_type' in turn,
    false,
    'export must not mutate live history',
  );
  const text = formatResultText(result);
  assert.match(text, /질문 유형: 다른 관점/);
  assert.match(text, /대안을 비교해보겠습니다/);
});
