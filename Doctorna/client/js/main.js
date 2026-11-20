import { h, $, toast, n } from './dom.js';
import { S, api, get, hasToken, loadMe, loadMeta } from './api.js';
import * as auth from './screens/auth.js';
import * as pt from './screens/patient.js';
import * as fl from './screens/file.js';
import * as ph from './screens/pharm.js';
import * as so from './screens/social.js';
import * as ms from './screens/misc.js';
import * as dr from './screens/doctor.js';
import * as st from './screens/staff.js';

const P = ['patient'], D = ['doctor'], DS = ['doctor', 'secretary'];
const ROUTES = [
  ['#/login', null, auth.login], ['#/register', null, auth.register],
  ['#/home', P, pt.homeScreen], ['#/doctors', P, pt.doctorsScreen], ['#/doctor/settings', D, dr.doctorSettings], ['#/doctor/patient/:id', D, (a) => dr.patientScreen(a.id)],
  ['#/doctor/:id', ['patient', 'doctor', 'admin'], (a) => pt.doctorProfile(a.id)], ['#/doctor', DS, dr.doctorHome],
  ['#/bookings', P, pt.bookingsScreen], ['#/ticket/:id', P, (a) => pt.ticketScreen(a.id)], ['#/file', P, fl.fileScreen],
  ['#/pharmacies', P, ph.pharmaciesScreen], ['#/pharmacy/settings', ['pharmacy', 'lab'], st.pharmacySettings], ['#/pharmacy/sell', ['pharmacy'], st.pharmacySell], ['#/pharmacy/:id', null, (a) => ph.pharmacyProfile(a.id)], ['#/pharmacy', ['pharmacy'], st.pharmacyHome],
  ['#/lab', ['lab'], st.labHome], ['#/admin', ['admin'], st.adminHome],
  ['#/forum', null, so.forumScreen], ['#/post/:id', null, (a) => so.postScreen(a.id)], ['#/messages', ['patient', 'doctor'], so.messagesScreen], ['#/chat/:id', ['patient', 'doctor'], (a) => so.chatScreen(a.id)],
  ['#/notifications', null, ms.notificationsScreen], ['#/rewards', null, ms.rewardsScreen], ['#/voice', P, ms.voiceScreen], ['#/me', null, ms.meScreen],
].map(([pat, roles, fn]) => { const keys = []; const re = new RegExp('^' + pat.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$'); return { re, keys, roles, fn }; });

const HOME = { patient: '#/home', doctor: '#/doctor', secretary: '#/doctor', pharmacy: '#/pharmacy', lab: '#/lab', admin: '#/admin' };
const root = $('#app');
let seq = 0;

async function render() {
  const my = ++seq;
  const hash = location.hash || '#/';
  const path = hash.split('?')[0];
  if (!S.user && hasToken()) { try { await loadMe(); } catch { /* token expired */ } }
  const open = path === '#/login' || path === '#/register';
  if (!S.user && !open) { if (path === '#/' || path === '#') { root.replaceChildren(auth.splash()); await new Promise((r) => setTimeout(r, 700)); } location.hash = '#/login'; return; }
  if (S.user && (open || path === '#/' || path === '#')) { location.hash = HOME[S.user.role]; return; }
  const m = ROUTES.map((r) => ({ r, x: r.re.exec(path) })).find((o) => o.x);
  if (!m) { location.hash = S.user ? HOME[S.user.role] : '#/login'; return; }
  if (m.r.roles && !m.r.roles.includes(S.user.role)) { location.hash = HOME[S.user.role]; return; }
  const args = Object.fromEntries(m.r.keys.map((k, i) => [k, decodeURIComponent(m.x[i + 1])]));
  try {
    if (S.user) { await loadMeta(); }
    const el = await m.r.fn(args);
    if (my !== seq) return;
    root.replaceChildren(el);
    window.scrollTo(0, 0);
    if (S.user) get('/me').then((j) => { S.unread = j.unread; }).catch(() => {});
  } catch (e) {
    if (my !== seq) return;
    root.replaceChildren(h('div', { class: 'page', style: 'padding-top:64px' }, h('div', { class: 'err' }, e.message), h('button', { class: 'btn block', style: 'margin-top:16px', onClick: () => render() }, 'جرّب مرة ثانية')));
  }
}
window.addEventListener('hashchange', render);

// ---------- تنبيهات الدواء والمراجعة (تشتغل والتطبيق مفتوح أو بالخلفية) ----------
const fired = new Set(JSON.parse(sessionStorage.getItem('dt_fired') || '[]'));
async function tick(refresh) {
  if (!S.user || S.user.role !== 'patient') return;
  try {
    if (refresh || !tick.cache) tick.cache = (await get('/reminders')).reminders;
    const hm = new Date(Date.now() + 3 * 3600e3).toISOString().slice(11, 16);
    for (const r of tick.cache) {
      if (r.type !== 'dose' || r.time !== hm || fired.has(r.id + r.date)) continue;
      fired.add(r.id + r.date); sessionStorage.setItem('dt_fired', JSON.stringify([...fired]));
      toast(`وقت علاجك: ${r.drug}`);
      if ('Notification' in window && Notification.permission === 'granted') {
        const reg = await navigator.serviceWorker?.getRegistration();
        const opts = { body: r.body, icon: 'icons/icon-192.png', tag: r.id, dir: 'rtl', lang: 'ar' };
        reg ? reg.showNotification(r.title, opts) : new Notification(r.title, opts);
      }
    }
  } catch {}
}
setInterval(() => tick(false), 20000);
setInterval(() => tick(true), 30 * 60000);
window.addEventListener('hashchange', () => { tick.cache = null; });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('online', () => toast('رجع النت'));
window.addEventListener('offline', () => toast('النت ضعيف، جرّب مرة ثانية', true));
render().then(() => tick(true));
