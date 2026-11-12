/**
 * WhatsApp Web.js local API for clinic slip images.
 * Usage: npm run whatsapp
 * Scan QR once (WhatsApp → Linked devices). Keep this process running.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const express = require('express');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const host = process.env.WHATSAPP_HOST || '127.0.0.1';
const port = Number(process.env.WHATSAPP_PORT || 8080);
const apiKey = process.env.WHATSAPP_API_KEY || 'aziza-husseni-whatsapp-key';
const sessionId = process.env.WHATSAPP_SESSION_ID || 'clinic';
const dataPath = path.resolve(
  process.cwd(),
  process.env.WHATSAPP_DATA_PATH || './.wwebjs_auth'
);
const cachePath = path.resolve(process.cwd(), './.wwebjs_cache');

let client = null;
let ready = false;
let lastQr = null;
let lastQrAt = null;
let lastQrDataUrl = null;
let clearing = false;
let initPromise = null;
let pushname = null;
let wid = null;

const chromePath =
  process.env.CHROME_PATH ||
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const bindClientEvents = (c) => {
  c.on('qr', async (qr) => {
    ready = false;
    lastQr = qr;
    lastQrAt = new Date().toISOString();
    pushname = null;
    wid = null;
    try {
      lastQrDataUrl = await QRCode.toDataURL(qr, {
        margin: 2,
        width: 320,
        errorCorrectionLevel: 'M',
      });
    } catch {
      lastQrDataUrl = null;
    }
    console.log('\nScan this QR with WhatsApp → Linked devices → Link a device:\n');
    qrcode.generate(qr, { small: true });
  });

  c.on('authenticated', () => {
    console.log('WhatsApp authenticated (session saved).');
  });

  c.on('ready', async () => {
    ready = true;
    lastQr = null;
    lastQrDataUrl = null;
    try {
      const info = c.info || {};
      pushname = info.pushname || null;
      wid = info.wid?._serialized || info.me?._serialized || null;
    } catch {
      pushname = null;
      wid = null;
    }
    console.log('WhatsApp Web.js READY — you can send slips from the portal.');
    console.log(`API: http://${host}:${port}`);
  });

  c.on('auth_failure', (msg) => {
    ready = false;
    console.error('WhatsApp auth failure:', msg);
  });

  c.on('disconnected', (reason) => {
    ready = false;
    pushname = null;
    wid = null;
    console.warn('WhatsApp disconnected:', reason);
  });
};

const createClient = () => {
  const c = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId,
      dataPath,
    }),
    puppeteer: {
      headless: true,
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });
  bindClientEvents(c);
  return c;
};

const startClient = async () => {
  if (initPromise) return initPromise;
  client = createClient();
  initPromise = client
    .initialize()
    .catch((err) => {
      console.error('Failed to initialize WhatsApp client:', err.message);
      throw err;
    })
    .finally(() => {
      initPromise = null;
    });
  return initPromise;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const killBrowserProcess = async () => {
  if (!client) return;
  try {
    const browser = client.pupBrowser;
    if (browser) {
      const proc = typeof browser.process === 'function' ? browser.process() : null;
      if (proc?.pid) {
        try {
          proc.kill('SIGKILL');
        } catch {
          /* already exited */
        }
      }
      try {
        await browser.close();
      } catch {
        /* already closed */
      }
    }
  } catch {
    /* ignore */
  }
};

/** Kill leftover Puppeteer/Chrome processes tied to this wwebjs session only */
const killWwebjsChrome = () => {
  if (process.platform !== 'win32') {
    try {
      execSync(
        `pkill -f "wwebjs_auth|wwebjs_cache|session-${sessionId}" || true`,
        { stdio: 'ignore', shell: true }
      );
    } catch {
      /* ignore */
    }
    return;
  }

  const scriptPath = path.join(require('os').tmpdir(), `wa-clear-chrome-${process.pid}.ps1`);
  const ps = `
$markers = @('.wwebjs_auth', '.wwebjs_cache', 'session-${sessionId}')
Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" -ErrorAction SilentlyContinue |
  Where-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { return $false }
    foreach ($m in $markers) {
      if ($cmd -like ('*' + $m + '*')) { return $true }
    }
    return $false
  } |
  ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
  }
`;
  try {
    fs.writeFileSync(scriptPath, ps, 'utf8');
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { stdio: 'ignore', windowsHide: true }
    );
  } catch (err) {
    console.warn('Could not kill wwebjs Chrome processes:', err.message);
  } finally {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      /* ignore */
    }
  }
};

