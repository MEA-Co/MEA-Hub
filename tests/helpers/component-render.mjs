import { webcrypto } from 'node:crypto';
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

/** Run the real component handlers and React element output without a browser. */
export function renderComponent(
  filename,
  { props = {}, modules = {}, initialState } = {},
) {
  const slots = [];
  let cursor = 0;
  let currentProps = props;
  let nodes = [];
  const downloads = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) {
        const value = typeof initial === 'function' ? initial() : initial;
        slots[index] = initialState ? initialState(index, value) : value;
      }
      return [
        slots[index],
        (value) => {
          slots[index] =
            typeof value === 'function' ? value(slots[index]) : value;
        },
      ];
    },
    useRef: (value) => ({ current: value }),
    useEffect: () => {},
  };
  const Icon = (attributes) => jsxRuntime.jsx('svg', attributes);
  const icons = new Proxy({}, { get: () => Icon });
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(project, file);
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
      if (id in modules) return modules[id];
      if (id.endsWith('.css')) return {};
      if (id === 'react') return react;
      if (id === 'react/jsx-runtime') return jsxRuntime;
      if (id === 'lucide-react') return icons;
      if (id.startsWith('@/'))
        return load(id.slice(2) + (id.endsWith('button') ? '.tsx' : '.ts'));
      if (id.startsWith('.')) {
        const resolved = path.resolve(path.dirname(absolute), id);
        return load(
          fs.existsSync(resolved)
            ? resolved
            : fs.existsSync(resolved + '.tsx')
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
      crypto: webcrypto,
      URL: {
        createObjectURL: (blob) => {
          downloads.push({ blob });
          return 'blob:test';
        },
        revokeObjectURL: () => {},
      },
      document: {
        createElement: () => {
          const link = {
            click: () => {
              downloads.at(-1).filename = link.download;
            },
          };
          return link;
        },
      },
      setTimeout: () => 0,
      clearTimeout: () => {},
    });
    new vm.Script(javascript, { filename: absolute }).runInContext(context);
    return exports;
  }
  const exports = load(filename);
  const Component = exports.default ?? Object.values(exports)[0];
  function render(nextProps = currentProps) {
    currentProps = nextProps;
    cursor = 0;
    nodes = [];
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (node.props?.hidden) return;
      if (typeof node.type === 'function') return visit(node.type(node.props));
      nodes.push(node);
      visit(node.props?.children);
    };
    visit(Component(currentProps));
  }
  const text = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean')
      return '';
    if (typeof node === 'string' || typeof node === 'number')
      return String(node);
    if (Array.isArray(node)) return node.map(text).join('');
    return text(node.props?.children);
  };
  const find = (predicate) => {
    const matches = nodes.filter(predicate);
    if (matches.length !== 1)
      throw new Error(`Expected one rendered element, got ${matches.length}`);
    return matches[0];
  };
  const button = (label) =>
    find((node) => node.type === 'button' && text(node).trim() === label);
  const click = (label) => {
    const node = button(label);
    if (node.props.disabled) return false;
    node.props.onClick?.({ preventDefault() {} });
    render();
    return true;
  };
  render();
  return {
    render,
    find,
    button,
    click,
    text,
    downloads,
    all: (predicate) => nodes.filter(predicate),
  };
}
