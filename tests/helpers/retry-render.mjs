import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const projectRequire = createRequire(path.join(project, 'package.json'));
const ts = projectRequire('typescript');
const jsxRuntime = projectRequire('react/jsx-runtime');

// Evaluate the real page and shared Button as React element factories. Only
// stateful hooks, unrelated panels, icons and routing are replaced. This avoids
// source-pattern assertions and never connects a microphone or network service.
function renderInterviewPage({
  recorder = {},
  interview: interviewOverrides = {},
} = {}) {
  const calls = { retry: 0, submit: 0, startRecording: 0, stopRecording: 0 };
  const noop = () => {};
  const react = {
    useState(initial) {
      const value = typeof initial === 'function' ? initial() : initial;
      return [value === 'activities' ? 'interview' : value, noop];
    },
    useRef(value) {
      return { current: value };
    },
    useEffect: noop,
  };
  const interview = {
    phase: 'live',
    question: {
      kind: 'activity',
      text: '이 활동에서 맡은 역할을 설명해주세요.',
    },
    history: [],
    answer: '아직 제출하지 않은 답변',
    busy: false,
    ending: false,
    error: '질문을 준비하지 못했습니다.',
    result: null,
    mode: 'demo',
    remaining: 240,
    minuteWarning: false,
    circumstancesSnapshot: null,
    startedAt: Date.now(),
    streamingText: '',
    streamingKind: 'activity',
    setAnswer: noop,
    start: noop,
    submit: () => {
      calls.submit += 1;
    },
    finish: noop,
    retry: () => {
      calls.retry += 1;
    },
    reset: noop,
    ...interviewOverrides,
  };
  const recorderState = {
    preparing: false,
    recording: false,
    transcribing: false,
    streaming: true,
    error: '',
    start: () => {
      calls.startRecording += 1;
    },
    stop: () => {
      calls.stopRecording += 1;
    },
    cancel: noop,
    ...recorder,
  };
  const drafts = { activities: [], changeActivities: noop, busy: null };
  const cache = new Map();
  const EmptyPanel = () => null;
  const Icon = (props) => jsxRuntime.jsx('svg', props);
  const icons = new Proxy({}, { get: () => Icon });
  const Link = (props) => jsxRuntime.jsx('a', props);

  function load(filename) {
    const absolute = path.resolve(project, filename);
    if (cache.has(absolute)) return cache.get(absolute);
    const exports = {};
    cache.set(absolute, exports);
    const javascript = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    const requireModule = (id) => {
      if (id.endsWith('.css')) return {};
      if (id === 'react') return react;
      if (id === 'react/jsx-runtime') return jsxRuntime;
      if (id === 'lucide-react') return icons;
      if (id === 'next/link') return { __esModule: true, default: Link };
      if (id.endsWith('/use-interview'))
        return { useInterview: () => interview };
      if (id.endsWith('/use-recorder'))
        return { useRecorder: () => recorderState };
      if (id.endsWith('/use-activity-drafts'))
        return { useActivityDrafts: () => drafts };
      if (id.includes('/_components/'))
        return {
          InterviewWorkspace: ({ children }) => children,
          ActivityEditor: EmptyPanel,
          ActivityStorage: EmptyPanel,
          CircumstancesEditor: EmptyPanel,
        };
      if (id.startsWith('@/'))
        return load(id.slice(2) + (id.endsWith('button') ? '.tsx' : '.ts'));
      if (id.startsWith('.')) {
        const resolved = path.resolve(path.dirname(absolute), id);
        return load(
          fs.existsSync(resolved + '.tsx')
            ? resolved + '.tsx'
            : resolved + '.ts',
        );
      }
      return projectRequire(id);
    };
    const context = vm.createContext({
      exports,
      require: requireModule,
      Date,
      console,
      AbortController,
      Blob,
      URL,
      setTimeout,
      clearTimeout,
    });
    new vm.Script(javascript, { filename: absolute }).runInContext(context);
    return exports;
  }

  const Page = load('app/interview/page.tsx').default;
  const tree = Page();
  const text = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean')
      return '';
    if (typeof node === 'string' || typeof node === 'number')
      return String(node);
    if (Array.isArray(node)) return node.map(text).join('');
    return text(node.props?.children);
  };
  const buttons = [];
  const visit = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean')
      return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object' || node.props?.hidden) return;
    if (typeof node.type === 'function') {
      visit(node.type(node.props));
      return;
    }
    if (node.type === 'button') buttons.push(node);
    visit(node.props?.children);
  };
  visit(tree);
  const button = (label) => {
    const matches = buttons.filter(
      (item) => text(item.props.children).trim() === label,
    );
    if (matches.length !== 1)
      throw new Error(
        `Expected one rendered button '${label}', got ${matches.length}`,
      );
    return matches[0];
  };
  const click = (label) => {
    const rendered = button(label);
    if (rendered.props.disabled) return false;
    rendered.props.onClick?.({ preventDefault: noop });
    return true;
  };
  return { button, click, calls };
}

export { renderInterviewPage };
