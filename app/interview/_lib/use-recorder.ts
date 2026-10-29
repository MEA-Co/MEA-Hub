'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { createLiveSpeechSession } from './live-speech';
import { requestSpeechSession, SpeechSessionError } from './speech-session';

async function toWave(blob: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(
      1,
      Math.ceil(Math.min(decoded.duration, 120) * 16000),
      16000,
    );
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const string = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1)
        view.setUint8(offset + i, value.charCodeAt(i));
    };
    string(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    string(8, 'WAVE');
    string(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    string(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(
        44 + i * 2,
        sample < 0 ? sample * 32768 : sample * 32767,
        true,
      );
    }
    return new Blob([buffer], { type: 'audio/wav' });
  } finally {
    await context.close();
  }
}

export function useRecorder(
  enabled: boolean,
  onText: (text: string) => void,
  options?: {
    websocketUrl?: string;
    sessionBased?: boolean;
    onPartial?: (text: string) => void;
  },
) {
  const websocketUrl = options?.websocketUrl;
  const sessionBased = options?.sessionBased === true;
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const live = useRef<ReturnType<typeof createLiveSpeechSession> | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const tracks = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const requesting = useRef(false);
  const active = useRef(enabled);
  const controller = useRef<AbortController | null>(null);
  const callback = useRef(onText);
  const partialCallback = useRef(options?.onPartial);
  useEffect(() => {
    callback.current = onText;
  }, [onText]);
  useEffect(() => {
    partialCallback.current = options?.onPartial;
  }, [options?.onPartial]);

  const cancel = useCallback(() => {
    requesting.current = false;
    generation.current += 1;
    live.current?.cancel();
    live.current = null;
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recorder.current = null;
    tracks.current?.getTracks().forEach((track) => track.stop());
    tracks.current = null;
    controller.current?.abort();
    setRecording(false);
    setPreparing(false);
    setTranscribing(false);
  }, []);

  useEffect(() => {
    active.current = enabled;
    // Closing a question disconnects the external microphone and its UI together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!enabled) cancel();
  }, [cancel, enabled]);
  useEffect(
    () => () => {
      active.current = false;
      generation.current += 1;
      live.current?.cancel();
      live.current = null;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === 'recording') recorder.current.stop();
      tracks.current?.getTracks().forEach((track) => track.stop());
      controller.current?.abort();
    },
    [],
  );

  const stop = useCallback(() => {
    if (live.current) {
      live.current.stop();
      return;
    }
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (
      !active.current ||
      live.current ||
      recorder.current ||
      requesting.current ||
      preparing ||
      transcribing
    )
      return;
    setError('');
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === 'undefined'
    ) {
      setError(
        '이 브라우저에서는 녹음을 사용할 수 없습니다. 채팅으로 답변해주세요.',
      );
      return;
    }
    if (
      sessionBased &&
      (typeof AudioWorkletNode === 'undefined' ||
        !('audioWorklet' in AudioContext.prototype))
    ) {
      setError(
        '이 브라우저에서는 실시간 음성을 사용할 수 없습니다. 채팅으로 답변해주세요.',
      );
      return;
    }
    const token = ++generation.current;
    requesting.current = true;
    setPreparing(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current || token !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      tracks.current = media;
      let connectionUrl = websocketUrl;
      if (sessionBased) {
        const abort = new AbortController();
        controller.current = abort;
        const timeout = setTimeout(() => abort.abort(), 20000);
        try {
          connectionUrl = await requestSpeechSession(abort.signal);
        } finally {
          clearTimeout(timeout);
          if (controller.current === abort) controller.current = null;
        }
        if (!active.current || token !== generation.current) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
      }
      const liveSupported = Boolean(
        connectionUrl &&
          typeof AudioWorkletNode !== 'undefined' &&
          'audioWorklet' in AudioContext.prototype,
      );
      setStreaming(liveSupported);
      if (liveSupported && connectionUrl) {
        const current = () => active.current && token === generation.current;
        const session = createLiveSpeechSession({
          url: connectionUrl,
          agentCoreSession: sessionBased,
          stream: media,
          onReady: () => {
            if (current()) {
              requesting.current = false;
              setPreparing(false);
              setRecording(true);
            }
          },
          onFinalizing: () => {
            if (current()) {
              setRecording(false);
              setTranscribing(true);
            }
          },
          onPartial: (text) => {
            if (current()) partialCallback.current?.(text);
          },
          onComplete: (text) => {
            if (current()) {
              callback.current(text);
              live.current = null;
              tracks.current = null;
              setRecording(false);
              setTranscribing(false);
            }
          },
          onError: (message) => {
            if (current()) {
              live.current = null;
              tracks.current = null;
              requesting.current = false;
              setPreparing(false);
              setRecording(false);
              setTranscribing(false);
              setError(message);
            }
          },
        });
        live.current = session;
        await session.start().catch(() => undefined);
        return;
      }
      if (typeof MediaRecorder === 'undefined')
        throw new Error('Recording is unavailable');
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(
        media,
        mimeType ? { mimeType } : undefined,
      );
      recorder.current = capture;
      let recordingTimer: ReturnType<typeof setTimeout> | null = null;
      const chunks: Blob[] = [];
      capture.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      capture.onerror = () => {
        if (token !== generation.current) return;
        cancel();
        setError(
          '녹음에 문제가 생겼습니다. 채팅으로 답변하거나 다시 녹음해주세요.',
        );
      };
      capture.onstop = async () => {
        media.getTracks().forEach((track) => track.stop());
        if (recordingTimer) clearTimeout(recordingTimer);
        if (recorder.current === capture) recorder.current = null;
        if (tracks.current === media) tracks.current = null;
        if (!active.current || token !== generation.current) return;
        setRecording(false);
        setTranscribing(true);
        const abort = new AbortController();
        controller.current = abort;
        const timeout = setTimeout(() => abort.abort(), 90000);
        try {
          const blob = new Blob(chunks, { type: capture.mimeType });
          if (!blob.size)
            throw new Error('녹음된 음성이 없습니다. 다시 녹음해주세요.');
          const wave = await toWave(blob);
          if (!active.current || token !== generation.current) return;
          if (wave.size > 10 * 1024 * 1024)
            throw new Error('녹음이 너무 깁니다. 답변을 나누어 녹음해주세요.');
          const data = new FormData();
          data.append('file', wave, 'answer.wav');
          const response = await fetch('/api/interview/transcribe', {
            method: 'POST',
            body: data,
            signal: abort.signal,
          });
          const body = (await response.json().catch(() => null)) as {
            text?: unknown;
            detail?: unknown;
            message?: unknown;
          } | null;
          if (!response.ok)
            throw new Error(
              typeof body?.detail === 'string'
                ? body.detail
                : typeof body?.message === 'string'
                  ? body.message
                  : '음성을 인식하지 못했습니다. 다시 시도하거나 채팅으로 입력해주세요.',
            );
          if (typeof body?.text !== 'string' || !body.text.trim())
            throw new Error(
              '인식된 말이 없습니다. 채팅으로 입력하거나 다시 녹음해주세요.',
            );
          if (active.current && token === generation.current)
            callback.current(body.text.trim());
        } catch (cause) {
          if (active.current && token === generation.current)
            setError(
              cause instanceof Error && cause.name !== 'AbortError'
                ? cause.message
                : '음성 처리 시간이 초과되었습니다. 채팅으로 입력하거나 다시 시도해주세요.',
            );
        } finally {
          clearTimeout(timeout);
          if (token === generation.current) setTranscribing(false);
        }
      };
      capture.start();
      setRecording(true);
      recordingTimer = setTimeout(() => {
        if (capture.state === 'recording') capture.stop();
      }, 120000);
      timer.current = recordingTimer;
    } catch (cause) {
      if (token !== generation.current) return;
      cancel();
      setError(
        cause instanceof SpeechSessionError
          ? cause.message
          : '마이크를 사용할 수 없습니다. 브라우저의 마이크 권한을 확인하거나 채팅으로 입력해주세요.',
      );
    } finally {
      if (token === generation.current) {
        requesting.current = false;
        setPreparing(false);
      }
    }
  }, [cancel, websocketUrl, sessionBased, preparing, transcribing]);

  return {
    recording,
    preparing,
    transcribing,
    streaming,
    error,
    start,
    stop,
    cancel,
  };
}
