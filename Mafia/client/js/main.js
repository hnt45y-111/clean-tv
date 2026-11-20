import { S, subscribe, notify, on, prefs, saveToken } from './store.js';
import { applyLang, t } from './i18n.js';
import { h, ic, toast, raw } from './dom.js';
import { api, connect, send, dropSession } from './net.js';
import { sfx, buzz, cinematic } from './fx.js';
import { logoArt, ROLE_COLOR } from './art.js';
import { go } from './screens/common.js';
import * as Auth from './screens/auth.js';
import * as Home from './screens/home.js';
import * as Rooms from './screens/rooms.js';
import * as Game from './screens/game.js';
import * as Meta from './screens/meta.js';

const SCREENS = {
  login: Auth.login, register: Auth.register, guest: Auth.guest, forgot: Auth.forgot, home: Home.home, mode: Home.mode, friends: Home.friends, profile: Home.profile, leaderboard: Home.leaderboard,
  create: Rooms.create, join: Rooms.join, lobby: Rooms.lobby, narrator: Game.narrator, play: Game.play, stats: Meta.stats, tasks: Meta.tasks, achievements: Meta.achievements, settings: Meta.settings,
  connecting: () => [h('div', { class: 'screen', style: { justifyContent: 'center', alignItems: 'center', textAlign: 'center' } }, h('div', { class: 'spinner' }), h('p', { class: 'dim' }, t('connecting')),
    h('button', { class: 'btn ghost', onclick: () => { dropSession(); go('login'); } }, t('logout')))],
};
const PUBLIC = ['login', 'register', 'guest', 'forgot', 'settings'];
const app = document.getElementById('app');

function currentKey() {
  if (!S.user) return S.token && S.conn !== 'idle' && S.route !== 'login' ? 'connecting' : PUBLIC.includes(S.route) ? S.route : S.token ? 'connecting' : 'login';
  const R = S.room;
  if (R) {
    if (R.status === 'lobby' || !R.match) return 'lobby';
    if (S.route === 'stats' && R.match.phase === 'ended') return 'stats';
    return R.isHost && !R.auto ? 'narrator' : 'play';
  }
  return SCREENS[S.route] && !PUBLIC.slice(0, 4).includes(S.route) ? S.route : 'home';
}

// ---- حفظ حقول الإدخال والتمرير أثناء إعادة الرسم ----
const snap = () => {
  const vals = {}; app.querySelectorAll('input[id], textarea[id]').forEach((i) => { if (i.type !== 'file') vals[i.id] = i.value; });
  const a = document.activeElement; return { vals, focus: a?.id && app.contains(a) ? a.id : null, sel: a?.selectionStart ?? null, scroll: app.querySelector('.screen')?.scrollTop ?? 0 };
};
const restore = (s, same) => {
  for (const [id, v] of Object.entries(s.vals)) { const el = document.getElementById(id); if (el && v !== '' && el.value !== v) el.value = v; }
  if (s.focus) { const el = document.getElementById(s.focus); if (el) { el.focus(); try { if (s.sel != null) el.setSelectionRange(s.sel, s.sel); } catch { /* نوع لا يدعم */ } } }
  if (same) { const sc = app.querySelector('.screen'); if (sc) sc.scrollTop = s.scroll; }
};

let lastKey = '';
function render() {
  const key = currentKey(); const s = snap(); const same = key === lastKey + '' ;
  let parts; try { parts = SCREENS[key](); } catch (e) { console.error(e); parts = [h('div', { class: 'screen' }, h('div', { class: 'banner red' }, 'Error: ' + e.message))]; }
  app.replaceChildren(...[].concat(parts));
  if (!same) app.querySelector('.screen')?.classList.add('enter');
  lastKey = key; restore(s, same);
  const m = S.room?.match; document.body.classList.toggle('is-night', m?.phase === 'night'); document.body.classList.toggle('is-day', !!m && ['dawn', 'day', 'vote', 'voteResult'].includes(m.phase));
  Game.tickTimers();
}

// ---- مؤثرات تغيّر الحالة ----
let prev = {};
function effects() {
  const R = S.room; const m = R?.match; const me = m?.me;
  const cur = { code: R?.code, phase: m?.phase, round: R?.round, speaker: m?.speaker, alive: me?.alive, members: R?.members.length, status: R?.status };
  if (R && prev.code === R.code) {
    if (cur.phase !== prev.phase || cur.round !== prev.round) {
      if (cur.phase === 'night') { cinematic('night'); sfx('night'); buzz([60, 40, 60]); }
      else if (cur.phase === 'day') { cinematic('day'); sfx('day'); buzz(50); }
      else if (cur.phase === 'roles') { sfx('flip'); buzz(40); }
      else if (cur.phase === 'vote') { sfx('vote'); buzz(40); }
      else if (cur.phase === 'dawn' || cur.phase === 'voteResult') { sfx('notify'); }
      else if (cur.phase === 'ended') { const w = m.winner; if (me) sfx(w && me.team === w ? 'win' : 'lose'); else sfx('win'); buzz([80, 40, 120]); }
    }
    if (me && prev.alive === true && cur.alive === false) { sfx('dead'); buzz(300); }
    if (me && cur.speaker === me.id && prev.speaker !== me.id) { sfx('notify'); buzz([80, 60, 80]); }
    if (cur.status === 'lobby' && (cur.members || 0) > (prev.members || 0)) sfx('join');
  }
  prev = cur;
}
subscribe(() => { effects(); render(); });

