import { useState } from 'react';
import { appendTerm } from '../utils/terminology';

/**
 * Clinical textarea with select-from-list + add-new terminology.
 */
export default function ClinicalTermField({
  label,
  value,
  onChange,
  options = [],
  onAddOption,
  rows = 3,
}) {
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const handlePick = (e) => {
    const picked = e.target.value;
    e.target.value = '';
    if (!picked) return;
    onChange(appendTerm(value, picked));
  };

  const handleAddNew = async () => {
    const text = draft.trim();
    if (!text || !onAddOption) return;
    setAdding(true);
    try {
      await onAddOption(text);
      onChange(appendTerm(value, text));
      setDraft('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="term-pick-row">
        <select className="form-select" defaultValue="" onChange={handlePick}>
          <option value="">Select from list…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt.length > 80 ? `${opt.slice(0, 80)}…` : opt}
            </option>
          ))}
        </select>
      </div>
      <div className="term-add-row">
        <input
          className="form-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Or type a new term…"
        />
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={handleAddNew}
          disabled={adding || !draft.trim()}
        >
          {adding ? '…' : 'Add'}
        </button>
      </div>
      <textarea
        className="form-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
      />
    </div>
  );
}
