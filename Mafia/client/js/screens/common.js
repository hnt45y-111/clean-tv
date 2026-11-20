import { h, ic, avatar, toast } from '../dom.js';
import { t, err } from '../i18n.js';
import { S, notify } from '../store.js';
import { send } from '../net.js';

export const go = (route, params = {}) => { S.route = route; S.params = params; history.replaceState(null, '', '#/' + route); notify(); };
export const screen = (...kids) => h('div', { class: 'screen' }, ...kids);
export const topbar = (title, { back = 'home', right } = {}) => h('div', { class: 'top' },
  back && h('button', { class: 'iconbtn', 'aria-label': t('back'), onclick: () => (typeof back === 'function' ? back() : go(back)) }, ic('chev')),
  h('h2', {}, title), right);
export const NAV = [['home', 'home', 'nav_home'], ['friends', 'users', 'nav_friends'], ['tasks', 'task', 'nav_tasks'], ['profile', 'user', 'nav_profile']];
export const navbar = (cur) => h('nav', { class: 'nav' }, NAV.map(([r, i, l]) => h('button', { class: r === cur ? 'on' : '', onclick: () => go(r) }, ic(i), t(l))));
export const fail = (code) => toast(err(code), 'err');
/** ينفّذ أمراً عبر الشبكة ويعرض الخطأ إن وُجد. يمنع النقر المزدوج بتعطيل الزر أثناء التنفيذ */
export async function act(btn, msg) {
  if (btn?.disabled) return null; if (btn) btn.disabled = true;
  const r = await send(msg); if (btn) btn.disabled = false;
  if (!r.ok) fail(r.error); return r.ok ? r : null;
}
export const levelInfo = (xp) => { const level = 1 + Math.floor(Math.sqrt(xp / 50)); const base = 50 * (level - 1) ** 2; const next = 50 * level ** 2; return { level, into: xp - base, span: next - base }; };
export const xpBar = (u) => { const L = levelInfo(u.xp); return h('div', { class: 'col gap6', style: { gap: '6px' } }, h('div', { class: 'row between small' }, h('span', {}, t('level') + ' ', h('b', { class: 'num' }, L.level)), h('span', { class: 'dim num' }, `${L.into} / ${L.span} XP`)), h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, (L.into / L.span) * 100) + '%' } }))); };

// ذاكرة مؤقتة للبيانات غير المتزامنة: تعيد القيمة الحالية (أو null) وتبدأ التحميل مرة واحدة ثم تُشعر الواجهة
const cache = new Map();
export function cached(key, loader, ttl = 5000) {
  const c = cache.get(key);
  if (!c || (Date.now() - c.at > ttl && !c.busy)) {
    const e = c || { v: null, at: 0 }; e.busy = true; cache.set(key, e);
    loader().then((v) => { e.v = v; e.at = Date.now(); e.busy = false; notify(); }).catch((x) => { e.busy = false; e.at = Date.now(); fail(x.message); });
  }
  return cache.get(key).v;
}
export const bust = (key) => (key ? cache.delete(key) : cache.clear());
