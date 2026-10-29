import type { CircumstancesDraft } from './circumstances';
import {
  type Activity,
  CATEGORIES,
  containsPrivateInformation,
  importActivities,
  targetMajorError,
} from './types';

export const PREPARATION_TEXT_HEADER = 'MEA 면접 준비 TXT v1';
export const MAX_PREPARATION_TEXT_LENGTH = 200000;
const ACTIVITY_FIELDS = [
  '식별자',
  '학년',
  '영역',
  '과목',
  '주제(제목)',
  '핵심내용',
  '느낀점/알게된점',
];
const GRADE_FIELDS = ['과목', '학년', '학기', '상황 설명'];
const CAREER_FIELDS = ['이전 관심 분야', '현재 관심 분야', '상황 설명'];

type ImportedPreparation = {
  activities: Activity[];
  circumstances?: CircumstancesDraft;
  targetMajor?: string;
};
function invalid(detail: string): never {
  throw new Error(`TXT 형식을 확인해주세요. ${detail}`);
}
function safe(text: string) {
  if (containsPrivateInformation(text))
    throw new Error(
      '원문·개인정보는 TXT에 넣을 수 없습니다. 본인의 말로 정리한 활동과 상황만 입력해주세요.',
    );
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
    invalid('사용할 수 없는 제어 문자가 있습니다.');
}
// Every content line has its own prefix. A student's literal [활동], colon,
// pipe or field label therefore cannot become structural input accidentally.
function encode(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
function decode(text: string): string {
  let result = '';
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '\\') {
      result += text[index];
      continue;
    }
    const escaped = text[++index];
    if (escaped === '\\') result += '\\';
    else if (escaped === 'r') result += '\r';
    else if (escaped === 't') result += '\t';
    else invalid('역슬래시는 두 번 써주세요. 줄바꿈은 다음 | 행에 적어주세요.');
  }
  return result;
}
function stringField(label: string, value: string) {
  return `${label}:\n${value
    .split('\n')
    .map((line) => `| ${encode(line)}`)
    .join('\n')}`;
}
function ownKeys(
  value: unknown,
  keys: string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    invalid('알 수 없는 항목이 있습니다.');
}
function text(value: unknown, limit: number): asserts value is string {
  if (typeof value !== 'string' || value.length > limit)
    invalid(
      `글자 수와 항목 형식을 확인해주세요. 최대 ${limit.toLocaleString()}자입니다.`,
    );
  safe(value);
}
function period(value: unknown, maximum: number) {
  if (
    value !== null &&
    (typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > maximum)
  )
    invalid('학년·학기는 지정된 숫자나 미선택으로 입력해주세요.');
}
function validateDraft(value: CircumstancesDraft) {
  ownKeys(value, [
    'grades_enabled',
    'grade_concerns',
    'career_enabled',
    'career_change',
  ]);
  if (
    typeof value.grades_enabled !== 'boolean' ||
    typeof value.career_enabled !== 'boolean' ||
    !Array.isArray(value.grade_concerns) ||
    value.grade_concerns.length > 3
  )
    invalid('특이사항 사용 여부와 성적 상황 0~3개를 확인해주세요.');
  for (const row of value.grade_concerns) {
    ownKeys(row, GRADE_KEYS);
    text(row.subject, 100);
    text(row.note, 400);
    period(row.grade, 3);
    period(row.semester, 2);
  }
  ownKeys(value.career_change, ['previous_field', 'current_field', 'note']);
  text(value.career_change.previous_field, 100);
  text(value.career_change.current_field, 100);
  text(value.career_change.note, 400);
}
const GRADE_KEYS = ['subject', 'grade', 'semester', 'note'];

function validateActivities(activities: Activity[]) {
  importActivities(JSON.stringify(activities));
  for (const row of activities) {
    text(row.id, 80);
    text(row.title, 100);
    text(row.core_content, 2000);
    text(row.reflection, 1000);
    if (row.subject !== undefined) text(row.subject, 100);
  }
}

function validateTargetMajor(value: string) {
  text(value, 100);
  const error = targetMajorError(value, false);
  if (error) throw new Error(error);
}

