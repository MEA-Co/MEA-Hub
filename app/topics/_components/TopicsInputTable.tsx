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
  placeholder: string;
};

const RANK_FIELDS: RankField[] = [
  {
    id: 'firstMajor',
    label: '1순위 전공',
    placeholder: '예: 컴퓨터공학과',
  },
  {
    id: 'secondMajor',
    label: '2순위 전공',
    placeholder: '예: 인공지능학과',
  },
  {
    id: 'thirdMajor',
    label: '3순위 전공',
    placeholder: '예: 데이터사이언스학과',
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
    <div className="space-y-3">
      <p className="font-medium tracking-tight">{title}</p>
      {subtitle ? (
        <p className="text-base leading-7 text-muted-foreground md:text-lg">
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
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder={placeholder}
      className={[
        'resize-y border-0 bg-transparent px-0 py-0 text-base leading-7 shadow-none focus-visible:ring-0',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
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
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-2xl">재료함</CardTitle>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SaveIcon className="size-4" />
            <span>
              {hasLoaded ? lastSavedLabel : '저장된 내용을 불러오는 중...'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-border/70">
          <Table className="min-w-[980px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[21%]" />
              <col className="w-[24%]" />
              <col className="w-[55%]" />
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
                      className="border-r border-border bg-muted/15 px-6 py-10 text-center align-middle whitespace-normal"
                    >
                      <SideLabel title="전공 세부 키워드" />
                    </TableCell>
                  ) : null}

                  <TableCell className="border-r border-border bg-muted/10 px-6 py-6 text-center align-middle whitespace-normal">
                    <SideLabel title={field.label} />
                  </TableCell>

                  <TableCell className="px-5 py-3 align-middle whitespace-normal">
                    <Input
                      value={fields[field.id]}
                      onChange={(event) =>
                        updateField(field.id, event.currentTarget.value)
                      }
                      placeholder={field.placeholder}
                      className="h-14 border-0 bg-transparent px-0 text-lg shadow-none focus-visible:ring-0"
                    />
                  </TableCell>
                </TableRow>
              ))}

              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell
                  colSpan={2}
                  className="px-6 py-6 align-top whitespace-normal"
                >
                  <div className="space-y-4">
                    <p className="text-xl font-medium tracking-tight md:text-[1.9rem]">
                      [기존 - 생활기록부 속 전공 세부 키워드]
                    </p>
                    <WorksheetTextarea
                      value={fields.existingKeywords}
                      onChange={(value) =>
                        updateField('existingKeywords', value)
                      }
                      placeholder="생활기록부에서 이미 드러난 전공 관련 키워드를 자유롭게 정리해보세요."
                      className="min-h-[220px]"
                    />
                  </div>
                </TableCell>
              </TableRow>

              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell
                  colSpan={2}
                  className="px-6 py-6 align-top whitespace-normal"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xl font-medium tracking-tight md:text-[1.9rem]">
                        [신규 - 학과/연구실 사이트에서 가져온 전공 세부 키워드]
                      </p>
                      <p className="text-base leading-7 text-muted-foreground md:text-lg">
                        (키워드), (사이트 주소)로 작성
                      </p>
                      <p className="text-base leading-7 text-muted-foreground md:text-lg">
                        (예시) AutoML, https://cse.snu.ac.kr/research/labs/1
                      </p>
                    </div>
                    <WorksheetTextarea
                      value={fields.newKeywords}
                      onChange={(value) => updateField('newKeywords', value)}
                      placeholder="예: 인간-컴퓨터 상호작용, https://example.ac.kr/lab"
                      className="min-h-[220px]"
                    />
                  </div>
                </TableCell>
              </TableRow>

              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell className="border-r border-border bg-muted/15 px-6 py-8 text-center align-middle whitespace-normal">
                  <SideLabel title="전공 가치관" />
                </TableCell>
                <TableCell
                  colSpan={2}
                  className="px-6 py-5 align-top whitespace-normal"
                >
                  <WorksheetTextarea
                    value={fields.majorValues}
                    onChange={(value) => updateField('majorValues', value)}
                    placeholder="전공을 통해 실현하고 싶은 가치, 전공을 바라보는 기준, 중요하게 여기는 문제의식 등을 적어보세요."
                    className="min-h-[120px]"
                  />
                </TableCell>
              </TableRow>

              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell
                  rowSpan={2}
                  className="border-r border-border bg-muted/15 px-6 py-10 text-center align-middle whitespace-normal"
                >
                  <SideLabel title="계열 적합 역량" />
                </TableCell>
                <TableCell className="border-r border-border bg-muted/10 px-6 py-8 text-center align-middle whitespace-normal">
                  <SideLabel
                    title="전공 계열 적합 역량"
                    subtitle="(+ 순수 학문 역량)"
                  />
                </TableCell>
                <TableCell className="px-6 py-5 align-top whitespace-normal">
                  <div className="space-y-3">
                    <p className="text-base leading-7 text-muted-foreground md:text-lg">
                      전공 가치관을 실현하기 위한 능력
                      <br />/ 전공과 관련하여 이번 학기에 드러내고자 하는 능력
                    </p>
                    <WorksheetTextarea
                      value={fields.academicCompetency}
                      onChange={(value) =>
                        updateField('academicCompetency', value)
                      }
                      placeholder="예: 수리적 추론, 실험 설계, 비판적 읽기, 탐구 지속력..."
                      className="min-h-[160px]"
                    />
                  </div>
                </TableCell>
              </TableRow>

              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell className="border-r border-border bg-muted/10 px-6 py-8 text-center align-middle whitespace-normal">
                  <SideLabel title="차별화 역량" />
                </TableCell>
                <TableCell className="px-6 py-5 align-top whitespace-normal">
                  <div className="space-y-3">
                    <p className="text-base leading-7 text-muted-foreground md:text-lg">
                      전공과 직접적인 연관이 없어도 활용가능한 나만의 능력 /
                      관심사
                    </p>
                    <WorksheetTextarea
                      value={fields.differentiatedCompetency}
                      onChange={(value) =>
                        updateField('differentiatedCompetency', value)
                      }
                      placeholder="예: 스토리텔링, 시각화, 리더십, 관찰력, 꾸준한 기록 습관..."
                      className="min-h-[160px]"
                    />
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>같은 브라우저에서 다시 열면 자동으로 이어서 작성할 수 있어요.</p>
          <Button
            type="button"
            variant="outline"
            onClick={resetFields}
            className="w-full md:w-auto"
          >
            <RotateCcwIcon />
            입력 초기화
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
