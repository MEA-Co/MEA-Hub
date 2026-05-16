import type { TopicWorksheetState } from './topicWorksheet';

export type PreviousActivityTopicRequest = {
  motivationInput: string;
  detailKeywordInput?: string;
  competencyInput?: string;
  worksheet: TopicWorksheetState;
};

export type PreviousActivityTopicCore = {
  motivation: string;
  topic: string;
  elaboration: string[];
  competencies: string[];
  growth: string[];
  usedKeywords: string[];
};

export type PreviousActivityTopicResponse = PreviousActivityTopicCore & {
  model: string;
};

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export function isPreviousActivityTopicCore(
  value: unknown,
): value is PreviousActivityTopicCore {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.motivation === 'string' &&
    typeof candidate.topic === 'string' &&
    isStringArray(candidate.elaboration) &&
    isStringArray(candidate.competencies) &&
    isStringArray(candidate.growth) &&
    isStringArray(candidate.usedKeywords)
  );
}