/** Includes disabled/incomplete optional fields; starting an interview validates them later. */
export function exportPreparationText(
  activities: Activity[],
  circumstancesDraft?: CircumstancesDraft,
  targetMajor?: string,
): string {
  // Reuse activity schema/privacy/size checks without replacing the input with
  // its trimmed copy. Preparation files preserve the student's editing draft.
  validateActivities(activities);
  const sections: string[] = [PREPARATION_TEXT_HEADER];
  if (targetMajor !== undefined) {
    validateTargetMajor(targetMajor);
    sections.push(
      [
        '[지원 정보]',
        stringField('지원학과', targetMajor),
        '[/지원 정보]',
      ].join('\n'),
    );
  }
  for (const row of activities) {
    for (const value of [
      row.id,
      row.subject ?? '',
      row.title,
      row.core_content,
      row.reflection,
    ])
      safe(value);
    sections.push(
      [
        '[활동]',
        stringField('식별자', row.id),
        `학년: ${row.grade}`,
        `영역: ${CATEGORIES[row.category]}`,
        ...(row.subject === undefined
          ? []
          : [stringField('과목', row.subject)]),
        stringField('주제(제목)', row.title),
        stringField('핵심내용', row.core_content),
        stringField('느낀점/알게된점', row.reflection),
        '[/활동]',
      ].join('\n'),
    );
  }
  if (circumstancesDraft !== undefined) {
    validateDraft(circumstancesDraft);
    sections.push(
      [
        '[특이사항]',
        `성적 상황 사용: ${circumstancesDraft.grades_enabled ? '예' : '아니오'}`,
        `진로 변경 사용: ${circumstancesDraft.career_enabled ? '예' : '아니오'}`,
        ...circumstancesDraft.grade_concerns.map((row) =>
          [
            '[성적 상황]',
            stringField('과목', row.subject),
            `학년: ${row.grade ?? '미선택'}`,
            `학기: ${row.semester ?? '미선택'}`,
            stringField('상황 설명', row.note),
            '[/성적 상황]',
          ].join('\n'),
        ),
        '[진로 변경]',
        stringField(
          '이전 관심 분야',
          circumstancesDraft.career_change.previous_field,
        ),
        stringField(
          '현재 관심 분야',
          circumstancesDraft.career_change.current_field,
        ),
        stringField('상황 설명', circumstancesDraft.career_change.note),
        '[/진로 변경]',
        '[/특이사항]',
      ].join('\n'),
    );
  }
  const result = `${sections.join('\n\n')}\n`;
  if (result.length > MAX_PREPARATION_TEXT_LENGTH)
    invalid('파일이 너무 큽니다. 활동 요약만 남겨주세요.');
  return result;
}

