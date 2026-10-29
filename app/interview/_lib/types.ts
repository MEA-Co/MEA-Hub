export const CATEGORIES = {
  autonomous: '자율활동',
  club: '동아리활동',
  career: '진로활동',
  subject: '교과 세특',
  major: '주요 활동',
} as const;

export type Activity = {
  id: string;
  category: keyof typeof CATEGORIES;
  grade: 1 | 2 | 3;
  subject?: string;
  title: string;
  core_content: string;
  reflection: string;
};
export type Kind =
  | 'self_introduction'
  | 'motivation'
  | 'learning_plan'
  | 'activity'
  | 'final_remarks';
export type StrategyFocus =
  | 'activity_overview'
  | 'personal_role'
  | 'concept_understanding'
  | 'reasoning_evidence'
  | 'problem_solving'
  | 'reflection_change'
  | 'collaboration'
  | 'major_connection'
  | 'transfer_plan'
  | 'clarification'
  | 'counterargument'
  | 'limitations';
export type QuestionStrategy = {
  version: 'video-2026-10-27';
  source?: 'activity' | 'circumstance' | 'general' | 'intro' | 'major';
  major_topic?: 'foundation' | 'issue' | null;
  activity_id?: string | null;
  circumstance_id?: 'grade_0' | 'grade_1' | 'grade_2' | 'career_change' | null;
  general_topic?:
    | 'meaningful_activity'
    | 'failure_experience'
    | 'collaboration_conflict'
    | 'leadership'
    | null;
  mix_seed?: string | null;
  focus: StrategyFocus;
  depth: 0 | 1 | 2;
};
export type Question = {
  text: string;
  kind: Kind;
  strategy?: QuestionStrategy | null;
  transition?: string | null;
};
export type Turn = {
  question: string;
  answer: string;
  kind: Kind;
  strategy?: QuestionStrategy | null;
};
export type Settings = {
  duration_minutes: number;
  show_timer: boolean;
  ask_intro?: boolean;
  ask_self_introduction?: boolean;
  ask_motivation?: boolean;
  ask_final_remarks: boolean;
};
export type GradeConcern = {
  subject: string;
  grade: 1 | 2 | 3 | null;
  semester: 1 | 2 | null;
  note: string;
};
export type CareerChange = {
  previous_field: string;
  current_field: string;
  note: string;
};
export type Circumstances = {
  grade_concerns: GradeConcern[];
  career_change: CareerChange | null;
};
export type InterviewResult = {
  summary: string;
  turns: Turn[];
  finish_reason: 'manual' | 'timeout' | 'completed';
  elapsed_seconds: number;
};
export type InterviewRequest = {
  action: 'start' | 'answer' | 'finish';
  settings: Settings;
  activities: Activity[];
  circumstances?: Circumstances | null;
  target_major?: string;
  history: Turn[];
  elapsed_seconds: number;
  current_question?: Question;
  finish_reason?: 'manual' | 'timeout';
  consent: true;
};
export type StreamEvent =
  | { type: 'question_start'; kind: Kind; mode: 'live' | 'demo' }
  | { type: 'token'; token: string }
  | { type: 'question'; question: Question; mode: 'live' | 'demo' }
  | { type: 'result'; result: InterviewResult; mode: 'live' | 'demo' }
  | { type: 'error'; message: string };

export const KIND_LABELS: Record<Kind, string> = {
  self_introduction: '자기소개',
  motivation: '지원동기',
  learning_plan: '학업계획',
  activity: '활동 기반 질문',
  final_remarks: '마지막 한마디',
};

export const FOCUS_LABELS: Record<StrategyFocus, string> = {
  activity_overview: '활동 살펴보기',
  personal_role: '본인 역할',
  concept_understanding: '개념 이해',
  reasoning_evidence: '근거와 과정',
  problem_solving: '문제 해결',
  reflection_change: '배움과 변화',
  collaboration: '협업과 조정',
  major_connection: '진로 연결',
  transfer_plan: '확장 계획',
  clarification: '설명 보완',
  counterargument: '다른 관점',
  limitations: '한계와 보완',
};

