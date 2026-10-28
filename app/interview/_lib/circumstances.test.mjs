import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCircumstances,
  emptyGradeConcern,
  initialCircumstancesDraft,
  snapshotCircumstances,
} from './circumstances.ts';
import { streamInterview } from './stream.ts';
import {
  formatResultText,
  questionTypeLabel,
  resultForExport,
  turnFromQuestion,
} from './types.ts';

const profile = {
  grade_concerns: [
    {
      subject: '수학',
      grade: 2,
      semester: 1,
      note: '기본 개념을 복습하며 학습 방법을 바꿨습니다.',
    },
  ],
  career_change: {
    previous_field: '생명과학',
    current_field: '데이터 과학',
    note: '탐구 자료를 분석하며 관심이 바뀌었습니다.',
  },
};

test('unselected optional groups never block a start or serialize their incomplete drafts', () => {
  const draft = initialCircumstancesDraft();
  draft.grade_concerns[0].note = '학교생활기록부 원문';
  assert.equal(buildCircumstances(draft), null);
  draft.career_enabled = true;
  draft.career_change = {
    previous_field: '생명과학',
    current_field: '컴퓨터 과학',
    note: '',
  };
  assert.deepEqual(buildCircumstances(draft), {
    grade_concerns: [],
    career_change: draft.career_change,
  });
});

test('selected grade notes allow subject-only or grade/semester-only context without scores', () => {
  const draft = {
    ...initialCircumstancesDraft(),
    grades_enabled: true,
    grade_concerns: [
      {
        subject: '영어',
        grade: null,
        semester: null,
        note: '  독해 공부 방식을 점검했습니다.  ',
      },
      {
        subject: '',
        grade: 1,
        semester: 2,
        note: '학기 전반의 공부 계획을 다시 세웠습니다.',
      },
    ],
  };
  const result = buildCircumstances(draft);
  assert.equal(result.grade_concerns.length, 2);
  assert.equal(result.grade_concerns[0].note, '독해 공부 방식을 점검했습니다.');
  assert.equal(result.grade_concerns[1].subject, '');
  assert.equal(result.career_change, null);
});

test('validates only selected groups and enforces note count, context and length limits', () => {
  const selected = { ...initialCircumstancesDraft(), grades_enabled: true };
  assert.throws(() => buildCircumstances(selected), /과목 또는 학년/);
  selected.grade_concerns[0] = { ...emptyGradeConcern(), subject: '수학' };
  assert.throws(() => buildCircumstances(selected), /1~400자/);
  selected.grade_concerns = Array.from({ length: 4 }, () => ({
    ...profile.grade_concerns[0],
  }));
  assert.throws(() => buildCircumstances(selected), /최대 3개/);
  const career = { ...initialCircumstancesDraft(), career_enabled: true };
  assert.throws(() => buildCircumstances(career), /이전·현재/);
  career.career_change = { ...profile.career_change, note: '가'.repeat(401) };
  assert.throws(() => buildCircumstances(career), /400자/);
});

test('rejects obvious pasted originals and identity markers in optional notes', () => {
  const draft = {
    ...initialCircumstancesDraft(),
    grades_enabled: true,
    grade_concerns: [
      {
        ...profile.grade_concerns[0],
        note: '학교 생활 기록부 원문을 복사했습니다.',
      },
    ],
  };
  assert.throws(() => buildCircumstances(draft), /원문·개인정보/);
  draft.grade_concerns[0].note = '주민등록번호를 기입한 자료';
  assert.throws(() => buildCircumstances(draft), /원문·개인정보/);
});

test('the running interview snapshot remains unchanged after later form edits', () => {
  const form = structuredClone(profile);
  const snapshot = snapshotCircumstances(form);
  form.grade_concerns[0].subject = '국어';
  form.grade_concerns[0].note = '다음 면접에서 사용할 다른 메모';
  form.career_change.current_field = '환경공학';
  assert.deepEqual(snapshot, profile);
  assert.notEqual(snapshot.grade_concerns[0], form.grade_concerns[0]);
  assert.notEqual(snapshot.career_change, form.career_change);
  assert.equal(snapshotCircumstances(), null);
});

test('optional context reaches start, answer and finish; special question strategy survives turns and exports', async () => {
  const previous = globalThis.fetch;
  const requests = [];
  const strategy = {
    version: 'video-2026-10-27',
    source: 'circumstance',
    activity_id: null,
    circumstance_id: 'career_change',
    focus: 'major_connection',
    depth: 0,
  };
  const question = {
    kind: 'activity',
    text: '관심 분야가 바뀐 계기를 직접 경험과 연결해 설명해주세요.',
    strategy,
  };
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return new Response(
      `data: ${JSON.stringify({ type: 'question', question, mode: 'live' })}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  };
  try {
    const snapshot = snapshotCircumstances(profile);
    const common = {
      settings: {},
      activities: [],
      circumstances: snapshot,
      elapsed_seconds: 0,
      consent: true,
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
      '관찰한 자료를 직접 분석하며 관심이 달라졌습니다.',
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
    assert.deepEqual(
      requests.map((request) => request.circumstances),
      [snapshot, snapshot, snapshot],
    );
    assert.deepEqual(requests[1].history[0].strategy, strategy);
    assert.deepEqual(requests[2].current_question.strategy, strategy);
    const result = {
      summary: '관심 변화의 계기를 구체적으로 설명했습니다.',
      turns: [turn],
      finish_reason: 'manual',
      elapsed_seconds: 100,
    };
    const exported = {
      circumstances: snapshot,
      result: resultForExport(result),
    };
    assert.equal(exported.result.turns[0].question_type, '진로 변경');
    assert.deepEqual(exported.result.turns[0].strategy, strategy);
    assert.match(formatResultText(result), /질문 유형: 진로 변경/);
  } finally {
    globalThis.fetch = previous;
  }
});

test('circumstance labels do not add focus kinds or change legacy activity labels', () => {
  assert.equal(
    questionTypeLabel({
      kind: 'activity',
      strategy: {
        version: 'video-2026-10-27',
        source: 'circumstance',
        activity_id: null,
        circumstance_id: 'grade_2',
        focus: 'reflection_change',
        depth: 0,
      },
    }),
    '성적 관련 상황',
  );
  assert.equal(
    questionTypeLabel({
      kind: 'activity',
      strategy: {
        version: 'video-2026-10-27',
        activity_id: 'activity-1',
        focus: 'reflection_change',
        depth: 1,
      },
    }),
    '배움과 변화',
  );
});
