import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

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

  const whole = Math.floor(Math.abs(num));
  if (whole === 0) return 'Zero Rupees Only';
  return convert(whole) + ' Rupees Only';
}

const emptyCharge = {
  particular: 'Bed/Room Charges',
  days: '',
  ratePerDay: '',
  amount: '',
  note: '',
  date: new Date().toISOString().slice(0, 10),
};

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [particulars, setParticulars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCharge, setShowCharge] = useState(false);
  const [showDischarge, setShowDischarge] = useState(false);
  const [charge, setCharge] = useState(emptyCharge);
  const [saving, setSaving] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({
    dischargeDate: new Date().toISOString().slice(0, 10),
    dischargeTime: '',
    advance: '',
    amountReceived: '',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, partRes] = await Promise.all([
        api.get(`/patients/${id}`),
        api.get('/patients/particulars/list'),
      ]);
      setPatient(pRes.data);
      setParticulars(partRes.data);
      setDischargeForm((f) => ({
        ...f,
        advance: pRes.data.advance || 0,
        amountReceived: '',
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load patient');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const total = (patient?.charges || []).reduce((s, c) => s + (c.amount || 0), 0);
  const advance = Number(patient?.advance || 0);
  const balance = total - advance;

  const setChargeField = (field) => (e) => {
    const value = e.target.value;
    setCharge((c) => {
      const next = { ...c, [field]: value };
      if (field === 'days' || field === 'ratePerDay') {
        const days = Number(field === 'days' ? value : next.days) || 0;
        const rate = Number(field === 'ratePerDay' ? value : next.ratePerDay) || 0;
        if (days > 0 && rate > 0) {
          next.amount = String(days * rate);
        }
      }
      return next;
    });
  };

  const handleAddCharge = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/patients/${id}/charges`, {
        particular: charge.particular,
        days: Number(charge.days) || 0,
        ratePerDay: Number(charge.ratePerDay) || 0,
        amount: Number(charge.amount) || 0,
        note: charge.note,
        date: charge.date,
      });
      setPatient(data);
      setShowCharge(false);
      setCharge({ ...emptyCharge, particular: particulars[0] || 'Bed/Room Charges' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add charge');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCharge = async (chargeId) => {
    if (!window.confirm('Remove this charge?')) return;
    try {
      const { data } = await api.delete(`/patients/${id}/charges/${chargeId}`);
      setPatient(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove charge');
    }
  };

  const handleDischarge = async (e) => {
    e.preventDefault();
    if (!window.confirm('Discharge this patient? Charges cannot be edited after discharge.')) return;
    setSaving(true);
    setError('');
    try {
      const bal = total - (Number(dischargeForm.advance) || 0);
      const { data } = await api.post(`/patients/${id}/discharge`, {
        dischargeDate: dischargeForm.dischargeDate,
        dischargeTime: dischargeForm.dischargeTime,
        advance: Number(dischargeForm.advance) || 0,
        amountReceived:
          dischargeForm.amountReceived !== ''
            ? Number(dischargeForm.amountReceived)
            : bal,
      });
      setPatient(data);
      setShowDischarge(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to discharge patient');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <Navbar />
        <div className="loading">Loading patient...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="app-shell">
        <Navbar />
        <main className="page">
          <div className="error-banner">{error || 'Patient not found'}</div>
          <Link to="/" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </main>
      </div>
    );
  }

  const isAdmitted = patient.status === 'admitted';

  return (
    <div className="app-shell">
      <Navbar />
      <main className="page page-wide">
        <Link to="/" className="back-link no-print">
          ← Back to patients
        </Link>

        {error && <div className="error-banner no-print">{error}</div>}

        <div className="detail-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1>{patient.name}</h1>
            <span className={`badge badge-${patient.status}`}>{patient.status}</span>
          </div>
          <div className="patient-meta" style={{ marginTop: '0.35rem' }}>
            <span>Reg: {patient.hospitalRegNo}</span>
            {patient.bedNo && <span>Bed: {patient.bedNo}</span>}
            {patient.billNo && <span>Bill: {patient.billNo}</span>}
          </div>
          <div className="detail-actions no-print">
            {isAdmitted && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowCharge(true)}
                >
                  + Add Charge
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setShowDischarge(true)}
                >
                  Discharge
                </button>
              </>
            )}
            {!isAdmitted && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>
                Print Bill
              </button>
            )}
          </div>
        </div>

        <div className="card">
          <div className="section-label">Patient Identification</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Hospital Reg No.</span>
              <span className="info-value">{patient.hospitalRegNo}</span>
            </div>
            <div className="info-item">
              <span className="info-label">IPD</span>
              <span className="info-value">{patient.ipd || '—'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Bed No.</span>
              <span className="info-value">{patient.bedNo || '—'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Age</span>
              <span className="info-value">{patient.age}</span>
            </div>
            <div className="info-item">
              <span className="info-label">W/o, S/o, D/o</span>
              <span className="info-value">{patient.relativeOf || '—'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Tel. No.</span>
              <span className="info-value">{patient.telNo || '—'}</span>
            </div>
            <div className="info-item full">
              <span className="info-label">Address</span>
              <span className="info-value">{patient.address || '—'}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-label">Admission Details</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Admitted On</span>
              <span className="info-value">
                {formatDate(patient.admissionDate)}
                {patient.admissionTime ? ` · ${patient.admissionTime}` : ''}
              </span>
            </div>
            {!isAdmitted && (
              <div className="info-item">
                <span className="info-label">Discharged</span>
                <span className="info-value">
                  {formatDate(patient.dischargeDate)}
                  {patient.dischargeTime ? ` · ${patient.dischargeTime}` : ''}
                </span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">Duty R.M.O.</span>
              <span className="info-value">{patient.dutyRmo || '—'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Consultant</span>
              <span className="info-value">{patient.consultant || '—'}</span>
            </div>
            <div className="info-item full">
              <span className="info-label">Diagnosis</span>
              <span className="info-value">{patient.diagnosis || '—'}</span>
            </div>
          </div>
        </div>

        {(patient.payerName || patient.payerTelNo) && (
          <div className="card">
            <div className="section-label">Payment Responsible</div>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Name</span>
                <span className="info-value">{patient.payerName || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Telephone</span>
                <span className="info-value">{patient.payerTelNo || '—'}</span>
              </div>
              <div className="info-item full">
                <span className="info-label">Address</span>
                <span className="info-value">{patient.payerAddress || '—'}</span>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Billing Particulars</h2>
            {isAdmitted && (
              <button
                type="button"
                className="btn btn-ghost btn-sm no-print"
                onClick={() => setShowCharge(true)}
              >
                + Add
              </button>
            )}
          </div>

          {(patient.charges || []).length === 0 ? (
            <div className="empty-state">
              <p>No charges added yet</p>
            </div>
          ) : (
            <div className="charges-table-wrap">
              <table className="charges-table">
                <thead>
                  <tr>
                    <th>Particulars</th>
                    <th>Qty / Rate</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    {isAdmitted && <th className="actions-col no-print" />}
                  </tr>
                </thead>
                <tbody>
                  {patient.charges.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.particular}</div>
                        {c.note && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {c.note}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {c.days > 0 && c.ratePerDay > 0
                          ? `${c.days} days @ Rs. ${c.ratePerDay}/day`
                          : '—'}
                      </td>
                      <td className="amount">{formatMoney(c.amount)}</td>
                      {isAdmitted && (
                        <td className="actions-col no-print">
                          <button
                            type="button"
                            className="btn-icon"
                            title="Remove"
                            onClick={() => handleRemoveCharge(c._id)}
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bill-summary">
            <div className="bill-row total">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
            <div className="bill-row">
              <span>Advance</span>
              <span>{formatMoney(advance)}</span>
            </div>
            <div className="bill-row balance">
              <span>Balance</span>
              <span>{formatMoney(isAdmitted ? balance : total - advance)}</span>
            </div>
            {!isAdmitted && (
              <>
                <div className="bill-row">
                  <span>Amount Received</span>
                  <span>{formatMoney(patient.amountReceived)}</span>
                </div>
                <div
                  className="bill-row"
                  style={{
                    marginTop: '0.75rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.25rem',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>Rupees (in words)</span>
                  <span style={{ color: 'var(--text)' }}>{numberToWords(total)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {showCharge && (
        <div className="modal-overlay" onClick={() => setShowCharge(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Daily Charge</h2>
              <button type="button" className="btn-icon" onClick={() => setShowCharge(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddCharge}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Particular <span className="req">*</span></label>
                  <select
                    className="form-select"
                    value={charge.particular}
                    onChange={setChargeField('particular')}
                    required
                  >
                    {particulars.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={charge.date}
                    onChange={setChargeField('date')}
                  />
                </div>
                <div className="form-grid cols-2" style={{ display: 'grid', gap: '0.9rem' }}>
                  <div className="form-group">
                    <label className="form-label">Days</label>
                    <input
                      type="number"
                      className="form-input"
                      value={charge.days}
                      onChange={setChargeField('days')}
                      min="0"
                      step="1"
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate / Day (Rs.)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={charge.ratePerDay}
                      onChange={setChargeField('ratePerDay')}
                      min="0"
                      step="0.01"
                      placeholder="e.g. 1500"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Amount (Rs.) <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={charge.amount}
                    onChange={setChargeField('amount')}
                    min="0.01"
                    step="0.01"
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Auto-fills when days × rate are entered
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">Note</label>
                  <input
                    className="form-input"
                    value={charge.note}
                    onChange={setChargeField('note')}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adding...' : 'Add Charge'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCharge(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDischarge && (
        <div className="modal-overlay" onClick={() => setShowDischarge(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Discharge Patient</h2>
              <button type="button" className="btn-icon" onClick={() => setShowDischarge(false)}>
                ×
              </button>
            </div>
            <div className="bill-summary" style={{ marginBottom: '1rem', marginTop: 0 }}>
              <div className="bill-row">
                <span>Total Charges</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>
            <form onSubmit={handleDischarge}>
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label className="form-label">Discharge Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dischargeForm.dischargeDate}
                    onChange={(e) =>
                      setDischargeForm((f) => ({ ...f, dischargeDate: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Discharge Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={dischargeForm.dischargeTime}
                    onChange={(e) =>
                      setDischargeForm((f) => ({ ...f, dischargeTime: e.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Advance (Rs.)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={dischargeForm.advance}
                    onChange={(e) =>
                      setDischargeForm((f) => ({ ...f, advance: e.target.value }))
                    }
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Received (Rs.)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={dischargeForm.amountReceived}
                    onChange={(e) =>
                      setDischargeForm((f) => ({ ...f, amountReceived: e.target.value }))
                    }
                    min="0"
                    step="0.01"
                    placeholder={String(
                      Math.max(0, total - (Number(dischargeForm.advance) || 0))
                    )}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-danger" disabled={saving}>
                  {saving ? 'Discharging...' : 'Confirm Discharge'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowDischarge(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