export const GENERAL_TOPIC_LABELS = {
  meaningful_activity: '의미 있었던 활동',
  failure_experience: '실패 경험',
  collaboration_conflict: '협력·갈등 해결',
  leadership: '리더십 경험',
} as const;

/** Keep the server's activity/focus/depth when an answer becomes conversation history. */
export function turnFromQuestion(question: Question, answer: string): Turn {
  return {
    question: question.text,
    kind: question.kind,
    answer,
    ...(question.strategy ? { strategy: { ...question.strategy } } : {}),
  };
}

export function questionTypeLabel(
  question: Pick<Question, 'kind' | 'strategy'>,
): string {
  if (question.strategy?.source === 'major') {
    if (question.strategy.depth > 0) return '전공 꼬리질문';
    return question.strategy.major_topic === 'issue'
      ? '전공 이슈 질문'
      : '전공 기초 질문';
  }
  if (question.strategy?.source === 'intro')
    return question.strategy.depth > 0
      ? `${KIND_LABELS[question.kind]} 꼬리질문 · ${FOCUS_LABELS[question.strategy.focus]}`
      : KIND_LABELS[question.kind];
  if (question.strategy?.source === 'general') {
    if (question.strategy.depth > 0)
      return `경험 꼬리질문 · ${FOCUS_LABELS[question.strategy.focus]}`;
    return question.strategy.general_topic
      ? GENERAL_TOPIC_LABELS[question.strategy.general_topic]
      : '일반 경험 질문';
  }
  if (question.strategy?.source === 'circumstance') {
    if (question.strategy.circumstance_id === 'career_change')
      return '진로 변경';
    if (question.strategy.circumstance_id?.startsWith('grade_'))
      return '성적 관련 상황';
  }
  return (
    (question.strategy && FOCUS_LABELS[question.strategy.focus]) ||
    KIND_LABELS[question.kind]
  );
}

export function resultForExport(result: InterviewResult) {
  return {
    ...result,
    turns: result.turns.map((turn) => ({
      ...turn,
      question_type: questionTypeLabel(turn),
    })),
  };
}

export function formatResultText(
  result: InterviewResult,
  targetMajor?: string,
): string {
  return `MEA 모의 면접 결과\n${targetMajor?.trim() ? `지원학과: ${targetMajor.trim()}\n` : ''}진행 시간: ${formatTime(result.elapsed_seconds)}\n\n종합 피드백\n${result.summary}\n\n질문과 답변\n${result.turns.map((turn, index) => `${index + 1}. ${turn.question}\n질문 유형: ${questionTypeLabel(turn)}\n답변: ${turn.answer || '(답변하지 않음)'}`).join('\n\n')}`;
}

export function newActivity(): Activity {
  return {
    id: crypto.randomUUID(),
    category: 'subject',
    grade: 1,
    title: '',
    core_content: '',
    reflection: '',
  };
}

const PRIVATE_CONTEXT =
  /학교\s*생활\s*(?:세부\s*사항\s*)?기록부|주민\s*등록\s*번호|인적\s*[·ㆍ・및]?\s*학적\s*사항|학생정보\s*성명|발급번호|민원발급번호|\d+\s*\.\s*출결\s*상황|(?<!\d)(?:\d{6}-?[1-4]\d{6}|01[016789][- .]?\d{3,4}[- .]?\d{4})(?!\d)|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export function containsPrivateInformation(value: string): boolean {
  return PRIVATE_CONTEXT.test(value);
}

export function targetMajorError(
  value: string,
  required = true,
): string | null {
  if ((required && !value.trim()) || value.length > 100)
    return '지원학과를 1~100자로 입력해주세요.';
  if (containsPrivateInformation(value) || /[\u0000-\u001f]/.test(value))
    return '지원학과에는 원문·연락처 등 개인정보를 넣을 수 없어요. 학과명만 입력해주세요.';
  return null;
}

export function cleanActivities(activities: Activity[]): Activity[] {
  return activities.map((activity) => ({
    ...activity,
    title: activity.title.trim(),
    core_content: activity.core_content.trim(),
    reflection: activity.reflection.trim(),
    subject: activity.subject?.trim() || undefined,
  }));
}

