'use client';

import { Button } from '@/components/ui/button';

import type { AdmissionMetaKey } from '../data';

export const MAX_SELECTED_DEPARTMENTS = 6;

export type SelectedDepartment = {
  id: string;
  key: AdmissionMetaKey;
  university: string;
  admissionCategory: string;
  admissionName: string;
  department: string;
};

type SelectionSlotsProps = {
  selectedDepartments: SelectedDepartment[];
  onRemove: (id: string) => void;
};

export function SelectionSlots({
  selectedDepartments,
  onRemove,
}: SelectionSlotsProps) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">지원 학과 선택 (최대 6개)</h2>
        <p className="text-sm text-muted-foreground">
          {selectedDepartments.length} / {MAX_SELECTED_DEPARTMENTS}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: MAX_SELECTED_DEPARTMENTS }, (_, index) => {
          const selected = selectedDepartments[index];
          if (!selected) {
            return (
              <div
                key={`empty-${index}`}
                className="flex min-h-28 items-center justify-center rounded-md border border-dashed bg-muted/40 px-3 text-center text-sm text-muted-foreground"
              >
                학과를 선택하면 여기에 추가됩니다
              </div>
            );
          }

          return (
            <div
              key={selected.id}
              className="flex min-h-28 flex-col justify-between rounded-md border bg-background p-3"
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  {selected.university} · {selected.admissionCategory} ·{' '}
                  {selected.admissionName}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold">
                  {selected.department}
                </p>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(selected.id)}
                >
                  제거
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
