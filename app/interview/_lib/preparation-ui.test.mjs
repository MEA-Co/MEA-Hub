import assert from 'node:assert/strict';
import test from 'node:test';

import { renderComponent } from '../../../tests/helpers/component-render.mjs';
import { loadTypeScript } from '../../../tests/helpers/load-typescript.mjs';

const { exportPreparationText } = loadTypeScript(
  new URL('./preparation-text.ts', import.meta.url),
);

const activities = Array.from({ length: 10 }, (_, index) => ({
  id: `activity-${index + 1}`,
  category: 'subject',
  grade: 2,
  subject: '정보',
  title: `자료 분석 탐구 ${index + 1}`,
  core_content:
    '공개 자료의 누락된 값을 확인하고 비교 기준을 세워 결과가 달라지는 과정을 직접 정리했다.',
  reflection: '',
}));
const circumstances = {
  grades_enabled: true,
  grade_concerns: [
    {
      subject: '수학',
      grade: 2,
      semester: 1,
      note: '기초 개념을 나누어 복습한 상황을 정리했다.',
    },
  ],
  career_enabled: false,
  career_change: { previous_field: '', current_field: '', note: '' },
};
const plain = (value) => JSON.parse(JSON.stringify(value));

function panel(props = {}) {
  const imports = [];
  const view = renderComponent(
    'app/interview/_components/preparation-text-panel.tsx',
    {
      props: {
        activities,
        circumstances,
        onImport: (value) => imports.push(value),
        ...props,
      },
    },
  );
  const paste = (text) => {
    view
      .find((node) => node.props.id === 'preparation-text')
      .props.onChange({ target: { value: text } });
    view.render();
  };
  return { ...view, imports, paste };
}

test('TXT panel validates the entire paste before applying any activity or circumstance changes', () => {
  const view = panel();
  const invalid = `${exportPreparationText(activities, circumstances)}\n[활동]\n학년: 잘못된 값\n[/활동]`;
  view.paste(invalid);
  assert.equal(view.click('TXT 내용 가져오기'), true);
  assert.equal(view.imports.length, 0);
  assert.equal(
    view.find((node) => node.props.id === 'preparation-text').props.value,
    invalid,
  );
  assert.ok(view.find((node) => node.props.role === 'alert'));
  view.paste(exportPreparationText(activities, circumstances));
  view.click('TXT 내용 가져오기');
  assert.equal(view.imports.length, 1);
  assert.equal(view.imports[0].activities.length, 10);
  assert.deepEqual(plain(view.imports[0].circumstances), circumstances);
});

test('TXT panel keeps optional reflection empty and reports activity-only imports without replacing notes', () => {
  const view = panel();
  view.paste(exportPreparationText(activities));
  view.click('TXT 내용 가져오기');
  assert.equal(view.imports[0].activities[0].reflection, '');
  assert.equal(view.imports[0].circumstances, undefined);
  assert.match(
    view.text(view.find((node) => node.props.role === 'status')),
    /기존 특이사항은 유지/,
  );
});

test('TXT panel blocks even a direct stale import callback during a live interview', () => {
  const view = panel({ disabled: true });
  view.paste(exportPreparationText(activities, circumstances));
  const button = view.button('TXT 내용 가져오기');
  assert.equal(button.props.disabled, true);
  button.props.onClick();
  assert.equal(view.imports.length, 0);
  assert.equal(
    view.find((node) => node.type === 'fieldset').props.disabled,
    true,
  );
});

test('TXT panel downloads both activity and optional circumstance drafts as a reusable plain-text file', async () => {
  const view = panel();
  view.click('활동·특이사항 TXT 저장');
  assert.equal(view.downloads.length, 1);
  assert.match(view.downloads[0].filename, /^MEA-면접준비-.*\.txt$/);
  assert.equal(view.downloads[0].blob.type, 'text/plain;charset=utf-8');
  assert.equal(
    await view.downloads[0].blob.text(),
    exportPreparationText(activities, circumstances),
  );
});

