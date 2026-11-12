const { getStatus, clearSession, isConfigured } = require('../utils/whatsapp');

exports.getWhatsappStatus = async (req, res) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (error) {
    res.status(error.status || 500).json({
      configured: isConfigured(),
      reachable: false,
      ready: false,
      message: error.message || 'Failed to load WhatsApp status',
    });
  }
};

exports.clearWhatsappSession = async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        message:
          'WhatsApp is not configured. Set WHATSAPP_API_KEY in backend .env, then run: npm run whatsapp',
      });
    }

    const result = await clearSession();
    const status = await getStatus();
    res.json({
      message: result.message || 'WhatsApp session cleared',
      ...status,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Failed to clear WhatsApp session',
    });
  }
};
