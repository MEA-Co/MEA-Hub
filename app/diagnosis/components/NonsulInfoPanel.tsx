'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';

import { nonsulDataset } from '../data';

type MinimumFilter = 'all' | 'required' | 'none';

const UNIVERSITY_ORDER = [
  '서울대학교',
  '연세대학교',
  '고려대학교',
  '서강대학교',
  '성균관대학교',
  '한양대학교',
  '중앙대학교',
  '경희대학교',
  '한국외국어대학교',
  '서울시립대학교',
  '이화여자대학교',
  '건국대학교',
  '동국대학교',
  '홍익대학교',
  '숙명여자대학교',
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

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function compareByDiagnosisUniversityOrder(
  a: { university: string },
  b: { university: string },
) {
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

  return a.university.localeCompare(b.university, 'ko');
}

function getReflectionTone(reflection: string) {
  if (reflection.includes('100%')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (reflection.includes('출결') || reflection.includes('비교과')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return 'bg-sky-50 text-sky-700 border-sky-200';
}

export function NonsulInfoPanel() {
  const [query, setQuery] = useState('');
  const [minimumFilter, setMinimumFilter] = useState<MinimumFilter>('all');

  const filteredDataset = useMemo(() => {
    const normalizedQuery = normalize(query);

    return nonsulDataset
      .filter((item) => {
        const minimumMatched =
          minimumFilter === 'all' ||
          (minimumFilter === 'required' && item.hasMinimumRequirement) ||
          (minimumFilter === 'none' && !item.hasMinimumRequirement);

        if (!minimumMatched) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return normalize(
          `${item.university} ${item.minimumRequirementDetail} ${item.studentRecordReflection}`,
        ).includes(normalizedQuery);
      })
      .sort(compareByDiagnosisUniversityOrder);
  }, [minimumFilter, query]);

  const minimumRequiredCount = nonsulDataset.filter(
    (item) => item.hasMinimumRequirement,
  ).length;
  const minimumNoneCount = nonsulDataset.length - minimumRequiredCount;
  const noRecordReflectionCount = nonsulDataset.filter((item) =>
    item.studentRecordReflection.includes('100%'),
  ).length;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">전체 대학</p>
          <p className="mt-1 text-2xl font-semibold">{nonsulDataset.length}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">수능 최저 있음</p>
          <p className="mt-1 text-2xl font-semibold">{minimumRequiredCount}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">수능 최저 없음</p>
          <p className="mt-1 text-2xl font-semibold">{minimumNoneCount}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">논술 100%</p>
          <p className="mt-1 text-2xl font-semibold">
            {noRecordReflectionCount}
          </p>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">논술전형 정보</h2>
            <p className="text-sm text-muted-foreground">
              수능 최저와 학생부 반영 방식을 한 번에 확인합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="대학명, 최저 기준, 반영 방식 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="text-sm text-muted-foreground md:min-w-28 md:text-right">
            {filteredDataset.length}개 대학
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/40">
              <tr className="[&>th]:border-b [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
                <th className="w-[18%]">대학</th>
                <th className="w-[12%]">최저</th>
                <th>최저 기준</th>
                <th className="w-[28%]">학생부 반영</th>
              </tr>
            </thead>
            <tbody>
              {filteredDataset.map((item) => (
                <tr
                  key={item.university}
                  className="[&>td]:border-b [&>td]:px-3 [&>td]:py-3"
                >
                  <td className="font-medium">{item.university}</td>
                  <td>
                    <span
                      className={
                        item.hasMinimumRequirement
                          ? 'rounded-sm border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700'
                          : 'rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600'
                      }
                    >
                      {item.hasMinimumRequirement ? '있음' : '없음'}
                    </span>
                  </td>
                  <td className="leading-6">{item.minimumRequirementDetail}</td>
                  <td>
                    <span
                      className={`inline-flex rounded-sm border px-2 py-1 text-xs font-medium ${getReflectionTone(
                        item.studentRecordReflection,
                      )}`}
                    >
                      {item.studentRecordReflection}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDataset.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            검색 조건에 맞는 논술 정보가 없습니다.
          </div>
        )}
      </section>
    </section>
  );
}
