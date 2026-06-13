const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { useSupabaseAuthState } = require('./supabaseAuthState');

let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';

const logger = pino({ level: 'silent' });

async function connectWhatsApp() {
  try {
    const { state, saveCreds } = await useSupabaseAuthState('main-session');
    const { version } = await fetchLatestBaileysVersion();

    console.log(`📱 Using Baileys version: ${version.join('.')}`);

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      browser: ['Chrome (Linux)', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeData = qr;
        connectionStatus = 'qr_ready';
        console.log('\n📲 QR Code ready! Scan it at: /qr\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        qrCodeData = null;
        connectionStatus = 'connected';
        console.log('✅ WhatsApp connected successfully!');
      }

      if (connection === 'close') {
        connectionStatus = 'disconnected';
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`❌ Connection closed. Status: ${statusCode}`);

        if (shouldReconnect) {
          console.log('🔄 Reconnecting in 5 seconds...');
          setTimeout(connectWhatsApp, 5000);
        } else {
          console.log('🚪 Logged out. Please re-scan QR code.');
          const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
          await supabase.from('whatsapp_sessions').delete().eq('id', 'main-session');
          setTimeout(connectWhatsApp, 3000);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;

        await handleIncomingMessage(msg);
      }
    });

  } catch (error) {
    console.error('❌ Error connecting to WhatsApp:', error);
    console.log('🔄 Retrying in 10 seconds...');
    setTimeout(connectWhatsApp, 10000);
  }
}

async function handleIncomingMessage(msg) {
  try {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      null;

    if (!text) return;

    const senderNumber = from.replace('@s.whatsapp.net', '').replace('@g.us', '');

    console.log(`📨 Message from ${senderNumber}: ${text}`);

    const allowedContacts = process.env.ALLOWED_CONTACTS
      ? process.env.ALLOWED_CONTACTS.split(',').map(c => c.trim())
      : null;

    if (allowedContacts && !allowedContacts.includes(senderNumber) && !isGroup) {
      console.log(`⚠️ Ignoring message from non-allowed contact: ${senderNumber}`);
      return;
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      console.log('⚠️ N8N_WEBHOOK_URL not set. Message not forwarded.');
      return;
    }

    const payload = {
      from: senderNumber,
      jid: from,
      text,
      isGroup,
      timestamp: msg.messageTimestamp,
      messageId: msg.key.id,
      pushName: msg.pushName || '',
    };

    const response = await axios.post(n8nWebhookUrl, payload, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    console.log(`✅ Forwarded to n8n. Response: ${response.status}`);

  } catch (error) {
    console.error('❌ Error handling message:', error.message);
  }
}

async function sendMessage(jid, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp not connected');
  }

  const delay = Math.floor(Math.random() * 2000) + 1000;
  await new Promise(resolve => setTimeout(resolve, delay));

  await sock.sendPresenceUpdate('composing', jid);
  await new Promise(resolve => setTimeout(resolve, delay));
  await sock.sendPresenceUpdate('paused', jid);

  const result = await sock.sendMessage(jid, { text });
  console.log(`📤 Message sent to ${jid}`);
  return result;
}

function getStatus() {
  return {
    status: connectionStatus,
    hasQR: !!qrCodeData,
  };
}

function getQR() {
  return qrCodeData;
}

module.exports = { connectWhatsApp, sendMessage, getStatus, getQR };
