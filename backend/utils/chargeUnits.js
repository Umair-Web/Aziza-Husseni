const UNITS = ['NICU', 'PICU', 'Ward'];

const subTypesForUnit = (unit) =>
  unit === 'NICU' ? ['Admission', 'Observation'] : ['Admission'];

const normalizeUnitSubType = (unit, subType) => {
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
  return { unit, subType: resolved };
};

module.exports = { UNITS, subTypesForUnit, normalizeUnitSubType };
