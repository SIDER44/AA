const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');
const fs         = require('fs');
const app        = express();
const PORT       = process.env.PORT || 8080;

// Create temp folder if not exists
if (!fs.existsSync('./temp')) fs.mkdirSync('./temp', { recursive: true });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── ROUTES ────────────────────────────────────────────────────
app.get('/',     (req, res) => res.sendFile(path.join(__dirname, 'views', 'main.html')));
app.get('/pair', (req, res) => res.sendFile(path.join(__dirname, 'views', 'pair.html')));
app.get('/qr',   (req, res) => res.sendFile(path.join(__dirname, 'views', 'qr.html')));

// ── API ENDPOINTS ─────────────────────────────────────────────
app.use('/api/pair', require('./routes/pair'));
app.use('/api/qr',   require('./routes/qr'));

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║      🤖  ALMEER XMD — PAIRING        ║
╠══════════════════════════════════════╣
║  🌐 Port    : ${PORT}                   ║
║  📱 Pair    : /pair                  ║
║  📷 QR Code : /qr                   ║
╚══════════════════════════════════════╝
  `);
});

module.exports = app;
