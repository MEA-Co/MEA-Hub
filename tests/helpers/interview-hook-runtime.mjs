import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import ts from 'typescript';

/**
 * Runs the real useInterview source with deterministic hook slots, effects,
 * time and streaming transport. No browser, network or provider is involved.
 */
export function createInterviewHookRuntime(options = {}) {
  const projectRoot =
    options.projectRoot ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const slots = [];
  const intervals = new Map();
  const requests = [];
  const modules = new Map();
  let cursor = 0;
  let dirty = true;
  let pendingEffects = [];
  let clock = 1_000_000;
  let intervalId = 0;
  let view;
  let invokeHook;

  const sameDependencies = (left, right) =>
    left &&
    right &&
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]));
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index])
        slots[index] = {
          value: typeof initial === 'function' ? initial() : initial,
        };
      return [
        slots[index].value,
        (update) => {
          const next =
            typeof update === 'function' ? update(slots[index].value) : update;
          if (!Object.is(next, slots[index].value)) {
            slots[index].value = next;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: { current: initial } };
      return slots[index].value;
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      if (
        !slots[index] ||
        !sameDependencies(slots[index].dependencies, dependencies)
      )
        slots[index] = { value: callback, dependencies };
      return slots[index].value;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (
        !slots[index] ||
        !sameDependencies(slots[index].dependencies, dependencies)
      ) {
        const cleanup = slots[index]?.cleanup;
        slots[index] = { dependencies, effect: true };
        pendingEffects.push(() => {
          cleanup?.();
          slots[index].cleanup = effect();
        });
      }
    },
  };

  const streamInterview = (payload, signal, onEvent) =>
    new Promise((resolve, reject) => {
      const onAbort = () => reject(new Error('aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
      requests.push({
        payload,
        signal,
        onEvent,
        resolve: () => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        },
        reject: (error) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      });
    });

  function loadModule(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const loadedModule = { exports: {} };
    modules.set(filename, loadedModule);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText;
    const requireModule = (specifier) => {
      if (specifier === 'react') return hooks;
      if (specifier === './stream') return { streamInterview };
      if (specifier.startsWith('.'))
        return loadModule(
          path.resolve(path.dirname(filename), `${specifier}.ts`),
        );
      throw new Error(`Unexpected import in hook test: ${specifier}`);
    };
    vm.runInNewContext(
      output,
      {
        module: loadedModule,
        exports: loadedModule.exports,
        require: requireModule,
        AbortController,
        Date: { now: () => clock },
        window: {
          setInterval(callback) {
            const id = ++intervalId;
            intervals.set(id, callback);
            return id;
          },
          clearInterval(id) {
            intervals.delete(id);
          },
        },
      },
      { filename },
    );
    return loadedModule.exports;
  }

  invokeHook = loadModule(
    path.join(projectRoot, 'app/interview/_lib/use-interview.ts'),
  ).useInterview;
  const flush = () => {
    let renders = 0;
    while (dirty) {
      if (++renders > 30) throw new Error('Hook did not settle');
      dirty = false;
      cursor = 0;
      view = invokeHook();
      const effects = pendingEffects;
      pendingEffects = [];
      for (const effect of effects) effect();
    }
  };
  const settle = async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
      flush();
    }
  };
  flush();

  return {
    get view() {
      return view;
    },
    requests,
    act(callback) {
      callback(view);
      flush();
    },
    advance(seconds) {
      clock += seconds * 1000;
      for (const callback of [...intervals.values()]) callback();
      flush();
    },
    async respond(index, events) {
      for (const event of events) {
        requests[index].onEvent(event);
        flush();
      }
      requests[index].resolve();
      await settle();
    },
    async fail(index, message = '평가 연결을 다시 확인해주세요.') {
      requests[index].reject(new Error(message));
      await settle();
    },
    dispose() {
      for (const slot of slots) if (slot?.effect) slot.cleanup?.();
      intervals.clear();
    },
  };
}
