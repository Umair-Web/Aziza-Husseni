import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Overview() {
  const [stats, setStats] = useState({ admitted: 0, discharged: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/patients/stats/summary')
      .then((res) => setStats(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load overview'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Overview</h1>
        <Link to="/patients/new" className="btn btn-primary btn-sm">
          + New Patient
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading overview...</div>
      ) : (
        <>
          <div className="stats-row overview-stats">
            <div className="stat-card highlight">
              <div className="stat-value">{stats.admitted}</div>
              <div className="stat-label">Currently Admitted</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.discharged}</div>
              <div className="stat-label">Discharged</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Patients</div>
            </div>
          </div>

          <div className="card">
            <div className="section-label">Quick actions</div>
            <div className="form-actions" style={{ marginTop: 0 }}>
              <Link to="/patients" className="btn btn-outline">
                View Patient History
              </Link>
              <Link to="/patients/new" className="btn btn-primary">
                Register New Patient
              </Link>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
