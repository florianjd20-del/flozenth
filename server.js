'use strict';
// FLOZENTH Shop-Server. Keine Pakete nötig, nur Node.js ab Version 18.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_MS = 14 * 24 * 3600 * 1000;

if (PASSWORD.length < 8) {
  console.error('Bitte ADMIN_PASSWORD setzen (mindestens 8 Zeichen).');
  process.exit(1);
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SHOP_FILE = path.join(DATA_DIR, 'shop.json');
const SECRET = crypto.createHash('sha256').update('flozenth-session:' + PASSWORD).digest();
const PW_HASH = crypto.createHash('sha256').update(PASSWORD).digest();

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

if (!fs.existsSync(SHOP_FILE)) {
  writeJSON(SHOP_FILE, {
    name: 'FLOZENTH',
    tagline: '3D-Druck aus der Werkstatt: Alltagshelfer, Deko und Einzelstücke. Jeder Artikel wird auf Bestellung gedruckt.',
    email: '',
    legal: 'Hinweis: Alle Preise in Euro. Lieferzeit je nach Druckdauer ca. 3 bis 7 Tage.'
  });
}
if (!fs.existsSync(PRODUCTS_FILE)) {
  writeJSON(PRODUCTS_FILE, [
    { id: 'p1', name: 'Kabelhalter Schreibtisch', price: 6.5, cat: 'Alltag', material: 'PLA', size: '60 x 25 x 20 mm', desc: 'Hält bis zu fünf Kabel an der Tischkante. Selbstklebend montierbar.', img: '', stock: 5, demo: true },
    { id: 'p2', name: 'Spiralvase', price: 24, cat: 'Deko', material: 'PETG', size: 'Höhe 180 mm', desc: 'Wasserdichte Vase im Vasenmodus gedruckt, in mehreren Farben.', img: '', stock: 3, demo: true },
    { id: 'p3', name: 'Handyständer verstellbar', price: 12.9, cat: 'Alltag', material: 'PLA', size: '110 x 80 x 95 mm', desc: 'Klappbar in drei Winkeln, passt für Handys und kleine Tablets.', img: '', stock: 8, demo: true },
    { id: 'p4', name: 'Flexi-Drache', price: 9.9, cat: 'Spielzeug', material: 'PLA Silk', size: 'Länge 220 mm', desc: 'Beweglich in einem Stück gedruckt, ohne Zusammenbau.', img: '', stock: 0, demo: true }
  ]);
}

function httpErr(status, msg) { const e = new Error(msg); e.status = status; return e; }

// ---- Anmeldung ----
function sign(text) { return crypto.createHmac('sha256', SECRET).update(text).digest('hex'); }
function makeToken() { const exp = String(Date.now() + SESSION_MS); return exp + '.' + sign(exp); }
function tokenValid(tok) {
  if (!tok) return false;
  const i = tok.indexOf('.');
  if (i < 1) return false;
  const exp = tok.slice(0, i), sig = tok.slice(i + 1);
  const want = sign(exp);
  if (sig.length !== want.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return false;
  return Number(exp) > Date.now();
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}
function isAdmin(req) { return tokenValid(cookies(req).fz_session); }
function requireAdmin(req) { if (!isAdmin(req)) throw httpErr(401, 'Nicht angemeldet.'); }

const attempts = new Map();
function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.socket.remoteAddress || 'x';
}
function checkLimit(ip) {
  const a = attempts.get(ip);
  if (a && a.until && a.until > Date.now()) throw httpErr(429, 'Zu viele Versuche. Bitte warte 15 Minuten.');
}
function noteFail(ip) {
  const a = attempts.get(ip) || { n: 0, until: 0 };
  a.n += 1;
  if (a.n >= 5) { a.until = Date.now() + 15 * 60 * 1000; a.n = 0; }
  attempts.set(ip, a);
}
function cookieFlags(req) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === '1';
  return 'HttpOnly; SameSite=Strict; Path=/' + (secure ? '; Secure' : '');
}

// ---- Eingaben prüfen ----
function str(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }
function cleanProduct(b, id, old) {
  const name = str(b.name, 120);
  if (!name) throw httpErr(400, 'Der Name fehlt.');
  const price = Number(b.price);
  if (!isFinite(price) || price < 0 || price > 100000) throw httpErr(400, 'Der Preis ist ungültig.');
  let stock = null;
  if (b.stock !== null && b.stock !== undefined && b.stock !== '') {
    stock = Number(b.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) throw httpErr(400, 'Der Bestand ist ungültig.');
  }
  const img = str(b.img, 100);
  if (img && !/^\/uploads\/[a-f0-9]{16}\.jpg$/.test(img)) throw httpErr(400, 'Das Bild ist ungültig.');
  const p = {
    id, name, price: Math.round(price * 100) / 100,
    cat: str(b.cat, 40), material: str(b.material, 40), size: str(b.size, 60),
    desc: str(b.desc, 1000), img, stock
  };
  if (old && old.demo && old.name === name) p.demo = true;
  return p;
}
function cleanShop(b) {
  const name = str(b.name, 60);
  if (!name) throw httpErr(400, 'Der Shop-Name fehlt.');
  return { name, tagline: str(b.tagline, 300), email: str(b.email, 120), legal: str(b.legal, 1500) };
}

