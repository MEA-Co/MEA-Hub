'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type Activity,
  activityDraftError,
  cleanActivities,
  importActivities,
} from './types';

type StorageState = {
  available: boolean;
  activities: Activity[] | null;
  revision: number;
  updated_at: string | null;
};
type Availability = 'checking' | 'available' | 'unavailable' | 'error';

function initialActivities(): Activity[] {
  return Array.from({ length: 10 }, (_, index) => ({
    id: `activity-${index + 1}`,
    category:
      index < 3
        ? 'autonomous'
        : index < 5
          ? 'club'
          : index < 7
            ? 'career'
            : 'subject',
    grade: ((index % 3) + 1) as Activity['grade'],
    title: '',
    core_content: '',
    reflection: '',
  }));
}

const fingerprint = (activities: Activity[]) =>
  JSON.stringify(cleanActivities(activities));

async function readStorageResponse(response: Response): Promise<StorageState> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 409)
      throw new Error(
        '다른 화면에서 저장본이 변경됐습니다. 현재 내용을 JSON으로 내보낸 뒤 저장본을 다시 불러와 비교해주세요. 현재 입력은 유지됩니다.',
      );
    throw new Error(
      response.status === 503
        ? '활동 저장을 지금 사용할 수 없습니다. 현재 입력은 유지되니 JSON으로 내보내주세요.'
        : '저장 서버에 연결하지 못했습니다. 현재 입력은 유지됩니다. 잠시 후 다시 시도해주세요.',
    );
  }
  if (!body || typeof body !== 'object')
    throw new Error('저장 상태를 확인하지 못했습니다. 현재 입력은 유지됩니다.');
  const value = body as Record<string, unknown>;
  if (
    typeof value.available !== 'boolean' ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    (value.updated_at !== null && typeof value.updated_at !== 'string') ||
    (value.activities !== null && !Array.isArray(value.activities))
  )
    throw new Error(
      '저장 응답 형식이 올바르지 않습니다. 현재 입력은 유지됩니다.',
    );
  return {
    available: value.available,
    revision: value.revision,
    updated_at: value.updated_at as string | null,
    activities:
      value.activities === null
        ? null
        : importActivities(JSON.stringify(value.activities)),
  };
}

