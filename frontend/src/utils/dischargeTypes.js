export const DISCHARGE_TYPES = [
  { value: 'DOR', label: 'DOR — Discharge on request' },
  { value: 'LAMA', label: 'LAMA — Leave against medical advice' },
  { value: 'Referral', label: 'Referral' },
];

export function dischargeTypeLabel(value) {
  if (!value) return '';
  return DISCHARGE_TYPES.find((t) => t.value === value)?.label || value;
}
