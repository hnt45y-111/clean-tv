// أدوات DOM والمكوّنات المشتركة بالهوية
export const h = (tag, props, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(c)); };
  kids.forEach(add);
  return el;
};
export const $ = (s, r = document) => r.querySelector(s);

// أرقام شرقية للمريض (١٢٣). الباركود والجرعات بالملغرام تبقى لاتينية.
const EAST = '٠١٢٣٤٥٦٧٨٩';
export const n = (x) => String(x ?? '').replace(/\d/g, (d) => EAST[d]);
// يحوّل التواريخ ISO إلى ٢١/١١ ويكتب الأرقام شرقية خارج الكلمات اللاتينية (٥٠٠mg تبقى 500mg)
export const nice = (s) => String(s ?? '').replace(/\d{4}-(\d{2})-(\d{2})/g, '$2/$1').replace(/(?<![A-Za-z\d.])\d+(?![A-Za-z])/g, (m) => n(m));
export const latin = (s) => h('span', { class: 'latin' }, s);
export const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const dayName = (d) => DAYS[new Date(d + 'T00:00:00Z').getUTCDay()];
export const fmtDate = (d) => `${dayName(d)} ${n(d.slice(8))}/${n(d.slice(5, 7))}`;
export const fmtDateFull = (d) => `${dayName(d)} ${n(d.slice(8))}/${n(d.slice(5, 7))}/${n(d.slice(0, 4))}`;
export const fmtTime = (t) => { if (!t) return ''; let [hh, mm] = t.split(':').map(Number); const p = hh >= 12 ? 'م' : 'ص'; hh = hh % 12 || 12; return `${n(hh)}:${n(String(mm).padStart(2, '0'))} ${p}`; };
export const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'هسه'; if (m < 60) return `قبل ${n(m)} د`; const hh = Math.round(m / 60); if (hh < 24) return `قبل ${n(hh)} س`; return fmtDate(new Date(ms + 3 * 3600e3).toISOString().slice(0, 10)); };
export const iqd = (x) => n(Number(x || 0).toLocaleString('en')) + ' د.ع';
export const initials = (name) => { const w = String(name).replace(/^د\.?\s*/, '').trim().split(/\s+/); return (w[0]?.[0] || '') ; };

