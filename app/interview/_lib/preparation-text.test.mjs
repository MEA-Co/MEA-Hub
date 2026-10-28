import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTypeScript } from '../../../tests/helpers/load-typescript.mjs';

import { initialCircumstancesDraft } from './circumstances.ts';

const {
  exportPreparationText,
  importPreparationText,
  MAX_PREPARATION_TEXT_LENGTH,
} = loadTypeScript(new URL('./preparation-text.ts', import.meta.url));
import {
  activityError,
  isActivityReady,
  PREPARATION_PROMPT,
  questionTypeLabel,
  resultForExport,
  turnFromQuestion,
} from './types.ts';

function activity(index = 1) {
  return {
    id: `draft-${index}`,
    category: 'subject',
    grade: 2,
    subject: '과학',
    title: `관찰 활동 ${index}`,
    core_content:
      '제가 관찰 조건을 맞추고 같은 양식에 기록해 서로 다른 결과를 비교했습니다.',
    reflection: '',
  };
}
function draft() {
  return {
    grades_enabled: false,
    grade_concerns: [
      {
        subject: '수학: 탐구',
        grade: 2,
        semester: 1,
        note: '비교 과정\n[활동]\n느낀점/알게된점: 그대로 적은 메모',
      },
      { subject: '', grade: null, semester: 2, note: '' },
      { subject: '국어', grade: 3, semester: null, note: '아직 작성 중' },
    ],
    career_enabled: true,
    career_change: {
      previous_field: '생명과학',
      current_field: '',
      note: '가능성을 적은 미완성 메모: 다음에 정리',
    },
  };
}

test('exports readable Korean text rather than renamed JSON, including stable IDs and all optional draft fields', () => {
  const rows = [
    activity(),
    { ...activity(2), title: '', core_content: '', reflection: '앎' },
  ];
  const optional = draft();
  const text = exportPreparationText(rows, optional);
  assert.match(text, /^MEA 면접 준비 TXT v1\n/);
  assert.match(text, /\[활동\]\n식별자:\n\| draft-1\n학년: 2\n영역: 교과 세특/);
  assert.match(text, /성적 상황 사용: 아니오/);
  assert.match(text, /진로 변경 사용: 예/);
  assert.throws(() => JSON.parse(text));
  assert.deepEqual(importPreparationText(text), {
    activities: rows,
    circumstances: optional,
  });
});

test('multiline text, delimiters, colons, literal backslashes, CRLF, tabs, emoji and whitespace roundtrip exactly', () => {
  const special =
    '  메모: [활동]\n[/특이사항]\n| 이미 있는 세로줄\n주제(제목):\nC:\\notes\\\n다음\r\n\t😀: 끝  ';
  const rows = [
    {
      ...activity(),
      title: '제목: 기호 | 😀',
      core_content: special,
      reflection: '\\r은 실제 줄바꿈이 아님\n\n마지막\\',
      subject: '',
    },
    Object.fromEntries(
      Object.entries(activity(2)).filter(([key]) => key !== 'subject'),
    ),
  ];
  assert.deepEqual(
    importPreparationText(exportPreparationText(rows)).activities,
    rows,
  );
});

test('activity-only files omit circumstances so callers keep their current optional fields', () => {
  const text = exportPreparationText([activity()]);
  assert.ok(!text.includes('[특이사항]'));
  const result = importPreparationText(text);
  assert.equal(Object.hasOwn(result, 'circumstances'), false);
  assert.deepEqual(result.activities, [activity()]);
});

test('an explicit empty optional section represents a deliberate reset and preserves zero grade rows', () => {
  const optional = { ...initialCircumstancesDraft(), grade_concerns: [] };
  assert.deepEqual(importPreparationText(exportPreparationText([], optional)), {
    activities: [],
    circumstances: optional,
  });
  assert.deepEqual(importPreparationText(exportPreparationText([])), {
    activities: [],
  });
});

test('omitted activity IDs are generated and optional reflection defaults to blank', () => {
  const text =
    'MEA 면접 준비 TXT v1\n\n[활동]\n학년: 1\n영역: 자율활동\n주제(제목): 미완성 메모\n핵심내용:\n| \n[/활동]\n';
  const result = importPreparationText(text).activities[0];
  assert.equal(result.category, 'autonomous');
  assert.equal(result.title, '미완성 메모');
  assert.equal(result.core_content, '');
  assert.equal(result.reflection, '');
  assert.ok(result.id);
});

test('accepts UTF8 BOM and operating-system line endings without changing content', () => {
  const text = exportPreparationText([activity()], draft());
  assert.deepEqual(
    importPreparationText(`\uFEFF${text.replace(/\n/g, '\r\n')}`),
    importPreparationText(text),
  );
});

for (const [name, change] of [
  ['wrong version', (text) => text.replace('v1', 'v2')],
  ['missing end delimiter', (text) => text.replace('[/활동]', '')],
  ['unknown field', (text) => text.replace('핵심내용:', '원본 문서:')],
  ['duplicate field', (text) => text.replace('학년: 2', '학년: 2\n학년: 1')],
  ['invalid grade', (text) => text.replace('학년: 2', '학년: 2.0')],
  [
    'invalid category',
    (text) => text.replace('영역: 교과 세특', '영역: 개인 정보'),
  ],
  [
    'missing required title',
    (text) => text.replace('주제(제목):\n| 관찰 활동 1\n', ''),
  ],
  ['malformed escape', (text) => text.replace('| 관찰 활동 1', '| 잘못된 \\q')],
  ['loose pipe', (text) => text.replace('| 관찰 활동 1', '|접두사 없는 내용')],
  ['unexpected trailing section', (text) => `${text}\n[다른 자료]\n`],
])
  test(`rejects malformed activity input atomically: ${name}`, () => {
    assert.throws(() =>
      importPreparationText(change(exportPreparationText([activity()]))),
    );
  });