/** Atomic parser: it returns all fields only after the whole preparation validates. */
export function importPreparationText(input: string): ImportedPreparation {
  if (typeof input !== 'string' || input.length > MAX_PREPARATION_TEXT_LENGTH)
    invalid('파일이 너무 큽니다. 활동 요약만 남겨주세요.');
  safe(input);
  const lines = input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  let index = 0;
  const skip = () => {
    while (index < lines.length && !lines[index].trim()) index += 1;
  };
  skip();
  if (lines[index++] !== PREPARATION_TEXT_HEADER)
    invalid(`첫 줄은 ${PREPARATION_TEXT_HEADER}여야 합니다.`);
  const read = (line: string): [string, string] => {
    const colon = line.indexOf(':');
    if (colon < 0) return invalid(`${index + 1}행의 필드 이름을 확인해주세요.`);
    const label = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).replace(/^ /, '');
    index += 1;
    if (rest) return [label, decode(rest)];
    const content: string[] = [];
    while (index < lines.length && /^\|(?: |$)/.test(lines[index])) {
      content.push(decode(lines[index] === '|' ? '' : lines[index].slice(2)));
      index += 1;
    }
    return [label, content.join('\n')];
  };
  const fields = (end: string, allowed: string[]): Record<string, string> => {
    const values: Record<string, string> = {};
    while (index < lines.length) {
      skip();
      if (lines[index] === end) {
        index += 1;
        return values;
      }
      if (index >= lines.length) break;
      const [label, value] = read(lines[index]);
      if (!allowed.includes(label) || Object.hasOwn(values, label))
        invalid('알 수 없거나 중복된 필드가 있습니다.');
      values[label] = value;
    }
    return invalid(`${end} 구분자가 없습니다.`);
  };
  const required = (row: Record<string, string>, name: string) => {
    if (!Object.hasOwn(row, name)) invalid(`${name} 필드가 없습니다.`);
    return row[name];
  };
  const selectedPeriod = (value: string, maximum: number): number | null => {
    if (value === '미선택') return null;
    if (!/^[1-3]$/.test(value) || Number(value) > maximum)
      return invalid('학년·학기는 지정된 숫자나 미선택으로 입력해주세요.');
    return Number(value);
  };
  const activities: Activity[] = [];
  let circumstances: CircumstancesDraft | undefined;
  let targetMajor: string | undefined;
  while (index < lines.length) {
    skip();
    if (index >= lines.length) break;
    const section = lines[index++];
    if (section === '[지원 정보]') {
      if (targetMajor !== undefined)
        invalid('지원 정보 섹션이 중복되었습니다.');
      const row = fields('[/지원 정보]', ['지원학과']);
      targetMajor = required(row, '지원학과');
    } else if (section === '[활동]') {
      if (activities.length >= 60)
        invalid('활동은 최대 60개까지 입력할 수 있어요.');
      const row = fields('[/활동]', ACTIVITY_FIELDS);
      const grade = selectedPeriod(required(row, '학년'), 3);
      if (grade === null) invalid('활동 학년은 1·2·3 중 하나를 입력해주세요.');
      const categoryText = required(row, '영역');
      const category = Object.entries(CATEGORIES).find(
        ([key, label]) => key === categoryText || label === categoryText,
      )?.[0] as Activity['category'] | undefined;
      if (!category) invalid('활동 영역을 확인해주세요.');
      activities.push({
        id: row['식별자'] ?? crypto.randomUUID(),
        grade: grade as Activity['grade'],
        category,
        ...(Object.hasOwn(row, '과목') ? { subject: row['과목'] } : {}),
        title: required(row, '주제(제목)'),
        core_content: required(row, '핵심내용'),
        reflection: row['느낀점/알게된점'] ?? '',
      });
    } else if (section === '[특이사항]') {
      if (circumstances !== undefined)
        invalid('특이사항 섹션이 중복되었습니다.');
      const flags: Record<string, string> = {};
      const gradeRows: CircumstancesDraft['grade_concerns'] = [];
      let career: CircumstancesDraft['career_change'] | undefined;
      let ended = false;
      while (index < lines.length) {
        skip();
        if (lines[index] === '[/특이사항]') {
          index += 1;
          ended = true;
          break;
        }
        if (lines[index] === '[성적 상황]') {
          index += 1;
          if (gradeRows.length >= 3)
            invalid('성적 상황은 최대 3개까지 입력할 수 있어요.');
          const row = fields('[/성적 상황]', GRADE_FIELDS);
          gradeRows.push({
            subject: required(row, '과목'),
            grade: selectedPeriod(required(row, '학년'), 3) as 1 | 2 | 3 | null,
            semester: selectedPeriod(required(row, '학기'), 2) as 1 | 2 | null,
            note: required(row, '상황 설명'),
          });
        } else if (lines[index] === '[진로 변경]') {
          index += 1;
          if (career) invalid('진로 변경 섹션이 중복되었습니다.');
          const row = fields('[/진로 변경]', CAREER_FIELDS);
          career = {
            previous_field: required(row, '이전 관심 분야'),
            current_field: required(row, '현재 관심 분야'),
            note: required(row, '상황 설명'),
          };
        } else if (index < lines.length) {
          const [label, value] = read(lines[index]);
          if (
            !['성적 상황 사용', '진로 변경 사용'].includes(label) ||
            Object.hasOwn(flags, label) ||
            !['예', '아니오'].includes(value)
          )
            invalid('특이사항 사용 여부는 예·아니오로 한 번씩 입력해주세요.');
          flags[label] = value;
        }
      }
      if (!ended) invalid('[/특이사항] 구분자가 없습니다.');
      required(flags, '성적 상황 사용');
      required(flags, '진로 변경 사용');
      if (!career) invalid('[진로 변경] 섹션이 없습니다.');
      circumstances = {
        grades_enabled: flags['성적 상황 사용'] === '예',
        career_enabled: flags['진로 변경 사용'] === '예',
        grade_concerns: gradeRows,
        career_change: career,
      };
    } else
      invalid(
        '알 수 없는 섹션이 있습니다. [지원 정보]·[활동]·[특이사항]을 확인해주세요.',
      );
  }
  validateActivities(activities);
  if (circumstances) validateDraft(circumstances);
  if (targetMajor !== undefined) validateTargetMajor(targetMajor);
  return {
    activities,
    ...(circumstances === undefined ? {} : { circumstances }),
    ...(targetMajor === undefined ? {} : { targetMajor }),
  };
}
