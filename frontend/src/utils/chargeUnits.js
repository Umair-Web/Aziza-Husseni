export const UNITS = ['NICU', 'PICU', 'Ward'];
export const AC_TYPES = ['With AC', 'Without AC'];

export const subTypesForUnit = (unit) =>
  unit === 'NICU' ? ['Admission', 'Observation'] : ['Admission'];

export const acTypesForUnit = (unit) => (unit === 'Ward' ? AC_TYPES : []);

/** Shared Ward charges + AC add-ons when patient is With AC */
export const categoryMatchesPatient = (category, unit, subType, patientAcType) => {
  if (!unit || !subType) return false;
  if (category.unit !== unit || category.subType !== subType) return false;
  if (unit !== 'Ward') return !category.acType;
  if (patientAcType === 'With AC') {
    return !category.acType || category.acType === 'With AC';
  }
  // Without AC: shared only
  return !category.acType;
};

export const labelForScope = (unit, subType, acType) => {
  if (!unit || !subType) return '—';
  if (unit === 'Ward' && acType) return `${unit} · ${subType} · ${acType}`;
  return `${unit} · ${subType}`;
};
