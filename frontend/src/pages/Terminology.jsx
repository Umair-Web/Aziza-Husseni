import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { ALL_MANAGED_TYPES } from '../utils/terminology';

export default function Terminology() {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState(ALL_MANAGED_TYPES[0].value);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/terminologies');
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load terminology');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => items.filter((i) => i.type === filterType).sort((a, b) => a.text.localeCompare(b.text)),
    [items, filterType]
  );

  const activeLabel =
    ALL_MANAGED_TYPES.find((t) => t.value === filterType)?.label || filterType;

  const resetForm = () => {
    setText('');
    setEditingId(null);
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setText(item.text);
    setFilterType(item.type);
    setSuccess('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Enter terminology text');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        await api.put(`/terminologies/${editingId}`, {
          type: filterType,
          text: trimmed,
        });
        setSuccess('Updated');
      } else {
        await api.post('/terminologies', { type: filterType, text: trimmed });
        setSuccess('Added');
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
    const ok = await confirm({
      title: 'Delete terminology',
      message: `Remove "${item.text}" from ${activeLabel}?`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/terminologies/${item._id}`);
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
        <h1>Terminology</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-label">Type</div>
        <div className="filter-pills" style={{ flexWrap: 'wrap' }}>
          {ALL_MANAGED_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`pill ${filterType === t.value ? 'active' : ''}`}
              onClick={() => {
                setFilterType(t.value);
                resetForm();
                setError('');
                setSuccess('');
              }}
            >
              {t.label}
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
              <label className="form-label">Text</label>
              <textarea
                className="form-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={filterType === 'medicine' || filterType === 'medicineTiming' ? 2 : 3}
                placeholder={`Enter ${activeLabel.toLowerCase()}…`}
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
            <p>No entries yet. Add the first one above.</p>
          </div>
        ) : (
          <div className="charges-table-wrap">
            <table className="charges-table">
              <thead>
                <tr>
                  <th>Text</th>
                  <th className="actions-col" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item._id}>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{item.text}</td>
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