const wipeSessionFolders = () => {
  for (const folder of [dataPath, cachePath]) {
    try {
      if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true });
        console.log('Deleted', folder);
      }
    } catch (err) {
      console.warn(`Could not wipe ${folder}:`, err.message);
    }
  }
};

const clearSession = async () => {
  if (clearing) {
    return { success: false, message: 'Clear already in progress' };
  }
  clearing = true;
  ready = false;
  lastQr = null;
  lastQrDataUrl = null;
  lastQrAt = null;
  pushname = null;
  wid = null;

  try {
    if (client) {
      try {
        await client.logout();
      } catch {
        /* session may already be invalid */
      }
      await killBrowserProcess();
      try {
        await client.destroy();
      } catch {
        /* browser may already be closed */
      }
      client = null;
    }

    killWwebjsChrome();
    await sleep(400);
    wipeSessionFolders();
    await startClient();

    return {
      success: true,
      message:
        'WhatsApp cleared: Chrome session stopped, .wwebjs_auth and .wwebjs_cache deleted. Scan the new QR when it appears.',
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || 'Failed to clear WhatsApp session',
    };
  } finally {
    clearing = false;
  }
};

const requireApiKey = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== apiKey) {
    return res.status(401).json({ success: false, message: 'Invalid API key' });
  }
  return next();
};

const parseDataUrl = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  return { mimetype: match[1], data: match[2] };
};

const buildStatus = () => ({
  ok: true,
  engine: 'whatsapp-web.js',
  ready,
  clearing,
  lastQrAt,
  hasQr: Boolean(lastQr),
  qrDataUrl: ready ? null : lastQrDataUrl,
  pushname,
  wid,
  sessionId,
});

const app = express();
app.use(express.json({ limit: '15mb' }));

app.get('/health', (req, res) => {
  res.json(buildStatus());
});

app.get('/api/status', requireApiKey, (req, res) => {
  res.json({ success: true, ...buildStatus() });
});

app.post('/api/session/clear', requireApiKey, async (req, res) => {
  const result = await clearSession();
  if (!result.success) {
    return res.status(500).json(result);
  }
  return res.json({ ...result, ...buildStatus() });
});

app.post('/api/messages/sendText', requireApiKey, async (req, res) => {
  try {
    if (!ready) {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp is not ready. Scan QR and wait for READY.',
      });
    }
    const to = String(req.body.to || '').trim();
    const content = String(req.body.content || '');
    if (!to || !content) {
      return res.status(400).json({ success: false, message: 'to and content are required' });
    }
    const result = await client.sendMessage(to, content);
    res.json({ success: true, data: { id: result?.id?._serialized || null } });
  } catch (err) {
    console.error('sendText failed:', err.message);
    res.status(502).json({ success: false, message: err.message || 'sendText failed' });
  }
});

app.post('/api/messages/sendImage', requireApiKey, async (req, res) => {
  try {
    if (!ready) {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp is not ready. Scan QR and wait for READY.',
      });
    }

    const to = String(req.body.to || '').trim();
    const filename = String(req.body.filename || 'slip.png');
    const caption = String(req.body.options?.caption || req.body.caption || '');
    const parsed = parseDataUrl(req.body.file);

    if (!to || !parsed) {
      return res.status(400).json({
        success: false,
        message: 'to and file (data:image/...;base64,...) are required',
      });
    }

    const numberId = await client.getNumberId(to.replace(/@c\.us$/i, ''));
    if (!numberId) {
      return res.status(400).json({
        success: false,
        message: 'This number is not registered on WhatsApp',
      });
    }

    const media = new MessageMedia(parsed.mimetype, parsed.data, filename);
    const chatId = numberId._serialized;
    const result = await client.sendMessage(chatId, media, {
      caption: caption || undefined,
      sendMediaAsDocument: false,
    });

    res.json({
      success: true,
      data: { id: result?.id?._serialized || null, to: chatId },
    });
  } catch (err) {
    console.error('sendImage failed:', err.message);
    res.status(502).json({ success: false, message: err.message || 'sendImage failed' });
  }
});

app.listen(port, host, () => {
  console.log(`WhatsApp Web.js API listening on http://${host}:${port}`);
  console.log('Starting WhatsApp client…');
  startClient().catch((err) => {
    console.error('Failed to initialize WhatsApp client:', err.message);
    process.exit(1);
  });
});