function page({
  phase = 'setup',
  activeTab = 'activities',
  result = null,
  targetMajor = '컴퓨터공학과',
  interview: overrides = {},
} = {}) {
  const panels = {};
  const calls = { storage: 0, start: [] };
  const noop = () => {};
  const mockPanel = (name) => (props) => {
    panels[name] = props;
    return { type: 'div', props: { 'data-panel': name } };
  };
  const interview = {
    phase,
    result,
    question: null,
    history: [],
    answer: '',
    busy: false,
    ending: false,
    error: '',
    mode: 'demo',
    remaining: 600,
    minuteWarning: false,
    startedAt: null,
    streamingText: '',
    streamingKind: 'activity',
    circumstancesSnapshot: null,
    targetMajorSnapshot: '컴퓨터공학과',
    setAnswer: noop,
    start: (...args) => calls.start.push(args),
    submit: noop,
    finish: noop,
    retry: noop,
    reset: noop,
    ...overrides,
  };
  const view = renderComponent('app/interview/page.tsx', {
    initialState: (index, value) =>
      index === 0
        ? activeTab
        : index === 2
          ? plain(circumstances)
          : index === 3
            ? true
            : index === 4
              ? plain(activities)
              : index === 11
                ? targetMajor
                : value,
    modules: {
      './_components/interview-workspace': {
        InterviewWorkspace: ({ children }) => children,
      },
      './_components/activity-editor': {
        ActivityEditor: mockPanel('activities'),
      },
      './_components/circumstances-editor': {
        CircumstancesEditor: mockPanel('circumstances'),
      },
      './_components/preparation-guide': {
        PreparationGuide: mockPanel('guide'),
      },
      './_components/preparation-text-panel': {
        PreparationTextPanel: mockPanel('text'),
      },
      './_lib/use-interview': { useInterview: () => interview },
      './_lib/use-recorder': {
        useRecorder: () => ({
          preparing: false,
          recording: false,
          transcribing: false,
          error: '',
          cancel: noop,
        }),
      },
      './_lib/use-activity-drafts': {
        useActivityDrafts: () => {
          calls.storage += 1;
          return {};
        },
      },
    },
  });
  return { ...view, panels, calls };
}

test('page places the guide before TXT, context and activities while preserving imported drafts', () => {
  const view = page();
  assert.equal(view.calls.storage, 0);
  assert.deepEqual(
    view
      .all((node) => node.props['data-panel'])
      .map((node) => node.props['data-panel']),
    ['guide', 'text', 'circumstances', 'activities'],
  );
  const nextRows = [{ ...activities[0], title: '불러온 활동' }];
  view.panels.text.onImport({ activities: nextRows });
  view.render();
  assert.deepEqual(plain(view.panels.text.activities), nextRows);
  assert.deepEqual(plain(view.panels.text.circumstances), circumstances);
  assert.equal(view.panels.text.targetMajor, '컴퓨터공학과');
  const nextContext = { ...circumstances, grades_enabled: false };
  view.panels.text.onImport({
    activities,
    circumstances: nextContext,
    targetMajor: '환경공학과',
  });
  view.render();
  assert.deepEqual(plain(view.panels.text.circumstances), nextContext);
  assert.equal(view.panels.text.targetMajor, '환경공학과');
  view.click('면접 설정으로 이동');
  assert.equal(
    view.all((node) => node.props['data-panel'] === 'circumstances').length,
    0,
  );
  view.click('활동 입력 수정하기');
  assert.deepEqual(plain(view.panels.text.circumstances), nextContext);
  assert.equal(view.calls.storage, 0);
});

test('page rejects activity, context, and TXT mutation callbacks throughout a live interview', () => {
  const view = page({ phase: 'live' });
  assert.equal(view.panels.activities.disabled, true);
  assert.equal(view.panels.circumstances.disabled, true);
  assert.equal(view.panels.text.disabled, true);
  const majorInput = view.find((node) => node.props.id === 'target-major');
  assert.equal(majorInput.props.disabled, true);
  majorInput.props.onChange({ target: { value: '다른학과' } });
  view.panels.activities.onChange([]);
  view.panels.circumstances.onChange({
    ...circumstances,
    grades_enabled: false,
  });
  view.panels.text.onImport({
    activities: [],
    circumstances: { ...circumstances, grades_enabled: false },
  });
  view.render();
  assert.deepEqual(plain(view.panels.text.activities), activities);
  assert.equal(view.panels.text.targetMajor, '컴퓨터공학과');
  assert.deepEqual(plain(view.panels.text.circumstances), circumstances);
});

test('page sends one intro setting, allows absent reflection, and enforces the 20-minute boundary', () => {
  const view = page({ activeTab: 'interview' });
  const input = () => view.find((node) => node.props.id === 'duration-minutes');
  assert.equal(input().props.min, 3);
  assert.equal(input().props.max, 20);
  input().props.onChange({ target: { value: '21' } });
  view.render();
  view.click('면접 시작하기');
  assert.equal(view.calls.start.length, 0);
  assert.match(
    view.text(view.find((node) => node.props.role === 'alert')),
    /3~20분/,
  );
  input().props.onChange({ target: { value: '20' } });
  view.render();
  view.click('면접 시작하기');
  assert.equal(view.calls.start.length, 1);
  const [rows, settings, , targetMajor] = view.calls.start[0];
  assert.equal(targetMajor, '컴퓨터공학과');
  assert.equal(rows[0].reflection, '');
  assert.equal(settings.duration_minutes, 20);
  assert.equal(settings.ask_intro, true);
  assert.deepEqual(Object.keys(settings).sort(), [
    'ask_final_remarks',
    'ask_intro',
    'duration_minutes',
    'show_timer',
  ]);
});

