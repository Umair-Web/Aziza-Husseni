import { useEffect, useRef, useState } from 'react';

/**
 * Compact dropdown: Print | WhatsApp for a slip action.
 */
export default function SlipActionMenu({
  label,
  onPrint,
  onWhatsApp,
  disabled = false,
  busy = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="slip-action-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={disabled || busy}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {busy ? 'Sending…' : `${label} ▾`}
      </button>
      {open && (
        <div className="slip-action-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="slip-action-item"
            onClick={() => {
              setOpen(false);
              onPrint?.();
            }}
          >
            Print
          </button>
          {typeof onWhatsApp === 'function' && (
            <button
              type="button"
              role="menuitem"
              className="slip-action-item"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onWhatsApp();
              }}
            >
              Send to WhatsApp
            </button>
          )}
        </div>
      )}
    </div>
  );
}
