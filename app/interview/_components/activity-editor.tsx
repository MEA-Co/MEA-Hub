'use client';

import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import {
  type Activity,
  CATEGORIES,
  isActivityReady,
  newActivity,
} from '../_lib/types';

const input =
  'mea-input w-full rounded-md border border-[#d9d9d5] bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-[#FAE45E]/50 disabled:bg-neutral-100 disabled:text-neutral-500';

export function ActivityEditor({
  activities,
  onChange,
  disabled = false,
}: {
  activities: Activity[];
  onChange: (activities: Activity[]) => void;
  disabled?: boolean;
}) {
  const completed = activities.filter(isActivityReady).length;
  const update = (id: string, changes: Partial<Activity>) => {
    if (!disabled)
      onChange(
        activities.map((activity) =>
          activity.id === id ? { ...activity, ...changes } : activity,
        ),
      );
  };

  return (
    <section
      aria-labelledby="activities-heading"
      className="mea-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="activities-heading"
            className="text-base font-semibold text-neutral-950"
          >
            활동 목록
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-500">
            활동마다{' '}
            <strong className="text-neutral-700">
              학년 · 영역/과목 · 주제 · 핵심내용 · 느낀점/알게된점
            </strong>
            을 나누어 적어주세요. 창체·세특·주요 활동을 합쳐 10개 이상 준비하면
            면접을 시작할 수 있어요. 느낀점이 없으면 비워두어도 괜찮아요.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums ${completed >= 10 ? 'border-[#e2cc4b] bg-[#FAE45E] text-neutral-950' : 'border-neutral-200 bg-neutral-50 text-neutral-600'}`}
          aria-live="polite"
        >
          {completed} / 10개 준비
        </span>
      </div>
      {disabled && (
        <p
          role="status"
          className="mea-muted mea-surface mt-3 rounded-md border-l-2 border-[#FAE45E] px-3 py-2 text-xs leading-6 text-neutral-600"
        >
          면접 중에는 활동을 읽기만 할 수 있어요. 면접을 마친 뒤 내용을 수정할
          수 있습니다. 탭을 옮겨도 작성 중인 답변과 면접 시간은 유지됩니다.
        </p>
      )}
      <fieldset disabled={disabled} className="min-w-0">
        <div className="mt-4 space-y-2">
          {activities.map((activity, index) => {
            const ready = isActivityReady(activity);
            return (
              <details
                key={activity.id}
                className="group rounded-lg border border-[#e3e3e0] bg-white open:border-neutral-300"
                open={index === 0 ? true : undefined}
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium ${ready ? 'bg-[#FAE45E] text-neutral-900' : 'bg-neutral-100 text-neutral-500'}`}
                  >
                    {ready ? (
                      <Check className="size-4" aria-label="입력 완료" />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-medium ${activity.title.trim() ? 'text-neutral-800' : 'text-neutral-400'}`}
                    >
                      {activity.title.trim() || '활동 주제를 입력해주세요'}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-400">
                      {activity.grade}학년 · {CATEGORIES[activity.category]}
                      {activity.subject ? ` · ${activity.subject}` : ''}
                    </span>
                  </span>
                  <ChevronDown
                    className="size-4 shrink-0 text-neutral-400 transition group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-[#e3e3e0] px-3 pb-4 pt-3 sm:px-4">
                  <div className="grid gap-3 md:grid-cols-[90px_minmax(0,1fr)_minmax(0,1.2fr)]">
                    <label className="text-xs font-semibold text-neutral-600">
                      학년
                      <select
                        aria-label={`${index + 1}번 활동 학년`}
                        value={activity.grade}
                        onChange={(event) =>
                          update(activity.id, {
                            grade: Number(
                              event.target.value,
                            ) as Activity['grade'],
                          })
                        }
                        className={`${input} mt-2`}
                      >
                        <option value={1}>1학년</option>
                        <option value={2}>2학년</option>
                        <option value={3}>3학년</option>
                      </select>
                    </label>
                    <fieldset className="min-w-0">
                      <legend className="text-xs font-semibold text-neutral-600">
                        영역/과목
                      </legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <select
                          aria-label={`${index + 1}번 활동 영역`}
                          value={activity.category}
                          onChange={(event) =>
                            update(activity.id, {
                              category: event.target
                                .value as Activity['category'],
                            })
                          }
                          className={input}
                        >
                          {Object.entries(CATEGORIES).map(([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label={`${index + 1}번 활동 과목명`}
                          value={activity.subject ?? ''}
                          onChange={(event) =>
                            update(activity.id, { subject: event.target.value })
                          }
                          maxLength={100}
                          placeholder="과목명 (선택)"
                          className={input}
                        />
                      </div>
                    </fieldset>
                    <label className="text-xs font-semibold text-neutral-600">
                      주제(제목)
                      <input
                        aria-label={`${index + 1}번 활동 주제(제목)`}
                        value={activity.title}
                        onChange={(event) =>
                          update(activity.id, { title: event.target.value })
                        }
                        maxLength={100}
                        placeholder="어떤 활동을 했나요?"
                        className={`${input} mt-2`}
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-semibold text-neutral-600">
                      핵심내용
                      <textarea
                        aria-label={`${index + 1}번 활동 핵심내용`}
                        value={activity.core_content}
                        onChange={(event) =>
                          update(activity.id, {
                            core_content: event.target.value,
                          })
                        }
                        rows={5}
                        maxLength={2000}
                        placeholder="내 역할, 실제로 한 일, 탐구와 협업 과정을 내 말로 적어주세요. (20자 이상)"
                        className={`${input} mt-2 resize-y leading-6 font-normal`}
                      />
                      <span
                        className={`mt-1.5 block text-xs font-normal ${activity.core_content.trim().length > 0 && activity.core_content.trim().length < 20 ? 'text-neutral-600' : 'text-neutral-400'}`}
                      >
                        {activity.core_content.trim().length.toLocaleString()} /
                        2,000자 · 면접 시작 시 최소 20자
                      </span>
                    </label>
                    <label className="text-xs font-semibold text-neutral-600">
                      느낀점/알게된점
                      <textarea
                        aria-label={`${index + 1}번 활동 느낀점/알게된점`}
                        value={activity.reflection}
                        onChange={(event) =>
                          update(activity.id, {
                            reflection: event.target.value,
                          })
                        }
                        rows={5}
                        maxLength={1000}
                        placeholder="새롭게 알게 된 점이나 생각의 변화가 있다면 적어주세요. 느낀점이 없으면 비워두어도 괜찮아요."
                        className={`${input} mt-2 resize-y leading-6 font-normal`}
                      />
                      <span className="mt-1.5 block text-xs font-normal text-neutral-400">
                        {activity.reflection.trim().length.toLocaleString()} /
                        1,000자 · 선택 입력
                      </span>
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!disabled)
                          onChange(
                            activities.filter((row) => row.id !== activity.id),
                          );
                      }}
                      className="flex items-center gap-1 rounded-lg p-1 text-xs text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`${index + 1}번 활동 삭제`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      삭제
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
        {activities.length === 0 && (
          <p className="mea-muted mea-surface mt-4 rounded-lg border border-[#e3e3e0] p-4 text-sm text-neutral-500">
            아직 입력한 활동이 없어요. 아래에서 활동을 추가하거나 저장한 TXT를
            가져와주세요.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-9 w-full rounded-md border-neutral-300 text-xs text-neutral-700 hover:bg-neutral-50"
          onClick={() => onChange([...activities, newActivity()])}
          disabled={activities.length >= 60}
        >
          <Plus aria-hidden />
          활동 추가하기 {activities.length >= 60 ? '(최대 60개)' : ''}
        </Button>
      </fieldset>
    </section>
  );
}
