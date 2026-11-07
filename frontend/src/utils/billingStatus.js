/** Sum of payment history, or legacy single amountReceived. */
export function totalAmountReceived(patient) {
  if (!patient) return 0;
  const hist = patient.paymentHistory || [];
  if (hist.length > 0) {
    return hist.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }
  return Number(patient.amountReceived) || 0;
}

/** True when charge total is not fully covered by advance + amount received. */
export function isUnpaidBill(patient) {
  if (!patient) return false;
  const total = (patient.charges || []).reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0
  );
  if (total <= 0) return false;
  const advance = Number(patient.advance) || 0;
  const received = totalAmountReceived(patient);
  const paid = advance + received;
  return paid + 0.009 < total;
}
