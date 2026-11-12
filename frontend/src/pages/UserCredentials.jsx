import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'clinician', label: 'Clinician' },
  { value: 'registration', label: 'Registration' },
];

const emptyForm = () => ({
  name: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
});

export default function UserCredentials() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterRole, setFilterRole] = useState('admin');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      users
        .filter((u) => u.role === filterRole)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users, filterRole]
  );

  const activeLabel = ROLES.find((r) => r.value === filterRole)?.label || filterRole;

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setFilterRole(item.role);
    setForm({
      name: item.name || '',
      username: item.username || '',
      email: item.email || '',
      password: '',
      confirmPassword: '',
    });
    setSuccess('');
    setError('');
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setSuccess('');
    setError('');
  };

  const setField = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    const username = form.username.trim();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (!name || !email) {
      setError('Name and email are required');
      return;
    }

    if (!editingId && !password) {
      setError('Password is required for new users');
      return;
    }

    if (password && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        name,
        email,
        username,
        role: filterRole,
      };
      if (password) payload.password = password;

      if (editingId) {
        const { data } = await api.put(`/users/${editingId}`, payload);
        setSuccess(`${activeLabel} credentials updated`);
        setUsers((list) => list.map((u) => (u._id === data._id ? data : u)));

        // Keep local session in sync if admin edited their own account
        if (currentUser?._id === data._id) {
          const next = {
            ...currentUser,
            name: data.name,
            username: data.username,
            email: data.email,
            role: data.role,
          };
          localStorage.setItem('user', JSON.stringify(next));
        }

        setForm((f) => ({ ...f, password: '', confirmPassword: '' }));
      } else {
        const { data } = await api.post('/users', payload);
        setSuccess(`${activeLabel} account created`);
        setUsers((list) => [...list, data]);
        resetForm();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <div className="page-heading">
        <h1>User Credentials</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="filter-pills" style={{ marginBottom: '1rem' }}>
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`pill ${filterRole === r.value ? 'active' : ''}`}
              onClick={() => {
                setFilterRole(r.value);
                resetForm();
                setSuccess('');
                setError('');
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="section-label" style={{ marginBottom: '0.75rem' }}>
          {editingId ? `Edit ${activeLabel}` : `Add ${activeLabel}`}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid cols-2">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={setField('name')}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={form.username}
                onChange={setField('username')}
                placeholder="Optional login username"
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={setField('email')}
                required
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                {editingId ? 'New password (optional)' : 'Password'}
              </label>
              <input
                type="password"
                className="form-input"
                value={form.password}
                onChange={setField('password')}
                placeholder={editingId ? 'Leave blank to keep current' : 'Min 6 characters'}
                autoComplete="new-password"
                required={!editingId}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <input
                type="password"
                className="form-input"
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
                placeholder={editingId ? 'Only if changing password' : 'Repeat password'}
                autoComplete="new-password"
                required={!editingId || Boolean(form.password)}
              />
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update credentials' : 'Create account'}
            </button>
            {editingId ? (
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                Cancel edit
              </button>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={startCreate}>
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="section-label" style={{ marginBottom: '0.75rem' }}>
          {activeLabel} accounts
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>No {activeLabel.toLowerCase()} accounts yet. Create one above.</p>
          </div>
        ) : (
          <div className="charges-table-wrap">
            <table className="charges-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th className="actions-col" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 500 }}>
                      {u.name}
                      {currentUser?._id === u._id ? (
                        <span
                          style={{
                            marginLeft: '0.4rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          (you)
                        </span>
                      ) : null}
                    </td>
                    <td>{u.username || '—'}</td>
                    <td>{u.email}</td>
                    <td className="actions-col">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(u)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
