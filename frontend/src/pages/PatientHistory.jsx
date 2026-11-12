import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { isUnpaidBill, totalAmountReceived } from '../utils/billingStatus';
import {
  discountLabel,
  patientDiscountAmount,
} from '../utils/billingDiscount';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateExcel(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function chargesTotal(patient) {
  return (patient.charges || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
}

function toExcelRows(patients) {
  return patients.map((p) => {
    const total = chargesTotal(p);
    const discount = patientDiscountAmount(p);
    const advance = Number(p.advance) || 0;
    const received = totalAmountReceived(p);
    const balance = Math.max(0, total - discount - advance - received);
    return {
      'Hospital Reg No': p.hospitalRegNo || '',
      'Bill No': p.billNo || '',
      Name: p.name || '',
      'S/o D/o': p.relativeOf || '',
      Gender: p.gender || '',
      Age: p.age != null ? `${p.age} ${p.ageUnit || ''}`.trim() : '',
      Address: p.address || '',
      Phone: p.telNo || '',
      Unit: p.bedNo || '',
      'Care Type': p.careType || '',
      'AC Option': p.acType || '',
      IPD: p.ipd || '',
      Status: p.status || '',
      'Admission Date': formatDateExcel(p.admissionDate),
      'Admission Time': p.admissionTime || '',
      'Discharge Date': formatDateExcel(p.dischargeDate),
      'Discharge Time': p.dischargeTime || '',
      'Discharge Type': p.dischargeType || '',
      Diagnosis: p.diagnosis || '',
      'Principle Diagnosis': p.principleDiagnosis || '',
      'Associate Diagnosis': p.associateDiagnosis || '',
      Consultant: p.consultant || '',
      'Duty RMO': p.dutyRmo || '',
      Referral: p.referralType || '',
      'Referral Detail': p.referralDescription || '',
      'Payer Name': p.payerName || '',
      'Total Charges': total,
      Discount: discount,
      'Discount Type': discountLabel(p),
      Advance: advance,
      'Amount Received': received,
      Balance: balance,
      'Unpaid Bill': isUnpaidBill(p) ? 'Yes' : 'No',
    };
  });
}

export default function PatientHistory() {
  const { user } = useAuth();
  const canCreate = user?.role !== 'clinician';
  const canExport = user?.role === 'admin' || user?.role === 'staff';
  const [patients, setPatients] = useState([]);
  const [status, setStatus] = useState('admitted');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportStatus, setExportStatus] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const params = {};
        if (status !== 'all') params.status = status;
        if (search.trim()) params.search = search.trim();

        const { data } = await api.get('/patients', { params });
        setPatients(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load patients');
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(fetchData, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [status, search]);

  const openExport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    setExportFrom(monthAgo.toISOString().slice(0, 10));
    setExportTo(today);
    setExportStatus('all');
    setExportError('');
    setShowExport(true);
  };

  const handleExportExcel = async (e) => {
    e.preventDefault();
    if (!exportFrom || !exportTo) {
      setExportError('Please select from and to dates');
      return;
    }
    if (new Date(exportFrom) > new Date(exportTo)) {
      setExportError('From date cannot be after to date');
      return;
    }

    setExporting(true);
    setExportError('');
    try {
      const params = {
        fromDate: exportFrom,
        toDate: exportTo,
      };
      if (exportStatus !== 'all') params.status = exportStatus;

      const { data } = await api.get('/patients', { params });
      if (!data.length) {
        setExportError('No patients found for the selected date range');
        return;
      }

      const rows = toExcelRows(data);
      const sheet = XLSX.utils.json_to_sheet(rows);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Patients');

      const colWidths = Object.keys(rows[0] || {}).map((key) => ({
        wch: Math.min(
          40,
          Math.max(
            key.length,
            ...rows.map((r) => String(r[key] ?? '').length)
          ) + 2
        ),
      }));
      sheet['!cols'] = colWidths;

      const fileName = `patients_${exportFrom}_to_${exportTo}.xlsx`;
      XLSX.writeFile(book, fileName);
      setShowExport(false);
    } catch (err) {
      setExportError(err.response?.data?.message || 'Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <main className="page">
        <div className="page-heading">
          <h1>Patient History</h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {canExport && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={openExport}
              >
                Export Excel
              </button>
            )}
            {canCreate && (
              <Link to="/patients/new" className="btn btn-primary btn-sm">
                + New Patient
              </Link>
            )}
          </div>
        </div>

        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              type="search"
              className="form-input"
              placeholder="Search name, reg no, unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-pills">
            {['admitted', 'discharged', 'all'].map((s) => (
              <button
                key={s}
                type="button"
                className={`pill ${status === s ? 'active' : ''}`}
                onClick={() => setStatus(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div className="loading">Loading patients...</div>
        ) : patients.length === 0 ? (
          <div className="empty-state card">
            <p>No patients found</p>
            {canCreate && (
              <Link to="/patients/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Create First Patient
              </Link>
            )}
          </div>
        ) : (
          <div className="patient-list">
            {patients.map((p) => (
              <Link key={p._id} to={`/patients/${p._id}`} className="patient-item">
                <div className="patient-item-top">
                  <div className="patient-name">{p.name}</div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {user?.role !== 'clinician' && isUnpaidBill(p) && (
                      <span className="badge badge-unpaid">Unpaid Bill</span>
                    )}
                    <span className={`badge badge-${p.status}`}>{p.status}</span>
                    {p.status === 'discharged' && p.dischargeType && (
                      <span
                        className={`badge badge-discharge-type badge-discharge-${p.dischargeType.toLowerCase()}`}
                      >
                        {p.dischargeType}
                      </span>
                    )}
                  </div>
                </div>
                <div className="patient-meta">
                  <span>Reg: {p.hospitalRegNo}</span>
                  {p.gender && <span>{p.gender}</span>}
                  {p.bedNo && (
                    <span>
                      Unit: {p.bedNo}
                      {p.careType ? ` · ${p.careType}` : ''}
                      {p.acType ? ` · ${p.acType}` : ''}
                    </span>
                  )}
                  <span>Admitted: {formatDate(p.admissionDate)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {canCreate && (
        <Link to="/patients/new" className="fab" aria-label="New patient">
          +
        </Link>
      )}

      {canExport && showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Export Patients to Excel</h2>
              <button type="button" className="btn-icon" onClick={() => setShowExport(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleExportExcel}>
              <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Download patient records by admission date range.
              </p>
              {exportError && <div className="error-banner">{exportError}</div>}
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label className="form-label">From date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={exportFrom}
                    onChange={(e) => setExportFrom(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">To date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={exportTo}
                    onChange={(e) => setExportTo(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group span-2">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={exportStatus}
                    onChange={(e) => setExportStatus(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="admitted">Admitted</option>
                    <option value="discharged">Discharged</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={exporting}>
                  {exporting ? 'Exporting...' : 'Download Excel'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowExport(false)}
                  disabled={exporting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
