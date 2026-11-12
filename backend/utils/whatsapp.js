/**
 * WhatsApp Web.js local API helper — send slip images.
 * Start session separately:
 *   npm run whatsapp
 * Then scan QR once (Linked devices).
 */

const DEFAULT_API_URL = 'http://127.0.0.1:8080';

const isConfigured = () => {
  if (String(process.env.WHATSAPP_ENABLED || 'true').toLowerCase() === 'false') {
    return false;
  }
  return Boolean(process.env.WHATSAPP_API_KEY || process.env.WHATSAPP_API_URL);
};

/**
 * Normalize Pakistan / international phone to chat id: 92xxxxxxxxxx@c.us
 */
const toChatId = (rawPhone) => {
  if (!rawPhone) return null;
  let digits = String(rawPhone).replace(/[^\d]/g, '');
  if (!digits) return null;

  if (digits.startsWith('0') && digits.length === 11) {
    digits = `92${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('3')) {
    digits = `92${digits}`;
  }

  if (digits.length < 10 || digits.length > 15) return null;
  return `${digits}@c.us`;
};

/** Prefer patient Tel No. only */
const pickPatientPhone = (patient, overridePhone) => {
  const candidates = [overridePhone, patient?.telNo].filter(Boolean);
  for (const c of candidates) {
    const chatId = toChatId(c);
    if (chatId) return { phone: c, chatId };
  }
  return { phone: '', chatId: null };
};

const getBaseUrl = () =>
  (process.env.WHATSAPP_API_URL || DEFAULT_API_URL).replace(/\/$/, '');

const getApiKey = () => process.env.WHATSAPP_API_KEY || '';

const ensureConfigured = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error(
      'WhatsApp is not configured. Set WHATSAPP_API_KEY in backend .env and run npm run whatsapp'
    );
    err.status = 503;
    throw err;
  }
  return apiKey;
};

const parseResponse = async (response) => {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }
  return data;
};

const unreachableError = (networkErr) => {
  const err = new Error(
    `Cannot reach WhatsApp service at ${getBaseUrl()}. Start it with: npm run whatsapp (then scan QR)`
  );
  err.status = 503;
  err.cause = networkErr;
  return err;
};

const waRequest = async (path, body, method = 'POST') => {
  const apiKey = ensureConfigured();
  const url = `${getBaseUrl()}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
  } catch (networkErr) {
    throw unreachableError(networkErr);
  }

  const data = await parseResponse(response);

  if (!response.ok || data?.success === false) {
    const msg =
      data?.error ||
      data?.message ||
      data?.raw ||
      `WhatsApp request failed (${response.status})`;
    const err = new Error(String(msg));
    err.status = response.status >= 400 ? response.status : 502;
    err.details = data;
    throw err;
  }

  return data;
};

const getStatus = async () => {
  if (!isConfigured()) {
    return {
      configured: false,
      reachable: false,
      ready: false,
      message:
        'WhatsApp is not configured. Set WHATSAPP_API_KEY in backend .env, then run npm run whatsapp',
    };
  }

  try {
    const data = await waRequest('/api/status', null, 'GET');
    return {
      configured: true,
      reachable: true,
      ready: Boolean(data.ready),
      clearing: Boolean(data.clearing),
      hasQr: Boolean(data.hasQr),
      qrDataUrl: data.qrDataUrl || null,
      lastQrAt: data.lastQrAt || null,
      pushname: data.pushname || null,
      wid: data.wid || null,
      sessionId: data.sessionId || null,
      engine: data.engine || 'whatsapp-web.js',
      message: data.ready
        ? 'WhatsApp is connected and ready'
        : data.hasQr
          ? 'Scan the QR code with WhatsApp Linked devices'
          : 'WhatsApp service is starting…',
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      ready: false,
      message: err.message,
    };
  }
};

const clearSession = async () => waRequest('/api/session/clear', {});

const sendText = async (chatId, content) =>
  waRequest('/api/messages/sendText', {
    to: chatId,
    content,
  });

/** Send slip image. `file` must be a data URL (data:image/png;base64,...) */
const sendImage = async (chatId, fileDataUrl, filename, caption = '') =>
  waRequest('/api/messages/sendImage', {
    to: chatId,
    file: fileDataUrl,
    filename: filename || 'slip.png',
    options: caption ? { caption } : {},
  });

module.exports = {
  isConfigured,
  toChatId,
  pickPatientPhone,
  sendText,
  sendImage,
  getStatus,
  clearSession,
};
