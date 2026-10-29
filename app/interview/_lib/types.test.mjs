import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activityDraftError,
  activityError,
  cleanActivities,
  containsPrivateInformation,
  formatResultText,
  importActivities,
  isActivityReady,
  questionTypeLabel,
  targetMajorError,
  turnFromQuestion,
} from './types.ts';

test('major question metadata keeps its topic and uses independent foundation, issue and follow-up labels', () => {
  const question = {
    kind: 'activity',
    text: '어떤 기준으로 비교하겠나요?',
    transition: '그럼 다음 질문으로 넘어갈게요.',
    strategy: {
      version: 'video-2026-10-27',
      source: 'major',
      major_topic: 'foundation',
      focus: 'concept_understanding',
      depth: 0,
    },
  };
  assert.equal(questionTypeLabel(question), '전공 기초 질문');
  assert.equal(
    questionTypeLabel({
      ...question,
      strategy: { ...question.strategy, major_topic: 'issue' },
    }),
    '전공 이슈 질문',
  );
  assert.equal(
    questionTypeLabel({
      ...question,
      strategy: { ...question.strategy, depth: 1 },
    }),
    '전공 꼬리질문',
  );
  const turn = turnFromQuestion(question, '비교할 조건을 먼저 맞추겠습니다.');
  assert.equal(turn.strategy.major_topic, 'foundation');
  assert.equal(turn.transition, undefined);
  assert.equal(turn.question, question.text);
  const result = {
    summary: '근거를 확인했습니다.',
    turns: [turn],
    finish_reason: 'manual',
    elapsed_seconds: 60,
  };
  assert.match(
    formatResultText(result, '컴퓨터공학과'),
    /지원학과: 컴퓨터공학과/,
  );
  assert.match(
    formatResultText(result, '컴퓨터공학과'),
    /질문 유형: 전공 기초 질문/,
  );
  assert.doesNotMatch(formatResultText(result), /지원학과:/);
});

test('target major shares basic record and contact privacy checks with activity content', () => {
  assert.equal(targetMajorError('컴퓨터공학과'), null);
  assert.equal(targetMajorError('가'.repeat(100)), null);
  assert.match(targetMajorError('가'.repeat(101)), /1~100자/);
  assert.match(targetMajorError('   '), /1~100자/);
  assert.equal(targetMajorError('', false), null);
  for (const value of [
    '학교생활기록부',
    '010-1234-5678',
    'student@example.com',
  ]) {
    assert.equal(containsPrivateInformation(value), true);
    assert.match(targetMajorError(value), /개인정보/);
    assert.match(
      activityDraftError([{ ...activity(), title: value }]),
      /개인정보/,
    );
  }
});

function activity(index = 1) {
  return {
    id: `activity-${index}`,
    grade: 2,
    category: 'subject',
    title: `탐구 활동 ${index}`,
    core_content:
      '내가 실험을 계획하고 자료를 수집하여 조원들과 결과를 비교하고 발표한 과정이다.',
    reflection:
      '자료의 한계를 검토하며 근거에 따라 생각을 바꾸는 태도를 배웠다.',
  };
}

test('keeps factual content and reflection separate across export/import', () => {
  const input = { ...activity(), subject: null };
  const [row] = importActivities(JSON.stringify([input]));
  assert.equal(row.core_content, input.core_content);
  assert.equal(row.reflection, input.reflection);
  assert.equal(row.subject, undefined);
  assert.equal(row.id, input.id);
  assert.deepEqual(importActivities(JSON.stringify([row])), [row]);
});

test('migrates legacy summary into factual content without inventing reflection', () => {
  const original = activity();
  const core_content = original.core_content;
  const base = {
    id: original.id,
    grade: original.grade,
    category: original.category,
    title: original.title,
  };
  const [row] = importActivities(
    JSON.stringify([{ ...base, summary: core_content }]),
  );
  assert.equal(row.core_content, core_content);
  assert.equal(row.reflection, '');
  assert.equal(isActivityReady(row), true);
  assert.equal('summary' in row, false);
});

test('accepts incomplete and empty drafts while interview requires ten completed activities', () => {
  assert.deepEqual(importActivities('[]'), []);
  assert.equal(activityDraftError([]), null);
  const [draft] = importActivities(
    JSON.stringify([
      { ...activity(), title: '', core_content: '', reflection: '' },
    ]),
  );
  assert.equal(activityDraftError([draft]), null);
  assert.match(activityError([draft]), /10개 이상/);
  assert.equal(
    activityError(Array.from({ length: 10 }, (_, index) => activity(index))),
    null,
  );
  assert.equal(
    activityError(
      Array.from({ length: 10 }, (_, index) => ({
        ...activity(index),
        reflection: '',
      })),
    ),
    null,
  );
});

test('enforces category totals rather than requiring nine creative activities', () => {
  const rows = Array.from({ length: 10 }, (_, index) => activity(index));
  assert.equal(activityError(rows), null);
  assert.equal(
    rows.every((row) => row.category === 'subject'),
    true,
  );
});

test('rejects contradictory migration fields, unknown document fields and raw record markers', () => {
  assert.throws(
    () =>
      importActivities(
        JSON.stringify([{ ...activity(), summary: '기존 요약' }]),
      ),
    /입력 형식/,
  );
  assert.throws(
    () =>
      importActivities(
        JSON.stringify([{ ...activity(), original_document: '원문' }]),
      ),
    /학년/,
  );
  assert.throws(
    () =>
      importActivities(
        JSON.stringify([
          {
            ...activity(),
            reflection: '학교생활기록부 원문에 있는 내용을 그대로 복사한 문장',
          },
        ]),
      ),
    /원문 문서 정보/,
  );
});

test('preserves blank reflections and trims all activity fields before use', () => {
  const [row] = cleanActivities([
    {
      ...activity(),
      title: '  탐구  ',
      core_content: '  실험 과정  ',
      reflection: '   ',
      subject: '  생명과학  ',
    },
  ]);
  assert.equal(row.title, '탐구');
  assert.equal(row.core_content, '실험 과정');
  assert.equal(row.reflection, '');
  assert.equal(row.subject, '생명과학');
});

test('bounds drafts and refuses duplicate IDs and oversized reflection', () => {
  assert.throws(
    () => importActivities(JSON.stringify([activity(), activity()])),
    /중복/,
  );
  assert.throws(
    () =>
      importActivities(
        JSON.stringify([{ ...activity(), reflection: '가'.repeat(1001) }]),
      ),
    /1,000자/,
  );
  assert.throws(
    () =>
      importActivities(
        JSON.stringify(
          Array.from({ length: 61 }, (_, index) => activity(index)),
        ),
      ),
    /0~60개/,
  );
});
