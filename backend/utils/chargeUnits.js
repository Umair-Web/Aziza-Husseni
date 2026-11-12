const UNITS = ['NICU', 'PICU', 'Ward'];
const AC_TYPES = ['With AC', 'Without AC'];

const subTypesForUnit = (unit) =>
  unit === 'NICU' ? ['Admission', 'Observation'] : ['Admission'];

const acTypesForUnit = (unit) => (unit === 'Ward' ? AC_TYPES : []);

/** Patient-side: Ward must be With AC or Without AC */
const normalizePatientAcType = (unit, acType) => {
  if (unit !== 'Ward') return '';
  if (AC_TYPES.includes(acType)) return acType;
  return null;
};

/**
 * Charge-category AC flag:
 * '' = shared (both With/Without AC)
 * 'With AC' = AC add-on only
 */
const normalizeCategoryAcType = (unit, acType) => {
  if (unit !== 'Ward') return '';
  if (acType === true || acType === 'With AC') return 'With AC';
  return '';
};

const normalizeUnitSubType = (unit, subType, acType) => {
  if (!UNITS.includes(unit)) {
    return { error: 'Unit must be NICU, PICU, or Ward' };
  }
  const allowed = subTypesForUnit(unit);
  const resolved = allowed.includes(subType) ? subType : allowed[0];
  if (unit !== 'NICU' && subType && subType !== 'Admission') {
    return { error: 'PICU and Ward only support Admission' };
  }
  if (unit === 'NICU' && subType && !allowed.includes(subType)) {
    return { error: 'NICU sub-type must be Admission or Observation' };
  }

  // Category scopes: shared by default; optional AC add-on for Ward
  const resolvedAc = normalizeCategoryAcType(unit, acType);
  return { unit, subType: resolved, acType: resolvedAc };
};

/** Mongo filter for charges available to a patient */
const chargeScopeFilter = (unit, subType, patientAcType) => {
  const filter = { unit, subType };
  if (unit !== 'Ward') {
    filter.acType = '';
    return filter;
  }
  if (patientAcType === 'With AC') {
    // Shared charges + AC add-ons
    filter.acType = { $in: ['', 'With AC'] };
  } else {
    // Without AC: shared charges only
    filter.acType = '';
  }
  return filter;
};

const labelForScope = (unit, subType, acType) => {
  if (!unit || !subType) return '—';
  if (unit === 'Ward' && acType) return `${unit} · ${subType} · ${acType}`;
  return `${unit} · ${subType}`;
};

module.exports = {
  UNITS,
  AC_TYPES,
  subTypesForUnit,
  acTypesForUnit,
  normalizePatientAcType,
  normalizeCategoryAcType,
  normalizeUnitSubType,
  chargeScopeFilter,
  labelForScope,
};
