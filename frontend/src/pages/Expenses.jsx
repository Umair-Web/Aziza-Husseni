import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useConfirm } from '../components/ConfirmDialog';

function formatMoney(n) {
  return `Rs. ${Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyExpenseForm = () => ({
  category: '',
  details: '',
  amount: '',
  date: todayStr(),
});

export default function Expenses() {
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [expenseData, setExpenseData] = useState({ totalExpenses: 0, expenses: [] });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [savingExpense, setSavingExpense] = useState(false);

  const dateParams = useCallback(() => {
    const params = {};
    if (appliedStart) params.startDate = appliedStart;
    if (appliedEnd) params.endDate = appliedEnd;
    return params;
  }, [appliedStart, appliedEnd]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = dateParams();
      const [earnRes, expRes, catRes] = await Promise.all([
        api.get('/patients/stats/earnings', { params }),
        api.get('/expenses', { params }),
        api.get('/expense-categories'),
      ]);
      setData(earnRes.data);
      setExpenseData(expRes.data);
      setCategories(catRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load expenses data');
    } finally {
      setLoading(false);
    }
  }, [dateParams]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const applyDateFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      setError('Start date must be on or before end date');
      return;
    }
    setError('');
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setShowFilter(false);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStart('');
    setAppliedEnd('');
    setShowFilter(false);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    setSavingCategory(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/expense-categories', { name });
      setNewCategoryName('');
      setSuccess(`Expense type "${name}" added`);
      const { data } = await api.get('/expense-categories');
      setCategories(data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add expense type');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    const ok = await confirm({
      title: 'Delete expense type',
      message: `Are you sure you want to delete expense type "${name}"?`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setError('');
    try {
      await api.delete(`/expense-categories/${id}`);
      setSuccess(`Deleted category "${name}"`);
      const { data } = await api.get('/expense-categories');
      setCategories(data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setSavingExpense(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/expenses', {
        category: expenseForm.category,
        details: expenseForm.details,
        amount: Number(expenseForm.amount),
        date: expenseForm.date || todayStr(),
      });
      setExpenseForm(emptyExpenseForm());
      setShowAddExpense(false);
      setSuccess('Expense added');
      const { data } = await api.get('/expenses', { params: dateParams() });
      setExpenseData(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    const ok = await confirm({
      title: 'Delete expense',
      message: 'Are you sure you want to delete this expense record?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setError('');
    try {
      await api.delete(`/expenses/${id}`);
      setSuccess('Expense deleted');
      const { data } = await api.get('/expenses', { params: dateParams() });
      setExpenseData(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  const net =
    (data?.totalEarnings || 0) - (expenseData?.totalExpenses || 0);

  return (
    <main className="page page-wide">
      <div className="page-heading">
        <h1>Expenses</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setStartDate(appliedStart);
              setEndDate(appliedEnd);
              setShowFilter(true);
              setError('');
            }}
          >
            Filter by date
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setShowAddType(true);
              setError('');
            }}
          >
            + Add expense type
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddExpense(true)}
          >
            + Add Expense
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {(appliedStart || appliedEnd) && (
        <p className="charge-attach-hint" style={{ marginBottom: '1rem' }}>
          Filtered: {appliedStart || '…'} → {appliedEnd || '…'}{' '}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearDateFilter}
            style={{ marginLeft: '0.35rem' }}
          >
            Clear filter
          </button>
        </p>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <div className="stats-row overview-stats">
            <div className="stat-card highlight">
              <div className="stat-value" style={{ fontSize: '1.35rem' }}>
                {formatMoney(data?.totalEarnings)}
              </div>
              <div className="stat-label">Total Earnings</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '1.35rem' }}>
                {formatMoney(expenseData.totalExpenses)}
              </div>
              <div className="stat-label">Total Expenses</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '1.35rem' }}>
                {formatMoney(net)}
              </div>
              <div className="stat-label">Net (Earnings − Expenses)</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-label" style={{ marginBottom: 0, border: 'none', padding: 0 }}>
                Expense list
              </div>
            </div>

            {(expenseData.expenses || []).length === 0 ? (
              <div className="empty-state">
                <p>No expenses in this date range</p>
              </div>
            ) : (
              <div className="charges-table-wrap">
                <table className="charges-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Details</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th className="actions-col" />
                    </tr>
                  </thead>
                  <tbody>
                    {expenseData.expenses.map((e) => (
                      <tr key={e._id}>
                        <td>{formatDate(e.date)}</td>
                        <td style={{ fontWeight: 500 }}>{e.category}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {e.details || '—'}
                        </td>
                        <td className="amount">{formatMoney(e.amount)}</td>
                        <td className="actions-col">
                          <button
                            type="button"
                            className="btn-icon"
                            title="Delete"
                            onClick={() => handleDeleteExpense(e._id)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-label">Patient charges (earnings)</div>
            <p className="charge-attach-hint">
              Filtered by admission date when a date range is applied.
            </p>

            {(data?.patients || []).length === 0 ? (
              <div className="empty-state">
                <p>No patients in this date range</p>
              </div>
            ) : (
              <div className="charges-table-wrap">
                <table className="charges-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Unit</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Charges</th>
                      <th style={{ textAlign: 'right' }}>Advance</th>
                      <th className="actions-col" />
                    </tr>
                  </thead>
                  <tbody>
                    {(data.patients || []).map((p) => {
                      const open = expandedId === p._id;
                      return (
                        <Fragment key={p._id}>
                          <tr>
                            <td>
                              <Link
                                to={`/patients/${p._id}`}
                                style={{ fontWeight: 600, color: 'inherit' }}
                              >
                                {p.name}
                              </Link>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  marginTop: '0.15rem',
                                }}
                              >
                                {p.hospitalRegNo}
                              </div>
                            </td>
                            <td>{p.bedNo || '—'}</td>
                            <td>
                              <span className={`badge badge-${p.status}`}>{p.status}</span>
                            </td>
                            <td className="amount">{formatMoney(p.chargesTotal)}</td>
                            <td className="amount">{formatMoney(p.advance)}</td>
                            <td className="actions-col">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setExpandedId(open ? null : p._id)}
                                disabled={!p.charges?.length}
                              >
                                {open ? 'Hide' : 'Details'}
                              </button>
                            </td>
                          </tr>
                          {open && (
                            <tr>
                              <td colSpan={6} style={{ background: 'var(--bg-soft, #faf7f7)' }}>
                                <table className="charges-table" style={{ margin: 0 }}>
                                  <thead>
                                    <tr>
                                      <th>Particular</th>
                                      <th>Days / Rate</th>
                                      <th style={{ textAlign: 'right' }}>Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.charges.map((c) => (
                                      <tr key={c._id}>
                                        <td>{c.particular}</td>
                                        <td
                                          style={{
                                            fontSize: '0.8rem',
                                            color: 'var(--text-muted)',
                                          }}
                                        >
                                          {c.ratePerDay > 0
                                            ? `${c.days || 0} × Rs. ${c.ratePerDay}`
                                            : '—'}
                                        </td>
                                        <td className="amount">{formatMoney(c.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showFilter && (
        <div className="modal-overlay" onClick={() => setShowFilter(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Filter by date</h2>
              <button type="button" className="btn-icon" onClick={() => setShowFilter(false)}>
                ×
              </button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Start date</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End date</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={applyDateFilter}>
                Apply filter
              </button>
              <button type="button" className="btn btn-outline" onClick={clearDateFilter}>
                Clear
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowFilter(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddType && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowAddType(false);
            setNewCategoryName('');
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add expense type</h2>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setShowAddType(false);
                  setNewCategoryName('');
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddCategory}>
              <div className="form-group">
                <label className="form-label">
                  Type name <span className="req">*</span>
                </label>
                <input
                  className="form-input"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Utilities, Salaries, Supplies"
                  required
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingCategory || !newCategoryName.trim()}
                >
                  {savingCategory ? 'Adding...' : 'Save type'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setShowAddType(false);
                    setNewCategoryName('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
            {categories.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <div className="section-label">Existing types</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {categories.map((c) => (
                    <span
                      key={c._id}
                      className="badge badge-discharged"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        textTransform: 'none',
                      }}
                    >
                      {c.name}
                      <button
                        type="button"
                        className="btn-icon"
                        title="Delete type"
                        style={{ fontSize: '0.9rem', lineHeight: 1 }}
                        onClick={() => handleDeleteCategory(c._id, c.name)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddExpense && (
        <div className="modal-overlay" onClick={() => setShowAddExpense(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Expense</h2>
              <button type="button" className="btn-icon" onClick={() => setShowAddExpense(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddExpense}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Category <span className="req">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={expenseForm.category}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, category: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select expense type</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {categories.length === 0 && (
                    <span className="charge-attach-hint">
                      No types yet — use “Add expense type” first.
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Details</label>
                  <input
                    className="form-input"
                    value={expenseForm.details}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, details: e.target.value }))
                    }
                    placeholder="Description / notes"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Amount (Rs.) <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingExpense || categories.length === 0}
                >
                  {savingExpense ? 'Saving...' : 'Save Expense'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddExpense(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
