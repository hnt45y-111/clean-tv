// الحالة العامة + التفضيلات. الواجهة تقرأ من هنا فقط، والمنطق (القواعد) كله على الخادم.
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* وضع خاص */ } };

export const prefs = { sound: true, haptics: true, quiet: false, lite: false, lang: 'ar', ...load('mafia.prefs', {}) };
export const setPref = (k, v) => { prefs[k] = v; save('mafia.prefs', prefs); document.body.classList.toggle('lite', !!prefs.lite); notify(); };

export const S = {
  ready: false, token: load('mafia.token', null), user: null, cfg: { googleClientId: '' },
  conn: 'idle', room: null, friends: { friends: [], incoming: [], outgoing: [] }, offset: 0,
  route: 'home', params: {}, invite: null, pendingJoin: null, lastReport: null,
};
export const saveToken = (t) => { S.token = t; t ? save('mafia.token', t) : localStorage.removeItem('mafia.token'); };
export const serverNow = () => Date.now() + S.offset;

const subs = new Set();
export const subscribe = (f) => (subs.add(f), () => subs.delete(f));
let queued = false;
export const notify = () => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; subs.forEach((f) => f()); }); };

const hubs = {};
export const on = (type, f) => ((hubs[type] ||= new Set()).add(f), () => hubs[type].delete(f));
export const emit = (type, data) => hubs[type]?.forEach((f) => f(data));
