export type AdmissionYearValue = {
  capacity: number | null;
  cutoff50: number | null;
  cutoff70: number | null;
};

export type AdmissionResultRow = {
  university: string;
  admissionCategory: string;
  admissionName: string;
  department: string;
  capacity_27: number | null;
  resultsByYear: {
    2024: AdmissionYearValue;
    2025: AdmissionYearValue;
    2026: AdmissionYearValue;
  };
};

export type AdmissionBaseMeta = {
  university: string;
  admissionCategory: '교과' | '학종';
  admissionName: string;
  minimumGradeRequiredSubjects: number | null;
  minimumGradeRequiredSum: number | null;
  minimumGradeNotes: string | null;
  notes: string | null;
};

export type AdmissionSchoolRecordMeta = AdmissionBaseMeta & {
  admissionCategory: '교과';
  documentEvaluationRatio: 10 | 20 | 30 | null;
};

export type AdmissionComprehensiveMeta = AdmissionBaseMeta & {
  admissionCategory: '학종';
  firstRoundMultiplier: number | null;
  interviewRatio: 30 | 40 | 50 | null;
  evaluationRatio: string;
};

export type AdmissionMeta =
  | AdmissionSchoolRecordMeta
  | AdmissionComprehensiveMeta;

export type AdmissionMetaKey = `${string}::${'교과' | '학종'}::${string}`;
