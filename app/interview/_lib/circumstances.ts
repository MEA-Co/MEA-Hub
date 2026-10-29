import {
  type CareerChange,
  type Circumstances,
  containsPrivateInformation,
  type GradeConcern,
} from './types';

export type CircumstancesDraft = {
  grades_enabled: boolean;
  grade_concerns: GradeConcern[];
  career_enabled: boolean;
  career_change: CareerChange;
};

export function emptyGradeConcern(): GradeConcern {
  return { subject: '', grade: null, semester: null, note: '' };
}

export function initialCircumstancesDraft(): CircumstancesDraft {
  return {
    grades_enabled: false,
    grade_concerns: [emptyGradeConcern()],
    career_enabled: false,
    career_change: { previous_field: '', current_field: '', note: '' },
  };
}

function checkContext(text: string) {
  if (containsPrivateInformation(text))
    throw new Error(
      '특이사항에도 원문·개인정보를 넣을 수 없습니다. 본인의 상황만 짧게 다시 정리해주세요.',
    );
}

/** Only selected groups enter the request; disabled drafts never block an interview. */
export function buildCircumstances(
  draft: CircumstancesDraft,
): Circumstances | null {
  const grade_concerns: GradeConcern[] = [];
  if (draft.grades_enabled) {
    if (draft.grade_concerns.length > 3)
      throw new Error('성적 관련 상황은 최대 3개까지 입력할 수 있어요.');
    for (let index = 0; index < draft.grade_concerns.length; index += 1) {
      const item = draft.grade_concerns[index];
      const row = {
        ...item,
        subject: item.subject.trim(),
        note: item.note.trim(),
      };
      if (row.subject.length > 100)
        throw new Error(
          `${index + 1}번 성적 상황의 과목은 100자 이내로 입력해주세요.`,
        );
      if (row.grade !== null && ![1, 2, 3].includes(row.grade))
        throw new Error(`${index + 1}번 성적 상황의 학년을 확인해주세요.`);
      if (row.semester !== null && ![1, 2].includes(row.semester))
        throw new Error(`${index + 1}번 성적 상황의 학기를 확인해주세요.`);
      if (!row.subject && row.grade === null && row.semester === null)
        throw new Error(
          `${index + 1}번 성적 상황의 과목 또는 학년·학기 중 하나 이상을 선택해주세요.`,
        );
      if (!row.note || row.note.length > 400)
        throw new Error(
          `${index + 1}번 성적 상황 설명을 1~400자로 입력해주세요.`,
        );
      checkContext(`${row.subject}\n${row.note}`);
      grade_concerns.push(row);
    }
  }
  let career_change: CareerChange | null = null;
  if (draft.career_enabled) {
    career_change = {
      previous_field: draft.career_change.previous_field.trim(),
      current_field: draft.career_change.current_field.trim(),
      note: draft.career_change.note.trim(),
    };
    if (
      !career_change.previous_field ||
      career_change.previous_field.length > 100 ||
      !career_change.current_field ||
      career_change.current_field.length > 100
    )
      throw new Error('이전·현재 관심 분야를 각각 1~100자로 입력해주세요.');
    if (career_change.note.length > 400)
      throw new Error('진로 변경 상황 설명은 400자 이내로 입력해주세요.');
    checkContext(
      `${career_change.previous_field}\n${career_change.current_field}\n${career_change.note}`,
    );
  }
  return grade_concerns.length || career_change
    ? { grade_concerns, career_change }
    : null;
}

/** Separate a running interview from later edits to its optional setup form. */
export function snapshotCircumstances(
  value?: Circumstances | null,
): Circumstances | null {
  return value
    ? {
        grade_concerns: value.grade_concerns.map((row) => ({ ...row })),
        career_change: value.career_change ? { ...value.career_change } : null,
      }
    : null;
}
