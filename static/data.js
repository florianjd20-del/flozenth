// Datenschicht: Firebase (Firestore + Anmeldung). Im Demo-Modus (Konfiguration noch nicht ausgefüllt) wird localStorage genutzt.
import { firebaseConfig } from './firebase-config.js';

export const isDemo = !firebaseConfig || !firebaseConfig.apiKey || /^DEIN/.test(firebaseConfig.apiKey) || /^DEIN/.test(firebaseConfig.projectId || '');
const V = '10.12.2';
const BASE = 'https://www.gstatic.com/firebasejs/' + V + '/';

export const DEFAULT_SHOP = {
  name: 'FLOZENTH',
  tagline: '3D-Druck aus der Werkstatt: Alltagshelfer, Deko und Einzelstücke. Jeder Artikel wird auf Bestellung gedruckt.',
  email: '',
  legal: 'Hinweis: Alle Preise in Euro. Lieferzeit je nach Druckdauer ca. 3 bis 7 Tage.'
};
const DEMO_PRODUCTS = [
  { id: 'p1', name: 'Kabelhalter Schreibtisch', price: 6.5, cat: 'Alltag', material: 'PLA', size: '60 x 25 x 20 mm', desc: 'Hält bis zu fünf Kabel an der Tischkante. Selbstklebend montierbar.', img: '', stock: 5, created: 1 },
  { id: 'p2', name: 'Spiralvase', price: 24, cat: 'Deko', material: 'PETG', size: 'Höhe 180 mm', desc: 'Wasserdichte Vase im Vasenmodus gedruckt, in mehreren Farben.', img: '', stock: 3, created: 2 },
  { id: 'p3', name: 'Handyständer verstellbar', price: 12.9, cat: 'Alltag', material: 'PLA', size: '110 x 80 x 95 mm', desc: 'Klappbar in drei Winkeln, passt für Handys und kleine Tablets.', img: '', stock: 8, created: 3 },
  { id: 'p4', name: 'Flexi-Drache', price: 9.9, cat: 'Spielzeug', material: 'PLA Silk', size: 'Länge 220 mm', desc: 'Beweglich in einem Stück gedruckt, ohne Zusammenbau.', img: '', stock: 0, created: 4 }
];

// ---- Hilfen ----
function ls(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { throw new Error('Der Browser kann im Demo-Modus nichts speichern (Speicher voll oder gesperrt).'); }
}
export function safeImg(src) {
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src || '') ? src : '';
}
function cleanProduct(id, d) {
  return {
    id: id,
    name: String(d.name || d.title || ''),
    price: Number(d.price) || 0,
    cat: String(d.cat || ''),
    material: String(d.material || ''),
    size: String(d.size || ''),
    desc: String(d.desc || d.description || ''),
    img: safeImg(d.img || d.image || ''),
    stock: typeof d.stock === 'number' ? d.stock : null,
    created: d.created && d.created.seconds ? d.created.seconds : (typeof d.created === 'number' ? d.created : 0)
  };
}
function sortProducts(list) {
  return list.sort(function (a, b) { return (a.created - b.created) || a.name.localeCompare(b.name, 'de'); });
}

let fb = null;
async function init() {
  if (fb) return fb;
  const [appM, fsM] = await Promise.all([import(BASE + 'firebase-app.js'), import(BASE + 'firebase-firestore.js')]);
  const app = appM.initializeApp(firebaseConfig);
  fb = { app: app, fsM: fsM, db: fsM.getFirestore(app), authM: null, auth: null };
  return fb;
}
async function initAuth() {
  const f = await init();
  if (!f.auth) {
    f.authM = await import(BASE + 'firebase-auth.js');
    f.auth = f.authM.getAuth(f.app);
  }
  return f;
}

// ---- Lesen (öffentlich) ----
export async function getShop() {
  if (isDemo) return Object.assign({}, DEFAULT_SHOP, ls('flozenth_demo_shop', {}));
  const f = await init();
  const snap = await f.fsM.getDoc(f.fsM.doc(f.db, 'settings', 'shop'));
  return Object.assign({}, DEFAULT_SHOP, snap.exists() ? snap.data() : {});
}
export async function listProducts() {
  if (isDemo) return sortProducts(ls('flozenth_demo_products', DEMO_PRODUCTS).map(function (d) { return cleanProduct(d.id, d); }));
  const f = await init();
  const snap = await f.fsM.getDocs(f.fsM.collection(f.db, 'products'));
  return sortProducts(snap.docs.map(function (d) { return cleanProduct(d.id, d.data()); }));
}

