function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(n) {
  return `Rs. ${Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  if (whole === 0) return 'Zero Rupees Only';
  return `${convert(whole)} Rupees Only`;
}

export default function PaymentReceiptSlip({ patient, payment }) {
  if (!patient || !payment) return null;

  const amount = Number(payment.amount) || 0;
  if (amount <= 0) return null;

  const receivedFrom = patient.payerName || patient.relativeOf || patient.name || '';
  const note = (payment.note || '').trim();

  return (
    <div className="payment-print a4-sheet">
      <header className="ap-header">
        <div>
          <div className="ap-hospital">AZIZA HUSSENI HOSPITAL</div>
          <div className="ap-tagline">Pediatric And Neonatal Services</div>
          <div className="ap-address">C-52/13, F.B. Area, Karachi</div>
          <div className="ap-phones">Phones: 36360526, 36806905</div>
        </div>
        <div className="ap-slip-title">PAYMENT RECEIPT</div>
      </header>

      <div className="ap-meta">
        <div>
          <span>Receipt date</span>
          <b>{formatDateTime(payment.receivedAt || new Date())}</b>
        </div>
        <div>
          <span>Reg. No.</span>
          <b>{patient.hospitalRegNo || ''}</b>
        </div>
        <div>
          <span>IPD</span>
          <b>{patient.ipd || ''}</b>
        </div>
      </div>

      <section className="ap-body">
        <div className="ap-row">
          <span>Received from</span>
          <b>{receivedFrom}</b>
        </div>
        <div className="ap-row">
          <span>Patient name</span>
          <b>{patient.name || ''}</b>
        </div>
        <div className="ap-row">
          <span>S/o, D/o, W/o</span>
          <b>{patient.relativeOf || ''}</b>
        </div>
        <div className="ap-row-grid">
          <div className="ap-row">
            <span>Unit</span>
            <b>
              {patient.bedNo || ''}
              {patient.careType ? ` · ${patient.careType}` : ''}
              {patient.acType ? ` · ${patient.acType}` : ''}
            </b>
          </div>
          <div className="ap-row">
            <span>Admitted on</span>
            <b>{formatDate(patient.admissionDate)}</b>
          </div>
        </div>
        <div className="ap-row">
          <span>Tel. No.</span>
          <b>{patient.telNo || patient.payerTelNo || ''}</b>
        </div>
        {note && (
          <div className="ap-row">
            <span>Note</span>
            <b>{note}</b>
          </div>
        )}

        <div className="ap-amount-box">
          <div className="ap-amount-label">Amount received</div>
          <div className="ap-amount-value">{formatMoney(amount)}</div>
          <div className="ap-amount-words">
            <span>In words:</span>
            <b>{numberToWords(amount)}</b>
          </div>
        </div>

        <p className="ap-note">
          This amount is received against hospital charges for the above patient and will be
          adjusted in the final bill.
        </p>
      </section>

      <footer className="ap-footer">
        <div className="ap-sign">
          <div className="ap-sign-line" />
          <div>Received by (Signature)</div>
        </div>
        <div className="ap-sign">
          <div className="ap-sign-line" />
          <div>Patient / Attendant</div>
        </div>
      </footer>
    </div>
  );
}
