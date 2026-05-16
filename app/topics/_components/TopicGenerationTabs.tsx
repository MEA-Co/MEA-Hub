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
import { Textarea } from '@/components/ui/textarea';

import type { PreviousActivityTopicResponse } from '../_lib/topicGeneration';

export default function TopicGenerationTabs() {
  const [motivationInput, setMotivationInput] = useState('');
  const [detailKeywordInput, setDetailKeywordInput] = useState('');
  const [competencyInput, setCompetencyInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviousActivityTopicResponse | null>(
    null,
  );

  async function handleGenerateTopic() {
    const trimmedMotivation = motivationInput.trim();
    const trimmedDetailKeyword = detailKeywordInput.trim();
    const trimmedCompetency = competencyInput.trim();

    if (!trimmedMotivation) {
      setError('계기를 먼저 입력해주세요.');
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
            motivationInput: trimmedMotivation,
            detailKeywordInput: trimmedDetailKeyword,
            competencyInput: trimmedCompetency,
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

      <Card>
        <CardHeader>
          <CardTitle>주제 고도화하기</CardTitle>
          <CardDescription>
            이전 활동에서 부족했던 점, 더 알아보고 싶었던 점, 꼭 살리고 싶은
            전공 방향을 나누어 작성해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">계기</p>
              <span className="text-xs font-medium text-destructive">
                필수
              </span>
            </div>
            <Textarea
              value={motivationInput}
              onChange={(event) =>
                setMotivationInput(event.currentTarget.value)
              }
              placeholder="예: 학교 캠페인을 준비하면서 친환경 포장이 실제로 얼마나 효과적인지 궁금해졌어."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">세부 키워드</p>
              <span className="text-xs font-medium text-muted-foreground">
                선택
              </span>
            </div>
            <Textarea
              value={detailKeywordInput}
              onChange={(event) =>
                setDetailKeywordInput(event.currentTarget.value)
              }
              placeholder="선택 입력: 생분해성 플라스틱, 탄소발자국, 소비자 인식 조사 등"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">역량</p>
              <span className="text-xs font-medium text-muted-foreground">
                선택
              </span>
            </div>
            <Textarea
              value={competencyInput}
              onChange={(event) =>
                setCompetencyInput(event.currentTarget.value)
              }
              placeholder="선택 입력: 데이터 분석력"
            />
            <p className="text-sm font-medium text-destructive">
              역량은 이번 탐구에서 살리고 싶은 핵심 역량이 있다면 하나만
              입력해주세요.
            </p>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              onClick={handleGenerateTopic}
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
              <p className="text-sm text-muted-foreground">{result.topic}</p>
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
    </section>
  );
}