for (const change of [
  (text) => text.replace('성적 상황 사용: 아니오', '성적 상황 사용: false'),
  (text) => text.replace('성적 상황 사용: 아니오\n', ''),
  (text) => text.replace('학기: 1', '학기: 3'),
  (text) => text.replace('[/특이사항]', ''),
  (text) => text + text.slice(text.indexOf('[특이사항]')),
])
  test('rejects malformed optional fields instead of partially applying activities', () => {
    assert.throws(() =>
      importPreparationText(
        change(exportPreparationText([activity()], draft())),
      ),
    );
  });

test('bounds activity count, text sizes, field lengths and duplicate IDs', () => {
  assert.throws(
    () => importPreparationText('x'.repeat(MAX_PREPARATION_TEXT_LENGTH + 1)),
    /너무 큽니다/,
  );
  assert.throws(
    () =>
      exportPreparationText(Array.from({ length: 61 }, (_, i) => activity(i))),
    /60개/,
  );
  assert.throws(() => exportPreparationText([activity(), activity()]), /중복/);
  assert.throws(
    () =>
      exportPreparationText([{ ...activity(), reflection: '가'.repeat(1001) }]),
    /1,000자/,
  );
  assert.throws(
    () =>
      exportPreparationText([
        { ...activity(), core_content: '가'.repeat(2001) },
      ]),
    /2,000자/,
  );
  assert.throws(
    () =>
      exportPreparationText([activity()], {
        ...draft(),
        grade_concerns: [...draft().grade_concerns, draft().grade_concerns[0]],
      }),
    /0~3개/,
  );
  assert.throws(
    () =>
      exportPreparationText([activity()], {
        ...draft(),
        career_change: { ...draft().career_change, unknown: 'x' },
      }),
    /알 수 없는 항목/,
  );
});

for (const privateText of [
  '학교생활기록부 인적 학적 사항',
  '010-1234-5678',
  'student@example.test',
])
  test('refuses raw/private information in either activities or disabled optional drafts', () => {
    assert.throws(
      () =>
        exportPreparationText([{ ...activity(), core_content: privateText }]),
      /원문|개인정보/,
    );
    const optional = initialCircumstancesDraft();
    optional.career_change.note = privateText;
    assert.throws(
      () => exportPreparationText([activity()], optional),
      /원문|개인정보/,
    );
    const file = exportPreparationText([activity()]).replace(
      '| 관찰 활동 1',
      `| ${privateText}`,
    );
    assert.throws(() => importPreparationText(file), /원문|개인정보/);
  });

test('empty and single-character reflection can complete ten activities', () => {
  for (const reflection of ['', '앎']) {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      ...activity(index),
      reflection,
    }));
    assert.equal(activityError(rows), null);
    assert.ok(rows.every(isActivityReady));
    assert.deepEqual(
      importPreparationText(exportPreparationText(rows)).activities,
      rows,
    );
  }
});

test('preparation prompt contains an importable exact TXT example, minimum ten and no nine-slot rule or invented reflection', () => {
  assert.ok(!PREPARATION_PROMPT.includes('9개'));
  assert.ok(PREPARATION_PROMPT.includes('총 10개 이상'));
  assert.ok(PREPARATION_PROMPT.includes('느낀점이 없으면 빈칸'));
  const example = PREPARATION_PROMPT.slice(
    PREPARATION_PROMPT.indexOf('\nMEA 면접 준비 TXT v1\n') + 1,
  ).split('\n이제 활동 메모')[0];
  const parsed = importPreparationText(example);
  assert.equal(parsed.activities.length, 1);
  assert.equal(parsed.activities[0].reflection, '');
  assert.equal(parsed.circumstances, undefined);
});

for (const [kind, label] of [
  ['self_introduction', '자기소개'],
  ['motivation', '지원동기'],
  ['learning_plan', '학업계획'],
])
  test(`intro kind, follow-up metadata and result exports stay distinct: ${kind}`, () => {
    const strategy = {
      version: 'video-2026-10-27',
      source: 'intro',
      focus: 'personal_role',
      depth: 1,
      mix_seed: '0'.repeat(32),
    };
    const question = {
      text: '직접 한 일을 한 가지 설명해주세요.',
      kind,
      strategy,
    };
    assert.equal(
      questionTypeLabel({ ...question, strategy: { ...strategy, depth: 0 } }),
      label,
    );
    assert.equal(questionTypeLabel(question), `${label} 꼬리질문 · 본인 역할`);
    const turn = turnFromQuestion(question, '제가 기준을 정했습니다.');
    assert.deepEqual(turn.strategy, strategy);
    const result = resultForExport({
      summary: '합성 피드백',
      turns: [turn],
      finish_reason: 'manual',
      elapsed_seconds: 1,
    });
    assert.equal(result.turns[0].kind, kind);
    assert.equal(
      result.turns[0].question_type,
      `${label} 꼬리질문 · 본인 역할`,
    );
  });