// ---- أحداث الخادم ----
on('event', (m) => { if (m.kind === 'timeup') { sfx('alarm'); buzz([200, 100, 200]); } });
const sysNotify = (title, body) => { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') { try { new Notification(title, { body, icon: 'icons/icon.svg' }); } catch { /* غير مدعوم */ } } };
on('notif', (n) => {
  sfx('notify'); buzz(40);
  if (n.kind === 'friend_request') { toast(t('n_friend_request', { name: n.from }), '', () => go('friends')); sysNotify(t('n_friend_request', { name: n.from }), ''); }
  else if (n.kind === 'friend_accepted') toast(t('n_friend_accepted', { name: n.from }), 'ok');
  else if (n.kind === 'match_start') { toast(t('n_match_start'), 'ok'); sysNotify(t('n_match_start'), ''); }
});
on('invite', (i) => { sfx('notify'); buzz(80); const msg = t('n_invite', { name: i.from }); sysNotify(msg, ''); toast(msg + ' — ' + t('tap_join'), '', async () => { const r = await send({ t: 'room:join', key: i.code }); if (!r.ok) toast(t('err.' + r.error), 'err'); }); });
on('left', (why) => { if (why && why !== 'left') toast(t('left_' + why), why === 'kicked' ? 'err' : ''); });
on('progress', (p) => { if (p.gained?.newAchievements?.length) toast(t('new_achievements', { n: p.gained.newAchievements.length }), 'ok', () => go('achievements')); });
on('hello', () => { if (S.pendingJoin && !S.room) { const k = S.pendingJoin; S.pendingJoin = null; send({ t: 'room:join', key: k }).then((r) => { if (!r.ok) toast(t('err.' + r.error), 'err'); }); } else S.pendingJoin = null; });

// ---- شريط الاتصال ----
let bar = null;
subscribe(() => {
  const need = S.user && S.conn !== 'ok';
  if (need && !bar) { bar = h('div', { class: 'toast err', style: { animation: 'none' } }, h('div', { class: 'spinner', style: { width: '18px', height: '18px' } }), t('reconnecting')); document.getElementById('layer').append(bar); }
  if (!need && bar) { bar.remove(); bar = null; }
});

// ---- منع إبقاء الشاشة مطفأة أثناء المباراة ----
let lock = null;
subscribe(async () => { const inGame = S.room?.match && S.room.match.phase !== 'ended'; if (inGame && !lock && navigator.wakeLock) { try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } catch { /* مرفوض */ } } else if (!inGame && lock) { lock.release().catch(() => {}); lock = null; } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.token) connect(); });

// ---- التوجيه بالرابط ----
function readHash() {
  const m = location.hash.match(/^#\/join\/([0-9]{6}(?:-[A-Za-z0-9]{8})?)/);
  if (m) { S.pendingJoin = m[1].toUpperCase(); history.replaceState(null, '', '#/home'); return; }
  const r = location.hash.replace(/^#\//, ''); if (SCREENS[r] && !['lobby', 'narrator', 'play', 'connecting'].includes(r)) S.route = r;
}
window.addEventListener('hashchange', () => { readHash(); notify(); });

// ---- الإقلاع + الشاشة الافتتاحية (1) ----
async function boot() {
  applyLang(); document.body.classList.toggle('lite', !!prefs.lite); readHash();
  const splash = h('div', { class: 'splash' }, h('div', { class: 'box' }, logoArt(), h('div', { class: 'logo' }, 'مافيا'), h('div', { class: 'dim' }, t('tagline')), h('div', { class: 'spinner' })));
  document.body.append(splash);
  const t0 = Date.now();
  try { S.cfg = await api('/api/config'); } catch { /* الخادم غير متاح بعد */ }
  if (S.token) { connect(); await new Promise((res) => { const off = on('hello', () => { off(); res(); }); setTimeout(res, 3500); }); }
  await new Promise((r) => setTimeout(r, Math.max(0, 1100 - (Date.now() - t0))));
  S.ready = true; if (!S.token) go('login'); else notify();
  splash.style.opacity = '0'; setTimeout(() => splash.remove(), 500);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  setInterval(Game.tickTimers, 200);
}
boot();
// أدوات اختبار/تصحيح
window.__mafia = { S, go };
