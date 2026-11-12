const {
  chargesTotal,
  patientDiscountAmount,
  netChargesTotal,
} = require('./billing');

const money = (n) =>
  `Rs. ${Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const sumPayments = (patient) => {
  const hist = patient.paymentHistory || [];
  if (hist.length > 0) {
    return hist.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }
  return Number(patient.amountReceived) || 0;
};

const header = (title) =>
  [
    '*Aziza Husseni Hospital*',
    title,
    '────────────────────',
  ].join('\n');

const patientBlock = (patient) =>
  [
    `*Patient:* ${patient.name || '—'}`,
    `*Reg No:* ${patient.hospitalRegNo || '—'}`,
    patient.ipd ? `*IPD:* ${patient.ipd}` : null,
    patient.bedNo
      ? `*Unit:* ${patient.bedNo}${patient.careType ? ` · ${patient.careType}` : ''}${
          patient.acType ? ` · ${patient.acType}` : ''
        }`
      : null,
    `*Admission:* ${formatDate(patient.admissionDate)}${
      patient.admissionTime ? ` ${patient.admissionTime}` : ''
    }`,
  ]
    .filter(Boolean)
    .join('\n');

const buildBillSlip = (patient) => {
  const total = chargesTotal(patient);
  const discount = patientDiscountAmount(patient);
  const net = netChargesTotal(patient);
  const advance = Number(patient.advance) || 0;
  const received = sumPayments(patient);
  const balance = Math.max(0, net - advance - received);

  const chargeLines = (patient.charges || []).map((c) => {
    const rate = Number(c.ratePerDay) || 0;
    const days = Number(c.days) || 0;
    const detail =
      rate > 0 ? ` (${days}d @ ${money(rate)})` : days > 0 ? ` (${days}d)` : '';
    const stopped = c.stoppedAt ? ' [stopped]' : '';
    return `• ${c.particular}${detail}${stopped}: ${money(c.amount)}`;
  });

  return [
    header('Bill Slip'),
    patientBlock(patient),
    '────────────────────',
    '*Charges*',
    chargeLines.length ? chargeLines.join('\n') : '• No charges',
    '────────────────────',
    `*Total:* ${money(total)}`,
    discount > 0 ? `*Discount:* - ${money(discount)}` : null,
    discount > 0 ? `*Net:* ${money(net)}` : null,
    advance > 0 ? `*Advance:* - ${money(advance)}` : null,
    received > 0 ? `*Received:* - ${money(received)}` : null,
    `*Balance:* ${money(balance)}`,
    '────────────────────',
    '_Sent from Aziza Husseni Portal_',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildAdvanceSlip = (patient) => {
  const advance = Number(patient.advance) || 0;
  return [
    header('Advance Payment Slip'),
    patientBlock(patient),
    '────────────────────',
    `*Advance received:* ${money(advance)}`,
    '────────────────────',
    '_Sent from Aziza Husseni Portal_',
  ].join('\n');
};

const buildPaymentSlip = (patient, payment) => {
  const amount = Number(payment?.amount) || 0;
  return [
    header('Payment Receipt'),
    patientBlock(patient),
    '────────────────────',
    `*Amount received:* ${money(amount)}`,
    `*Date:* ${formatDateTime(payment?.receivedAt)}`,
    payment?.note ? `*Note:* ${payment.note}` : null,
    '────────────────────',
    '_Sent from Aziza Husseni Portal_',
  ]
    .filter(Boolean)
    .join('\n');
};

module.exports = {
  buildBillSlip,
  buildAdvanceSlip,
  buildPaymentSlip,
};