// ---- Anmeldung ----
const demoListeners = [];
export async function onAuth(cb) {
  if (isDemo) { demoListeners.push(cb); cb(ls('flozenth_demo_user', null)); return; }
  const f = await initAuth();
  f.authM.onAuthStateChanged(f.auth, function (u) { cb(u ? { email: u.email } : null); });
}
export async function login(email, pw) {
  if (isDemo) {
    if (pw !== 'demo') throw new Error('Im Demo-Modus ist das Passwort: demo');
    const u = { email: email || 'demo' };
    lsSet('flozenth_demo_user', u);
    demoListeners.forEach(function (cb) { cb(u); });
    return u;
  }
  const f = await initAuth();
  await f.authM.signInWithEmailAndPassword(f.auth, email, pw);
}
export async function logout() {
  if (isDemo) { try { localStorage.removeItem('flozenth_demo_user'); } catch (e) {} demoListeners.forEach(function (cb) { cb(null); }); return; }
  const f = await initAuth();
  await f.authM.signOut(f.auth);
}

// ---- Schreiben (nur angemeldet) ----
export function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
export async function saveProduct(p) {
  const data = {
    name: String(p.name || '').trim().slice(0, 120),
    price: Math.round(Math.max(0, Number(p.price) || 0) * 100) / 100,
    cat: String(p.cat || '').trim().slice(0, 40),
    material: String(p.material || '').trim().slice(0, 40),
    size: String(p.size || '').trim().slice(0, 60),
    desc: String(p.desc || '').trim().slice(0, 1000),
    img: safeImg(p.img),
    stock: (p.stock === null || p.stock === undefined || p.stock === '') ? null : Math.max(0, Math.floor(Number(p.stock) || 0))
  };
  if (!data.name) throw new Error('Bitte gib dem Artikel einen Namen.');
  if (data.img.length > 800000) throw new Error('Das Foto ist zu groß. Nimm ein kleineres Bild.');
  if (isDemo) {
    const list = ls('flozenth_demo_products', DEMO_PRODUCTS);
    const i = list.findIndex(function (x) { return x.id === p.id; });
    if (i >= 0) list[i] = Object.assign({}, list[i], data); else list.push(Object.assign({ id: p.id, created: Date.now() }, data));
    lsSet('flozenth_demo_products', list);
    return;
  }
  const f = await init();
  const ref = f.fsM.doc(f.db, 'products', p.id);
  if (p.isNew) data.created = f.fsM.serverTimestamp();
  await f.fsM.setDoc(ref, data, { merge: true });
}
export async function deleteProduct(id) {
  if (isDemo) { lsSet('flozenth_demo_products', ls('flozenth_demo_products', DEMO_PRODUCTS).filter(function (x) { return x.id !== id; })); return; }
  const f = await init();
  await f.fsM.deleteDoc(f.fsM.doc(f.db, 'products', id));
}
export async function saveShop(s) {
  const data = {
    name: String(s.name || '').trim().slice(0, 60) || 'FLOZENTH',
    tagline: String(s.tagline || '').trim().slice(0, 300),
    email: String(s.email || '').trim().slice(0, 120),
    legal: String(s.legal || '').slice(0, 1500)
  };
  if (isDemo) { lsSet('flozenth_demo_shop', data); return; }
  const f = await init();
  await f.fsM.setDoc(f.fsM.doc(f.db, 'settings', 'shop'), data);
}
export function friendlyError(e) {
  const c = e && e.code || '';
  if (c === 'permission-denied') return 'Keine Berechtigung. Prüfe die Firestore-Regeln und ob du mit dem richtigen Konto angemeldet bist.';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-email') return 'Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort.';
  if (c === 'auth/too-many-requests') return 'Zu viele Versuche. Bitte warte einige Minuten.';
  if (c === 'unavailable' || c === 'auth/network-request-failed') return 'Keine Verbindung. Prüfe dein Internet.';
  return (e && e.message) || 'Das hat nicht geklappt.';
}