test('result page offers only TXT export and downloads the question, answer, and feedback', async () => {
  const result = {
    summary: '답변 근거를 바탕으로 다음 연습 방향을 확인했습니다.',
    turns: [
      {
        question: '무엇을 분석했나요?',
        answer: '비교 기준을 정리했습니다.',
        kind: 'activity',
      },
    ],
    finish_reason: 'manual',
    elapsed_seconds: 82,
  };
  const view = page({ phase: 'result', activeTab: 'interview', result });
  assert.equal(
    view.all(
      (node) => node.type === 'button' && view.text(node).includes('JSON'),
    ).length,
    0,
  );
  view.click('결과 TXT 저장');
  assert.match(view.downloads[0].filename, /\.txt$/);
  const content = await view.downloads[0].blob.text();
  assert.match(content, /무엇을 분석했나요/);
  assert.match(content, /비교 기준을 정리했습니다/);
  assert.match(content, /다음 연습 방향/);
  assert.match(content, /지원학과: 컴퓨터공학과/);
});

test('missing or private target major returns to the activity field before starting an interview', () => {
  const view = page({ activeTab: 'interview', targetMajor: '' });
  view.click('면접 시작하기');
  assert.equal(view.calls.start.length, 0);
  const field = view.find((node) => node.props.id === 'target-major');
  assert.equal(field.props['aria-invalid'], true);
  assert.match(
    view.text(view.find((node) => node.props.id === 'target-major-error')),
    /1~100자/,
  );
  field.props.onChange({ target: { value: '컴퓨터공학과' } });
  view.render();
  assert.equal(
    view.find((node) => node.props.id === 'target-major').props['aria-invalid'],
    undefined,
  );
  view.click('면접 설정으로 이동');
  view.click('면접 시작하기');
  assert.equal(view.calls.start[0][3], '컴퓨터공학과');

  const privateView = page({
    activeTab: 'interview',
    targetMajor: 'student@example.com',
  });
  privateView.click('면접 시작하기');
  assert.equal(privateView.calls.start.length, 0);
  assert.match(
    privateView.text(
      privateView.find((node) => node.props.id === 'target-major-error'),
    ),
    /개인정보/,
  );
});

test('final question transitions are separate status messages and disappear along with old question text while busy', () => {
  const question = {
    kind: 'activity',
    text: '자료구조의 차이를 설명해주세요.',
    transition: '그럼 다음 질문으로 넘어갈게요.',
    strategy: {
      version: 'video-2026-10-27',
      source: 'major',
      major_topic: 'foundation',
      focus: 'concept_understanding',
      depth: 0,
    },
  };
  const ready = page({
    phase: 'live',
    activeTab: 'interview',
    interview: { question },
  });
  const marker = ready.find(
    (node) => node.props['data-testid'] === 'question-transition',
  );
  assert.equal(marker.props.role, 'status');
  assert.equal(ready.text(marker), question.transition);
  assert.equal(
    ready.text(ready.find((node) => node.props.id === 'current-question')),
    question.text,
  );
  const busy = page({
    phase: 'live',
    activeTab: 'interview',
    interview: { question, busy: true },
  });
  assert.equal(
    busy.all((node) => node.props['data-testid'] === 'question-transition')
      .length,
    0,
  );
  assert.match(
    busy.text(busy.find((node) => node.props.id === 'current-question')),
    /다음 질문을 준비/,
  );
  assert.equal(
    busy.all(
      (node) => node.type === 'span' && busy.text(node) === '전공 기초 질문',
    ).length,
    0,
  );
  const failed = page({
    phase: 'live',
    activeTab: 'interview',
    interview: { question, error: '연결이 끊겼어요.' },
  });
  assert.equal(
    failed.text(failed.find((node) => node.props.id === 'current-question')),
    question.text,
  );
});

test('preparation TXT includes target major and activity-only imports preserve it until explicitly replaced', async () => {
  const view = panel({ targetMajor: '환경공학과' });
  view.click('활동·특이사항 TXT 저장');
  assert.match(await view.downloads[0].blob.text(), /\| 환경공학과/);
  view.paste(exportPreparationText(activities));
  view.click('TXT 내용 가져오기');
  assert.equal(view.imports[0].targetMajor, undefined);
  const stateful = page();
  stateful.panels.text.onImport(view.imports[0]);
  stateful.render();
  assert.equal(stateful.panels.text.targetMajor, '컴퓨터공학과');
  stateful.panels.text.onImport({ activities, targetMajor: '' });
  stateful.render();
  assert.equal(stateful.panels.text.targetMajor, '');
});
