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
import { MidTierInfoPanel } from './MidTierInfoPanel';
import { NonsulInfoPanel } from './NonsulInfoPanel';
import {
  MAX_SELECTED_DEPARTMENTS,
  type SelectedDepartment,
  SelectionSlots,
} from './SelectionSlots';

type MinimumFilter = 'all' | 'required' | 'none';
type AdmissionCategoryFilter = 'all' | '교과' | '학종';
type AdmissionDetailFilter =
  | '교과_서류미반영'
  | '교과_탐구계열별'
  | '학종_면접'
  | '학종_서류';
type SortMode = 'university' | 'approximateCut';
type UniversityBand =
  | '서연고'
  | '서성한'
  | '중경시'
  | '건동홍'
  | '국숭세단'
  | '인하아주'
  | '인가경'
  | '광명상가'
  | '한성삼육';
type SubjectTrack = '우수' | '적절' | '부족';
type GradeTrend = '상승' | '유지' | '하락';
type ExtracurricularLevel = '강함' | '보통' | '약함';
type DiagnosisView = 'planner' | 'nonsul' | 'midTier';

const UNIVERSITY_ORDER = [
  '서울대학교',
  '연세대학교',
  '고려대학교',
  '서강대학교',
  '성균관대학교',
  '한양대학교',
  '중앙대학교',
  '경희대학교',
  '서울시립대학교',
  '건국대학교',
  '동국대학교',
  '홍익대학교',
  '국민대학교',
  '숭실대학교',
  '세종대학교',
  '단국대학교',
  '인하대학교',
  '아주대학교',
  '광운대학교',
  '명지대학교',
  '상명대학교',
  '가톨릭대학교',
  '인천대학교',
  '가천대학교',
  '경기대학교',
  '한성대학교',
  '삼육대학교',
] as const;

const UNIVERSITY_ORDER_RANK: Map<string, number> = new Map(
  UNIVERSITY_ORDER.map((name, index) => [name, index]),
);

const UNIVERSITY_BAND_GROUPS: ReadonlyArray<{
  key: UniversityBand;
  universities: readonly string[];
}> = [
  {
    key: '서연고',
    universities: ['서울대학교', '연세대학교', '고려대학교'],
  },
  {
    key: '서성한',
    universities: ['서강대학교', '성균관대학교', '한양대학교'],
  },
  {
    key: '중경시',
    universities: ['중앙대학교', '경희대학교', '서울시립대학교'],
  },
  {
    key: '건동홍',
    universities: ['건국대학교', '동국대학교', '홍익대학교'],
  },
  {
    key: '국숭세단',
    universities: ['국민대학교', '숭실대학교', '세종대학교', '단국대학교'],
  },
  {
    key: '인하아주',
    universities: ['인하대학교', '아주대학교'],
  },
  {
    key: '광명상가',
    universities: ['광운대학교', '명지대학교', '상명대학교', '가톨릭대학교'],
  },
  {
    key: '인가경',
    universities: ['인천대학교', '가천대학교', '경기대학교'],
  },
  {
    key: '한성삼육',
    universities: ['한성대학교', '삼육대학교'],
  },
];

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function parseSearchKeywords(input: string) {
  return input
    .split(',')
    .map((token) => normalize(token))
    .filter(Boolean);
}

function includesByAnyKeyword(target: string, keywords: string[]) {
  if (keywords.length === 0) {
    return true;
  }

  const normalizedTarget = normalize(target);
  return keywords.some((keyword) => normalizedTarget.includes(keyword));
}

