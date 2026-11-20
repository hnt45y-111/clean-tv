import { t } from './i18n.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && !['list', 'form'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}
export const raw = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };

const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.4c2.2.7 3.5 2.6 3.5 5.6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>', trophy: '<path d="M8 4h8v6a4 4 0 01-8 0z"/><path d="M8 6H4v2a3 3 0 003 3M16 6h4v2a3 3 0 01-3 3M12 14v4M8 21h8M10 18h4"/>',
  task: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 9l2 2 3-3M8 16h8"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>', micoff: '<path d="M3 3l18 18"/><path d="M9 9v2a3 3 0 005 2M15 10V6a3 3 0 00-5.7-1.3M5 11a7 7 0 0011 5.7M12 18v3"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  vote: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M8 9V5l4 3 4-3v4M9 14l2 2 4-4"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  skull: '<path d="M12 3a8 8 0 00-5 14v3h10v-3a8 8 0 00-5-14z"/><circle cx="9" cy="11.5" r="1.6"/><circle cx="15" cy="11.5" r="1.6"/>', heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 018-2.7A4.5 4.5 0 0120 9c0 6-8 11-8 11z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>', qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  bell: '<path d="M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4"/>', flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M8 5v14M16 5v14"/>', reset: '<path d="M4 12a8 8 0 108-8H7M7 1L4 4l3 3"/>', crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', wifi: '<path d="M2 9a15 15 0 0120 0M5 12.5a10.5 10.5 0 0114 0M8.5 16a5.5 5.5 0 017 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>',
  wifioff: '<path d="M3 3l18 18M2 9a15 15 0 015-3M10 5.2A15 15 0 0122 9M5 12.5a10 10 0 013-2M12 10a10 10 0 017 2.5M8.5 16a5.5 5.5 0 013-1.6"/>', out: '<path d="M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5M15 8l4 4-4 4M19 12H9"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', chev: '<path d="M15 5l-7 7 7 7"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  mask: '<path d="M3 8c3-2 6-2 9-1 3-1 6-1 9 1 0 6-3 10-9 10S3 14 3 8z"/><circle cx="8.5" cy="10.5" r="1.4"/><circle cx="15.5" cy="10.5" r="1.4"/>', med: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  vib: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M4 8v8M20 8v8"/>', sound: '<path d="M4 9v6h4l5 4V5L8 9zM17 8a5 5 0 010 8"/>', globe2: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  door: '<path d="M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17M4 21h16M14 12h.01"/>', send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>', gift: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9C9 9 7 7 8.5 5.5S12 6 12 9c0-3 2-4.5 3.5-3S15 9 12 9z"/>',
};
export const ic = (name, cls = '') => raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`);

const COLORS = [['#2478E8', '#6b3fd6'], ['#D9233C', '#7a1226'], ['#21A875', '#0e5e44'], ['#A45BE7', '#4a2380'], ['#E8AE42', '#8a5a0a']];
export function avatar(u, size = '', extra = '') {
  const name = u?.name || '?'; const c = COLORS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length];
  const inner = u?.avatar ? h('img', { src: u.avatar, alt: '', loading: 'lazy' })
    : h('div', { class: 'txt', style: { '--c1': c[0], '--c2': c[1] } }, [...name][0]);
  return h('div', { class: `avatar ${size} ${u?.frame && u.frame !== 'none' ? 'f-' + u.frame : ''} ${extra}` }, inner, u && 'online' in u ? h('i', { class: 'badge ' + (u.online ? 'on' : '') }) : null);
}

// ---- Toast / Sheet / Confirm ----
const layer = () => document.getElementById('layer');
export function toast(msg, kind = '', onclick) {
  const el = h('div', { class: `toast ${kind} ${onclick ? 'act' : ''}`, onclick: () => { onclick?.(); el.remove(); } }, msg);
  layer().append(el); setTimeout(() => el.remove(), 3300);
}
export function sheet(build, { onClose } = {}) {
  const close = () => { scrim.remove(); onClose?.(); };
  const body = h('div', { class: 'sheet' }, h('div', { class: 'grab' }));
  const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) close(); } }, body);
  layer().append(scrim);
  const api = { close, body, set(...kids) { body.replaceChildren(h('div', { class: 'grab' }), ...kids); } };
  api.set(...[].concat(build(api)));
  return api;
}
export const confirmBox = (title, msg, okLabel, { danger = true } = {}) => new Promise((res) => {
  // الوعد يُحلّ أول مرة فقط؛ لذا نحلّه بـ true قبل الإغلاق (الإغلاق يستدعي onClose ⇒ false)
  sheet((a) => [h('h2', {}, title), msg && h('p', { class: 'dim' }, msg),
    h('div', { class: 'row' }, h('button', { class: `btn grow ${danger ? 'primary' : 'blue'}`, onclick: () => { res(true); a.close(); } }, okLabel || t('ok')),
      h('button', { class: 'btn grow', onclick: () => { res(false); a.close(); } }, t('cancel')))], { onClose: () => res(false) });
});
export const fmtTime = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export async function copyText(text) { try { await navigator.clipboard.writeText(text); toast(t('copied'), 'ok'); } catch { prompt(t('copy_manual'), text); } }