function dropImage(url) {
  if (!url) return;
  const products = readJSON(PRODUCTS_FILE, []);
  if (products.some(p => p.img === url)) return;
  const m = /^\/uploads\/([a-f0-9]{16}\.jpg)$/.exec(url);
  if (m) fs.unlink(path.join(UPLOAD_DIR, m[1]), () => {});
}

// ---- Hilfen ----
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    if (!type.startsWith('application/json')) return reject(httpErr(415, 'Nur JSON erlaubt.'));
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(httpErr(413, 'Die Anfrage ist zu groß.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(httpErr(400, 'Ungültige Daten.')); }
    });
    req.on('error', reject);
  });
}
function send(res, status, body, extra) {
  const data = JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {}));
  res.end(data);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function sendFile(res, file, cache) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(buf);
  });
}

async function route(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");

  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const m = req.method;

  if (p === '/api/shop' && m === 'GET') return send(res, 200, readJSON(SHOP_FILE, {}));
  if (p === '/api/products' && m === 'GET') return send(res, 200, readJSON(PRODUCTS_FILE, []));
  if (p === '/api/me' && m === 'GET') return send(res, 200, { admin: isAdmin(req) });

  if (p === '/api/login' && m === 'POST') {
    const ip = clientIp(req);
    checkLimit(ip);
    const b = await readBody(req, 4096);
    const given = crypto.createHash('sha256').update(String(b.password || '')).digest();
    if (!crypto.timingSafeEqual(given, PW_HASH)) { noteFail(ip); throw httpErr(401, 'Passwort stimmt nicht.'); }
    attempts.delete(ip);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'fz_session=' + makeToken() + '; Max-Age=' + SESSION_MS / 1000 + '; ' + cookieFlags(req) });
  }
  if (p === '/api/logout' && m === 'POST') {
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'fz_session=; Max-Age=0; ' + cookieFlags(req) });
  }

  if (p === '/api/shop' && m === 'PUT') {
    requireAdmin(req);
    const shop = cleanShop(await readBody(req, 20000));
    writeJSON(SHOP_FILE, shop);
    return send(res, 200, shop);
  }

  if (p === '/api/upload' && m === 'POST') {
    requireAdmin(req);
    const b = await readBody(req, 6 * 1024 * 1024);
    const mt = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.dataUrl || ''));
    if (!mt) throw httpErr(400, 'Bitte ein JPEG-Bild senden.');
    const buf = Buffer.from(mt[1], 'base64');
    if (buf.length < 100 || buf.length > 3 * 1024 * 1024 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw httpErr(400, 'Das Bild ist ungültig oder zu groß.');
    const name = crypto.randomBytes(8).toString('hex') + '.jpg';
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return send(res, 200, { url: '/uploads/' + name });
  }

  const pm = /^\/api\/products\/([a-z0-9]{1,24})$/.exec(p);
  if (pm && m === 'PUT') {
    requireAdmin(req);
    const id = pm[1];
    const products = readJSON(PRODUCTS_FILE, []);
    const i = products.findIndex(x => x.id === id);
    const item = cleanProduct(await readBody(req, 20000), id, i >= 0 ? products[i] : null);
    const oldImg = i >= 0 ? products[i].img : '';
    if (i >= 0) products[i] = item; else products.push(item);
    writeJSON(PRODUCTS_FILE, products);
    if (oldImg && oldImg !== item.img) dropImage(oldImg);
    return send(res, 200, item);
  }
  if (pm && m === 'DELETE') {
    requireAdmin(req);
    const products = readJSON(PRODUCTS_FILE, []);
    const old = products.find(x => x.id === pm[1]);
    writeJSON(PRODUCTS_FILE, products.filter(x => x.id !== pm[1]));
    if (old) dropImage(old.img);
    return send(res, 200, { ok: true });
  }
  if (p.startsWith('/api/')) throw httpErr(404, 'Nicht gefunden.');

  if (m !== 'GET' && m !== 'HEAD') throw httpErr(405, 'Nicht erlaubt.');
  const um = /^\/uploads\/([a-f0-9]{16}\.jpg)$/.exec(p);
  if (um) return sendFile(res, path.join(UPLOAD_DIR, um[1]), 'public, max-age=31536000, immutable');
  if (p === '/' || p === '/admin') return sendFile(res, path.join(PUBLIC_DIR, 'index.html'), 'no-cache');
  if (p === '/style.css' || p === '/app.js') return sendFile(res, path.join(PUBLIC_DIR, p.slice(1)), 'no-cache');
  throw httpErr(404, 'Nicht gefunden.');
}

http.createServer((req, res) => {
  route(req, res).catch(e => {
    const st = e.status || 500;
    if (st === 500) console.error(e);
    if (!res.headersSent) send(res, st, { error: st === 500 ? 'Serverfehler.' : e.message });
  });
}).listen(PORT, () => console.log('FLOZENTH läuft auf Port ' + PORT));
