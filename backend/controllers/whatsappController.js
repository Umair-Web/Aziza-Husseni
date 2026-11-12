const Patient = require('../models/Patient');
const {
  isConfigured,
  pickPatientPhone,
  sendImage,
} = require('../utils/whatsapp');

exports.sendPatientSlip = async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        message:
          'WhatsApp is not enabled. Set WHATSAPP_API_KEY in backend .env, then run: npm run whatsapp',
      });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const type = String(req.body.type || 'simple').toLowerCase();
    const image = String(req.body.image || '').trim();
    const { phone, chatId } = pickPatientPhone(patient, req.body.phone);

    if (!chatId) {
      return res.status(400).json({
        message:
          'Patient Tel No. is missing or invalid. Add a WhatsApp number on the patient (03xx or 92xxxxxxxxxx).',
      });
    }

    if (!image.startsWith('data:image/')) {
      return res.status(400).json({
        message: 'Slip image is required (capture failed)',
      });
    }

    if (type === 'advance' && !(Number(patient.advance) > 0)) {
      return res.status(400).json({ message: 'No advance amount to send' });
    }

    if (type === 'payment') {
      const paymentId = req.body.paymentId;
      const payment = patient.paymentHistory?.id
        ? patient.paymentHistory.id(paymentId)
        : (patient.paymentHistory || []).find(
            (p) => String(p._id) === String(paymentId)
          );
      if (!payment) {
        return res.status(404).json({ message: 'Payment entry not found' });
      }
    }

    const filenames = {
      advance: 'advance-slip.png',
      simple: 'simple-bill.png',
      detailed: 'detailed-bill.png',
      payment: 'payment-receipt.png',
      bill: 'bill.png',
    };
    const captions = {
      advance: `Advance slip — ${patient.name || ''} (${patient.hospitalRegNo || ''})`,
      simple: `Bill — ${patient.name || ''} (${patient.hospitalRegNo || ''})`,
      detailed: `Detailed bill — ${patient.name || ''} (${patient.hospitalRegNo || ''})`,
      payment: `Payment receipt — ${patient.name || ''} (${patient.hospitalRegNo || ''})`,
      bill: `Bill — ${patient.name || ''} (${patient.hospitalRegNo || ''})`,
    };

    const filename = filenames[type] || 'slip.png';
    const caption = captions[type] || 'Hospital slip';

    const result = await sendImage(chatId, image, filename, caption);
    res.json({
      message: 'Slip image sent on WhatsApp',
      to: chatId,
      phone,
      type,
      result,
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      message: error.message || 'Failed to send WhatsApp slip',
    });
  }
};