export function DiagnosisPlanner() {
  const [activeView, setActiveView] = useState<DiagnosisView>('planner');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [departmentQuery, setDepartmentQuery] = useState('');
  const [selectedUniversityBands, setSelectedUniversityBands] = useState<
    UniversityBand[]
  >([]);
  const [sortMode, setSortMode] = useState<SortMode>('university');
  const [minimumFilter, setMinimumFilter] = useState<MinimumFilter>('all');
  const [admissionCategoryFilter, setAdmissionCategoryFilter] =
    useState<AdmissionCategoryFilter>('all');
  const [selectedAdmissionDetailFilter, setSelectedAdmissionDetailFilter] =
    useState<AdmissionDetailFilter | null>(null);
  const [minimumDifficultyFilter, setMinimumDifficultyFilter] = useState<
    'all' | MinimumDifficultyLevel
  >('all');
  const [userGradeInput, setUserGradeInput] = useState('');
  const [showProfileInputs, setShowProfileInputs] = useState(false);
  const [showGradeCompareHighlight, setShowGradeCompareHighlight] =
    useState(false);
  const [subjectTrack, setSubjectTrack] = useState<SubjectTrack>('우수');
  const [majorSubjectGradeInput, setMajorSubjectGradeInput] = useState('');
  const [gradeTrend, setGradeTrend] = useState<GradeTrend>('유지');
  const [extracurricularLevel, setExtracurricularLevel] =
    useState<ExtracurricularLevel>('보통');
  const [selectedDepartments, setSelectedDepartments] = useState<
    SelectedDepartment[]
  >([]);

  const selectedDepartmentIds = useMemo(
    () => new Set(selectedDepartments.map((department) => department.id)),
    [selectedDepartments],
  );

  const parsedUserGrade = useMemo(() => {
    const trimmed = userGradeInput.trim();
    if (!trimmed) {
      return null;
    }

    const value = Number(trimmed);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return value;
  }, [userGradeInput]);

  const approximateCutWindow = useMemo(() => {
    if (parsedUserGrade === null) {
      return null;
    }

    const roundedUp = Math.ceil(parsedUserGrade * 10) / 10;
    const min = Math.round((roundedUp - 0.1) * 10) / 10;
    const max = Math.round((roundedUp + 0.2) * 10) / 10;

    return { min, max };
  }, [parsedUserGrade]);

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
      if (sortMode === 'approximateCut') {
        const aCut = a.meta?.approximatecut ?? Number.POSITIVE_INFINITY;
        const bCut = b.meta?.approximatecut ?? Number.POSITIVE_INFINITY;
        if (aCut !== bCut) {
          return aCut - bCut;
        }
      }

      const aRank = UNIVERSITY_ORDER_RANK.get(a.university);
      const bRank = UNIVERSITY_ORDER_RANK.get(b.university);
      if (aRank !== undefined && bRank !== undefined && aRank !== bRank) {
        return aRank - bRank;
      }
      if (aRank !== undefined && bRank === undefined) {
        return -1;
      }
      if (aRank === undefined && bRank !== undefined) {
        return 1;
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
  }, [sortMode]);

  const filteredOptions = useMemo(() => {
    const schoolKeywords = parseSearchKeywords(schoolQuery);
    const departmentKeywords = parseSearchKeywords(departmentQuery);
    const allowedUniversities =
      selectedUniversityBands.length === 0
        ? null
        : new Set(
            UNIVERSITY_BAND_GROUPS.filter((group) =>
              selectedUniversityBands.includes(group.key),
            ).flatMap((group) => group.universities),
          );

    return options
      .filter((option) => {
        if (
          allowedUniversities &&
          !allowedUniversities.has(option.university)
        ) {
          return false;
        }

        const minimumMatched =
          minimumFilter === 'all' ||
          (minimumFilter === 'required' &&
            hasMinimumRequirement(option.meta)) ||
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

        const activeAdmissionDetailFilter =
          admissionCategoryFilter === '교과' &&
          selectedAdmissionDetailFilter?.startsWith('교과_')
            ? selectedAdmissionDetailFilter
            : admissionCategoryFilter === '학종' &&
                selectedAdmissionDetailFilter?.startsWith('학종_')
              ? selectedAdmissionDetailFilter
              : null;

        if (activeAdmissionDetailFilter !== null) {
          const meta = option.meta;
          if (!meta) {
            return false;
          }

          const detailMatched =
            (activeAdmissionDetailFilter === '교과_서류미반영' &&
              meta.admissionCategory === '교과' &&
              meta.documentEvaluationRatio === null) ||
            (activeAdmissionDetailFilter === '교과_탐구계열별' &&
              meta.admissionCategory === '교과' &&
              meta.usesMajorExplorationSubjectsByTrack === true) ||
            (activeAdmissionDetailFilter === '학종_면접' &&
              meta.admissionCategory === '학종' &&
              meta.interviewRatio !== null) ||
            (activeAdmissionDetailFilter === '학종_서류' &&
              meta.admissionCategory === '학종' &&
              meta.interviewRatio === null);

          if (!detailMatched) {
            return false;
          }
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

        const fieldMatch = includesByAnyKeyword(
          `${option.university} ${option.admissionCategory} ${option.admissionName}`,
          schoolKeywords,
        );

        return fieldMatch;
      })
      .map((option) => {
        const matchedRows =
          departmentKeywords.length > 0
            ? option.rows.filter((row) =>
                includesByAnyKeyword(row.department, departmentKeywords),
              )
            : option.rows;

        return {
          ...option,
          rows: matchedRows,
        };
      })
      .filter((option) => option.rows.length > 0);
  }, [
    admissionCategoryFilter,
    departmentQuery,
    minimumDifficultyFilter,
    minimumFilter,
    options,
    schoolQuery,
    selectedAdmissionDetailFilter,
    selectedUniversityBands,
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

  function toggleUniversityBand(band: UniversityBand) {
    setSelectedUniversityBands((previous) =>
      previous.includes(band)
        ? previous.filter((value) => value !== band)
        : [...previous, band],
    );
  }

  function handleAdmissionCategoryFilterChange(
    nextFilter: AdmissionCategoryFilter,
  ) {
    setAdmissionCategoryFilter(nextFilter);
    setSelectedAdmissionDetailFilter(null);
  }

  function renderToggleGroup<T extends string>(params: {
    label: string;
    value: T;
    options: readonly T[];
    onChange: (value: T) => void;
  }) {
    const { label, value, options: toggleOptions, onChange } = params;
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex flex-wrap gap-1">
          {toggleOptions.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={value === option ? 'default' : 'outline'}
              onClick={() => onChange(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  function renderPlannerView() {
    return (
      <>
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
                <span className="text-xs text-muted-foreground">정렬</span>
                <Button
                  size="sm"
                  variant={sortMode === 'university' ? 'default' : 'outline'}
                  onClick={() => setSortMode('university')}
                >
                  대학별 정렬
                </Button>
                <Button
                  size="sm"
                  variant={
                    sortMode === 'approximateCut' ? 'default' : 'outline'
                  }
                  onClick={() => setSortMode('approximateCut')}
                >
                  전형별(성적대) 정렬
                </Button>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 md:justify-end">
                <span className="text-xs text-muted-foreground">구간</span>
                {UNIVERSITY_BAND_GROUPS.map((group) => (
                  <Button
                    key={group.key}
                    size="sm"
                    variant={
                      selectedUniversityBands.includes(group.key)
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => toggleUniversityBand(group.key)}
                  >
                    {group.key}
                  </Button>
                ))}
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 md:justify-end">
                <span className="text-xs text-muted-foreground">전형</span>
                <Button
                  size="sm"
                  variant={
                    admissionCategoryFilter === 'all' ? 'default' : 'outline'
                  }
                  onClick={() => handleAdmissionCategoryFilterChange('all')}
                >
                  전형 전체
                </Button>
                <Button
                  size="sm"
                  variant={
                    admissionCategoryFilter === '교과' ? 'default' : 'outline'
                  }
                  onClick={() => handleAdmissionCategoryFilterChange('교과')}
                >
                  교과
                </Button>
                <Button
                  size="sm"
                  variant={
                    admissionCategoryFilter === '학종' ? 'default' : 'outline'
                  }
                  onClick={() => handleAdmissionCategoryFilterChange('학종')}
                >
                  학종
                </Button>
              </div>

              {admissionCategoryFilter !== 'all' && (
                <div className="flex w-full flex-wrap items-center gap-2 md:justify-end">
                  <span className="text-xs text-muted-foreground">세부</span>
                  <Button
                    size="sm"
                    variant={
                      selectedAdmissionDetailFilter === null
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => setSelectedAdmissionDetailFilter(null)}
                  >
                    세부 전체
                  </Button>
                  {admissionCategoryFilter === '교과' && (
                    <>
                      <Button
                        size="sm"
                        variant={
                          selectedAdmissionDetailFilter === '교과_서류미반영'
                            ? 'default'
                            : 'outline'
                        }
                        onClick={() =>
                          setSelectedAdmissionDetailFilter('교과_서류미반영')
                        }
                      >
                        교과(서류 미반영)
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          selectedAdmissionDetailFilter === '교과_탐구계열별'
                            ? 'default'
                            : 'outline'
                        }
                        onClick={() =>
                          setSelectedAdmissionDetailFilter('교과_탐구계열별')
                        }
                      >
                        교과(탐구 계열별 반영)
                      </Button>
                    </>
                  )}
                  {admissionCategoryFilter === '학종' && (
                    <>
                      <Button
                        size="sm"
                        variant={
                          selectedAdmissionDetailFilter === '학종_면접'
                            ? 'default'
                            : 'outline'
                        }
                        onClick={() =>
                          setSelectedAdmissionDetailFilter('학종_면접')
                        }
                      >
                        학종(면접)
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          selectedAdmissionDetailFilter === '학종_서류'
                            ? 'default'
                            : 'outline'
                        }
                        onClick={() =>
                          setSelectedAdmissionDetailFilter('학종_서류')
                        }
                      >
                        학종(서류)
                      </Button>
                    </>
                  )}
                </div>
              )}

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
            <div className="w-full rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">내 성적(등급)</span>
                <input
                  className="h-9 w-28 rounded-md border bg-background px-2 text-sm"
                  placeholder="예: 2.15"
                  inputMode="decimal"
                  value={userGradeInput}
                  onChange={(event) => setUserGradeInput(event.target.value)}
                />

                <Button
                  size="sm"
                  variant={showGradeCompareHighlight ? 'default' : 'outline'}
                  disabled={parsedUserGrade === null}
                  onClick={() =>
                    setShowGradeCompareHighlight((previous) => !previous)
                  }
                >
                  70컷 비교 색상
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowProfileInputs((previous) => !previous)}
                >
                  {showProfileInputs ? '세부 입력 접기' : '세부 입력 펼치기'}
                </Button>
                <p className="text-xs text-rose-500/80">
                  *직접적인 성적 비교는 건국대 이상 학생부 종합전형에서는
                  유효하지 않습니다.
                </p>
              </div>

              {showProfileInputs && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {renderToggleGroup({
                    label: '선택 과목',
                    value: subjectTrack,
                    options: ['우수', '적절', '부족'],
                    onChange: setSubjectTrack,
                  })}
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">
                      주요과목 성적 (국영수사/과)
                    </p>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      placeholder="예: 2.1"
                      inputMode="decimal"
                      value={majorSubjectGradeInput}
                      onChange={(event) =>
                        setMajorSubjectGradeInput(event.target.value)
                      }
                    />
                  </div>
                  {renderToggleGroup({
                    label: '성적 추이',
                    value: gradeTrend,
                    options: ['상승', '유지', '하락'],
                    onChange: setGradeTrend,
                  })}
                  {renderToggleGroup({
                    label: '비교과',
                    value: extracurricularLevel,
                    options: ['강함', '보통', '약함'],
                    onChange: setExtracurricularLevel,
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-center">
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="학교명, 전형명 검색 (쉼표로 다중 검색)"
              value={schoolQuery}
              onChange={(event) => setSchoolQuery(event.target.value)}
            />
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="학과명 검색 (쉼표로 다중 검색)"
              value={departmentQuery}
              onChange={(event) => setDepartmentQuery(event.target.value)}
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
                approximateCutWindow={approximateCutWindow}
                referenceGrade={parsedUserGrade}
                showGradeCompareHighlight={showGradeCompareHighlight}
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
      </>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeView === 'planner' ? 'default' : 'outline'}
          onClick={() => setActiveView('planner')}
        >
          지원 진단
        </Button>
        <Button
          variant={activeView === 'nonsul' ? 'default' : 'outline'}
          onClick={() => setActiveView('nonsul')}
        >
          논술 정보
        </Button>
        <Button
          variant={activeView === 'midTier' ? 'default' : 'outline'}
          onClick={() => setActiveView('midTier')}
        >
          중위권 정보
        </Button>
      </div>

      {activeView === 'planner' && renderPlannerView()}
      {activeView === 'nonsul' && <NonsulInfoPanel />}
      {activeView === 'midTier' && <MidTierInfoPanel />}
    </main>
  );
}
