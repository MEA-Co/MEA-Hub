'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { snapshotCircumstances } from './circumstances';
import { streamInterview } from './stream';
import {
  type Activity,
  type Circumstances,
  type InterviewRequest,
  type InterviewResult,
  type Kind,
  type Question,
  type Settings,
  type Turn,
  turnFromQuestion,
} from './types';

type ActiveRequest = {
  id: number;
  payload: InterviewRequest;
  committed: boolean;
};

export function useInterview() {
  const [phase, setPhase] = useState<'setup' | 'live' | 'result'>('setup');
  const [question, setQuestion] = useState<Question | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [streamingKind, setStreamingKind] = useState<Kind>('activity');
  const [history, setHistory] = useState<Turn[]>([]);
  const [answer, setAnswerState] = useState('');
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [mode, setMode] = useState<'live' | 'demo'>('live');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [minuteWarning, setMinuteWarning] = useState(false);
  const [circumstancesSnapshot, setCircumstancesSnapshot] =
    useState<Circumstances | null>(null);
  const context = useRef<{
    activities: Activity[];
    settings: Settings;
    circumstances?: Circumstances;
  } | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const questionRef = useRef<Question | null>(null);
  const answerRef = useRef('');
  const startRef = useRef<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const currentRequest = useRef<ActiveRequest | null>(null);
  const requestNumber = useRef(0);
  const endingRef = useRef(false);
  const expiredRef = useRef(false);
  const retryRef = useRef<InterviewRequest | null>(null);
  const finishRef = useRef<(reason: 'manual' | 'timeout') => void>(
    () => undefined,
  );

  const setAnswer = useCallback((value: string) => {
    answerRef.current = value;
    setAnswerState(value);
  }, []);

  const elapsed = useCallback(
    () =>
      startRef.current === null
        ? 0
        : Math.floor((Date.now() - startRef.current) / 1000),
    [],
  );

  const run = useCallback(
    async (payload: InterviewRequest) => {
      controllerRef.current?.abort();
      const id = ++requestNumber.current;
      const controller = new AbortController();
      controllerRef.current = controller;
      currentRequest.current = { id, payload, committed: false };
      retryRef.current = payload;
      setBusy(true);
      setError('');
      setStreamingText('');
      try {
        await streamInterview(payload, controller.signal, (event) => {
          if (id !== requestNumber.current) return;
          if ('mode' in event) setMode(event.mode);
          if (event.type === 'question_start') setStreamingKind(event.kind);
          if (event.type === 'token')
            setStreamingText((previous) => previous + event.token);
          if (event.type === 'question') {
            historyRef.current = payload.history;
            setHistory(payload.history);
            questionRef.current = event.question;
            setQuestion(event.question);
            setAnswer('');
            setStreamingText('');
            setPhase('live');
            if (startRef.current === null) {
              const now = Date.now();
              startRef.current = now;
              setStartedAt(now);
            }
            if (currentRequest.current?.id === id)
              currentRequest.current.committed = true;
          }
          if (event.type === 'result') {
            historyRef.current = event.result.turns;
            setHistory(event.result.turns);
            setResult(event.result);
            setPhase('result');
            questionRef.current = null;
            setQuestion(null);
            setAnswer('');
            if (currentRequest.current?.id === id)
              currentRequest.current.committed = true;
          }
        });
        if (id === requestNumber.current) retryRef.current = null;
      } catch (cause) {
        if (id !== requestNumber.current || controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : '연결에 문제가 생겼습니다. 다시 시도해주세요.',
        );
        setStreamingText('');
        if (payload.action === 'start' && startRef.current === null)
          setPhase('setup');
      } finally {
        if (id === requestNumber.current) {
          currentRequest.current = null;
          setBusy(false);
        }
      }
    },
    [setAnswer],
  );

  const start = useCallback(
    (
      activities: Activity[],
      settings: Settings,
      circumstances?: Circumstances | null,
    ) => {
      if (currentRequest.current) return;
      const snapshot = snapshotCircumstances(circumstances);
      context.current = {
        activities,
        settings,
        ...(snapshot ? { circumstances: snapshot } : {}),
      };
      setCircumstancesSnapshot(snapshot);
      historyRef.current = [];
      questionRef.current = null;
      startRef.current = null;
      endingRef.current = false;
      expiredRef.current = false;
      setStartedAt(null);
      setHistory([]);
      setQuestion(null);
      setAnswer('');
      setResult(null);
      setEnding(false);
      setMinuteWarning(false);
      setRemaining(settings.duration_minutes * 60);
      setPhase('live');
      void run({
        action: 'start',
        ...context.current,
        history: [],
        elapsed_seconds: 0,
        consent: true,
      });
    },
    [run, setAnswer],
  );

  const finish = useCallback(
    (reason: 'manual' | 'timeout') => {
      if (!context.current || endingRef.current) return;
      endingRef.current = true;
      setEnding(true);
      const inflight = currentRequest.current;
      let turns = historyRef.current;
      let pending = questionRef.current ?? undefined;
      if (
        inflight &&
        !inflight.committed &&
        inflight.payload.action === 'answer'
      ) {
        turns = inflight.payload.history;
        pending = undefined;
      } else if (pending && answerRef.current.trim()) {
        turns = [...turns, turnFromQuestion(pending, answerRef.current.trim())];
        pending = undefined;
      }
      void run({
        action: 'finish',
        ...context.current,
        history: turns,
        current_question: pending,
        elapsed_seconds: Math.min(
          elapsed(),
          context.current.settings.duration_minutes * 60,
        ),
        finish_reason: reason,
        consent: true,
      });
    },
    [elapsed, run],
  );

  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const submit = useCallback(() => {
    const pending = questionRef.current;
    const text = answerRef.current.trim();
    if (
      currentRequest.current ||
      endingRef.current ||
      !context.current ||
      !pending ||
      !text
    )
      return;
    if (elapsed() >= context.current.settings.duration_minutes * 60) {
      finish('timeout');
      return;
    }
    if (historyRef.current.length >= 99) {
      finish('manual');
      return;
    }
    const turns = [...historyRef.current, turnFromQuestion(pending, text)];
    void run({
      action: 'answer',
      ...context.current,
      history: turns,
      elapsed_seconds: elapsed(),
      consent: true,
    });
  }, [elapsed, finish, run]);

  const retry = useCallback(() => {
    if (currentRequest.current || !retryRef.current) return;
    if (
      retryRef.current.action !== 'finish' &&
      context.current &&
      elapsed() >= context.current.settings.duration_minutes * 60
    ) {
      finish('timeout');
      return;
    }
    if (retryRef.current.action === 'answer') {
      submit();
      return;
    }
    void run(
      retryRef.current.action === 'finish'
        ? retryRef.current
        : { ...retryRef.current, elapsed_seconds: elapsed() },
    );
  }, [elapsed, finish, run, submit]);

  const reset = useCallback(() => {
    ++requestNumber.current;
    controllerRef.current?.abort();
    currentRequest.current = null;
    retryRef.current = null;
    context.current = null;
    historyRef.current = [];
    questionRef.current = null;
    startRef.current = null;
    endingRef.current = false;
    expiredRef.current = false;
    setStartedAt(null);
    setQuestion(null);
    setHistory([]);
    setAnswer('');
    setResult(null);
    setError('');
    setBusy(false);
    setEnding(false);
    setMinuteWarning(false);
    setCircumstancesSnapshot(null);
    setPhase('setup');
  }, [setAnswer]);

  useEffect(() => {
    if (phase !== 'live' || startedAt === null) return;
    const tick = () => {
      if (!context.current) return;
      const left = Math.max(
        0,
        context.current.settings.duration_minutes * 60 -
          Math.floor((Date.now() - startedAt) / 1000),
      );
      setRemaining(left);
      if (left <= 60) setMinuteWarning(true);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        finishRef.current('timeout');
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(
    () => () => {
      ++requestNumber.current;
      controllerRef.current?.abort();
    },
    [],
  );

  return {
    phase,
    question,
    streamingText,
    streamingKind,
    history,
    answer,
    setAnswer,
    busy,
    ending,
    error,
    result,
    mode,
    remaining,
    minuteWarning,
    circumstancesSnapshot,
    startedAt,
    start,
    submit,
    finish,
    retry,
    reset,
  };
}
