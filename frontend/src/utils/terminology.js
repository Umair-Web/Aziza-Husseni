export const TERMINOLOGY_TYPES = [
  {
    value: 'principleDiagnosis',
    label: 'Principle Diagnosis',
    field: 'principleDiagnosis',
  },
  {
    value: 'associateDiagnosis',
    label: 'Associate Diagnosis',
    field: 'associateDiagnosis',
  },
  {
    value: 'historyExamination',
    label: 'History & Examination',
    field: 'historyExamination',
  },
  {
    value: 'investigation',
    label: 'Investigation',
    field: 'investigation',
  },
  {
    value: 'managementHospitalCourse',
    label: 'Management and Hospital Course',
    field: 'managementHospitalCourse',
  },
];

export const MEDICINE_TYPE = {
  value: 'medicine',
  label: 'Medicine Names',
};

export const TIMING_TYPE = {
  value: 'medicineTiming',
  label: 'Medicine Timing',
};

export const ALL_MANAGED_TYPES = [
  ...TERMINOLOGY_TYPES.map(({ value, label }) => ({ value, label })),
  MEDICINE_TYPE,
  TIMING_TYPE,
];

export function termsForType(items, type) {
  return (items || [])
    .filter((t) => t.type === type)
    .map((t) => t.text)
    .sort((a, b) => a.localeCompare(b));
}

/** Append selected term to existing text (newline if needed). */
export function appendTerm(current, term) {
  const next = String(term || '').trim();
  if (!next) return current || '';
  const cur = String(current || '').trim();
  if (!cur) return next;
  if (cur.split(/\n/).map((l) => l.trim()).includes(next)) return cur;
  return `${cur}\n${next}`;
}
