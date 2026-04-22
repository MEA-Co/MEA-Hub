'use client';

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

import type {
  AdmissionMeta,
  AdmissionMetaKey,
  AdmissionResultRow,
} from '../data';

import type { SelectedDepartment } from './SelectionSlots';

type AdmissionOption = {
  key: AdmissionMetaKey;
  university: string;
  admissionCategory: string;
  admissionName: string;
  rows: readonly AdmissionResultRow[];
  meta: AdmissionMeta | undefined;
};

type AdmissionOptionAccordionProps = {
  option: AdmissionOption;
  isSelectionFull: boolean;
  selectedDepartmentIds: Set<string>;
  onSelectDepartment: (selected: SelectedDepartment) => void;
};

const MINIMUM_DIFFICULTY_LEVELS = [
  '4합 8',
  '3합 6',
  '3합 7',
  '3합 8',
  '2합 5',
  '3합 9',
  '2합 6',
  '2합 7',
] as const;

type MinimumDifficultyLevel = (typeof MINIMUM_DIFFICULTY_LEVELS)[number];

function formatValue(value: number | null) {
  return value === null ? '-' : String(value);
}

function hasMinimumRequirement(meta: AdmissionMeta | undefined) {
  if (!meta) {
    return false;
  }

  return (
    meta.minimumGradeRequiredSubjects !== null ||
    meta.minimumGradeRequiredSum !== null ||
    Boolean(meta.minimumGradeNotes?.trim())
  );
}

function renderMinimumText(meta: AdmissionMeta | undefined) {
  if (!meta || !hasMinimumRequirement(meta)) {
    return '없음';
  }

  const subjects =
    meta.minimumGradeRequiredSubjects === null
      ? '-'
      : `${meta.minimumGradeRequiredSubjects}과목`;
  const sum =
    meta.minimumGradeRequiredSum === null
      ? '-'
      : `${meta.minimumGradeRequiredSum}`;

  return `${subjects} / 합 ${sum}`;
}

function getMinimumDifficultyLevel(
  meta: AdmissionMeta | undefined,
): MinimumDifficultyLevel | null {
  if (!meta) {
    return null;
  }

  if (
    meta.minimumGradeRequiredSubjects === null ||
    meta.minimumGradeRequiredSum === null
  ) {
    return null;
  }

  const value =
    `${meta.minimumGradeRequiredSubjects}합 ${meta.minimumGradeRequiredSum}` as MinimumDifficultyLevel;

  return MINIMUM_DIFFICULTY_LEVELS.includes(value) ? value : null;
}

export function AdmissionOptionAccordion({
  option,
  isSelectionFull,
  selectedDepartmentIds,
  onSelectDepartment,
}: AdmissionOptionAccordionProps) {
  return (
    <AccordionItem value={option.key}>
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex w-full flex-col items-start gap-1 text-left sm:flex-row sm:items-center sm:justify-between">
          <div className="font-medium">
            {option.university} · {option.admissionCategory} ·{' '}
            {option.admissionName}
          </div>
          <div className="text-xs text-muted-foreground">
            학과 {option.rows.length}개
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent>
        <div className="space-y-4 px-4 pb-4">
          <section className="rounded-md border bg-muted/20 p-3 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <p>
                <span className="text-muted-foreground">카테고리:</span>{' '}
                {option.meta?.admissionCategory ?? option.admissionCategory}
              </p>
              <p>
                <span className="text-muted-foreground">최저 기준:</span>{' '}
                {renderMinimumText(option.meta)}
              </p>
              <p>
                <span className="text-muted-foreground">최저 비고:</span>{' '}
                {option.meta?.minimumGradeNotes?.trim()
                  ? option.meta.minimumGradeNotes
                  : '-'}
              </p>

              {option.meta?.admissionCategory === '교과' ? (
                <p>
                  <span className="text-muted-foreground">서류평가 비율:</span>{' '}
                  {option.meta.documentEvaluationRatio === null
                    ? '-'
                    : `${option.meta.documentEvaluationRatio}%`}
                </p>
              ) : (
                <>
                  <p>
                    <span className="text-muted-foreground">1단계 배수:</span>{' '}
                    {option.meta?.firstRoundMultiplier ?? '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">면접 비율:</span>{' '}
                    {option.meta?.interviewRatio === null ||
                    option.meta?.interviewRatio === undefined
                      ? '-'
                      : `${option.meta.interviewRatio}%`}
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      서류평가 비율:
                    </span>{' '}
                    {option.meta?.evaluationRatio ?? '-'}
                  </p>
                </>
              )}

              <p className="md:col-span-2">
                <span className="text-muted-foreground">비고:</span>{' '}
                {option.meta?.notes?.trim() ? option.meta.notes : '-'}
              </p>
            </div>
          </section>

          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-[1080px] text-sm">
              <thead className="bg-muted/40">
                <tr className="[&>th]:border-b [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
                  <th>학과</th>
                  <th>선택</th>
                  <th>27 모집</th>
                  <th>24 인원</th>
                  <th>24 컷50</th>
                  <th>24 컷70</th>
                  <th>25 인원</th>
                  <th>25 컷50</th>
                  <th>25 컷70</th>
                  <th>26 인원</th>
                  <th>26 컷50</th>
                  <th>26 컷70</th>
                </tr>
              </thead>
              <tbody>
                {option.rows.map((row, index) => {
                  const id = `${option.key}::${row.department}`;
                  const isSelected = selectedDepartmentIds.has(id);
                  const disableSelect = !isSelected && isSelectionFull;

                  return (
                    <tr
                      key={`${id}-${index}`}
                      className="[&>td]:border-b [&>td]:px-3 [&>td]:py-2"
                    >
                      <td className="min-w-64">{row.department}</td>
                      <td>
                        <Button
                          size="sm"
                          variant={isSelected ? 'secondary' : 'outline'}
                          disabled={disableSelect}
                          onClick={() =>
                            onSelectDepartment({
                              id,
                              key: option.key,
                              university: option.university,
                              admissionCategory: option.admissionCategory,
                              admissionName: option.admissionName,
                              department: row.department,
                            })
                          }
                        >
                          {isSelected ? '선택됨' : '선택'}
                        </Button>
                      </td>
                      <td>{formatValue(row.capacity_27)}</td>
                      <td>{formatValue(row.resultsByYear[2024].capacity)}</td>
                      <td>{formatValue(row.resultsByYear[2024].cutoff50)}</td>
                      <td>{formatValue(row.resultsByYear[2024].cutoff70)}</td>
                      <td>{formatValue(row.resultsByYear[2025].capacity)}</td>
                      <td>{formatValue(row.resultsByYear[2025].cutoff50)}</td>
                      <td>{formatValue(row.resultsByYear[2025].cutoff70)}</td>
                      <td>{formatValue(row.resultsByYear[2026].capacity)}</td>
                      <td>{formatValue(row.resultsByYear[2026].cutoff50)}</td>
                      <td>{formatValue(row.resultsByYear[2026].cutoff70)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export {
  getMinimumDifficultyLevel,
  hasMinimumRequirement,
  MINIMUM_DIFFICULTY_LEVELS,
};
export type { AdmissionOption, MinimumDifficultyLevel };
