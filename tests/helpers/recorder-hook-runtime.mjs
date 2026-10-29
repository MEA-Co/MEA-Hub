import fs from 'node:fs';
import vm from 'node:vm';

import ts from 'typescript';

import { loadTypeScript } from './load-typescript.mjs';

const { requestSpeechSession, SpeechSessionError } = loadTypeScript(
  new URL('../../app/interview/_lib/speech-session.ts', import.meta.url),
);

/** Real recorder lifecycle with deterministic microphone and transport doubles. */
export function recorderHookRuntime({ workletSupported = true } = {}) {
  const slots = [];
  const requests = [];
  const microphones = [];
  const sessions = [];
  const texts = [];
  let cursor = 0;
  let dirty = true;
  let enabled = true;
  let effects = [];
  let view;
  const equal = (a, b) =>
    a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!slots[i])
        slots[i] = {
          value: typeof initial === 'function' ? initial() : initial,
        };
      return [
        slots[i].value,
        (next) => {
          const value =
            typeof next === 'function' ? next(slots[i].value) : next;
          if (!Object.is(value, slots[i].value)) {
            slots[i].value = value;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: { current: initial } };
      return slots[i].value;
    },
    useCallback(callback, dependencies) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].dependencies, dependencies))
        slots[i] = { value: callback, dependencies };
      return slots[i].value;
    },
    useEffect(effect, dependencies) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].dependencies, dependencies)) {
        const cleanup = slots[i]?.cleanup;
        slots[i] = { dependencies };
        effects.push(() => {
          cleanup?.();
          slots[i].cleanup = effect();
        });
      }
    },
  };
  const fetcher = (_url, options) =>
    new Promise((resolve, reject) => {
      const abort = () => reject(new Error('synthetic abort'));
      options.signal.addEventListener('abort', abort, { once: true });
      requests.push({
        signal: options.signal,
        respond: (value) => {
          options.signal.removeEventListener('abort', abort);
          resolve(Response.json(value));
        },
      });
    });
  class AudioContext {}
  if (workletSupported) AudioContext.prototype.audioWorklet = {};
  const exported = {};
  const output = ts.transpileModule(
    fs.readFileSync(
      new URL('../../app/interview/_lib/use-recorder.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(output, {
    exports: exported,
    require(id) {
      if (id === 'react') return hooks;
      if (id === './speech-session')
        return {
          SpeechSessionError,
          requestSpeechSession: (signal) =>
            requestSpeechSession(signal, fetcher),
        };
      if (id === './live-speech')
        return {
          createLiveSpeechSession: (options) => {
            const session = {
              options,
              start: async () => options.onReady(),
              stop() {},
              cancel() {
                options.stream.getTracks().forEach((track) => track.stop());
              },
            };
            sessions.push(session);
            return session;
          },
        };
      throw new Error('Unexpected recorder test import');
    },
    navigator: {
      mediaDevices: {
        getUserMedia: async () => {
          const track = {
            stopped: false,
            stop() {
              this.stopped = true;
            },
          };
          const media = { getTracks: () => [track] };
          microphones.push({ track, media });
          return media;
        },
      },
    },
    AudioContext,
    AudioWorkletNode: workletSupported ? class {} : undefined,
    AbortController,
    Blob,
    setTimeout,
    clearTimeout,
  });
  const options = { sessionBased: true };
  const onText = (text) => texts.push(text);
  function flush() {
    let n = 0;
    while (dirty) {
      if (++n > 30) throw new Error('Recorder hook did not settle');
      dirty = false;
      cursor = 0;
      view = exported.useRecorder(enabled, onText, options);
      const pending = effects;
      effects = [];
      pending.forEach((effect) => effect());
    }
  }
  async function settle() {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
      flush();
    }
  }
  flush();
  return {
    get view() {
      return view;
    },
    requests,
    microphones,
    sessions,
    texts,
    settle,
    act(fn) {
      const promise = fn(view);
      flush();
      return promise;
    },
    disable() {
      enabled = false;
      dirty = true;
      flush();
    },
    dispose() {
      for (const slot of slots) slot?.cleanup?.();
    },
  };
}
