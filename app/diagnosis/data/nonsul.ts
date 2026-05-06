export type UniversityNonsulInfo = {
  university: string;
  hasMinimumRequirement: boolean;
  minimumRequirementDetail: string;
  studentRecordReflection: string;
};

export const nonsulDataset: UniversityNonsulInfo[] = [
  {
    university: '가천대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail: '국, 수, 영, 탐(1과목) 중 1개 영역 3등급 이내',
    studentRecordReflection: '교과 20% 반영',
  },
  {
    university: '가톨릭대학교',
    hasMinimumRequirement: false,
    minimumRequirementDetail: '없음 (간호학과, 약학과 제외)',
    studentRecordReflection: '교과 20% 반영',
  },
  {
    university: '경기대학교',
    hasMinimumRequirement: false,
    minimumRequirementDetail: '없음',
    studentRecordReflection: '교과 10% 반영',
  },
  {
    university: '고려대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 4개 영역 등급 합 8 이내, 한국사 4등급 이내 (경영대학은 합 5 이내)',
    studentRecordReflection: '논술 100% (교과 반영 없음)',
  },
  {
    university: '단국대학교',
    hasMinimumRequirement: false,
    minimumRequirementDetail: '없음',
    studentRecordReflection: '교과 20% 반영',
  },
  {
    university: '동국대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 2개 영역 등급 합 5 이내, 한국사 4등급 이내',
    studentRecordReflection: '교과 20% + 출결 10% 반영',
  },
  {
    university: '서강대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 3개 영역 등급 합 7 이내, 한국사 4등급 이내',
    studentRecordReflection: '교과 10% + 비교과(출결) 10% 반영',
  },
  {
    university: '서울여자대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail: '국, 수, 영 중 1개 영역 3등급 이내',
    studentRecordReflection: '교과 20% 반영',
  },
  {
    university: '성균관대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐1, 탐2 중 3개 영역 등급 합 6 이내 (의예 등 일부 학과 제외)',
    studentRecordReflection: '논술 100% (교과 반영 없음)',
  },
  {
    university: '성신여자대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 2개 영역 등급 합 7 이내',
    studentRecordReflection: '교과 10% 반영',
  },
  {
    university: '세종대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 2개 영역 등급 합 5 이내',
    studentRecordReflection: '교과 30% 반영',
  },
  {
    university: '수원대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail: '국, 수, 영, 탐(1과목) 중 1개 영역 3등급 이내',
    studentRecordReflection: '교과 40% 반영',
  },
  {
    university: '숙명여자대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 2개 영역 등급 합 5 이내',
    studentRecordReflection: '교과 10% 반영',
  },
  {
    university: '숭실대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 탐(1과목) 중 2개 영역 등급 합 5 이내 (영어 제외)',
    studentRecordReflection: '교과 20% 반영',
  },
  {
    university: '연세대학교',
    hasMinimumRequirement: false,
    minimumRequirementDetail: '없음',
    studentRecordReflection: '논술 100% (교과 반영 없음)',
  },
  {
    university: '이화여자대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 2개 영역 등급 합 5 이내',
    studentRecordReflection: '논술 100% (교과 반영 없음)',
  },
  {
    university: '중앙대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 3개 영역 등급 합 6 이내',
    studentRecordReflection: '교과 20% + 출결 10% 반영',
  },
  {
    university: '한국외국어대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 2개 영역 등급 합 4 이내, 한국사 4등급 이내 (서울캠퍼스 기준)',
    studentRecordReflection: '교과 20% 반영',
  },
  {
    university: '한양대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 3개 영역 등급 합 7 이내',
    studentRecordReflection: '학생부종합평가 10% 반영',
  },
  {
    university: '홍익대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 2개 영역 등급 합 5 이내, 한국사 4등급 이내',
    studentRecordReflection: '교과 10% 반영',
  },
  {
    university: '삼육대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail: '국, 수, 영, 탐(1과목) 중 1개 영역 3등급',
    studentRecordReflection: '논술 100% (교과 반영 없음)',
  },
  {
    university: '서경대학교',
    hasMinimumRequirement: false,
    minimumRequirementDetail: '없음',
    studentRecordReflection: '교과 30% 반영',
  },
  {
    university: '인하대학교',
    hasMinimumRequirement: false,
    minimumRequirementDetail: '없음',
    studentRecordReflection: '교과 20% 반영',
  },
  {
    university: '아주대학교',
    hasMinimumRequirement: false,
    minimumRequirementDetail: '없음',
    studentRecordReflection: '교과 20% 반영',
  },
  {
    university: '국민대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail:
      '국, 수, 영, 탐(1과목) 중 2개 영역 등급 합 6 이내',
    studentRecordReflection: '교과 20% 반영',
  },
  {
    university: '경희대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail: '탐구 2과목 등급 합 5 이내',
    studentRecordReflection: '논술 100% (교과 반영 없음)',
  },
  {
    university: '서울시립대학교',
    hasMinimumRequirement: false,
    minimumRequirementDetail: '없음 (자연계열)',
    studentRecordReflection: '서류 20% 반영',
  },
  {
    university: '건국대학교',
    hasMinimumRequirement: true,
    minimumRequirementDetail: '탐구 1과목 포함 2개 영역 등급 합 5 이내',
    studentRecordReflection: '논술 100% (교과 반영 없음)',
  },
  {
    university: '광운대학교',
    hasMinimumRequirement: false,
    minimumRequirementDetail: '없음',
    studentRecordReflection: '서류 20% 반영',
  },
  {
    university: '상명대학교',
    hasMinimumRequirement: false,
    minimumRequirementDetail: '없음',
    studentRecordReflection: '서류 10% 반영',
  },
];