export function activityDraftError(activities: Activity[]): string | null {
  if (activities.length > 60) return '활동은 최대 60개까지 입력할 수 있어요.';
  if (
    new Set(activities.map((activity) => activity.id)).size !==
    activities.length
  )
    return '중복된 활동이 있습니다. 내용을 다시 확인해주세요.';
  for (let index = 0; index < activities.length; index += 1) {
    const row = activities[index];
    if (
      !Object.hasOwn(CATEGORIES, row.category) ||
      ![1, 2, 3].includes(row.grade)
    )
      return `${index + 1}번 활동의 분류와 학년을 확인해주세요.`;
    if (!row.id.trim() || row.id.length > 80)
      return `${index + 1}번 활동 식별값을 확인해주세요.`;
    if (row.title.trim().length > 100)
      return `${index + 1}번 활동 주제는 100자 이내로 입력해주세요.`;
    if (row.core_content.trim().length > 2000)
      return `${index + 1}번 활동 핵심내용은 2,000자 이내로 입력해주세요.`;
    if (row.reflection.trim().length > 1000)
      return `${index + 1}번 활동 느낀점/알게된점은 1,000자 이내로 입력해주세요.`;
    if ((row.subject?.length ?? 0) > 100)
      return `${index + 1}번 활동의 과목명은 100자 이내로 입력해주세요.`;
    if (
      containsPrivateInformation(
        `${row.title}\n${row.core_content}\n${row.reflection}\n${row.subject ?? ''}`,
      )
    )
      return `${index + 1}번 활동에 원문 문서 정보가 포함된 것 같습니다. 개인정보를 빼고 본인의 말로 다시 정리해주세요.`;
  }
  if (
    activities.reduce(
      (sum, activity) =>
        sum +
        activity.core_content.trim().length +
        activity.reflection.trim().length,
      0,
    ) > 60000
  )
    return '전체 핵심내용과 느낀점/알게된점을 합쳐 60,000자 이내로 정리해주세요.';
  return null;
}

export function isActivityReady(activity: Activity): boolean {
  return (
    Boolean(activity.title.trim()) && activity.core_content.trim().length >= 20
  );
}

export function activityError(activities: Activity[]): string | null {
  const draftError = activityDraftError(activities);
  if (draftError) return draftError;
  if (activities.length < 10)
    return '창체·세특·주요 활동을 합쳐 10개 이상 정리해주세요.';
  for (let index = 0; index < activities.length; index += 1) {
    const row = activities[index];
    if (!row.title.trim())
      return `${index + 1}번 활동의 주제(제목)를 입력해주세요.`;
    if (row.core_content.trim().length < 20)
      return `${index + 1}번 활동 핵심내용을 20자 이상 입력해주세요.`;
  }
  return null;
}

export function importActivities(text: string): Activity[] {
  if (text.length > 200000)
    throw new Error('붙여넣은 요약이 너무 깁니다. 활동 요약만 입력해주세요.');
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(
      'JSON 형식을 확인해주세요. 아래 정리 프롬프트의 출력 형식을 사용할 수 있어요.',
    );
  }
  if (!Array.isArray(parsed) || parsed.length > 60)
    throw new Error(
      '활동 0~60개가 담긴 JSON 배열을 입력해주세요. 면접을 시작할 때는 10개 이상 필요해요.',
    );
  const allowed = new Set([
    'id',
    'category',
    'grade',
    'subject',
    'title',
    'summary',
    'core_content',
    'reflection',
  ]);
  const activities = parsed.map((value: unknown, index: number): Activity => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error(`${index + 1}번 활동의 형식을 확인해주세요.`);
    const row = value as Record<string, unknown>;
    if (Object.keys(row).some((key) => !allowed.has(key)))
      throw new Error(
        `${index + 1}번 활동에는 학년·영역/과목·주제·핵심내용·느낀점/알게된점만 넣어주세요.`,
      );
    if (
      typeof row.category !== 'string' ||
      !Object.hasOwn(CATEGORIES, row.category) ||
      typeof row.grade !== 'number' ||
      ![1, 2, 3].includes(row.grade) ||
      typeof row.title !== 'string' ||
      (row.core_content !== undefined &&
        typeof row.core_content !== 'string') ||
      (row.summary !== undefined && typeof row.summary !== 'string') ||
      (row.core_content !== undefined && row.summary !== undefined) ||
      (row.reflection !== undefined && typeof row.reflection !== 'string') ||
      (row.id !== undefined && typeof row.id !== 'string') ||
      (row.subject !== undefined &&
        row.subject !== null &&
        typeof row.subject !== 'string')
    )
      throw new Error(`${index + 1}번 활동의 입력 형식을 확인해주세요.`);
    return {
      id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
      category: row.category as Activity['category'],
      grade: row.grade as Activity['grade'],
      title: row.title,
      core_content: (row.core_content ?? row.summary ?? '') as string,
      reflection: (row.reflection ?? '') as string,
      subject: typeof row.subject === 'string' ? row.subject : undefined,
    };
  });
  const cleaned = cleanActivities(activities);
  const error = activityDraftError(cleaned);
  if (error) throw new Error(error);
  return cleaned;
}

