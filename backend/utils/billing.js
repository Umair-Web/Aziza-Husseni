/**
 * Bill discount helpers (percentage or fixed amount off charges total).
 */

function chargesTotal(patientOrCharges) {
  const charges = Array.isArray(patientOrCharges)
    ? patientOrCharges
    : patientOrCharges?.charges || [];
  return charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

function computeDiscountAmount(total, discountType, discountValue) {
  const value = Number(discountValue) || 0;
  if (!discountType || value <= 0 || total <= 0) return 0;

  if (discountType === 'percentage') {
    const pct = Math.min(100, value);
    return Math.min(total, (total * pct) / 100);
  }

  if (discountType === 'fixed') {
    return Math.min(total, value);
  }

  return 0;
}

function patientDiscountAmount(patient) {
  const total = chargesTotal(patient);
  return computeDiscountAmount(
    total,
    patient?.discountType,
    patient?.discountValue
  );
}

function netChargesTotal(patient) {
  const total = chargesTotal(patient);
  return Math.max(0, total - patientDiscountAmount(patient));
}

module.exports = {
  chargesTotal,
  computeDiscountAmount,
  patientDiscountAmount,
  netChargesTotal,
};
