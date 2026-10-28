'use client';

import { ChevronDown, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import {
  type CircumstancesDraft,
  emptyGradeConcern,
} from '../_lib/circumstances';
import type { GradeConcern } from '../_lib/types';

const input =
  'mea-input mt-1.5 w-full rounded-md border border-[#d9d9d5] bg-white px-3 py-2 text-sm font-normal text-neutral-700 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-[#FAE45E]/50 disabled:bg-neutral-100';

export function CircumstancesEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: CircumstancesDraft;
  onChange: (value: CircumstancesDraft) => void;
  disabled?: boolean;
}) {
  const updateGrade = (index: number, changes: Partial<GradeConcern>) =>
    onChange({
      ...value,
      grade_concerns: value.grade_concerns.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...changes } : row,
      ),
    });
  return (
    <details open className="mea-card group mb-4 p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="text-xs font-medium text-neutral-500">
            선택 입력
          </span>
          <span className="mt-0.5 block text-sm font-semibold text-neutral-900">
            면접에 참고할 특이사항
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-neutral-400 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <p className="mt-3 text-sm leading-6 text-neutral-500">
        성적 관련 상황이나 관심 분야가 바뀐 경험을 질문 후보에 참고할 수 있어요.
        모두 생략할 수 있으며 입력한 내용이 반드시 질문으로 나오는 것은
        아닙니다. 이름·학교명·원문을 빼고 본인이 정리한 상황만 적어주세요. 성적
        수치는 입력하지 않아도 됩니다.
      </p>
      <p className="mea-muted mea-surface mt-3 rounded-md border-l-2 border-[#FAE45E] px-3 py-2 text-xs leading-6 text-neutral-600">
        활동과 함께 TXT로 저장하고 다시 붙여넣어 사용할 수 있어요. 입력한 내용은
        이번 면접의 질문 후보에 참고합니다. TXT로 저장하지 않고 새로고침하면
        작성 내용은 사라집니다.
      </p>
      <fieldset disabled={disabled} className="mt-4 min-w-0 space-y-4">
        <section aria-labelledby="grade-concerns-heading">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700">
            <input
              id="grade-concerns-enabled"
              aria-label="성적 관련 상황 사용"
              type="checkbox"
              checked={value.grades_enabled}
              onChange={(event) =>
                onChange({ ...value, grades_enabled: event.target.checked })
              }
              className="size-4 accent-neutral-900"
            />
            <span id="grade-concerns-heading">성적 관련 상황</span>
            <span className="font-normal text-neutral-400">최대 3개</span>
          </label>
          {value.grades_enabled && (
            <div className="mt-4 space-y-3">
              {value.grade_concerns.map((row, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-[#e3e3e0] bg-neutral-50/60 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-neutral-500">
                      성적 상황 {index + 1}
                    </p>
                    <button
                      type="button"
                      className="rounded-lg p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`${index + 1}번 성적 상황 삭제`}
                      onClick={() =>
                        onChange({
                          ...value,
                          grade_concerns: value.grade_concerns.filter(
                            (_, rowIndex) => rowIndex !== index,
                          ),
                        })
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <label className="min-w-0 text-xs font-semibold text-neutral-600">
                      과목
                      <input
                        aria-label={`${index + 1}번 특이사항 과목`}
                        value={row.subject}
                        onChange={(event) =>
                          updateGrade(index, { subject: event.target.value })
                        }
                        maxLength={100}
                        placeholder="예: 수학 · 선택"
                        className={input}
                      />
                    </label>
                    <label className="min-w-0 text-xs font-semibold text-neutral-600">
                      학년
                      <select
                        aria-label={`${index + 1}번 특이사항 학년`}
                        value={row.grade ?? ''}
                        onChange={(event) =>
                          updateGrade(index, {
                            grade: event.target.value
                              ? (Number(
                                  event.target.value,
                                ) as GradeConcern['grade'])
                              : null,
                          })
                        }
                        className={input}
                      >
                        <option value="">선택 안 함</option>
                        <option value={1}>1학년</option>
                        <option value={2}>2학년</option>
                        <option value={3}>3학년</option>
                      </select>
                    </label>
                    <label className="min-w-0 text-xs font-semibold text-neutral-600">
                      학기
                      <select
                        aria-label={`${index + 1}번 특이사항 학기`}
                        value={row.semester ?? ''}
                        onChange={(event) =>
                          updateGrade(index, {
                            semester: event.target.value
                              ? (Number(
                                  event.target.value,
                                ) as GradeConcern['semester'])
                              : null,
                          })
                        }
                        className={input}
                      >
                        <option value="">선택 안 함</option>
                        <option value={1}>1학기</option>
                        <option value={2}>2학기</option>
                      </select>
                    </label>
                  </div>
                  <label className="mt-3 block text-xs font-semibold text-neutral-600">
                    상황 설명
                    <textarea
                      aria-label={`${index + 1}번 특이사항 상황 설명`}
                      value={row.note}
                      onChange={(event) =>
                        updateGrade(index, { note: event.target.value })
                      }
                      maxLength={400}
                      rows={3}
                      placeholder="예: 학습 방법을 바꾸거나 기초 개념을 보완해 본 경험을 짧게 정리해주세요."
                      className={`${input} resize-y leading-6`}
                    />
                  </label>
                  <p className="mt-1 text-xs text-neutral-400">
                    과목 또는 학년·학기를 하나 이상 선택해주세요. 상황 설명{' '}
                    {row.note.length} / 400자
                  </p>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-md border-neutral-300 px-3 text-xs text-neutral-700 hover:bg-neutral-100"
                disabled={value.grade_concerns.length >= 3}
                onClick={() =>
                  onChange({
                    ...value,
                    grade_concerns: [
                      ...value.grade_concerns,
                      emptyGradeConcern(),
                    ],
                  })
                }
              >
                <Plus aria-hidden />
                성적 상황 추가
              </Button>
            </div>
          )}
        </section>
        <section
          aria-labelledby="career-change-heading"
          className="border-t border-[#e3e3e0] pt-4"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700">
            <input
              id="career-change-enabled"
              aria-label="진로 변경 사용"
              type="checkbox"
              checked={value.career_enabled}
              onChange={(event) =>
                onChange({ ...value, career_enabled: event.target.checked })
              }
              className="size-4 accent-neutral-900"
            />
            <span id="career-change-heading">진로 변경</span>
          </label>
          {value.career_enabled && (
            <div className="mt-3 rounded-lg border border-[#e3e3e0] bg-neutral-50/60 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="min-w-0 text-xs font-semibold text-neutral-600">
                  이전 관심 분야
                  <input
                    aria-label="이전 관심 분야"
                    value={value.career_change.previous_field}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        career_change: {
                          ...value.career_change,
                          previous_field: event.target.value,
                        },
                      })
                    }
                    maxLength={100}
                    placeholder="예: 생명과학"
                    className={input}
                  />
                </label>
                <label className="min-w-0 text-xs font-semibold text-neutral-600">
                  현재 관심 분야
                  <input
                    aria-label="현재 관심 분야"
                    value={value.career_change.current_field}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        career_change: {
                          ...value.career_change,
                          current_field: event.target.value,
                        },
                      })
                    }
                    maxLength={100}
                    placeholder="예: 데이터 과학"
                    className={input}
                  />
                </label>
              </div>
              <label className="mt-3 block text-xs font-semibold text-neutral-600">
                상황 설명{' '}
                <span className="font-normal text-neutral-400">선택</span>
                <textarea
                  aria-label="진로 변경 상황 설명"
                  value={value.career_change.note}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      career_change: {
                        ...value.career_change,
                        note: event.target.value,
                      },
                    })
                  }
                  maxLength={400}
                  rows={3}
                  placeholder="관심이 바뀌게 된 계기나 두 분야를 연결해 생각한 내용을 적어주세요."
                  className={`${input} resize-y leading-6`}
                />
              </label>
              <p className="mt-1 text-xs text-neutral-400">
                {value.career_change.note.length} / 400자
              </p>
            </div>
          )}
        </section>
      </fieldset>
    </details>
  );
}
