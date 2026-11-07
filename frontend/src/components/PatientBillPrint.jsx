import { totalAmountReceived } from '../utils/billingStatus';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function formatAmount(n) {
  const value = Number(n) || 0;
  return `${value.toLocaleString('en-PK', {
    maximumFractionDigits: 0,
  })}/-`;
}

function padDays(n) {
  const d = Number(n) || 0;
  if (d <= 0) return '';
  return String(d).padStart(2, '0');
}

function numberToWords(num) {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) {
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    }
    if (n < 100000) {
      return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    }
    if (n < 10000000) {
      return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    }
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const whole = Math.floor(Math.abs(Number(num) || 0));
  if (whole === 0) return 'Zero Only';
  return `${convert(whole)} Only`;
}

function particularLine(charge, detailed) {
  const name = charge.particular || '';
  if (!detailed) return name;

  const days = Number(charge.days) || 0;
  const rate = Number(charge.ratePerDay) || 0;
  const note = (charge.note || '').trim();

  if (days > 0 && rate > 0) {
    return `${name} ${padDays(days)} days @ Rs. ${rate.toLocaleString('en-PK')} per day`;
  }
  if (note) return `${name} ${note}`;
  return name;
}

/**
 * A4 hospital bill. mode: 'simple' | 'detailed'
 * simple  — particular name + amount only
 * detailed — days @ rate breakdown in particulars
 */
export default function PatientBillPrint({ patient, mode = 'simple' }) {
  if (!patient) return null;

  const detailed = mode === 'detailed';
  const charges = patient.charges || [];
  const total = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const advance = Number(patient.advance) || 0;
  const received = totalAmountReceived(patient);
  const balance = Math.max(0, total - advance);
  const billDate = patient.dischargeDate || new Date();
  const diagnosis =
    patient.principleDiagnosis || patient.diagnosis || '';
  const ipd = patient.ipd || patient.bedNo || '';

  return (
    <div className={`bill-print a4-sheet bill-${mode}`}>
      <header className="pb-header">
        <div className="pb-brand">
          <div className="pb-brand-text">
            <div className="pb-hospital">Aziza Husseni Hospital</div>
            <div className="pb-tagline">Pediatric And Neonatal Services.</div>
            <div className="pb-address">C-52/13, F.B. Area, Karachi, Pakistan.</div>
          </div>
        </div>
        <div className="pb-phones">
          <div>021-36360526</div>
          <div>021-36806905</div>
          <div>0332-8292279</div>
        </div>
      </header>

      <div className="pb-reg">{patient.hospitalRegNo || ''}</div>

      <div className="pb-meta">
        <div className="pb-field">
          <span className="pb-label">Bill No.</span>
          <span className="pb-value">{patient.billNo || ''}</span>
        </div>
        <div className="pb-field">
          <span className="pb-label">IPD</span>
          <span className="pb-value">{ipd}</span>
        </div>
        <div className="pb-field">
          <span className="pb-label">Date</span>
          <span className="pb-value">{formatDate(billDate)}</span>
        </div>
      </div>

      <div className="pb-patient">
        <div className="pb-field pb-full">
          <span className="pb-label">Name</span>
          <span className="pb-value">{patient.name || ''}</span>
        </div>
        <div className="pb-field pb-full">
          <span className="pb-label">S/o D/o</span>
          <span className="pb-value">{patient.relativeOf || ''}</span>
        </div>
        <div className="pb-field pb-full">
          <span className="pb-label">Address</span>
          <span className="pb-value">{patient.address || ''}</span>
        </div>
        <div className="pb-field pb-full">
          <span className="pb-label">Patient Phone No.</span>
          <span className="pb-value">{patient.telNo || ''}</span>
        </div>
        <div className="pb-field pb-full">
          <span className="pb-label">Diagnosis</span>
          <span className="pb-value">{diagnosis}</span>
        </div>
        <div className="pb-dates-row">
          <div className="pb-field">
            <span className="pb-label">Admitted On</span>
            <span className="pb-value">{formatDate(patient.admissionDate)}</span>
          </div>
          <div className="pb-field">
            <span className="pb-label">Discharged</span>
            <span className="pb-value">{formatDate(patient.dischargeDate)}</span>
          </div>
        </div>
      </div>

      <table className="pb-table">
        <colgroup>
          <col className="pb-col-particular" />
          <col className="pb-col-amount" />
        </colgroup>
        <thead>
          <tr>
            <th>PARTICULARS</th>
            <th>AMOUNT (Rs. / Ps.)</th>
          </tr>
        </thead>
        <tbody>
          {charges.length === 0 ? (
            <tr>
              <td colSpan={2} className="pb-empty">
                No charges
              </td>
            </tr>
          ) : (
            charges.map((c, i) => (
              <tr key={c._id || i}>
                <td>{particularLine(c, detailed)}</td>
                <td className="pb-amount">{formatAmount(c.amount)}</td>
              </tr>
            ))
          )}
          {Array.from({ length: Math.max(0, 8 - charges.length) }).map((_, i) => (
            <tr key={`pad-${i}`} className="pb-pad-row">
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          ))}
          <tr className="pb-summary-row">
            <td rowSpan={4} className="pb-words-cell">
              <div className="pb-words">
                <span className="pb-label">Rupees</span>
                <span className="pb-words-text">{numberToWords(total)}</span>
              </div>
            </td>
            <td className="pb-summary-cell">
              <span>Total</span>
              <b>{formatAmount(total)}</b>
            </td>
          </tr>
          <tr className="pb-summary-row">
            <td className="pb-summary-cell">
              <span>Advance</span>
              <b>{formatAmount(advance)}</b>
            </td>
          </tr>
          <tr className="pb-summary-row">
            <td className="pb-summary-cell">
              <span>Balance</span>
              <b>{formatAmount(balance)}</b>
            </td>
          </tr>
          <tr className="pb-summary-row pb-received">
            <td className="pb-summary-cell">
              <span>Amount Received</span>
              <b>{formatAmount(received)}</b>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
