import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { combineDateAndTime, countBillableDays } from '../utils/billingDays';
import {
  UNITS,
  AC_TYPES,
  subTypesForUnit,
  acTypesForUnit,
  categoryMatchesPatient,
  labelForScope,
} from '../utils/chargeUnits';

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const emptyForm = () => ({
  bedNo: 'NICU',
  careType: 'Admission',
  acType: '',
  name: '',
  relativeOf: '',
  gender: 'Male',
  age: '',
  ageUnit: 'Years',
  weight: '',
  address: '',
  telNo: '',
  referralType: '',
  referralDescription: '',
  admissionDate: today(),
  admissionTime: nowTime(),
  dutyRmo: '',
  consultant: '',
  diagnosis: '',
  payerName: '',
  payerAddress: '',
  payerTelNo: '',
  advance: '',
  ipd: '',
});

export default function CreatePatient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isRegistrationOnly = user?.role === 'registration';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nextRegNo, setNextRegNo] = useState('Loading...');
  const [referrals, setReferrals] = useState([]);
  const [rmoList, setRmoList] = useState([]);
  const [consultantList, setConsultantList] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCharges, setSelectedCharges] = useState([]);
  const [extraCharge, setExtraCharge] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    api
      .get('/patients/next-reg-no')
      .then((res) => setNextRegNo(res.data.hospitalRegNo))
      .catch(() => setNextRegNo('Will be assigned on save'));

    api
      .get('/referrals')
      .then((res) => setReferrals(res.data))
      .catch(() => setReferrals([]));

    api
      .get('/clinical-staff')
      .then((res) => {
        const list = res.data || [];
        setRmoList(list.filter((s) => s.role === 'rmo'));
        setConsultantList(list.filter((s) => s.role === 'consultant'));
      })
      .catch(() => {
        setRmoList([]);
        setConsultantList([]);
      });

    api
      .get('/charge-categories')
      .then((res) => setAllCategories(res.data || []))
      .catch(() => setAllCategories([]));
  }, []);

  const scopedCategories = allCategories.filter((c) =>
    categoryMatchesPatient(c, form.bedNo, form.careType, form.acType)
  );
  const autoAttachNames = scopedCategories.filter((c) => c.autoAttach).map((c) => c.name);

  useEffect(() => {
    if (!form.bedNo || !form.careType || (form.bedNo === 'Ward' && !form.acType)) {
      setSelectedCharges([]);
      return;
    }
    const scoped = allCategories.filter((c) =>
      categoryMatchesPatient(c, form.bedNo, form.careType, form.acType)
    );
    const autoNames = scoped.filter((c) => c.autoAttach).map((c) => c.name);
    setSelectedCharges(autoNames);
    setExtraCharge('');
  }, [form.bedNo, form.careType, form.acType, allCategories]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const setUnit = (unit) => {
    const subs = subTypesForUnit(unit);
    setForm((f) => ({
      ...f,
      bedNo: unit,
      // PICU / Ward only have Admission — always preselect it
      careType: unit === 'NICU' && subs.includes(f.careType) ? f.careType : 'Admission',
      acType: unit === 'Ward' ? f.acType || 'With AC' : '',
    }));
  };

  const removeCharge = (name) => {
    setSelectedCharges((prev) => prev.filter((n) => n !== name));
  };

  const addExtraCharge = () => {
    if (!extraCharge || selectedCharges.includes(extraCharge)) return;
    setSelectedCharges((prev) => [...prev, extraCharge]);
    setExtraCharge('');
  };

  const refreshNextReg = () => {
    api
      .get('/patients/next-reg-no')
      .then((res) => setNextRegNo(res.data.hospitalRegNo))
      .catch(() => setNextRegNo('Will be assigned on save'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!UNITS.includes(form.bedNo)) {
      setError('Please select a unit: NICU, PICU, or Ward');
      return;
    }
    if (!form.careType) {
      setError('Please select Admission or Observation');
      return;
    }
    if (form.bedNo === 'Ward' && !AC_TYPES.includes(form.acType)) {
      setError('Please select With AC or Without AC for Ward');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        age: Number(form.age),
        weight: form.weight === '' ? null : Number(form.weight),
        advance: Number(form.advance) || 0,
        chargeCategories: selectedCharges,
      };
      const { data } = await api.post('/patients', payload);
      if (isRegistrationOnly) {
        setSuccess(
          `Patient "${data.name}" registered successfully (Reg: ${data.hospitalRegNo}).`
        );
        setForm(emptyForm());
        setSelectedCharges([]);
        setExtraCharge('');
        refreshNextReg();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate(`/patients/${data._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create patient');
    } finally {
      setLoading(false);
    }
  };

  const availableToAdd = scopedCategories.filter((c) => !selectedCharges.includes(c.name));
  const rateByName = Object.fromEntries(scopedCategories.map((c) => [c.name, c.ratePerDay]));
  // Only selected charges (auto-attached by default + any added from dropdown)
  const visibleCharges = selectedCharges.filter((n) =>
    scopedCategories.some((c) => c.name === n)
  );
  const careOptions = form.bedNo ? subTypesForUnit(form.bedNo) : [];
  const previewDays = countBillableDays(
    combineDateAndTime(form.admissionDate, form.admissionTime) || new Date(),
    new Date()
  );
  const selectedChargesTotal = selectedCharges.reduce(
    (sum, name) => sum + (Number(rateByName[name]) || 0) * previewDays,
    0
  );
  const advancePreview = Number(form.advance) || 0;
  const balancePreview = selectedChargesTotal - advancePreview;

  return (
    <main className="page">
        <Link to="/patients" className="back-link">
          ← Back to patients
        </Link>
        <div className="page-heading">
          <h1>New Patient</h1>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="section-label">Identification</div>
            <div className="form-grid cols-2">
              <div className="form-group">
                <label className="form-label">Hospital Registration No.</label>
                <input className="form-input" value={nextRegNo} disabled readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Unit <span className="req">*</span>
                </label>
                <div className="filter-pills gender-toggle" role="group" aria-label="Unit">
                  {UNITS.map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      className={`pill ${form.bedNo === unit ? 'active' : ''}`}
                      onClick={() => setUnit(unit)}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  {form.bedNo === 'NICU' ? 'Admission / Observation' : 'Care type'}{' '}
                  <span className="req">*</span>
                </label>
                <div className="filter-pills gender-toggle" role="group" aria-label="Care type">
                  {careOptions.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      className={`pill ${form.careType === sub ? 'active' : ''}`}
                      onClick={() => setForm((f) => ({ ...f, careType: sub }))}
                      disabled={careOptions.length === 1}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
                {form.bedNo !== 'NICU' && (
                  <p className="charge-attach-hint" style={{ margin: '0.35rem 0 0' }}>
                    {form.bedNo || 'PICU / Ward'} only has Admission (preselected).
                  </p>
                )}
              </div>
              {form.bedNo === 'Ward' && (
                <div className="form-group">
                  <label className="form-label">
                    AC option <span className="req">*</span>
                  </label>
                  <div className="filter-pills gender-toggle" role="group" aria-label="AC option">
                    {acTypesForUnit('Ward').map((ac) => (
                      <button
                        key={ac}
                        type="button"
                        className={`pill ${form.acType === ac ? 'active' : ''}`}
                        onClick={() => setForm((f) => ({ ...f, acType: ac }))}
                      >
                        {ac}
                      </button>
                    ))}
                  </div>
                  <p className="charge-attach-hint" style={{ margin: '0.35rem 0 0' }}>
                    {form.acType === 'With AC'
                      ? 'Same Ward charges as Without AC, plus AC Charges add-on.'
                      : 'Same Ward charges as With AC, without the AC Charges add-on.'}
                  </p>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">IPD No.</label>
                <input
                  className="form-input"
                  value={form.ipd}
                  onChange={set('ipd')}
                  placeholder="Enter IPD No."
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-label">Patient Information</div>
            <div className="form-grid cols-2">
              <div className="form-group">
                <label className="form-label">
                  Name <span className="req">*</span>
                </label>
                <input className="form-input" value={form.name} onChange={set('name')} required />
              </div>
              <div className="form-group">
                <label className="form-label">W/o, S/o, D/o</label>
                <input
                  className="form-input"
                  value={form.relativeOf}
                  onChange={set('relativeOf')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Gender <span className="req">*</span>
                </label>
                <div className="filter-pills gender-toggle" role="group" aria-label="Gender">
                  {['Male', 'Female'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`pill ${form.gender === g ? 'active' : ''}`}
                      onClick={() => setForm((f) => ({ ...f, gender: g }))}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Age <span className="req">*</span>
                </label>
                <div className="filter-pills age-unit-toggle" role="group" aria-label="Age unit">
                  {['Days', 'Months', 'Years'].map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      className={`pill ${form.ageUnit === unit ? 'active' : ''}`}
                      onClick={() => setForm((f) => ({ ...f, ageUnit: unit }))}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  className="form-input"
                  style={{ marginTop: '0.5rem' }}
                  value={form.age}
                  onChange={set('age')}
                  min="0"
                  step="1"
                  placeholder={`Age in ${form.ageUnit.toLowerCase()}`}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Weight (kg)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.weight}
                  onChange={set('weight')}
                  min="0"
                  step="0.01"
                  placeholder="Weight in kg"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tel. No.</label>
                <input
                  type="tel"
                  className="form-input"
                  value={form.telNo}
                  onChange={set('telNo')}
                />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Address</label>
                <textarea
                  className="form-textarea"
                  value={form.address}
                  onChange={set('address')}
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-label">Referral</div>
            <div className="form-grid cols-2">
              <div className="form-group">
                <label className="form-label">Referral Type</label>
                <select
                  className="form-select"
                  value={form.referralType}
                  onChange={set('referralType')}
                >
                  <option value="">Select referral type</option>
                  {referrals.map((r) => (
                    <option key={r._id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  className="form-input"
                  value={form.referralDescription}
                  onChange={set('referralDescription')}
                  placeholder="Referral details"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-label">
              Charge Categories —{' '}
              {labelForScope(
                form.bedNo,
                form.careType,
                form.bedNo === 'Ward' ? form.acType : ''
              )}
            </div>
            <p className="charge-attach-hint">
              Auto-add charges for this unit / care type are selected below. Use the dropdown to
              add more from the same scope only. Noon cutoff: {previewDays} billable day
              {previewDays === 1 ? '' : 's'}.
            </p>
            <div className="charge-check-list">
              {visibleCharges.length === 0 ? (
                <p className="empty-state" style={{ padding: '0.5rem 0' }}>
                  No auto-add charges for this scope. Add from the dropdown, or set Auto-add in
                  Charge Category.
                </p>
              ) : (
                visibleCharges.map((name) => (
                  <div key={name} className="charge-check-item selected">
                    <div className="charge-check-label" style={{ cursor: 'default' }}>
                      <span className="charge-check-name">
                        {name}
                        {autoAttachNames.includes(name) && (
                          <span className="auto-badge"> Auto</span>
                        )}
                        {scopedCategories.find((c) => c.name === name)?.acType === 'With AC' && (
                          <span className="auto-badge"> AC add-on</span>
                        )}
                      </span>
                      <span className="charge-check-meta">
                        <span className="charge-check-rate">
                          Rs. {Number(rateByName[name] ?? 0).toLocaleString('en-PK')}/day
                        </span>
                        <span className="charge-check-amount">
                          Amt: Rs.{' '}
                          {(Number(rateByName[name] ?? 0) * previewDays).toLocaleString('en-PK')}
                          {previewDays > 1 ? ` (${previewDays}d)` : ''}
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-icon charge-remove-btn"
                      title="Remove"
                      onClick={() => removeCharge(name)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="form-grid cols-2" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Add charge category</label>
                <select
                  className="form-select"
                  value={extraCharge}
                  onChange={(e) => setExtraCharge(e.target.value)}
                  disabled={availableToAdd.length === 0}
                >
                  <option value="">
                    {availableToAdd.length === 0
                      ? 'No more categories for this scope'
                      : 'Select category'}
                  </option>
                  {availableToAdd.map((c) => (
                    <option key={c._id} value={c.name}>
                      {c.name} — Rs. {Number(c.ratePerDay || 0).toLocaleString('en-PK')}/day
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                <label className="form-label">&nbsp;</label>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={addExtraCharge}
                  disabled={!extraCharge}
                >
                  + Add
                </button>
              </div>
            </div>
            <div className="bill-summary" style={{ marginTop: '1rem' }}>
              <div className="bill-row total">
                <span>Charges Total</span>
                <span>
                  Rs. {selectedChargesTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-label">Admission Details</div>
            <div className="form-grid cols-2">
              <div className="form-group">
                <label className="form-label">
                  Date of Admission <span className="req">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={form.admissionDate}
                  onChange={set('admissionDate')}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Time of Admission</label>
                <input
                  type="time"
                  className="form-input"
                  value={form.admissionTime}
                  onChange={set('admissionTime')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Name of Duty R.M.O.</label>
                <select
                  className="form-select"
                  value={form.dutyRmo}
                  onChange={set('dutyRmo')}
                >
                  <option value="">Select R.M.O.</option>
                  {rmoList.map((s) => (
                    <option key={s._id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Name of Consultant</label>
                <select
                  className="form-select"
                  value={form.consultant}
                  onChange={set('consultant')}
                >
                  <option value="">Select consultant</option>
                  {consultantList.map((s) => (
                    <option key={s._id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group span-2">
                <label className="form-label">Reason For Admission / Diagnosis</label>
                <textarea
                  className="form-textarea"
                  value={form.diagnosis}
                  onChange={set('diagnosis')}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-label">
              Person / Company Responsible for Payment
            </div>
            <div className="form-grid cols-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={form.payerName}
                  onChange={set('payerName')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telephone No.</label>
                <input
                  type="tel"
                  className="form-input"
                  value={form.payerTelNo}
                  onChange={set('payerTelNo')}
                />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Address</label>
                <textarea
                  className="form-textarea"
                  value={form.payerAddress}
                  onChange={set('payerAddress')}
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Advance (Rs.)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.advance}
                  onChange={set('advance')}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="bill-summary" style={{ marginTop: '1rem' }}>
              <div className="bill-row total">
                <span>Charges Total</span>
                <span>
                  Rs. {selectedChargesTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bill-row">
                <span>Less: Advance (deducted)</span>
                <span>
                  - Rs. {advancePreview.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bill-row balance">
                <span>{balancePreview >= 0 ? 'Balance Due' : 'Refund / Credit'}</span>
                <span>
                  Rs.{' '}
                  {Math.abs(balancePreview).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Create Patient'}
            </button>
            <Link to="/patients" className="btn btn-outline">
              Cancel
            </Link>
          </div>
        </form>
    </main>
  );
}
