'use client';

import {
  ArrowRight,
  ChevronDown,
  Clock3,
  Download,
  EyeOff,
  LoaderCircle,
  MessageSquareText,
  Mic,
  RefreshCw,
  Send,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { ActivityEditor } from './_components/activity-editor';
import { CircumstancesEditor } from './_components/circumstances-editor';
import { InterviewWorkspace } from './_components/interview-workspace';
import { PreparationGuide } from './_components/preparation-guide';
import { PreparationTextPanel } from './_components/preparation-text-panel';
import {
  buildCircumstances,
  initialCircumstancesDraft,
} from './_lib/circumstances';
import { withSpeechTranscript } from './_lib/speech-text';
import {
  type Activity,
  activityError,
  cleanActivities,
  formatResultText,
  formatTime,
  isActivityReady,
  KIND_LABELS,
  questionTypeLabel,
  type Settings,
  targetMajorError,
} from './_lib/types';
import { useInterview } from './_lib/use-interview';
import { useRecorder } from './_lib/use-recorder';

import './interview.css';

const DEFAULT_SETTINGS: Settings = {
  duration_minutes: 10,
  show_timer: true,
  ask_intro: true,
  ask_final_remarks: true,
};

function SettingToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-neutral-700">
          {label}
        </span>
        {description && (
          <span className="mt-1 block text-xs leading-5 text-neutral-400">
            {description}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="mea-setting-track" aria-hidden />
    </label>
  );
}

export default function InterviewPage() {
  const [activeTab, setActiveTab] = useState<'activities' | 'interview'>(
    'activities',
  );
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [circumstancesDraft, setCircumstancesDraft] = useState(
    initialCircumstancesDraft,
  );
  const [consent, setConsent] = useState(false);
  const [activities, setActivities] = useState<Activity[]>(() =>
    Array.from({ length: 10 }, (_, index) => ({
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
    })),
  );
  const [setupError, setSetupError] = useState('');
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [speechWebsocketUrl, setSpeechWebsocketUrl] = useState<
    string | undefined
  >();
  const [capabilitiesKnown, setCapabilitiesKnown] = useState(false);
  const [audioNotice, setAudioNotice] = useState('');
  const [consentAttention, setConsentAttention] = useState(0);
  const [targetMajor, setTargetMajor] = useState('');
  const [targetMajorIssue, setTargetMajorIssue] = useState('');
  const [majorAttention, setMajorAttention] = useState(0);
  const interview = useInterview();
  const consentBlock = useRef<HTMLDivElement | null>(null);
  const consentBox = useRef<HTMLInputElement | null>(null);
  const targetMajorBox = useRef<HTMLInputElement | null>(null);
  const answerBox = useRef<HTMLTextAreaElement | null>(null);
  const headline = useRef<HTMLHeadingElement | null>(null);
  const speechPrefix = useRef('');
  const receiveSpeech = (text: string) => {
    const combined = withSpeechTranscript(speechPrefix.current, text);
    if (combined.truncated)
      setAudioNotice(
        '음성 인식 결과가 답변 길이를 넘어서 일부만 입력됐어요. 답변을 확인해주세요.',
      );
    interview.setAnswer(combined.text);
  };
  const recorder = useRecorder(
    activeTab === 'interview' &&
      interview.phase === 'live' &&
      !interview.busy &&
      !interview.ending &&
      Boolean(interview.question),
    (text) => {
      receiveSpeech(text);
      answerBox.current?.focus();
    },
    { websocketUrl: speechWebsocketUrl, onPartial: receiveSpeech },
  );

  useEffect(() => {
    const abort = new AbortController();
    void fetch('/api/interview/capabilities', { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (body && typeof body === 'object') {
          const capabilities = body as Record<string, unknown>;
          const canStream =
            capabilities.speech_streaming === true &&
            typeof capabilities.speech_websocket_url === 'string' &&
            typeof AudioContext !== 'undefined' &&
            typeof AudioWorkletNode !== 'undefined' &&
            'audioWorklet' in AudioContext.prototype;
          if (canStream)
            setSpeechWebsocketUrl(capabilities.speech_websocket_url as string);
          setSpeechAvailable(
            capabilities.speech_recognition === true || canStream,
          );
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!abort.signal.aborted) setCapabilitiesKnown(true);
      });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (interview.phase === 'result' && activeTab === 'interview')
      headline.current?.focus();
  }, [activeTab, interview.phase]);

  useEffect(() => {
    if (activeTab !== 'activities' || consent || consentAttention === 0) return;
    consentBox.current?.focus({ preventScroll: true });
    consentBlock.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'center',
    });
  }, [activeTab, consent, consentAttention]);

  useEffect(() => {
    if (activeTab !== 'activities' || !targetMajorIssue || majorAttention === 0)
      return;
    targetMajorBox.current?.focus({ preventScroll: true });
    targetMajorBox.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'center',
    });
  }, [activeTab, majorAttention, targetMajorIssue]);

  const requestConsent = () => {
    setActiveTab('activities');
    setConsentAttention((attempt) => attempt + 1);
  };

  const changeTab = (tab: 'activities' | 'interview') => {
    if (tab === 'interview' && interview.phase === 'setup' && !consent) {
      requestConsent();
      return false;
    }
    setActiveTab(tab);
    return true;
  };

  const begin = () => {
    if (interview.busy || interview.phase !== 'setup') return;
    const majorIssue = targetMajorError(targetMajor);
    if (majorIssue) {
      setSetupError(majorIssue);
      setTargetMajorIssue(majorIssue);
      setMajorAttention((attempt) => attempt + 1);
      setActiveTab('activities');
      return;
    }
    const cleaned = cleanActivities(activities);
    const error = activityError(cleaned);
    if (error) {
      setSetupError(error);
      return;
    }
    if (
      !Number.isInteger(settings.duration_minutes) ||
      settings.duration_minutes < 3 ||
      settings.duration_minutes > 20
    ) {
      setSetupError('면접 시간은 3~20분 사이의 정수로 입력해주세요.');
      return;
    }
    if (!consent) {
      setSetupError('개인정보와 원문을 제외한 요약인지 확인해주세요.');
      return;
    }
    let circumstances;
    try {
      circumstances = buildCircumstances(circumstancesDraft);
    } catch (cause) {
      setSetupError(
        cause instanceof Error
          ? cause.message
          : '선택한 특이사항의 내용을 확인해주세요.',
      );
      return;
    }
    setSetupError('');
    setActivities(cleaned);
    setActiveTab('interview');
    interview.start(cleaned, settings, circumstances, targetMajor.trim());
  };

  const download = () => {
    const result = interview.result;
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([formatResultText(result, interview.targetMajorSnapshot)], {
        type: 'text/plain;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `MEA-면접결과-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const currentText =
    interview.streamingText ||
    (!interview.busy ? interview.question?.text : undefined);
  const transition =
    !interview.busy && !interview.ending
      ? interview.question?.transition
      : undefined;
  const kind = interview.streamingText
    ? interview.streamingKind
    : (interview.question?.kind ?? interview.streamingKind);

  return (
    <InterviewWorkspace
      activeTab={activeTab}
      onTabChange={changeTab}
      phase={interview.phase}
    >
      {activeTab === 'activities' &&
        interview.phase === 'live' &&
        interview.minuteWarning && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
          >
            <strong>
              {interview.remaining > 0
                ? '면접 종료까지 1분 이내로 남았습니다.'
                : '면접 시간이 끝났습니다.'}
            </strong>
            <p>
              면접 탭에서 답변을 마무리해주세요. 탭을 이동해도 면접 시간은 계속
              흐릅니다.
            </p>
            <button
              type="button"
              className="mt-2 font-semibold underline"
              onClick={() => setActiveTab('interview')}
            >
              진행 중인 면접으로 돌아가기
            </button>
          </div>
        )}
      {activeTab === 'activities' && interview.phase === 'result' && (
        <div
          role="status"
          className="mb-5 rounded-lg bg-[#f5f5f2] p-4 text-sm text-neutral-800"
        >
          면접 결과가 준비됐어요.{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setActiveTab('interview')}
          >
            면접 결과 보기
          </button>
        </div>
      )}
      <section
        role="tabpanel"
        id="activities-panel"
        aria-labelledby="activities-tab"
        hidden={activeTab !== 'activities'}
      >
        <div className="mea-page-heading">
          <h1 className="text-2xl font-bold text-neutral-950">활동 입력</h1>
          <p className="mt-3 text-sm leading-7 text-neutral-500">
            활동한 사실과 그 경험에서 얻은 생각을 나누어 적어보세요. 입력한
            내용은 면접 탭으로 옮겨도 그대로 유지됩니다.
          </p>
        </div>
        <div className="mea-info-strip mb-1">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <strong>생기부 원문은 올리거나 붙여넣지 마세요.</strong>
            <br />
            이름·학교명 등 개인정보를 빼고 본인이 직접 검토·수정한 정보만
            입력해주세요. 원본 파일을 받는 기능은 제공하지 않습니다.
          </p>
        </div>
        <div
          ref={consentBlock}
          className={`mea-consent-block mb-4 ${consentAttention > 0 && !consent ? 'is-highlighted' : ''}`}
        >
          <label
            htmlFor="activity-consent"
            className="mea-consent cursor-pointer"
          >
            <input
              ref={consentBox}
              id="activity-consent"
              type="checkbox"
              checked={consent}
              disabled={interview.phase === 'live'}
              aria-invalid={(consentAttention > 0 && !consent) || undefined}
              aria-describedby={
                consentAttention > 0 && !consent
                  ? 'activity-consent-reminder'
                  : undefined
              }
              onChange={(event) => {
                setConsent(event.target.checked);
                if (event.target.checked) setConsentAttention(0);
              }}
              className="mt-1 size-4 shrink-0 accent-neutral-900"
            />
            <span>
              생기부 원문과 개인정보를 제외하고 내용을 직접 검토·수정했으며,
              면접의 질문 생성과 평가에 사용하는 것에 동의합니다.
            </span>
          </label>
          {consentAttention > 0 && !consent && (
            <p
              id="activity-consent-reminder"
              role="alert"
              className="mea-consent-reminder"
            >
              면접 설정으로 이동하려면 위 확인 문항을 먼저 체크해주세요.
            </p>
          )}
        </div>
        <section
          aria-labelledby="target-major-heading"
          className="mea-card mb-4 p-4 sm:p-5"
        >
          <label
            htmlFor="target-major"
            id="target-major-heading"
            className="text-sm font-semibold text-neutral-900"
          >
            지원학과{' '}
            <span className="ml-1 text-xs font-normal text-red-700">필수</span>
          </label>
          <p
            id="target-major-help"
            className="mt-1 text-xs leading-6 text-neutral-500"
          >
            연습하려는 지원학과를 적어주세요. 활동과 전공 질문의 맥락에
            참고합니다. 학교명·연락처 등 개인정보는 넣지 마세요.
          </p>
          <input
            ref={targetMajorBox}
            id="target-major"
            type="text"
            value={targetMajor}
            required
            maxLength={100}
            disabled={interview.phase === 'live'}
            aria-invalid={Boolean(targetMajorIssue) || undefined}
            aria-describedby={`target-major-help${targetMajorIssue ? ' target-major-error' : ''}`}
            onChange={(event) => {
              if (interview.phase === 'live') return;
              setTargetMajor(event.target.value);
              if (targetMajorIssue)
                setTargetMajorIssue(targetMajorError(event.target.value) ?? '');
            }}
            placeholder="예: 컴퓨터공학과"
            className={`mea-input mt-3 ${targetMajorIssue ? 'border-red-500 ring-1 ring-red-200' : ''}`}
          />
          {targetMajorIssue && (
            <p
              id="target-major-error"
              role="alert"
              className="mt-2 text-xs text-red-700"
            >
              {targetMajorIssue}
            </p>
          )}
        </section>
        <PreparationGuide />
        <PreparationTextPanel
          activities={activities}
          circumstances={circumstancesDraft}
          targetMajor={targetMajor}
          onImport={(value) => {
            if (interview.phase === 'live') return;
            setActivities(value.activities);
            if (value.circumstances) setCircumstancesDraft(value.circumstances);
            if (value.targetMajor !== undefined) {
              setTargetMajor(value.targetMajor);
              setTargetMajorIssue('');
            }
            setSetupError('');
          }}
          disabled={interview.phase === 'live'}
        />
        <CircumstancesEditor
          value={circumstancesDraft}
          onChange={(value) => {
            if (interview.phase !== 'live') setCircumstancesDraft(value);
          }}
          disabled={interview.phase === 'live'}
        />
        <ActivityEditor
          activities={activities}
          onChange={(rows: Activity[]) => {
            if (interview.phase !== 'live') setActivities(rows);
          }}
          disabled={interview.phase === 'live'}
        />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-6 text-neutral-400">
            새로고침하면 현재 작성 내용이 사라집니다. 다시 사용하려면 활동과
            특이사항을 TXT로 저장해주세요.
          </p>
          <Button
            type="button"
            className="h-11 rounded-md mea-button-primary hover:bg-neutral-800"
            onClick={() => changeTab('interview')}
          >
            {interview.phase === 'live'
              ? '진행 중인 면접으로 이동'
              : interview.phase === 'result'
                ? '면접 결과로 이동'
                : '면접 설정으로 이동'}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </section>
      <section
        role="tabpanel"
        id="interview-panel"
        aria-labelledby="interview-tab"
        hidden={activeTab !== 'interview'}
      >
        {interview.phase === 'setup' && (
          <>
            <div className="mea-page-heading">
              <h1 className="text-2xl font-bold text-neutral-950">면접 설정</h1>
              <p className="mt-3 text-sm leading-7 text-neutral-500">
                활동을 확인하고 면접 시간과 공통 질문을 선택해주세요. 면접이
                끝나면 질문·답변과 한 문단의 피드백을 돌아볼 수 있어요.
              </p>
              <p className="mt-2 text-xs leading-6 text-neutral-400">
                일반 경험 질문도 서버가 섞어 제시해요. 활동 목록 밖의 경험을
                골라도 되고, 해당 경험이 없으면 없다고 답해도 괜찮아요.
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-700">
                지원학과:{' '}
                {targetMajor.trim() || '활동 입력 탭에서 입력해주세요'}
              </p>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <section
                aria-labelledby="readiness-heading"
                className="mea-card p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2
                      id="readiness-heading"
                      className="text-xl font-bold text-neutral-900"
                    >
                      준비한 활동
                    </h2>
                  </div>
                  <span
                    className={`rounded-md px-2.5 py-1 text-sm font-semibold ${!activityError(activities) ? 'bg-[#f7efbf] text-neutral-800' : 'bg-[#f5f5f2] text-neutral-800'}`}
                  >
                    {activities.filter(isActivityReady).length} / 10개 준비
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-neutral-500">
                  창체·세특·주요 활동 합계 10개 이상이 필요해요. 주제와 핵심내용
                  20자 이상을 확인합니다. 느낀점/알게된점이 없으면 비워두어도
                  괜찮아요.
                </p>
                <p
                  className={`mt-4 rounded-md p-3 text-sm leading-6 ${activityError(activities) ? 'bg-amber-50 text-amber-800' : 'bg-[#f7efbf] text-neutral-800'}`}
                >
                  {activityError(activities) ||
                    '활동 준비가 끝났어요. 원하는 면접 설정으로 연습을 시작해보세요.'}
                </p>
                <div className="mt-5 divide-y divide-neutral-100">
                  {activities.map((activity, index) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 py-4"
                    >
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isActivityReady(activity) ? 'bg-neutral-100 text-neutral-800' : 'bg-neutral-100 text-neutral-400'}`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-neutral-700">
                          {activity.title || '아직 주제를 입력하지 않았어요'}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-6 text-neutral-500">
                          핵심내용: {activity.core_content || '입력 대기'}
                        </p>
                        <p className="line-clamp-2 text-xs leading-6 text-neutral-500">
                          느낀점/알게된점:{' '}
                          {activity.reflection || '작성하지 않음'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full rounded-md"
                  onClick={() => setActiveTab('activities')}
                >
                  활동 입력 수정하기
                  <ArrowRight aria-hidden />
                </Button>
              </section>
              <aside className="space-y-4 lg:sticky lg:top-6">
                <section
                  aria-labelledby="settings-heading"
                  className="mea-card p-5 sm:p-6"
                >
                  <h2
                    id="settings-heading"
                    className="text-xl font-bold text-neutral-900"
                  >
                    진행 설정
                  </h2>
                  <label
                    htmlFor="duration-minutes"
                    className="mt-6 block text-sm font-medium text-neutral-700"
                  >
                    면접 시간
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="duration-minutes"
                      type="number"
                      min={3}
                      max={20}
                      step={1}
                      value={
                        Number.isNaN(settings.duration_minutes)
                          ? ''
                          : settings.duration_minutes
                      }
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          duration_minutes:
                            event.target.value === ''
                              ? NaN
                              : Number(event.target.value),
                        })
                      }
                      className="h-12 w-full rounded-md border border-neutral-200 bg-neutral-50 px-4 pr-10 text-lg font-semibold outline-none focus:border-neutral-200 focus:ring-2 focus:ring-[#fae45e]"
                    />
                    <span className="absolute right-4 top-3.5 text-sm text-neutral-400">
                      분
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-neutral-400">
                    3~20분 · 첫 질문이 표시되면 시작해요.
                  </p>
                  <div className="mt-4 divide-y divide-neutral-100">
                    <SettingToggle
                      checked={settings.show_timer}
                      onChange={(value) =>
                        setSettings({ ...settings, show_timer: value })
                      }
                      label="면접 중 남은 시간 표시"
                      description="표시하지 않아도 종료 1분 전에는 알려드려요."
                    />
                  </div>
                  <div className="mt-4 border-t border-neutral-100 pt-5">
                    <p className="mb-1 text-sm font-semibold text-neutral-800">
                      공통 질문 선택
                    </p>
                    <p className="mb-2 text-xs leading-5 text-neutral-400">
                      이번 면접에서 받고 싶은 질문을 골라주세요.
                    </p>
                    <div className="divide-y divide-neutral-100">
                      <SettingToggle
                        checked={settings.ask_intro ?? true}
                        onChange={(value) =>
                          setSettings({ ...settings, ask_intro: value })
                        }
                        label="intro 질문 연습하기 (자기소개/지원동기/학습계획)"
                        description="시작 질문 한 가지를 무작위로 제시하고, 답변에 따라 꼬리질문을 이어가요."
                      />
                      <SettingToggle
                        checked={settings.ask_final_remarks}
                        onChange={(value) =>
                          setSettings({
                            ...settings,
                            ask_final_remarks: value,
                          })
                        }
                        label="마지막으로 하고 싶은 말"
                        description="마지막 1분에 다음 질문으로 제시해요."
                      />
                    </div>
                  </div>
                </section>
                <div className="mea-start-panel">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                    <MessageSquareText
                      className="size-4 text-neutral-800"
                      aria-hidden
                    />
                    답변 방식
                  </div>
                  <p className="text-xs leading-6 text-neutral-600">
                    마이크 없이 바로 테스트할 수 있어요. 음성 인식이 연결된
                    경우에는 녹음 후 내용을 확인하고 제출할 수 있습니다.
                  </p>
                  <p
                    className={`mt-4 text-xs leading-6 ${consent ? 'text-neutral-700' : 'text-neutral-600'}`}
                  >
                    {consent
                      ? '개인정보·원문 제외와 사용 동의를 확인했어요.'
                      : '활동 입력 탭에서 개인정보·원문 제외와 사용 동의를 확인해주세요.'}
                  </p>
                  <p className="mt-3 text-[11px] leading-5 text-neutral-400">
                    면접을 시작하면 활동 정보와 답변이 질문 생성·평가에
                    사용됩니다. 면접 대화와 결과는 자동 저장되지 않습니다.
                  </p>
                  <Button
                    type="button"
                    onClick={begin}
                    disabled={interview.busy}
                    className="mt-5 h-12 w-full rounded-md mea-button-primary text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    면접 시작하기
                    <ArrowRight aria-hidden />
                  </Button>
                </div>
                {(setupError || interview.error) && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
                  >
                    {setupError || interview.error}
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
        {interview.phase === 'live' && (
          <div className="mea-live-container">
            <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="mt-2 text-2xl font-bold text-neutral-900">
                  면접 진행
                </h1>
              </div>
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${interview.minuteWarning ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-neutral-200 bg-white text-neutral-600'}`}
              >
                {settings.show_timer ? (
                  <>
                    <Clock3 className="size-4" aria-hidden />
                    <span
                      className="tabular-nums"
                      aria-label={`남은 시간 ${Math.floor(interview.remaining / 60)}분 ${interview.remaining % 60}초`}
                    >
                      {formatTime(interview.remaining)}
                    </span>
                  </>
                ) : (
                  <>
                    <EyeOff className="size-4" aria-hidden />
                    시간 숨김
                  </>
                )}
              </div>
            </div>
            {interview.mode === 'demo' && (
              <p className="mb-4 rounded-md border border-neutral-200 bg-[#f5f5f2] p-3 text-sm text-neutral-800">
                테스트 모드 · 예시 질문과 예시 피드백으로 면접 흐름을 확인하고
                있어요.
              </p>
            )}
            {interview.minuteWarning && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
              >
                <Clock3 className="mt-0.5 size-5 shrink-0" aria-hidden />
                <p>
                  <strong>
                    {interview.remaining > 0
                      ? '면접 종료까지 1분 이내로 남았습니다.'
                      : '면접 시간이 끝났습니다.'}
                  </strong>
                  <br />
                  {interview.remaining > 0
                    ? '현재 답변을 마무리해주세요. 시간이 끝나면 작성 중인 답변까지 정리됩니다.'
                    : '입력한 답변을 포함해 결과를 정리하고 있어요.'}
                </p>
              </div>
            )}
            {transition && (
              <p
                role="status"
                aria-live="polite"
                data-testid="question-transition"
                className="mb-3 border-l-2 border-[#FAE45E] pl-3 text-sm text-neutral-600"
              >
                {transition}
              </p>
            )}
            <section
              aria-labelledby="current-question"
              className="mea-question-section"
            >
              <div className="mea-question-heading">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-800">
                  <span
                    className={`size-2 rounded-full mea-button-primary ${interview.busy ? 'animate-pulse' : ''}`}
                    aria-hidden
                  />
                  {interview.ending
                    ? '면접 마무리'
                    : `질문 ${String(interview.history.length + 1).padStart(2, '0')}`}
                </span>
                <span className="text-xs text-neutral-400">
                  {interview.ending
                    ? '결과 정리 중'
                    : interview.busy
                      ? '다음 질문 준비'
                      : !interview.question
                        ? KIND_LABELS[kind]
                        : questionTypeLabel(interview.question)}
                </span>
              </div>
              <div className="mea-question-body">
                <h2
                  id="current-question"
                  className="whitespace-pre-wrap"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {interview.ending
                    ? '수고했어요. 질문과 답변을 정리하고 있습니다.'
                    : currentText ||
                      (interview.history.length > 0 || interview.question
                        ? '다음 질문을 준비하고 있어요.'
                        : '첫 질문을 준비하고 있어요.')}
                </h2>
                {interview.busy && (
                  <p className="mt-4 flex items-center gap-2 text-xs text-neutral-400">
                    <LoaderCircle
                      className="size-3.5 animate-spin"
                      aria-hidden
                    />
                    {interview.ending
                      ? '답변을 바탕으로 피드백을 작성하고 있어요'
                      : '질문을 준비하고 있어요'}
                  </p>
                )}
              </div>
            </section>

            <section
              aria-labelledby="answer-heading"
              className="mea-card mea-answer-panel"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2
                  id="answer-heading"
                  className="flex items-center gap-2 text-sm font-semibold text-neutral-700"
                >
                  <MessageSquareText
                    className="size-4 text-neutral-800"
                    aria-hidden
                  />
                  나의 답변
                </h2>
                <span className="text-xs text-neutral-400">
                  {interview.answer.length.toLocaleString()} / 6,000자
                </span>
              </div>
              <textarea
                ref={answerBox}
                aria-label="면접 답변"
                value={interview.answer}
                onChange={(event) => interview.setAnswer(event.target.value)}
                disabled={
                  interview.busy ||
                  interview.ending ||
                  recorder.preparing ||
                  recorder.recording ||
                  recorder.transcribing
                }
                maxLength={6000}
                rows={7}
                placeholder="질문에 대한 생각을 편하게 입력해주세요. 내가 한 일과 그 과정에서 배운 점을 구체적으로 설명해보세요."
                className="mea-input mea-answer-input disabled:opacity-60"
                onKeyDown={(event) => {
                  if (
                    (event.ctrlKey || event.metaKey) &&
                    event.key === 'Enter' &&
                    !event.nativeEvent.isComposing &&
                    !recorder.recording &&
                    !recorder.transcribing &&
                    !recorder.preparing
                  ) {
                    event.preventDefault();
                    interview.submit();
                  }
                }}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  {speechAvailable ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={`rounded-md ${recorder.recording ? 'border-red-200 bg-red-50 text-red-600' : ''}`}
                      disabled={
                        interview.busy ||
                        interview.ending ||
                        recorder.preparing ||
                        recorder.transcribing ||
                        !interview.question
                      }
                      onClick={() => {
                        setAudioNotice('');
                        if (recorder.recording) recorder.stop();
                        else {
                          speechPrefix.current = interview.answer;
                          void recorder.start();
                        }
                      }}
                    >
                      {recorder.transcribing || recorder.preparing ? (
                        <LoaderCircle className="animate-spin" aria-hidden />
                      ) : recorder.recording ? (
                        <Square className="fill-current" aria-hidden />
                      ) : (
                        <Mic aria-hidden />
                      )}
                      {recorder.preparing
                        ? '마이크 연결 중'
                        : recorder.transcribing
                          ? recorder.streaming
                            ? '마지막 문장 확인 중'
                            : '음성 인식 중'
                          : recorder.recording
                            ? '녹음 완료'
                            : '음성으로 입력'}
                    </Button>
                  ) : (
                    <p className="text-xs text-neutral-400">
                      {capabilitiesKnown
                        ? '채팅 답변으로 진행할 수 있어요.'
                        : '입력 기능을 확인하고 있어요.'}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  className="h-11 rounded-md mea-button-primary px-5 hover:bg-neutral-800"
                  disabled={
                    !interview.answer.trim() ||
                    !interview.question ||
                    interview.busy ||
                    interview.ending ||
                    recorder.recording ||
                    recorder.preparing ||
                    recorder.transcribing
                  }
                  onClick={interview.submit}
                >
                  답변 제출
                  <Send className="size-4" aria-hidden />
                </Button>
              </div>
              {(recorder.preparing ||
                recorder.recording ||
                recorder.transcribing) && (
                <p
                  role="status"
                  data-testid="speech-status"
                  className="mt-3 text-sm font-medium text-neutral-800"
                >
                  {recorder.preparing
                    ? '실시간 음성 연결을 준비하고 있어요.'
                    : recorder.recording
                      ? recorder.streaming
                        ? '말하는 중 · 실시간 인식'
                        : '녹음 중 · 완료 후 음성 인식'
                      : recorder.streaming
                        ? '마지막 문장 확인 중'
                        : '녹음한 음성을 인식하고 있어요.'}
                </p>
              )}
              {speechAvailable && (
                <p className="mt-3 text-xs leading-5 text-neutral-400">
                  {speechWebsocketUrl
                    ? '말하는 동안 인식된 내용이 답변에 표시됩니다. 녹음은 최대 2분이며, 녹음 완료 후 마지막 문장을 확인하고 직접 제출할 수 있어요.'
                    : '이 환경에서는 녹음 완료 후 음성을 인식합니다. 녹음은 최대 2분이며, 내용을 수정한 다음 직접 제출할 수 있어요.'}
                </p>
              )}
              {(recorder.error || audioNotice) && (
                <p role="alert" className="mt-3 text-sm text-amber-700">
                  {recorder.error || audioNotice}
                </p>
              )}
            </section>

            {interview.error && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4"
              >
                <p className="text-sm leading-6 text-red-700">
                  {interview.error}
                </p>
                <p className="mt-1 text-xs leading-5 text-red-500">
                  작성한 답변과 이전 대화는 남아 있어요.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 rounded-md bg-white text-red-700"
                  onClick={interview.retry}
                  disabled={
                    interview.busy ||
                    recorder.preparing ||
                    recorder.recording ||
                    recorder.transcribing
                  }
                >
                  <RefreshCw aria-hidden />
                  {interview.ending ? '결과 정리 다시 요청' : '다시 요청'}
                </Button>
              </div>
            )}
            <div className="mt-5 flex items-center justify-between gap-3 px-1">
              <p className="text-xs text-neutral-400">
                답변 {interview.history.length}개 완료 ·{' '}
                {settings.duration_minutes}분 면접
              </p>
              <button
                type="button"
                disabled={interview.startedAt === null || interview.ending}
                onClick={() => {
                  recorder.cancel();
                  interview.finish('manual');
                }}
                className="rounded-lg px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
              >
                면접 마치고 결과 보기
              </button>
            </div>
            {interview.history.length > 0 && (
              <details className="group mt-6 rounded-lg border border-neutral-200 bg-white p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-neutral-600">
                  이전 질문과 답변 {interview.history.length}개
                  <ChevronDown
                    className="size-4 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="mt-5 space-y-5">
                  {interview.history.map((turn, index) => (
                    <div
                      key={index}
                      className="border-t border-neutral-100 pt-4"
                    >
                      <p className="text-sm font-semibold leading-6 text-neutral-700">
                        {index + 1}. {turn.question}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-500">
                        {turn.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {interview.phase === 'result' && interview.result && (
          <div className="mea-live-container">
            <div className="mea-result-heading">
              <h1
                ref={headline}
                tabIndex={-1}
                className="text-2xl font-bold text-neutral-950 outline-none"
              >
                면접 결과
              </h1>
              {interview.targetMajorSnapshot && (
                <p className="mt-2 text-sm font-medium text-neutral-700">
                  지원학과: {interview.targetMajorSnapshot}
                </p>
              )}
              <p className="mt-3 text-sm text-neutral-500">
                {
                  interview.result.turns.filter((turn) => turn.answer.trim())
                    .length
                }
                개의 답변 · {formatTime(interview.result.elapsed_seconds)} 진행
                ·{' '}
                {interview.result.finish_reason === 'timeout'
                  ? '시간 종료'
                  : interview.result.finish_reason === 'completed'
                    ? '마지막 답변 완료'
                    : '직접 종료'}
              </p>
            </div>
            {interview.mode === 'demo' && (
              <p className="mb-4 rounded-md border border-neutral-200 bg-[#f5f5f2] p-3 text-sm text-neutral-800">
                테스트 모드의 예시 피드백입니다. 실제 답변을 평가한 결과와 다를
                수 있어요.
              </p>
            )}
            <section
              aria-labelledby="feedback-heading"
              className="mea-card mea-feedback"
            >
              <h2
                id="feedback-heading"
                className="flex items-center gap-2 text-sm font-semibold text-neutral-800"
              >
                <MessageSquareText className="size-4" aria-hidden />
                종합 피드백
              </h2>
              <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-neutral-700">
                {interview.result.summary}
              </p>
              <p className="mt-4 text-xs leading-5 text-neutral-400">
                다음 연습을 위한 참고 피드백입니다.
              </p>
              <details className="group mt-5 border-t border-neutral-100 pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-neutral-600">
                  피드백 기준
                  <ChevronDown
                    className="size-4 transition group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-3 text-xs leading-6 text-neutral-500">
                  실제로 제출한 답변에서 확인된 근거를 바탕으로 살펴봅니다.
                  질문하지 않았거나 답변에서 확인되지 않은 항목은 역량 부족으로
                  단정하지 않습니다.
                </p>
                <dl className="mt-4 grid gap-4 text-xs leading-6 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-neutral-700">
                      본인 역할
                    </dt>
                    <dd className="text-neutral-500">
                      직접 한 행동과 선택, 그 이유가 구체적으로 드러나는지
                      살펴봅니다.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-700">
                      탐구 이해
                    </dt>
                    <dd className="text-neutral-500">
                      개념을 자신의 말로 설명하고 실제 활동에 연결하는지
                      확인합니다.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-700">
                      논리·대안
                    </dt>
                    <dd className="text-neutral-500">
                      주장의 근거, 다른 관점, 적용 조건과 한계를 함께 검토하는지
                      살펴봅니다.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-700">성찰</dt>
                    <dd className="text-neutral-500">
                      배운 점과 판단의 변화, 실제 보완한 행동이 연결되는지
                      확인합니다.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-700">협업</dt>
                    <dd className="text-neutral-500">
                      다른 사람의 관점과 자신의 기여, 의견을 조정한 과정을
                      살펴봅니다.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-neutral-700">
                      진로 확장
                    </dt>
                    <dd className="text-neutral-500">
                      경험에서 생긴 관심이 다음 학습과 탐구 계획으로 이어지는지
                      확인합니다.
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-6 text-neutral-400">
                  말투·음성·외모나 합격 가능성은 판정하지 않습니다.
                </p>
              </details>
            </section>
            <div className="mb-5 mt-9 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-neutral-800">
                질문과 답변
              </h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-md bg-white"
                  onClick={download}
                >
                  <Download aria-hidden />
                  결과 TXT 저장
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              {interview.result.turns.map((turn, index) => (
                <article key={index} className="mea-card p-5 sm:p-6">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-neutral-800">
                    <span className="rounded-md bg-[#f5f5f2] px-2 py-1">
                      Q{String(index + 1).padStart(2, '0')}
                    </span>
                    {questionTypeLabel(turn)}
                  </div>
                  <h3 className="text-base font-semibold leading-7 text-neutral-800">
                    {turn.question}
                  </h3>
                  <div className="mea-result-answer">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
                      <MessageSquareText className="size-3.5" aria-hidden />
                      나의 답변
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-600">
                      {turn.answer || '답변하지 않은 질문입니다.'}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            {interview.result.turns.length === 0 && (
              <p className="rounded-lg bg-white p-6 text-sm text-neutral-500">
                기록된 질문과 답변이 없습니다.
              </p>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                type="button"
                className="h-11 rounded-md mea-button-primary hover:bg-neutral-800"
                onClick={() => {
                  interview.reset();
                  if (!consent) requestConsent();
                }}
              >
                <RefreshCw aria-hidden />
                같은 활동으로 다시 준비
              </Button>
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-neutral-400">
              면접 대화와 결과는 자동 저장되지 않습니다. 다시 준비하거나
              페이지를 떠나기 전에 결과를 저장해주세요.
            </p>
          </div>
        )}
      </section>
    </InterviewWorkspace>
  );
}
