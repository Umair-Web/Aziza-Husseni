import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { UNITS, subTypesForUnit, labelForScope } from '../utils/chargeUnits';

const emptyForm = {
  name: '',
  ratePerDay: '',
  autoAttach: false,
  acAddon: false,
  unit: 'NICU',
  subType: 'Admission',
};

export default function Categories() {
  const confirm = useConfirm();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterUnit, setFilterUnit] = useState('NICU');
  const [filterSubType, setFilterSubType] = useState('Admission');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/charge-categories');
      setCategories(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load charge categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formSubTypes = subTypesForUnit(form.unit);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (cat) => {
    setEditingId(cat._id);
    setForm({
      name: cat.name,
      ratePerDay: String(cat.ratePerDay ?? 0),
      autoAttach: Boolean(cat.autoAttach),
      acAddon: cat.unit === 'Ward' && cat.acType === 'With AC',
      unit: cat.unit || 'NICU',
      subType: cat.subType || 'Admission',
    });
    setSuccess('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setUnit = (unit) => {
    const subs = subTypesForUnit(unit);
    setForm((f) => ({
      ...f,
      unit,
      subType: subs.includes(f.subType) ? f.subType : subs[0],
      acAddon: unit === 'Ward' ? f.acAddon : false,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: form.name.trim(),
        ratePerDay: Number(form.ratePerDay) || 0,
        autoAttach: Boolean(form.autoAttach),
        unit: form.unit,
        subType: form.subType,
        acAddon: form.unit === 'Ward' ? Boolean(form.acAddon) : false,
      };

      if (editingId) {
        await api.put(`/charge-categories/${editingId}`, payload);
        setSuccess('Charge category updated');
      } else {
        await api.post('/charge-categories', payload);
        setSuccess('Charge category created');
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save charge category');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutoAttach = async (cat) => {
    setError('');
    setSuccess('');
    try {
      await api.put(`/charge-categories/${cat._id}`, {
        autoAttach: !cat.autoAttach,
      });
      setSuccess(
        !cat.autoAttach
          ? `"${cat.name}" will auto-add for ${labelForScope(cat.unit, cat.subType)}`
          : `"${cat.name}" removed from auto-add`
      );
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update auto-add');
    }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({
      title: 'Delete charge category',
      message: `Are you sure you want to delete "${name}"? It will no longer appear on patient registration.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/charge-categories/${id}`);
      if (editingId === id) resetForm();
      setSuccess('Charge category deleted');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete charge category');
    }
  };

  const filtered = useMemo(() => {
    return categories.filter(
      (c) => c.unit === filterUnit && c.subType === filterSubType
    );
  }, [categories, filterUnit, filterSubType]);

  const filterSubOptions = subTypesForUnit(filterUnit);
  const autoCount = filtered.filter((c) => c.autoAttach).length;
  const scopeLabel = labelForScope(form.unit, form.subType);

  return (
    <main className="page page-wide">
      <div className="page-heading">
        <h1>Charge Category</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="card">
        <div className="section-label">
          {editingId ? 'Edit Charge Category' : 'Add Charge Category'}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid cols-2">
            <div className="form-group">
              <label className="form-label">
                Unit <span className="req">*</span>
              </label>
              <div className="filter-pills gender-toggle" role="group" aria-label="Unit">
                {UNITS.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    className={`pill ${form.unit === unit ? 'active' : ''}`}
                    onClick={() => setUnit(unit)}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">
                Sub-type <span className="req">*</span>
              </label>
              <div className="filter-pills gender-toggle" role="group" aria-label="Sub-type">
                {formSubTypes.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    className={`pill ${form.subType === sub ? 'active' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, subType: sub }))}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">
                Charge Name <span className="req">*</span>
              </label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Consultation"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Rate Per Day (Rs.)</label>
              <input
                type="number"
                className="form-input"
                value={form.ratePerDay}
                onChange={(e) => setForm((f) => ({ ...f, ratePerDay: e.target.value }))}
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>
            {form.unit === 'Ward' && (
              <div className="form-group span-2">
                <label className="charge-check-label auto-attach-form-check">
                  <input
                    type="checkbox"
                    checked={form.acAddon}
                    onChange={(e) => setForm((f) => ({ ...f, acAddon: e.target.checked }))}
                  />
                  <span>
                    <strong>AC add-on (With AC only)</strong>
                    <span className="charge-attach-hint" style={{ display: 'block', margin: 0 }}>
                      Shared Ward charges apply to both With AC and Without AC. Check this for
                      charges like AC Charges that only apply when With AC is selected.
                    </span>
                  </span>
                </label>
              </div>
            )}
            <div className="form-group span-2">
              <label className="charge-check-label auto-attach-form-check">
                <input
                  type="checkbox"
                  checked={form.autoAttach}
                  onChange={(e) => setForm((f) => ({ ...f, autoAttach: e.target.checked }))}
                />
                <span>
                  <strong>Auto-add on patient registration</strong>
                  <span className="charge-attach-hint" style={{ display: 'block', margin: 0 }}>
                    Pre-selected for patients in {scopeLabel}
                    {form.unit === 'Ward' && form.acAddon ? ' when With AC is selected' : ''}.
                  </span>
                </span>
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update Category' : 'Add Category'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-label" style={{ marginBottom: 0, border: 'none', padding: 0 }}>
            All Charge Categories
          </div>
          <span className="auto-count-pill">{autoCount} auto-add</span>
        </div>
        <p className="charge-attach-hint">
          Ward Admission uses the same charge types for With AC and Without AC. Mark a row as AC
          add-on to attach it only when With AC is selected.
        </p>

        <div className="toolbar" style={{ marginBottom: '1rem' }}>
          <div className="filter-pills">
            {UNITS.map((u) => (
              <button
                key={u}
                type="button"
                className={`pill ${filterUnit === u ? 'active' : ''}`}
                onClick={() => {
                  setFilterUnit(u);
                  const subs = subTypesForUnit(u);
                  setFilterSubType(subs.includes(filterSubType) ? filterSubType : 'Admission');
                }}
              >
                {u}
              </button>
            ))}
          </div>
          <div className="filter-pills">
            {filterSubOptions.map((s) => (
              <button
                key={s}
                type="button"
                className={`pill ${filterSubType === s ? 'active' : ''}`}
                onClick={() => setFilterSubType(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>No charge categories for this filter</p>
          </div>
        ) : (
          <div className="charges-table-wrap">
            <table className="charges-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Sub-type</th>
                  <th>Charge Name</th>
                  {filterUnit === 'Ward' && <th>Type</th>}
                  <th style={{ textAlign: 'right' }}>Rate / Day</th>
                  <th style={{ textAlign: 'center' }}>Auto-add</th>
                  <th className="actions-col" style={{ width: 110 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat) => (
                  <tr key={cat._id}>
                    <td>{cat.unit || '—'}</td>
                    <td>{cat.subType || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{cat.name}</td>
                    {filterUnit === 'Ward' && (
                      <td>
                        {cat.acType === 'With AC' ? (
                          <span className="auto-badge">AC add-on</span>
                        ) : (
                          'Shared'
                        )}
                      </td>
                    )}
                    <td className="amount">
                      Rs. {Number(cat.ratePerDay || 0).toLocaleString('en-PK')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <label className="auto-toggle" title="Auto-add on registration">
                        <input
                          type="checkbox"
                          checked={Boolean(cat.autoAttach)}
                          onChange={() => handleToggleAutoAttach(cat)}
                        />
                        <span>{cat.autoAttach ? 'On' : 'Off'}</span>
                      </label>
                    </td>
                    <td className="actions-col">
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => startEdit(cat)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Delete"
                          onClick={() => handleDelete(cat._id, cat.name)}
                        >
                          ×
                        </button>
                      </div>
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
