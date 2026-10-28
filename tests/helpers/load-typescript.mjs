import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ownRequire = createRequire(import.meta.url);
const ts = ownRequire('typescript');
const cache = new Map();

/** Execute real local TS modules in Node tests, with Next-style relative imports.
 * No app compiler settings change and no generated source files are required.
 */
export function loadTypeScript(filename) {
  const absolute =
    filename instanceof URL ? fileURLToPath(filename) : path.resolve(filename);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const loadedModule = { exports: {} };
  cache.set(absolute, loadedModule);
  const javascript = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const require = (id) => {
    if (!id.startsWith('.')) return createRequire(absolute)(id);
    const base = path.resolve(path.dirname(absolute), id);
    const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`].find(
      (file) => fs.existsSync(file) && fs.statSync(file).isFile(),
    );
    if (!resolved) throw new Error(`Cannot resolve ${id} from ${absolute}`);
    return /\.tsx?$/.test(resolved)
      ? loadTypeScript(resolved)
      : createRequire(absolute)(resolved);
  };
  new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    javascript,
  )(loadedModule.exports, require, loadedModule, absolute, path.dirname(absolute));
  return loadedModule.exports;
}