// ---------- الأيقونات: خط ٢ بكسل على شبكة ٢٤، نهايات مستقيمة، مسمار واحد على الأقل ----------
const N = (d) => `<path d="${d}" fill="currentColor" stroke="none"/>`; // المسمار
const ICONS = {
  home: `<path d="M3 11 12 3l9 8M5 9.500V21h14V9.500"/>${N('M10 21v-6h4v6z')}`,
  cal: `<path d="M4 5h16v16H4zM4 10h16M8 3v4M16 3v4"/>${N('M10 13h4l-1.300 2 -.4 3h-.6l-.4-3z')}`,
  forum: `<path d="M4 4h16v12H10l-4 4v-4H4z"/>${N('M9 7h6l-1.500 2-.3 3h-.4l-.3-3z')}`,
  user: `<path d="M5 21v-3c0-3 3-5 7-5s7 2 7 5v3"/><path d="M8 7c0-3 2-5 4-5s4 2 4 5-2 5-4 5-4-2-4-5z"/>${N('M11 15h2l-.5 3h-1z')}`,
  doctor: `<path d="M5 21V10c0-4 3-7 7-9 4 2 7 5 7 9v11M3 21h18"/>${N('M10 8h4l-1 1.500-.3 4h-1.400l-.3-4z')}`,
  pharm: `<path d="M5 8h14v13H5zM8 4h8v4H8z"/>${N('M10.500 11h3l-1 2-.2 4h-.6l-.2-4z')}`,
  pill: `<path d="M8 3a5 5 0 0 1 7 0l6 6a5 5 0 0 1-7 7l-6-6a5 5 0 0 1 0-7zM9 9l6 6"/>${N('M4 18l3 3-2 1z')}`,
  lab: `<path d="M9 3h6M10 3v7l-5 9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2l-5-9V3M8 15h8"/>${N('M11 17h2l-.5 2h-1z')}`,
  file: `<path d="M5 3h10l4 4v14H5zM15 3v4h4"/>${N('M10 11h4l-1 1.500-.3 4h-1.400l-.3-4z')}`,
  bell: `<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>${N('M11 6h2l-.4 2h-1.200z')}`,
  mic: `<path d="M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v3"/>${N('M11 6h2l-.5 3h-1z')}`,
  star: `<path d="M12 2l3 7 7 .6-5.300 4.700L18.300 22 12 18l-6.300 4 1.600-7.700L2 9.600 9 9z"/>`,
  chat: `<path d="M3 5h18v11H13l-4 4v-4H3z"/>${N('M11 8h2l-.4 3h-1.200z')}`,
  qr: `<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 14v7h-2M14 20h3"/>${N('M5.500 5h2l-.5 3h-1z')}`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  back: `<path d="M20 12H5"/>${N('M4 12l6-5v10z')}`,
  clock: `<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/>${N('M11 6h2l-.3 6 3 2-.7 1-4-2.500z')}`,
  pin: `<path d="M12 21c-5-5-7-8-7-11a7 7 0 0 1 14 0c0 3-2 6-7 11z"/>${N('M10.500 7h3l-1.200 2-.3 3h-.0l-.3-3z')}`,
  phone: `<path d="M5 3h4l2 5-2.500 1.500a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>`,
  gift: `<path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9C9 9 7 7 8.500 5.500S12 6 12 9c0-3 2-4.500 3.500-3S15 9 12 9z"/>`,
  heart: `<path d="M12 21C5 15 3 12 3 8.500A4.500 4.500 0 0 1 12 7a4.500 4.500 0 0 1 9 1.500C21 12 19 15 12 21z"/>${N('M11 9h2l-.4 3h-1.200z')}`,
  book: `<path d="M4 4h7v16H4zM13 4h7v16h-7z"/>${N('M6.500 8h2l-.5 3h-1z')}`,
  cam: `<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><path d="M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>`,
  check: `<path d="M4 12l5 5 11-11"/>`,
  x: `<path d="M5 5l14 14M19 5L5 19"/>`,
  send: `<path d="M21 3L3 11l7 3 3 7z"/>`,
  print: `<path d="M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>${N('M16 11h2v1h-2z')}`,
  edit: `<path d="M4 20l1-5L16 4l4 4L9 19z"/>`,
  logout: `<path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H8"/>`,
  shield: `<path d="M12 2l8 3v6c0 5-3 9-8 11-5-2-8-6-8-11V5z"/>${N('M11 8h2l-.4 3h-1.200z')}`,
  share: `<path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.500 10.500l7-3.500M8.500 13.500l7 3.500"/>`,
  list: `<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>`,
};
export const icon = (name, size = 24) => h('span', { html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" aria-hidden="true">${ICONS[name] || ''}</svg>`, style: 'display:inline-flex' });

export const nail = (cls = '') => h('i', { class: 'nail ' + cls });

// ختم «طبيب موثّق»: دائرة بثمانية مسامير
export const seal = (size = 20) => {
  const nails = Array.from({ length: 8 }, (_, i) => `<path d="M-1.800 -9.500H1.800L1 -6.500 .6 -4.500H-.6L-1 -6.500Z" fill="#F1E8D8" transform="rotate(${i * 45})"/>`).join('');
  return h('span', { class: 'seal', title: 'طبيب موثّق', html: `<svg width="${size}" height="${size}" viewBox="-12 -12 24 24"><circle r="11.500" fill="#1B3A7A"/><circle r="10.500" fill="none" stroke="#C9A063" stroke-width=".8"/>${nails}<circle r="2.600" fill="#C9A063"/></svg>` });
};

export const arch = (name, w = 56, tone = '') => h('span', { class: 'arch-wrap' }, h('span', { class: 'arch ' + tone, style: `--w:${w}px` }, initials(name)));

export const stars = (avg, count) => h('span', { class: 'row', style: 'gap:6px;display:inline-flex' },
  h('span', { class: 'stars' }, [1, 2, 3, 4, 5].map((i) => h('i', { class: 'st' + (avg >= i - 0.25 ? ' on' : '') }))),
  count != null ? h('span', { class: 'small muted' }, count ? `${n(avg)} (${n(count)})` : 'بلا تقييم') : null);

export const empty = (title, text) => h('div', { class: 'empty' }, h('b', {}, title), text);

// ---------- الإشعارات والنوافذ ----------
export function toast(msg, isErr = false) {
  const t = h('div', { class: 'toast' + (isErr ? ' err' : ''), role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), isErr ? 4200 : 2800);
}
export function modal(build) {
  const bg = h('div', { class: 'modal-bg', onClick: (e) => e.target === bg && close() });
  const box = h('div', { class: 'modal', role: 'dialog' });
  const close = () => bg.remove();
  box.append(...[].concat(build(close)));
  bg.append(box); document.body.append(bg);
  return close;
}
export function confirmBox(title, text, okLabel = 'تأكيد', tone = '') {
  return new Promise((res) => modal((close) => [
    h('h3', {}, title), h('p', { class: 'muted' }, text),
    h('div', { class: 'row', style: 'margin-top:16px' },
      h('button', { class: 'btn block ' + tone, onClick: () => { close(); res(true); } }, okLabel),
      h('button', { class: 'btn ghost block', onClick: () => { close(); res(false); } }, 'لا')),
  ]));
}
export const spinner = () => h('div', { class: 'empty' }, 'لحظة…');
export const field = (label, input, hint) => h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('div', { class: 'hint' }, hint) : null);
export const opts = (list, sel, ph) => [ph != null ? h('option', { value: '' }, ph) : null, ...list.map((x) => h('option', { value: x.value ?? x, selected: (x.value ?? x) === sel }, x.label ?? x))];
