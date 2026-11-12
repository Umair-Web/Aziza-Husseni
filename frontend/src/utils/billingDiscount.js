/** Bill discount: percentage or fixed amount off charges total. */

export function chargesTotal(patient) {
  return (patient?.charges || []).reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0
  );
}

export function computeDiscountAmount(total, discountType, discountValue) {
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

export function patientDiscountAmount(patient) {
  return computeDiscountAmount(
    chargesTotal(patient),
    patient?.discountType,
    patient?.discountValue
  );
}

export function netChargesTotal(patient) {
  return Math.max(0, chargesTotal(patient) - patientDiscountAmount(patient));
}

export function discountLabel(patient) {
  const type = patient?.discountType;
  const value = Number(patient?.discountValue) || 0;
  if (!type || value <= 0) return '';
  if (type === 'percentage') return `${value}%`;
  return `Rs. ${value.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}
