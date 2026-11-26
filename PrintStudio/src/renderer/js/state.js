import { call } from './util.js';
export const S = { settings: null, pages: [], scanners: null, printers: null, listeners: new Set() };
export const emit = () => S.listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
export async function refreshState() { const st = await call('state'); S.settings = st.settings; S.firstRun = st.firstRun; S.platform = st.platform; emit(); return st; }
export async function setSetting(obj) { S.settings = await call('settingsSet', obj); applyGeneral(); emit(); return S.settings; }
export function applyGeneral() {
  const g = S.settings && S.settings.general; if (!g) return;
  document.body.classList.toggle('no-anim', !g.animations);
  document.documentElement.style.setProperty('--bg0', g.theme === 'darker' ? '#02030a' : '#050816');
}
export async function refreshPages() { S.pages = await call('pagesList'); emit(); return S.pages; }
export async function refreshDevices(force = true) {
  const [p, s] = await Promise.allSettled([call('printers'), call('scanners')]);
  S.printers = p.status === 'fulfilled' ? p.value : { error: p.reason.message, list: [] };
  S.scanners = s.status === 'fulfilled' ? s.value : { error: s.reason.message, list: [] };
  emit(); return S;
}
