require('dotenv').config();
const express = require('express');
const { connectWhatsApp } = require('./whatsapp');
const { router } = require('./routes');

const app = express();
app.use(express.json());

// Routes
app.use('/', router);

// Health check - keeps Render alive
app.get('/ping', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/ping`);

  // Start WhatsApp connection
  await connectWhatsApp();
});
