export const UNITS = ['NICU', 'PICU', 'Ward'];

export const subTypesForUnit = (unit) =>
  unit === 'NICU' ? ['Admission', 'Observation'] : ['Admission'];

export const labelForScope = (unit, subType) =>
  unit && subType ? `${unit} · ${subType}` : '—';
