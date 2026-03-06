const express  = require('express');
const router   = express.Router();
const fs       = require('fs');
const pino     = require('pino');
const path     = require('path');
const QRCode   = require('qrcode');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
  DisconnectReason
} = require('@whiskeysockets/baileys');

function makeid(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result  = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function removeFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { recursive: true, force: true });
  } catch (e) {}
}

router.get('/', async (req, res) => {
  const id      = makeid();
  const tmpPath = path.join(__dirname, '..', 'temp', id);
  const logger  = pino({ level: 'fatal' });

  async function startQR() {
    const { state, saveCreds } = await useMultiFileAuthState(tmpPath);

    let sock;
    try {
      sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60000
      });
    } catch (err) {
      removeFile(tmpPath);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to start. Try again.' });
      return;
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !res.headersSent) {
        try {
          const qrBuffer = await QRCode.toBuffer(qr, {
            errorCorrectionLevel: 'L',
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
          });
          res.setHeader('Content-Type', 'image/png');
          res.end(qrBuffer);
        } catch (e) {
          if (!res.headersSent) res.status(500).json({ error: 'QR generation failed' });
        }
      }

      if (connection === 'open') {
        await delay(5000);
        try {
          const credsFile   = path.join(tmpPath, 'creds.json');
          const sessionData = fs.readFileSync(credsFile, 'utf-8');
          const sessionB64  = Buffer.from(sessionData).toString('base64');
          const sessionId   = `ALMEER-XMD~${sessionB64}`;

          const sentMsg = await sock.sendMessage(sock.user.id, { text: sessionId });

          await sock.sendMessage(sock.user.id, {
            text:
`🤖 *ALMEER XMD — Session Created!* ✅

👋 Your bot is ready to connect!

🔐 *Session ID:* Sent above ↑
⚠️ *Never share this with anyone!*

━━━━━━━━━━━━━━━━━━━━━
📌 *How to use:*

1️⃣ Copy the Session ID above
2️⃣ Go to your bot on Railway
3️⃣ Click *Variables* tab
4️⃣ Add:
   *Name:*  SESSION_DATA
   *Value:* paste your session ID
5️⃣ Redeploy → Bot connects! ✅

━━━━━━━━━━━━━━━━━━━━━
> *© Powered by ALMEER XMD*`,
            contextInfo: {
              externalAdReply: {
                title: 'ALMEER XMD',
                body: 'Advanced WhatsApp Bot',
                thumbnailUrl: 'https://i.imgur.com/GVW7aoD.jpeg',
                sourceUrl: 'https://github.com',
                mediaType: 1,
                renderLargerThumbnail: true
              }
            }
          }, { quoted: sentMsg });

        } catch (err) {
          console.error('Session send error:', err.message);
        }

        await delay(2000);
        try { sock.ev.removeAllListeners(); sock.ws.close(); } catch (e) {}
        removeFile(tmpPath);

      } else if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut && code !== 401) {
          removeFile(tmpPath);
        }
      }
    });
  }

  startQR().catch((err) => {
    removeFile(tmpPath);
    if (!res.headersSent) res.status(500).json({ error: 'Service error. Try again.' });
  });
});

module.exports = router;
