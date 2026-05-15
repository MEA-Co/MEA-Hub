'use client';

import { RotateCcwIcon, SaveIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const STORAGE_KEY = 'mea-hub-topics-notes';

const FORM_FIELDS = [
  'firstMajor',
  'secondMajor',
  'thirdMajor',
  'existingKeywords',
  'newKeywords',
  'majorValues',
  'academicCompetency',
  'differentiatedCompetency',
] as const;

type TopicFieldId = (typeof FORM_FIELDS)[number];
type TopicFormState = Record<TopicFieldId, string>;

type StoredTopicsPayload = {
  fields?: Record<string, unknown>;
  updatedAt?: string;
};

type RankField = {
  id: Extract<TopicFieldId, 'firstMajor' | 'secondMajor' | 'thirdMajor'>;
  label: string;
};

const RANK_FIELDS: RankField[] = [
  {
    id: 'firstMajor',
    label: '1순위 전공',
  },
  {
    id: 'secondMajor',
    label: '2순위 전공',
  },
  {
    id: 'thirdMajor',
    label: '3순위 전공',
  },
];

const EMPTY_FORM: TopicFormState = {
  firstMajor: '',
  secondMajor: '',
  thirdMajor: '',
  existingKeywords: '',
  newKeywords: '',
  majorValues: '',
  academicCompetency: '',
  differentiatedCompetency: '',
};

function createEmptyForm(): TopicFormState {
  return { ...EMPTY_FORM };
}

function normalizeFields(
  value: Record<string, unknown> | undefined,
): TopicFormState {
  if (!value) {
    return createEmptyForm();
  }

  const normalized = FORM_FIELDS.reduce<TopicFormState>((acc, fieldId) => {
    const fieldValue = value[fieldId];
    acc[fieldId] = typeof fieldValue === 'string' ? fieldValue : '';
    return acc;
  }, createEmptyForm());

  if (!normalized.firstMajor && typeof value.careerGoal === 'string') {
    normalized.firstMajor = value.careerGoal;
  }

  if (!normalized.majorValues && typeof value.majorValues === 'string') {
    normalized.majorValues = value.majorValues;
  }

  if (
    !normalized.academicCompetency &&
    typeof value.fitCompetency === 'string'
  ) {
    normalized.academicCompetency = value.fitCompetency;
  }

  return normalized;
}

function SideLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1.5 md:space-y-2.5">
      <p className="text-sm font-medium tracking-tight md:text-base">{title}</p>
      {subtitle ? (
        <p className="text-xs leading-5 text-muted-foreground md:text-sm md:leading-6">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function WorksheetTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder={placeholder}
    />
  );
}

export default function TopicsInputTable() {
  const [fields, setFields] = useState<TopicFormState>(createEmptyForm);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as StoredTopicsPayload;
        setFields(normalizeFields(parsed.fields));
        setLastSavedAt(
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        );
      }
    } catch (error) {
      console.error('Failed to load topic notes from localStorage.', error);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const payload: StoredTopicsPayload = {
      fields,
      updatedAt,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setLastSavedAt(updatedAt);
    } catch (error) {
      console.error('Failed to save topic notes to localStorage.', error);
    }
  }, [fields, hasLoaded]);

  const lastSavedLabel = useMemo(() => {
    if (!lastSavedAt) {
      return '아직 저장된 기록이 없어요.';
    }

    return `마지막 저장: ${new Date(lastSavedAt).toLocaleString('ko-KR')}`;
  }, [lastSavedAt]);

  function updateField(fieldId: TopicFieldId, value: string) {
    setFields((current) => ({
      ...current,
      [fieldId]: value,
    }));
  }

  function resetFields() {
    setFields(createEmptyForm());
    setLastSavedAt(null);
  }

  return (
    <Card className="w-full">
      <CardHeader className="gap-2 px-4 pb-0 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-xl md:text-2xl">재료함</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground md:text-sm">
            <SaveIcon className="size-3.5 md:size-4" />
            <span>
              {hasLoaded ? lastSavedLabel : '저장된 내용을 불러오는 중...'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-hidden rounded-xl border border-border/70">
          <Table className="w-full">
            <colgroup>
              <col className="w-[24%] md:w-[21%]" />
              <col className="w-[28%] md:w-[24%]" />
              <col className="w-[48%] md:w-[55%]" />
            </colgroup>

            <TableBody>
              {RANK_FIELDS.map((field, index) => (
                <TableRow
                  key={field.id}
                  className="border-b border-border hover:bg-transparent"
                >
                  {index === 0 ? (
                    <TableCell
                      rowSpan={5}
                      className="border-r border-border bg-muted/15 px-3 py-5 text-center align-middle whitespace-normal md:px-5 md:py-8"
                    >
                      <SideLabel title="전공 세부 키워드" />
                    </TableCell>
                  ) : null}

                  <TableCell className="border-r border-border bg-muted/10 px-3 py-4 text-center align-middle whitespace-normal md:px-5 md:py-5">
                    <SideLabel title={field.label} />
                  </TableCell>

                  <TableCell className="px-3 py-2 align-middle whitespace-normal md:px-4 md:py-3">
                    <Input
                      value={fields[field.id]}
                      onChange={(event) =>
                        updateField(field.id, event.currentTarget.value)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}

              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell
                  colSpan={2}
                  className="px-3 py-4 align-top whitespace-normal md:px-5 md:py-5"
                >
                  <div className="space-y-3">
                    <p className="text-sm font-medium tracking-tight md:text-base">
                      [기존 - 생활기록부 속 전공 세부 키워드]
                    </p>
                    <WorksheetTextarea
                      value={fields.existingKeywords}
                      onChange={(value) =>
                        updateField('existingKeywords', value)
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>

              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell
                  colSpan={2}
                  className="px-3 py-4 align-top whitespace-normal md:px-5 md:py-5"
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium tracking-tight md:text-base">
                        [신규 - 학과/연구실 사이트에서 가져온 전공 세부 키워드]
                      </p>
                    </div>
                    <WorksheetTextarea
                      value={fields.newKeywords}
                      onChange={(value) => updateField('newKeywords', value)}
                      placeholder="예: 인간-컴퓨터 상호작용"
                    />
                  </div>
                </TableCell>
              </TableRow>

              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell className="border-r border-border bg-muted/15 px-3 py-5 text-center align-middle whitespace-normal md:px-5 md:py-7">
                  <SideLabel title="전공 가치관" />
                </TableCell>
                <TableCell
                  colSpan={2}
                  className="px-3 py-4 align-top whitespace-normal md:px-5 md:py-4"
                >
                  <WorksheetTextarea
                    value={fields.majorValues}
                    onChange={(value) => updateField('majorValues', value)}
                  />
                </TableCell>
              </TableRow>

              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell
                  rowSpan={2}
                  className="border-r border-border bg-muted/15 px-3 py-5 text-center align-middle whitespace-normal md:px-5 md:py-8"
                >
                  <SideLabel title="계열 적합 역량" />
                </TableCell>
                <TableCell className="border-r border-border bg-muted/10 px-3 py-5 text-center align-middle whitespace-normal md:px-5 md:py-7">
                  <SideLabel
                    title="전공 계열 적합 역량"
                    subtitle="(+ 순수 학문 역량)"
                  />
                </TableCell>
                <TableCell className="px-3 py-4 align-top whitespace-normal md:px-5 md:py-4">
                  <div className="space-y-2.5">
                    <WorksheetTextarea
                      value={fields.academicCompetency}
                      onChange={(value) =>
                        updateField('academicCompetency', value)
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>

              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell className="border-r border-border bg-muted/10 px-3 py-5 text-center align-middle whitespace-normal md:px-5 md:py-7">
                  <SideLabel title="차별화 역량" />
                </TableCell>
                <TableCell className="px-3 py-4 align-top whitespace-normal md:px-5 md:py-4">
                  <div className="space-y-2.5">
                    <WorksheetTextarea
                      value={fields.differentiatedCompetency}
                      onChange={(value) =>
                        updateField('differentiatedCompetency', value)
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:p-4 md:text-sm">
          <p>같은 브라우저에서 다시 열면 자동으로 이어서 작성할 수 있어요.</p>
          <Button
            type="button"
            variant="outline"
            onClick={resetFields}
            className="h-9 w-full text-xs md:w-auto md:text-sm"
          >
            <RotateCcwIcon />
            입력 초기화
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
