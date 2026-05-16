export const TOPIC_WORKSHEET_STORAGE_KEY = 'mea-hub-topics-notes';

export const TOPIC_WORKSHEET_FIELDS = [
  'firstMajor',
  'secondMajor',
  'thirdMajor',
  'existingKeywords',
  'newKeywords',
  'majorValues',
  'academicCompetency',
  'differentiatedCompetency',
] as const;

export type TopicWorksheetFieldId = (typeof TOPIC_WORKSHEET_FIELDS)[number];
export type TopicWorksheetState = Record<TopicWorksheetFieldId, string>;

export type StoredTopicWorksheetPayload = {
  fields?: Record<string, unknown>;
  updatedAt?: string;
};

const EMPTY_WORKSHEET: TopicWorksheetState = {
  firstMajor: '',
  secondMajor: '',
  thirdMajor: '',
  existingKeywords: '',
  newKeywords: '',
  majorValues: '',
  academicCompetency: '',
  differentiatedCompetency: '',
};

export function createEmptyTopicWorksheet(): TopicWorksheetState {
  return { ...EMPTY_WORKSHEET };
}

export function normalizeTopicWorksheet(
  value: Record<string, unknown> | undefined,
): TopicWorksheetState {
  if (!value) {
    return createEmptyTopicWorksheet();
  }

  const normalized = TOPIC_WORKSHEET_FIELDS.reduce<TopicWorksheetState>(
    (acc, fieldId) => {
      const fieldValue = value[fieldId];
      acc[fieldId] = typeof fieldValue === 'string' ? fieldValue : '';
      return acc;
    },
    createEmptyTopicWorksheet(),
  );

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

export function parseStoredTopicWorksheet(
  rawValue: string | null,
): TopicWorksheetState {
  if (!rawValue) {
    return createEmptyTopicWorksheet();
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredTopicWorksheetPayload;
    return normalizeTopicWorksheet(parsed.fields);
  } catch {
    return createEmptyTopicWorksheet();
  }
}

export function summarizeTopicWorksheet(
  worksheet: TopicWorksheetState,
): string[] {
  const sections: Array<[string, string]> = [
    ['1순위 전공', worksheet.firstMajor],
    ['2순위 전공', worksheet.secondMajor],
    ['3순위 전공', worksheet.thirdMajor],
    ['기존 전공 세부 키워드', worksheet.existingKeywords],
    ['신규 전공 세부 키워드', worksheet.newKeywords],
    ['전공 가치관', worksheet.majorValues],
    ['전공 계열 적합 역량', worksheet.academicCompetency],
    ['차별화 역량', worksheet.differentiatedCompetency],
  ];

  return sections
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`);
}

export function summarizeTopicWorksheetForTopicGeneration(
  worksheet: TopicWorksheetState,
): string[] {
  const detailKeywords = [worksheet.existingKeywords, worksheet.newKeywords]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join('\n');

  const sections: Array<[string, string]> = [
    ['1순위 희망 전공', worksheet.firstMajor],
    ['전공 세부 키워드', detailKeywords],
    ['전공 가치관', worksheet.majorValues],
    ['차별화 역량', worksheet.differentiatedCompetency],
  ];

  return sections
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`);
}

export function getMissingRequiredTopicWorksheetFields(
  worksheet: TopicWorksheetState,
): string[] {
  const missing: string[] = [];

  if (!worksheet.firstMajor.trim()) {
    missing.push('1순위 전공');
  }

  if (!worksheet.majorValues.trim()) {
    missing.push('전공 가치관');
  }

  if (!worksheet.existingKeywords.trim() && !worksheet.newKeywords.trim()) {
    missing.push('전공 세부 키워드');
  }

  return missing;
}
