const express = require('express');
const qrcode = require('qrcode');
const { sendMessage, getStatus, getQR } = require('./whatsapp');

const router = express.Router();

// ── Root ──────────────────────────────────────────────
router.get('/', (req, res) => {
  const status = getStatus();
  res.json({
    app: 'WhatsApp AI Bot',
    version: '1.0.0',
    ...status,
  });
});

// ── QR Code Page (scan to connect WhatsApp) ───────────
router.get('/qr', async (req, res) => {
  const qrData = getQR();
  const status = getStatus();

  if (status.status === 'connected') {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#111;color:#fff">
        <h2>✅ WhatsApp Connected!</h2>
        <p>Your bot is live and ready.</p>
      </body></html>
    `);
  }

  if (!qrData) {
    return res.send(`
      <html>
      <head><meta http-equiv="refresh" content="3"></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#111;color:#fff">
        <h2>⏳ Generating QR Code...</h2>
        <p>Status: ${status.status}</p>
        <p>Page will refresh automatically.</p>
      </body></html>
    `);
  }

  try {
    const qrImageUrl = await qrcode.toDataURL(qrData);
    res.send(`
      <html>
      <head><meta http-equiv="refresh" content="30"></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#111;color:#fff">
        <h2>📲 Scan QR Code with WhatsApp</h2>
        <p>Open WhatsApp → Linked Devices → Link a Device</p>
        <img src="${qrImageUrl}" style="width:300px;height:300px;border:4px solid #fff;border-radius:12px" />
        <p style="color:#aaa;font-size:14px">QR refreshes every 30 seconds automatically</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR image' });
  }
});

// ── Send Message (called by n8n) ──────────────────────
router.post('/send', async (req, res) => {
  const apiKey = req.headers['x-api-key'];

  // Simple API key auth
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing "to" or "message" fields' });
  }

  try {
    // Format JID - add @s.whatsapp.net if not present
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const result = await sendMessage(jid, message);
    res.json({ success: true, messageId: result?.key?.id });
  } catch (error) {
    console.error('Send error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Status ────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json(getStatus());
});

module.exports = { router };
