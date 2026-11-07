import { createContext, useCallback, useContext, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((options = {}) => {
    const {
      title = 'Confirm',
      message = 'Are you sure you want to continue?',
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      danger = true,
    } = typeof options === 'string' ? { message: options } : options;

    return new Promise((resolve) => {
      setDialog({
        title,
        message,
        confirmLabel,
        cancelLabel,
        danger,
        resolve,
      });
    });
  }, []);

  const close = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="modal-overlay confirm-overlay" onClick={() => close(false)}>
          <div
            className="modal confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="confirm-title">{dialog.title}</h2>
              <button type="button" className="btn-icon" onClick={() => close(false)} aria-label="Close">
                ×
              </button>
            </div>
            <p id="confirm-desc" className="confirm-message">
              {dialog.message}
            </p>
            <p className="confirm-warning">This action cannot be undone once it is done.</p>
            <div className="form-actions confirm-actions">
              <button
                type="button"
                className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => close(true)}
                autoFocus
              >
                {dialog.confirmLabel}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => close(false)}>
                {dialog.cancelLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return confirm;
}
