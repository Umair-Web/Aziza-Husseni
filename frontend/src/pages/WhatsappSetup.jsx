import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useConfirm } from '../components/ConfirmDialog';

export default function WhatsappSetup() {
  const confirm = useConfirm();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStatus = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const { data } = await api.get('/whatsapp/status');
      setStatus(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load WhatsApp status');
      setStatus((prev) =>
        prev || {
          configured: false,
          reachable: false,
          ready: false,
          message: 'Unable to load status',
        }
      );
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.reachable || status.ready) return undefined;
    const timer = setInterval(() => {
      loadStatus({ quiet: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [status?.reachable, status?.ready, loadStatus]);

  const handleClear = async () => {
    const ok = await confirm({
      title: 'Clear WhatsApp session',
      message:
        'This stops the background Chrome session and deletes .wwebjs_auth and .wwebjs_cache. You will need to scan a new QR code.',
      confirmLabel: 'Clear WhatsApp',
      danger: true,
    });
    if (!ok) return;

    setClearing(true);
    setSuccess('');
    setError('');
    try {
      const { data } = await api.post('/whatsapp/clear');
      setStatus(data);
      setSuccess(data.message || 'WhatsApp session cleared. Scan the new QR when it appears.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear WhatsApp session');
    } finally {
      setClearing(false);
      loadStatus({ quiet: true });
    }
  };

  const stateLabel = !status
    ? 'Checking…'
    : !status.configured
      ? 'Not configured'
      : !status.reachable
        ? 'Service offline'
        : status.clearing
          ? 'Clearing…'
          : status.ready
            ? 'Connected'
            : status.hasQr
              ? 'Scan QR'
              : 'Starting…';

  const stateClass = !status
    ? ''
    : !status.configured || !status.reachable
      ? 'wa-state-offline'
      : status.ready
        ? 'wa-state-ready'
        : 'wa-state-pending';

  return (
    <main className="page">
      <div className="page-heading">
        <h1>WhatsApp Setup</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="card wa-setup-card">
        <div className="card-header">
          <h2 className="card-title">Connection status</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => loadStatus()}
            disabled={loading || clearing}
          >
            Refresh
          </button>
        </div>

        {loading && !status ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            <div className={`wa-status-row ${stateClass}`}>
              <span className="wa-status-dot" aria-hidden="true" />
              <div>
                <div className="wa-status-label">{stateLabel}</div>
                <div className="wa-status-message">
                  {status?.message || '—'}
                </div>
              </div>
            </div>

            <div className="wa-meta-grid">
              <div>
                <div className="section-label">Service</div>
                <div>{status?.reachable ? 'Running' : 'Not reachable'}</div>
              </div>
              <div>
                <div className="section-label">Linked account</div>
                <div>
                  {status?.ready
                    ? status.pushname || status.wid || 'Connected'
                    : 'Not linked'}
                </div>
              </div>
              <div>
                <div className="section-label">Session</div>
                <div>{status?.sessionId || 'clinic'}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* <div className="card wa-setup-card">
        <div className="section-label" style={{ marginBottom: '0.75rem' }}>
          Setup steps
        </div>
        <ol className="wa-steps">
          <li>
            On the server PC, open a terminal in the <code>backend</code> folder and run{' '}
            <code>npm run whatsapp</code>. Keep that window open.
          </li>
          <li>
            When a QR appears below (or in the terminal), open WhatsApp on the clinic phone →{' '}
            <strong>Linked devices</strong> → <strong>Link a device</strong> and scan it.
          </li>
          <li>
            Wait until status shows <strong>Connected</strong>. You can then send bill/advance slips
            from patient pages.
          </li>
          <li>
            Use <strong>Clear WhatsApp</strong> if the session is stuck, you changed phones, or you
            need to link a different number.
          </li>
        </ol>
      </div> */}

      <div className="card wa-setup-card">
        <div className="card-header">
          <h2 className="card-title">QR code</h2>
        </div>

        {!status?.reachable ? (
          <div className="empty-state">
            <p>
              WhatsApp service is offline. Start it with <code>npm run whatsapp</code>, then refresh.
            </p>
          </div>
        ) : status.ready ? (
          <div className="empty-state">
            <p>Already connected. Clear the session if you need a new QR.</p>
          </div>
        ) : status.qrDataUrl ? (
          <div className="wa-qr-wrap">
            <img src={status.qrDataUrl} alt="WhatsApp QR code" className="wa-qr-image" />
            <p className="wa-qr-hint">
              Scan with WhatsApp → Linked devices
              {status.lastQrAt ? ` · Updated ${new Date(status.lastQrAt).toLocaleTimeString()}` : ''}
            </p>
          </div>
        ) : (
          <div className="empty-state">
            <p>
              {status.clearing
                ? 'Clearing session and preparing a new QR…'
                : 'Waiting for QR from WhatsApp service…'}
            </p>
          </div>
        )}
      </div>

      <div className="card wa-setup-card">
        {/* <div className="card-header">
          <h2 className="card-title">Clear WhatsApp</h2>
        </div>
        <p className="wa-clear-copy">
          Stops the WhatsApp Chrome process running in the background and deletes{' '}
          <code>.wwebjs_auth</code> and <code>.wwebjs_cache</code>. Slip sending stops until you
          scan a new QR.
        </p> */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleClear}
            disabled={clearing || !status?.reachable}
          >
            {clearing ? 'Clearing…' : 'Clear WhatsApp'}
          </button>
        </div>
      </div>
    </main>
  );
}