export function useActivityDrafts(consent: boolean) {
  const [activities, setActivitiesState] =
    useState<Activity[]>(initialActivities);
  const [availability, setAvailability] = useState<Availability>('checking');
  const [busy, setBusy] = useState<'load' | 'save' | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [confirmLoad, setConfirmLoad] = useState(false);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    fingerprint(initialActivities()),
  );
  const activitiesRef = useRef(activities);
  const localVersion = useRef(0);
  const revision = useRef(0);
  const busyRef = useRef(false);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const changeActivities = useCallback((rows: Activity[]) => {
    localVersion.current += 1;
    activitiesRef.current = rows;
    setActivitiesState(rows);
    setStatus('');
  }, []);

  const check = useCallback(async (signal?: AbortSignal) => {
    if (busyRef.current || signal?.aborted) return;
    busyRef.current = true;
    const id = ++requestId.current;
    try {
      const fetchStatus = () =>
        fetch('/api/interview/activities', {
          cache: 'no-store',
          signal,
        });
      // Serialize the first cookie handshake across tabs so a late response cannot
      // replace a newly saved draft's browser identity. Older browsers still work.
      const response =
        typeof navigator !== 'undefined' && navigator.locks
          ? await navigator.locks.request(
              'mea-interview-owner',
              { signal },
              fetchStatus,
            )
          : await fetchStatus();
      const stored = await readStorageResponse(response);
      if (signal?.aborted || !mounted.current || id !== requestId.current)
        return;
      revision.current = stored.revision;
      setAvailability(stored.available ? 'available' : 'unavailable');
      setUpdatedAt(stored.updated_at);
      setHasSavedDraft(stored.activities !== null);
      setError('');
    } catch (cause) {
      if (signal?.aborted || !mounted.current || id !== requestId.current)
        return;
      setAvailability('error');
      setError(
        cause instanceof Error
          ? cause.message
          : '저장 연결을 확인하지 못했습니다.',
      );
    } finally {
      if (id === requestId.current) busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    void Promise.resolve().then(() => check(abort.signal));
    return () => {
      mounted.current = false;
      abort.abort();
      controller.current?.abort();
      busyRef.current = false;
    };
  }, [check]);

  const save = useCallback(async () => {
    if (busyRef.current || availability !== 'available') return;
    if (!consent) {
      setError(
        '원문·개인정보 제외와 면접·선택적 저장 사용에 먼저 동의해주세요.',
      );
      return;
    }
    const snapshot = cleanActivities(activitiesRef.current);
    const invalid = activityDraftError(snapshot);
    if (invalid) {
      setError(invalid);
      return;
    }
    busyRef.current = true;
    const id = ++requestId.current;
    const version = localVersion.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy('save');
    setError('');
    setStatus('');
    setConfirmLoad(false);
    try {
      const response = await fetch('/api/interview/activities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activities: snapshot,
          revision: revision.current,
          consent: true,
        }),
        signal: abort.signal,
      });
      const stored = await readStorageResponse(response);
      if (!mounted.current || abort.signal.aborted || id !== requestId.current)
        return;
      if (!stored.available)
        throw new Error(
          '활동 저장이 연결되지 않았습니다. 현재 입력은 유지됩니다.',
        );
      revision.current = stored.revision;
      setUpdatedAt(stored.updated_at);
      setHasSavedDraft(stored.activities !== null);
      setSavedFingerprint(fingerprint(snapshot));
      setStatus(
        version === localVersion.current
          ? '현재 활동을 저장했어요. 미완성 항목도 이어서 작성할 수 있어요.'
          : '요청한 시점의 활동을 저장했어요. 저장 중에 수정한 내용은 아직 저장되지 않았습니다.',
      );
    } catch (cause) {
      if (!mounted.current || abort.signal.aborted || id !== requestId.current)
        return;
      setError(
        cause instanceof Error
          ? cause.message
          : '저장에 실패했습니다. 현재 입력은 유지됩니다.',
      );
    } finally {
      if (id === requestId.current) {
        busyRef.current = false;
        setBusy(null);
      }
    }
  }, [availability, consent]);

  const performLoad = useCallback(async () => {
    if (busyRef.current || availability !== 'available') return;
    busyRef.current = true;
    const id = ++requestId.current;
    const version = localVersion.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy('load');
    setError('');
    setStatus('');
    setConfirmLoad(false);
    try {
      const response = await fetch('/api/interview/activities', {
        cache: 'no-store',
        signal: abort.signal,
      });
      const stored = await readStorageResponse(response);
      if (!mounted.current || abort.signal.aborted || id !== requestId.current)
        return;
      if (!stored.available) {
        setAvailability('unavailable');
        throw new Error(
          '활동 저장이 현재 연결되지 않았습니다. 현재 입력은 유지됩니다.',
        );
      }
      if (version !== localVersion.current) {
        setError(
          '불러오는 동안 활동을 수정해서 저장본으로 바꾸지 않았어요. 입력 내용을 확인한 뒤 다시 불러와주세요.',
        );
        return;
      }
      revision.current = stored.revision;
      setUpdatedAt(stored.updated_at);
      setHasSavedDraft(stored.activities !== null);
      if (stored.activities === null) {
        setStatus('아직 저장된 활동이 없어요. 현재 입력은 그대로 유지됩니다.');
        return;
      }
      const rows = stored.activities;
      changeActivities(rows);
      setSavedFingerprint(fingerprint(rows));
      setStatus(
        `${rows.length}개 활동을 불러왔어요. 내용을 확인하고 이어서 작성해주세요.`,
      );
    } catch (cause) {
      if (!mounted.current || abort.signal.aborted || id !== requestId.current)
        return;
      setError(
        cause instanceof Error
          ? cause.message
          : '불러오지 못했습니다. 현재 입력은 유지됩니다.',
      );
    } finally {
      if (id === requestId.current) {
        busyRef.current = false;
        setBusy(null);
      }
    }
  }, [availability, changeActivities]);

  const dirty = fingerprint(activities) !== savedFingerprint;
  const load = useCallback(() => {
    if (busyRef.current || availability !== 'available') return;
    if (fingerprint(activitiesRef.current) !== savedFingerprint) {
      setConfirmLoad(true);
      setError('');
      return;
    }
    void performLoad();
  }, [availability, performLoad, savedFingerprint]);

  const exportJSON = useCallback(() => {
    const rows = cleanActivities(activitiesRef.current);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `MEA-활동정리-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  return {
    activities,
    changeActivities,
    availability,
    busy,
    status,
    error,
    updatedAt,
    hasSavedDraft,
    confirmLoad,
    dirty,
    save,
    load,
    performLoad,
    cancelLoad: () => setConfirmLoad(false),
    check,
    exportJSON,
  };
}