export const PREPARATION_PROMPT = `대학 면접 준비를 위해 내가 제공하는 활동 메모를 정리해줘.
내가 직접 작성하거나 별도로 추출해 검토한 정보만 사용할 거야. 개인정보를 먼저 제외하고 다음 원칙을 지켜줘.

1. 창체(자율·동아리·진로), 핵심 주요과목 세특, 주요 활동을 합쳐 총 10개 이상 정리해줘. 특정 영역의 개수를 따로 채울 필요는 없어.
2. 없는 경험·역할·성과·느낀점은 지어내지 마. 활동 정보가 부족하면 먼저 나에게 물어봐.
3. 각 활동은 학년, 영역/과목, 주제(제목), 핵심내용, 느낀점/알게된점으로 나누어 정리해줘. 핵심내용은 내 역할과 구체적인 과정을 20~2,000자로 정리하고, 느낀점/알게된점은 메모에 있는 경우에만 1,000자 이내로 써줘. 느낀점이 없으면 빈칸으로 남겨도 돼.
4. 이름·학교명·학번·생년월일·연락처·교사명·문서 발급정보와 생기부 원문 문장은 제외해줘. 원본 문서를 이 면접 프로그램에 올리지 않고 내가 검토·수정한 활동 요약 TXT만 넣을 거야.
5. 아래 한국어 TXT 형식만 출력해줘. JSON은 사용하지 마. 첫 줄은 정확히 "MEA 면접 준비 TXT v1"로 쓰고, 활동마다 [활동]과 [/활동]으로 구분해줘. 학년은 1·2·3 중 하나, 영역은 자율활동·동아리활동·진로활동·교과 세특·주요 활동 중 하나야.
6. 과목·주제·핵심내용·느낀점의 내용은 해당 필드 다음 줄부터 "| "로 시작해 적어줘. 여러 줄이면 매 줄 "| "를 붙여줘. 빈 느낀점은 "느낀점/알게된점:" 다음 줄에 "| "만 써줘. 내용에 역슬래시가 있으면 두 번 써서 표시해줘. 과목이 없으면 빈칸으로 남겨줘.
7. 특이사항은 내가 따로 입력하므로 이 정리에는 추가하지 마. 아래 예시는 활동 1개이며 실제 출력에는 제공된 사실에 근거해 활동 10개 이상을 같은 방식으로 반복해줘.

MEA 면접 준비 TXT v1

[활동]
학년: 2
영역: 교과 세특
과목:
| 생명과학Ⅰ
주제(제목):
| 관찰 조건에 따른 결과 비교
핵심내용:
| 내가 관찰 조건을 확인하고 자료를 모아 조원들과 결과를 비교한 과정을 정리했다.
느낀점/알게된점:
|
[/활동]

이제 활동 메모를 제공할게. 정리 전에 먼저 어떤 정보가 필요한지 안내해줘.`;

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
