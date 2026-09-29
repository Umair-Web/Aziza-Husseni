import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function CreatePatient() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    hospitalRegNo: '',
    bedNo: '',
    name: '',
    relativeOf: '',
    age: '',
    address: '',
    telNo: '',
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

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        age: Number(form.age),
        advance: Number(form.advance) || 0,
        ipd: form.ipd || form.hospitalRegNo,
      };
      const { data } = await api.post('/patients', payload);
      navigate(`/patients/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <main className="page">
        <Link to="/" className="back-link">
          ← Back to patients
        </Link>
        <div className="page-heading">
          <h1>New Patient</h1>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="section-label">Identification</div>
            <div className="form-grid cols-2">
              <div className="form-group">
                <label className="form-label">
                  Hospital Registration No. <span className="req">*</span>
                </label>
                <input
                  className="form-input"
                  value={form.hospitalRegNo}
                  onChange={set('hospitalRegNo')}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Bed No.</label>
                <input className="form-input" value={form.bedNo} onChange={set('bedNo')} />
              </div>
              <div className="form-group">
                <label className="form-label">IPD No.</label>
                <input
                  className="form-input"
                  value={form.ipd}
                  onChange={set('ipd')}
                  placeholder="Same as Reg No if blank"
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
                  Age <span className="req">*</span>
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={form.age}
                  onChange={set('age')}
                  min="0"
                  required
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
                <input className="form-input" value={form.dutyRmo} onChange={set('dutyRmo')} />
              </div>
              <div className="form-group">
                <label className="form-label">Name of Consultant</label>
                <input
                  className="form-input"
                  value={form.consultant}
                  onChange={set('consultant')}
                />
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
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Create Patient'}
            </button>
            <Link to="/" className="btn btn-outline">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
