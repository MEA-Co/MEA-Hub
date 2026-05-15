import OpenAI from 'openai';
import { NextResponse } from 'next/server';

import {
  isPreviousActivityTopicCore,
  type PreviousActivityTopicRequest,
  type PreviousActivityTopicResponse,
} from '@/app/topics/_lib/topicGeneration';
import {
  getMissingRequiredTopicWorksheetFields,
  normalizeTopicWorksheet,
  summarizeTopicWorksheet,
} from '@/app/topics/_lib/topicWorksheet';

export const runtime = 'nodejs';

const REQUESTED_MODEL = 'gpt-5.5-nano';
const FALLBACK_MODEL = process.env.OPENAI_TOPIC_MODEL_FALLBACK ?? 'gpt-5-nano';

const TOPIC_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'motivation',
    'topic',
    'elaboration',
    'competencies',
    'growth',
    'usedKeywords',
  ],
  properties: {
    motivation: {
      type: 'string',
    },
    topic: {
      type: 'string',
    },
    elaboration: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'string',
      },
    },
    competencies: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'string',
      },
    },
    growth: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'string',
      },
    },
    usedKeywords: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
} as const;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function generateWithModel(
  client: OpenAI,
  model: string,
  activityDescription: string,
  worksheetSummary: string[],
): Promise<PreviousActivityTopicResponse> {
  const prompt = [
    '너는 대한민국 고등학생의 생활기록부용 탐구 주제를 설계하는 입학 컨설턴트다.',
    '이전 활동 설명을 가장 중요하게 사용하고, 재료함 내용은 보조 키워드로만 활용하라.',
    '출력은 반드시 지정된 JSON 스키마만 사용하라.',
    '계기 작성 규칙:',
    '- 이전 활동 설명에 부족한 점, 더 궁금한 점, 더 알아보고 싶은 점이 이미 드러나면 그것을 그대로 계기로 반영한다.',
    '- 그런 정보가 부족하면 활동을 발전시키기 위한 자연스러운 문제의식이나 궁금증을 짧고 구체적으로 제안한다.',
    '주제 작성 규칙:',
    '- 반드시 키워드와 탐구 방법을 함께 포함한다.',
    '- 탐구 방법은 비교 분석, 실험, 문헌 조사, 설문, 사례 조사 등 고등학생이 수행 가능한 수준이어야 한다.',
    '구체화 작성 규칙:',
    '- 탐구를 대신 수행하지 말라.',
    '- 학생이 탐구 과정에서 구체적으로 밝혀야 할 점을 제안하라.',
    '- 변수, 비교 기준, 실험 조건, 관찰 지표, 수치화 포인트 등을 포함할 수 있다.',
    '역량 작성 규칙:',
    '- 이 탐구를 통해 생활기록부에서 어필 가능한 역량을 제안하라.',
    '성장 작성 규칙:',
    '- 이번 탐구 이후에 이어질 수 있는 후속 탐구 주제를 제안하라.',
    '사용된 키워드 목록 규칙:',
    '- 실제 결과에 반영한 키워드만 포함하라.',
    '',
    '[이전 활동 설명]',
    activityDescription,
    '',
    '[재료함 보조 키워드]',
    worksheetSummary.length > 0
      ? worksheetSummary.join('\n')
      : '작성된 재료함 정보 없음',
  ].join('\n');

  const response = await client.responses.create({
    model,
    input: prompt,
    text: {
      format: {
        type: 'json_schema',
        name: 'previous_activity_topic_recommendation',
        strict: true,
        schema: TOPIC_RESPONSE_SCHEMA,
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as unknown;

  if (!isPreviousActivityTopicCore(parsed)) {
    throw new Error('모델 응답 형식이 올바르지 않습니다.');
  }

  return {
    ...parsed,
    model,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY가 설정되어 있지 않습니다.' },
      { status: 500 },
    );
  }

  let body: PreviousActivityTopicRequest;

  try {
    body = (await request.json()) as PreviousActivityTopicRequest;
  } catch {
    return badRequest('요청 본문을 읽을 수 없습니다.');
  }

  const activityDescription = body.activityDescription?.trim();

  if (!activityDescription) {
    return badRequest('이전 활동 설명을 입력해주세요.');
  }

  const worksheet = normalizeTopicWorksheet(
    typeof body.worksheet === 'object' && body.worksheet !== null
      ? (body.worksheet as Record<string, unknown>)
      : undefined,
  );
  const missingFields = getMissingRequiredTopicWorksheetFields(worksheet);

  if (missingFields.length > 0) {
    return badRequest(
      `재료함의 다음 필수 항목을 먼저 입력해주세요: ${missingFields.join(', ')}`,
    );
  }

  const worksheetSummary = summarizeTopicWorksheet(worksheet);
  const client = new OpenAI({ apiKey });

  try {
    try {
      const result = await generateWithModel(
        client,
        REQUESTED_MODEL,
        activityDescription,
        worksheetSummary,
      );
      return NextResponse.json(result);
    } catch (requestedError) {
      if (REQUESTED_MODEL === FALLBACK_MODEL) {
        throw requestedError;
      }

      const result = await generateWithModel(
        client,
        FALLBACK_MODEL,
        activityDescription,
        worksheetSummary,
      );
      return NextResponse.json(result);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : '탐구 주제를 생성하는 중 오류가 발생했습니다.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
