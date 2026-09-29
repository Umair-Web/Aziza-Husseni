import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function Dashboard() {
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState({ admitted: 0, discharged: 0, total: 0 });
  const [status, setStatus] = useState('admitted');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const params = {};
        if (status !== 'all') params.status = status;
        if (search.trim()) params.search = search.trim();

        const [patientsRes, statsRes] = await Promise.all([
          api.get('/patients', { params }),
          api.get('/patients/stats/summary'),
        ]);
        setPatients(patientsRes.data);
        setStats(statsRes.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load patients');
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(fetchData, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [status, search]);

  return (
    <div className="app-shell">
      <Navbar />
      <main className="page">
        <div className="page-heading">
          <h1>Patients</h1>
          <Link to="/patients/new" className="btn btn-primary btn-sm">
            + New Patient
          </Link>
        </div>

        <div className="stats-row">
          <div className="stat-card highlight">
            <div className="stat-value">{stats.admitted}</div>
            <div className="stat-label">Admitted</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.discharged}</div>
            <div className="stat-label">Discharged</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>

        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              type="search"
              className="form-input"
              placeholder="Search name, reg no, bed..."
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
            <Link to="/patients/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Create First Patient
            </Link>
          </div>
        ) : (
          <div className="patient-list">
            {patients.map((p) => (
              <Link key={p._id} to={`/patients/${p._id}`} className="patient-item">
                <div className="patient-item-top">
                  <div className="patient-name">{p.name}</div>
                  <span className={`badge badge-${p.status}`}>{p.status}</span>
                </div>
                <div className="patient-meta">
                  <span>Reg: {p.hospitalRegNo}</span>
                  {p.bedNo && <span>Bed: {p.bedNo}</span>}
                  <span>Admitted: {formatDate(p.admissionDate)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Link to="/patients/new" className="fab" aria-label="New patient">
        +
      </Link>
    </div>
  );
}
