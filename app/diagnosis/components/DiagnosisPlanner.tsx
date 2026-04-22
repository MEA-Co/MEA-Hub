'use client';

import { useMemo, useState } from 'react';

import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

import {
  type AdmissionMetaKey,
  admissionMetaMap,
  admissionResultSourceMap,
} from '../data';

import {
  type AdmissionOption,
  AdmissionOptionAccordion,
  getMinimumDifficultyLevel,
  hasMinimumRequirement,
  MINIMUM_DIFFICULTY_LEVELS,
  type MinimumDifficultyLevel,
} from './AdmissionOptionAccordion';
import {
  MAX_SELECTED_DEPARTMENTS,
  type SelectedDepartment,
  SelectionSlots,
} from './SelectionSlots';

type MinimumFilter = 'all' | 'required' | 'none';
type AdmissionCategoryFilter = 'all' | '교과' | '학종';

function normalize(text: string) {
  return text.toLowerCase().trim();
}

export function DiagnosisPlanner() {
  const [query, setQuery] = useState('');
  const [minimumFilter, setMinimumFilter] = useState<MinimumFilter>('all');
  const [admissionCategoryFilter, setAdmissionCategoryFilter] =
    useState<AdmissionCategoryFilter>('all');
  const [minimumDifficultyFilter, setMinimumDifficultyFilter] = useState<
    'all' | MinimumDifficultyLevel
  >('all');
  const [selectedDepartments, setSelectedDepartments] = useState<
    SelectedDepartment[]
  >([]);

  const selectedDepartmentIds = useMemo(
    () => new Set(selectedDepartments.map((department) => department.id)),
    [selectedDepartments],
  );

  const options = useMemo<AdmissionOption[]>(() => {
    const normalizedOptions: AdmissionOption[] = [];

    for (const [key, rows] of Object.entries(admissionResultSourceMap)) {
      const first = rows[0];
      if (!first) {
        continue;
      }

      const typedKey = key as AdmissionMetaKey;
      normalizedOptions.push({
        key: typedKey,
        university: first.university,
        admissionCategory: first.admissionCategory,
        admissionName: first.admissionName,
        rows,
        meta: admissionMetaMap[typedKey],
      });
    }

    return normalizedOptions.sort((a, b) => {
      const universityCompare = a.university.localeCompare(b.university, 'ko');
      if (universityCompare !== 0) {
        return universityCompare;
      }

      const categoryCompare = a.admissionCategory.localeCompare(
        b.admissionCategory,
        'ko',
      );
      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      return a.admissionName.localeCompare(b.admissionName, 'ko');
    });
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalize(query);

    return options.filter((option) => {
      const minimumMatched =
        minimumFilter === 'all' ||
        (minimumFilter === 'required' && hasMinimumRequirement(option.meta)) ||
        (minimumFilter === 'none' && !hasMinimumRequirement(option.meta));

      if (!minimumMatched) {
        return false;
      }

      if (
        admissionCategoryFilter !== 'all' &&
        option.admissionCategory !== admissionCategoryFilter
      ) {
        return false;
      }

      if (minimumDifficultyFilter !== 'all') {
        const selectedIndex = MINIMUM_DIFFICULTY_LEVELS.indexOf(
          minimumDifficultyFilter,
        );
        const optionDifficulty = getMinimumDifficultyLevel(option.meta);
        if (optionDifficulty !== null) {
          const optionIndex =
            MINIMUM_DIFFICULTY_LEVELS.indexOf(optionDifficulty);
          if (optionIndex < selectedIndex) {
            return false;
          }
        }
      }

      if (!normalizedQuery) {
        return true;
      }

      const fieldMatch =
        normalize(
          `${option.university} ${option.admissionCategory} ${option.admissionName}`,
        ).includes(normalizedQuery) ||
        option.rows.some((row) =>
          normalize(row.department).includes(normalizedQuery),
        );

      return fieldMatch;
    });
  }, [
    admissionCategoryFilter,
    minimumDifficultyFilter,
    minimumFilter,
    options,
    query,
  ]);

  function handleSelectDepartment(selected: SelectedDepartment) {
    setSelectedDepartments((previous) => {
      const alreadySelected = previous.some(
        (department) => department.id === selected.id,
      );
      if (alreadySelected) {
        return previous;
      }

      if (previous.length >= MAX_SELECTED_DEPARTMENTS) {
        return previous;
      }

      return [...previous, selected];
    });
  }

  function handleRemoveDepartment(id: string) {
    setSelectedDepartments((previous) =>
      previous.filter((department) => department.id !== id),
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">
      <SelectionSlots
        selectedDepartments={selectedDepartments}
        onRemove={handleRemoveDepartment}
      />

      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold">학교 · 전형 검색</h2>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[640px] md:items-end">
            <div className="flex w-full flex-wrap items-center gap-2 md:justify-end">
              <span className="text-xs text-muted-foreground">전형</span>
              <Button
                size="sm"
                variant={
                  admissionCategoryFilter === 'all' ? 'default' : 'outline'
                }
                onClick={() => setAdmissionCategoryFilter('all')}
              >
                전형 전체
              </Button>
              <Button
                size="sm"
                variant={
                  admissionCategoryFilter === '교과' ? 'default' : 'outline'
                }
                onClick={() => setAdmissionCategoryFilter('교과')}
              >
                교과
              </Button>
              <Button
                size="sm"
                variant={
                  admissionCategoryFilter === '학종' ? 'default' : 'outline'
                }
                onClick={() => setAdmissionCategoryFilter('학종')}
              >
                학종
              </Button>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 md:justify-end">
              <span className="text-xs text-muted-foreground">최저</span>
              <Button
                size="sm"
                variant={minimumFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setMinimumFilter('all')}
              >
                전체
              </Button>
              <Button
                size="sm"
                variant={minimumFilter === 'required' ? 'default' : 'outline'}
                onClick={() => setMinimumFilter('required')}
              >
                최저 있음
              </Button>
              <Button
                size="sm"
                variant={minimumFilter === 'none' ? 'default' : 'outline'}
                onClick={() => setMinimumFilter('none')}
              >
                최저 없음
              </Button>

              <div className="flex items-center gap-2 rounded-md border bg-background px-2">
                <span className="text-xs text-muted-foreground">난이도</span>
                <select
                  className="h-8 rounded-md bg-transparent text-sm outline-none"
                  value={minimumDifficultyFilter}
                  onChange={(event) =>
                    setMinimumDifficultyFilter(
                      event.target.value as 'all' | MinimumDifficultyLevel,
                    )
                  }
                >
                  <option value="all">전체</option>
                  {MINIMUM_DIFFICULTY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="학교명, 전형명, 학과명으로 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="text-sm text-muted-foreground md:min-w-32 md:text-right">
            {filteredOptions.length}개 전형
          </p>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <Accordion type="multiple" className="w-full">
          {filteredOptions.map((option) => (
            <AdmissionOptionAccordion
              key={option.key}
              option={option}
              isSelectionFull={
                selectedDepartments.length >= MAX_SELECTED_DEPARTMENTS
              }
              selectedDepartmentIds={selectedDepartmentIds}
              onSelectDepartment={handleSelectDepartment}
            />
          ))}
        </Accordion>

        {filteredOptions.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            검색 조건에 맞는 전형이 없습니다.
          </div>
        )}
      </section>
    </main>
  );
}
