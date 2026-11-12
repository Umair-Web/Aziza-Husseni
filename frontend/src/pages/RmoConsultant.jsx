import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useConfirm } from '../components/ConfirmDialog';

const ROLES = [
  { value: 'rmo', label: 'R.M.O.' },
  { value: 'consultant', label: 'Consultant' },
];

export default function RmoConsultant() {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterRole, setFilterRole] = useState('rmo');
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/clinical-staff');
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load R.M.O. / consultants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      items
        .filter((i) => i.role === filterRole)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items, filterRole]
  );

  const activeLabel = ROLES.find((r) => r.value === filterRole)?.label || filterRole;

  const resetForm = () => {
    setName('');
    setEditingId(null);
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setName(item.name);
    setFilterRole(item.role);
    setSuccess('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        await api.put(`/clinical-staff/${editingId}`, {
          role: filterRole,
          name: trimmed,
        });
        setSuccess(`${activeLabel} updated`);
      } else {
        await api.post('/clinical-staff', { role: filterRole, name: trimmed });
        setSuccess(`${activeLabel} added`);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const label = item.role === 'rmo' ? 'R.M.O.' : 'Consultant';
    const ok = await confirm({
      title: `Delete ${label}`,
      message: `Remove "${item.name}" from the ${label} list? Existing patients keep the name already saved.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/clinical-staff/${item._id}`);
      if (editingId === item._id) resetForm();
      setSuccess('Deleted');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <main className="page">
      <div className="page-heading">
        <h1>RMO and Consultant</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-label">Type</div>
        <div className="filter-pills" style={{ flexWrap: 'wrap' }}>
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`pill ${filterRole === r.value ? 'active' : ''}`}
              onClick={() => {
                setFilterRole(r.value);
                resetForm();
                setError('');
                setSuccess('');
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-label">
          {editingId ? `Edit — ${activeLabel}` : `Add — ${activeLabel}`}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                Name <span className="req">*</span>
              </label>
              <input
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Enter ${activeLabel} name`}
                required
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="section-label">{activeLabel} list</div>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>No {activeLabel} entries yet. Add the first one above.</p>
          </div>
        ) : (
          <div className="charges-table-wrap">
            <table className="charges-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="actions-col" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item._id}>
                    <td style={{ fontWeight: 500 }}>{item.name}</td>
                    <td className="actions-col">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(item)}
                      >
                        Delete
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
