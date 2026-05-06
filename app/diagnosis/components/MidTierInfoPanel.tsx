'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';

import { type MidTierCategory,midTierDataset } from '../data';

type CategoryFilter = 'all' | MidTierCategory;
type AdmissionFilter = 'all' | '교과' | '학종';

const CATEGORY_FILTERS: readonly CategoryFilter[] = [
  'all',
  '지거국 학종',
  '분캠',
  '서울/경기권',
];

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function formatValue(value: string | null) {
  return value ?? '-';
}

function getCategoryTone(category: MidTierCategory) {
  if (category === '지거국 학종') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (category === '분캠') {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }

  return 'border-violet-200 bg-violet-50 text-violet-700';
}

export function MidTierInfoPanel() {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>('all');
  const [admissionFilter, setAdmissionFilter] =
    useState<AdmissionFilter>('all');

  const filteredDataset = useMemo(() => {
    const normalizedQuery = normalize(query);

    return midTierDataset.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      if (admissionFilter === '교과' && item.schoolRecordGrade === null) {
        return false;
      }

      if (admissionFilter === '학종' && item.comprehensiveGrade === null) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return normalize(
        [
          item.university,
          item.category,
          item.schoolRecordGrade,
          item.comprehensiveGrade,
          item.calculationBasis,
          item.notes,
        ]
          .filter(Boolean)
          .join(' '),
      ).includes(normalizedQuery);
    });
  }, [admissionFilter, categoryFilter, query]);

  const schoolRecordCount = midTierDataset.filter(
    (item) => item.schoolRecordGrade !== null,
  ).length;
  const comprehensiveCount = midTierDataset.filter(
    (item) => item.comprehensiveGrade !== null,
  ).length;
  const comprehensiveUnavailableCount =
    midTierDataset.length - comprehensiveCount;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">전체 대학</p>
          <p className="mt-1 text-2xl font-semibold">
            {midTierDataset.length}
          </p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">교과 참고</p>
          <p className="mt-1 text-2xl font-semibold">{schoolRecordCount}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">학종 참고</p>
          <p className="mt-1 text-2xl font-semibold">{comprehensiveCount}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">종합 미선발</p>
          <p className="mt-1 text-2xl font-semibold">
            {comprehensiveUnavailableCount}
          </p>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold">중위권 참고 정보</h2>
            <p className="text-sm text-muted-foreground">
              대학군별 교과·학종 참고 성적대와 산정 방식을 정리합니다.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={categoryFilter === filter ? 'default' : 'outline'}
                  onClick={() => setCategoryFilter(filter)}
                >
                  {filter === 'all' ? '분류 전체' : filter}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', '교과', '학종'] as const).map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={admissionFilter === filter ? 'default' : 'outline'}
                  onClick={() => setAdmissionFilter(filter)}
                >
                  {filter === 'all' ? '전형 전체' : filter}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="대학명, 성적대, 산정 기준 검색"
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
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/40">
              <tr className="[&>th]:border-b [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
                <th className="w-[13%]">분류</th>
                <th className="w-[16%]">대학</th>
                <th className="w-[14%]">교과</th>
                <th className="w-[14%]">학종</th>
                <th>산정 기준</th>
                <th className="w-[22%]">비고</th>
              </tr>
            </thead>
            <tbody>
              {filteredDataset.map((item) => (
                <tr
                  key={`${item.category}-${item.university}`}
                  className="[&>td]:border-b [&>td]:px-3 [&>td]:py-3"
                >
                  <td>
                    <span
                      className={`inline-flex rounded-sm border px-2 py-1 text-xs font-medium ${getCategoryTone(
                        item.category,
                      )}`}
                    >
                      {item.category}
                    </span>
                  </td>
                  <td className="font-medium">{item.university}</td>
                  <td>{formatValue(item.schoolRecordGrade)}</td>
                  <td>{formatValue(item.comprehensiveGrade)}</td>
                  <td className="whitespace-pre-line leading-6">
                    {item.calculationBasis}
                  </td>
                  <td className="leading-6 text-muted-foreground">
                    {item.notes ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDataset.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            검색 조건에 맞는 중위권 정보가 없습니다.
          </div>
        )}
      </section>
    </section>
  );
}
