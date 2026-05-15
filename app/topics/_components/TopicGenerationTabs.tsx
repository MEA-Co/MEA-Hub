'use client';

import { useState } from 'react';

import { fetchJson } from '@/app/record/_lib/http';
import {
  getMissingRequiredTopicWorksheetFields,
  TOPIC_WORKSHEET_STORAGE_KEY,
  parseStoredTopicWorksheet,
} from '@/app/topics/_lib/topicWorksheet';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import type { PreviousActivityTopicResponse } from '../_lib/topicGeneration';

const TOPIC_TABS = [
  {
    value: 'previous-activity',
    label: '이전 활동으로 만들기',
    description:
      '이전에 했던 활동, 프로젝트, 수업 경험을 바탕으로 탐구 주제를 확장해요.',
  },
  {
    value: 'detail-keyword',
    label: '세부 키워드로 만들기',
    description:
      '재료함에 모아둔 전공 세부 키워드를 바탕으로 탐구 주제를 구성해요.',
  },
] as const;

export default function TopicGenerationTabs() {
  const [activityDescription, setActivityDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviousActivityTopicResponse | null>(
    null,
  );

  async function handleGenerateFromPreviousActivity() {
    const trimmed = activityDescription.trim();

    if (!trimmed) {
      setError('이전 활동 설명을 먼저 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const worksheet = parseStoredTopicWorksheet(
        window.localStorage.getItem(TOPIC_WORKSHEET_STORAGE_KEY),
      );
      const missingFields = getMissingRequiredTopicWorksheetFields(worksheet);

      if (missingFields.length > 0) {
        setResult(null);
        setError(
          `재료함의 다음 필수 항목을 먼저 입력해주세요: ${missingFields.join(', ')}`,
        );
        return;
      }

      const response = await fetchJson<PreviousActivityTopicResponse>(
        '/api/topics/previous-activity',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            activityDescription: trimmed,
            worksheet,
          }),
          timeoutMs: 60000,
        },
      );

      setResult(response);
    } catch (generationError) {
      setResult(null);
      setError(
        generationError instanceof Error
          ? generationError.message
          : '탐구 주제 생성 중 오류가 발생했습니다.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="w-full space-y-4">
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          탐구 주제 만들기
        </h2>
      </div>

      <Tabs defaultValue={TOPIC_TABS[0].value}>
        <TabsList>
          {TOPIC_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="previous-activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{TOPIC_TABS[0].label}</CardTitle>
              <CardDescription>{TOPIC_TABS[0].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">이전 활동 설명</p>
                <Textarea
                  value={activityDescription}
                  onChange={(event) =>
                    setActivityDescription(event.currentTarget.value)
                  }
                  placeholder="예: 과학 동아리에서 미세플라스틱 관련 실험을 했는데, 실험 조건을 더 다양하게 바꾸면 결과가 어떻게 달라지는지 궁금했어."
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  재료함 내용은 보조 키워드로 함께 활용돼요.
                </p>
                <Button
                  type="button"
                  onClick={handleGenerateFromPreviousActivity}
                  disabled={isLoading}
                >
                  {isLoading ? '생성 중...' : '탐구 주제 생성'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {error ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          ) : null}

          {result ? (
            <Card>
              <CardHeader>
                <CardTitle>추천된 탐구 주제</CardTitle>
                <CardDescription>생성 모델: {result.model}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">계기</p>
                  <p className="text-sm text-muted-foreground">
                    {result.motivation}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">주제</p>
                  <p className="text-sm text-muted-foreground">
                    {result.topic}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">구체화</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.elaboration.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">역량</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.competencies.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">성장</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.growth.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">사용된 키워드 목록</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.usedKeywords.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="detail-keyword">
          <Card>
            <CardHeader>
              <CardTitle>{TOPIC_TABS[1].label}</CardTitle>
              <CardDescription>{TOPIC_TABS[1].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                이 탭은 다음 단계에서 이어서 구현할 예정이에요.
              </p>
              <Button type="button" disabled>
                탐구 주제 생성
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
