// أدوات مشتركة للواجهة: بناء DOM آمن، إشعارات، نوافذ، أيقونات.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' ميجابايت' : Math.max(1, Math.round(n / 1024)) + ' كيلوبايت');
export const fmtDate = (t) => new Date(t).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' });
export const b64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const fileUrl = (p, v = '') => (window.PS_URL_BASE || 'psfile://f/') + b64url(p) + (v !== '' ? '?v=' + v : '');
export const call = (name, ...a) => window.ps.call(name, ...a);

/** استدعاء مع إشعار خطأ تلقائي وزر في حالة انشغال */
export async function run(btn, fn, { okMsg } = {}) {
  if (btn) { if (btn.classList.contains('busy')) return; btn.classList.add('busy'); }
  try { const r = await fn(); if (okMsg) toast(okMsg, 'ok'); return r; }
  catch (e) { toast(e.message || String(e), 'err'); return undefined; }
  finally { if (btn) btn.classList.remove('busy'); }
}

export function toast(msg, kind = 'ok', actions = []) {
  const root = $('#toasts'); const t = document.createElement('div'); t.className = 'toast ' + kind; t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  const ic = { ok: '✔', err: '✖', warn: '⚠' }[kind] || 'ℹ';
  t.innerHTML = `<span class="ic">${ic}</span><div class="grow"><div>${esc(msg)}</div><div class="acts"></div></div><button class="x" aria-label="إغلاق">×</button>`;
  const acts = $('.acts', t);
  for (const a of actions) { const b = document.createElement('button'); b.className = 'btn sm ghost'; b.textContent = a.label; b.onclick = () => { a.fn(); close(); }; acts.append(b); }
  const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  $('.x', t).onclick = close; root.append(t); if (!actions.length || kind === 'ok') setTimeout(close, kind === 'err' ? 9000 : actions.length ? 12000 : 4500);
  while (root.children.length > 5) root.firstChild.remove();
}

export function modal(html, { wide = false, cls = '', dismissible = true } = {}) {
  const root = $('#modal-root'); const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape' && dismissible) close(); };
  document.addEventListener('keydown', onKey); if (dismissible) ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  root.append(ov); const el = $('.modal', ov); el.close = close; return el;
}
export function confirmBox(msg, okLabel = 'تأكيد', danger = false) {
  return new Promise((res) => {
    const m = modal(`<h2>تأكيد</h2><p>${esc(msg)}</p><div class="foot"><button class="btn ${danger ? 'red' : ''}" data-ok>${esc(okLabel)}</button><button class="btn ghost" data-no>إلغاء</button></div>`);
    $('[data-ok]', m).onclick = () => { m.close(); res(true); }; $('[data-no]', m).onclick = () => { m.close(); res(false); };
  });
}
export function loading(msg) {
  const m = modal(`<h2>${esc(msg)}</h2><div class="progress ind"><i></i></div><p class="sub" data-p style="margin-top:12px"></p>`, { dismissible: false });
  return { set: (t) => { $('[data-p]', m).textContent = t; }, setPct: (p) => { const pr = $('.progress', m); pr.classList.remove('ind'); $('i', pr).style.width = p + '%'; }, close: () => m.close() };
}
/** مساعد بناء عناصر */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
/** تفويض أحداث: data-act="name" */
export function actions(root, map) {
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b || !root.contains(b)) return; const fn = map[b.dataset.act]; if (fn) fn(b, e); });
}

const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const ICON = {
  scan: I('<path d="M3 14h18v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M5 14l2-7h10l2 7"/><path d="M7 17h.01M10 17h7"/>'),
  printer: I('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  doc: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
  ocr: I('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9h8M8 12h8M8 15h5"/>'),
  id: I('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 16c.6-1.6 2-2.4 3.5-2.4s2.9.8 3.5 2.4M14 9.5h4M14 12.5h4"/>'),
  pdf: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8 17v-4h1.5a1.2 1.2 0 0 1 0 2.4H8M12.5 17v-4h1a2 2 0 0 1 0 4zM17 17v-4h-1.5"/>'),
  archive: I('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'), trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  rot: I('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'), crop: I('<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>'),
  save: I('<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'), x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  eye: I('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  word: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8 12l1.5 5L12 12l2.5 5L16 12"/>'),
  excel: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 12l5 6M14 12l-5 6"/>'),
  txt: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>'),
  img: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>'),
  merge: I('<path d="M6 3v6a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v4M6 21v-4M18 3v4"/>'), split: I('<path d="M12 3v18M5 8l-3 4 3 4M19 8l3 4-3 4"/>'),
  compress: I('<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>'), water: I('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  hash: I('<path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18"/>'), reorder: I('<path d="M8 4v16M8 4L4 8M8 4l4 4M16 20V4M16 20l-4-4M16 20l4-4"/>'),
  refresh: I('<path d="M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4"/>'), up: I('<path d="M12 19V5M5 12l7-7 7 7"/>'), down: I('<path d="M12 5v14M5 12l7 7 7-7"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>'), wand: I('<path d="M4 20L16 8M14 6l1-3 1 3 3 1-3 1-1 3-1-3-3-1zM19 14l.6 1.4L21 16l-1.4.6L19 18l-.6-1.4L17 16l1.4-.6z"/>'),
  home: I('<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>'), table: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>'),
  open: I('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
};
export const icon = (n) => ICON[n] || '';
