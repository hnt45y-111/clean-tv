import { $, $$, esc, call, run, toast, modal, icon, actions } from './util.js';
import { S, refreshState, refreshDevices, applyGeneral, emit } from './state.js';
import { printerArt } from './art.js';

const ROUTES = [
  ['scan', 'الرئيسية — السكانر', 'scan', () => import('./views/scan.js')],
  ['ocr', 'التعرف الذكي على الملفات', 'ocr', () => import('./views/ocr.js')],
  ['ids', 'سكانر الهويات والباجات', 'id', () => import('./views/ids.js')],
  ['print', 'مركز الطباعة', 'printer', () => import('./views/print.js')],
  ['printers', 'إدارة الطابعات', 'doc', () => import('./views/printers.js')],
  ['pdf', 'أدوات PDF', 'pdf', () => import('./views/pdftools.js')],
  ['archive', 'الأرشيف', 'archive', () => import('./views/archive.js')],
  ['settings', 'الإعدادات', 'gear', () => import('./views/settings.js')],
];
let current = null, cleanup = null;

function buildNav() {
  $('#nav').innerHTML = `<div class="brand"><svg width="38" height="38" viewBox="0 0 64 64"><rect x="3" y="3" width="58" height="58" rx="14" fill="#1b46c9" stroke="#000" stroke-width="4"/><path d="M16 38h32v10H16zM20 38l4-16h16l4 16" fill="#9fe9ff" stroke="#000" stroke-width="3" stroke-linejoin="round"/><circle cx="22" cy="43" r="2" fill="#22c55e"/></svg><div><b>Print Studio</b><small>مركز الطباعة والسكانر</small></div></div>`
    + ROUTES.map(([id, label, ic]) => `<button class="nav-i" data-r="${id}" title="${esc(label)}">${icon(ic)}<span>${esc(label.replace('الرئيسية — ', ''))}</span></button>`).join('')
    + `<div class="nav-sp"></div><div class="nav-i" id="nav-dev" style="cursor:default;font-size:12px;flex-direction:column;align-items:flex-start;gap:5px"></div>`;
  $$('#nav .nav-i[data-r]').forEach((b) => (b.onclick = () => go(b.dataset.r)));
}
function navStatus() {
  const el = $('#nav-dev'); if (!el) return;
  const pr = S.settings.printer.name, sc = S.settings.scanner.name;
  const pOk = S.printers && !S.printers.error ? S.printers.selectedAvailable : null, sOk = S.scanners && !S.scanners.error ? S.scanners.selectedAvailable : null;
  const dot = (ok) => `<span class="stat-dot ${ok === null ? 'warn' : ok ? 'ok' : 'bad'}"></span>`;
  el.innerHTML = `<div>${dot(sc ? sOk : false)} ${esc(sc || 'لا يوجد سكانر محدد')}</div><div>${dot(pr ? pOk : false)} ${esc(pr || 'لا توجد طابعة')}</div>`;
}

export async function go(id) {
  const r = ROUTES.find((x) => x[0] === id) || ROUTES[0];
  if (current === r[0] && location.hash === '#' + r[0]) return;
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  current = r[0]; location.hash = r[0];
  $$('#nav .nav-i[data-r]').forEach((b) => b.classList.toggle('on', b.dataset.r === r[0]));
  const old = $('#view'); const view = old.cloneNode(false); old.replaceWith(view); view.className = r[0] === 'scan' ? 'dash' : ''; view.style.animation = 'none'; void view.offsetWidth; view.style.animation = ''; view.innerHTML = '';
  try { const mod = await r[3](); cleanup = (await mod.mount(view)) || null; } catch (e) { console.error(e); view.innerHTML = `<div class="card empty">تعذّر فتح الصفحة: ${esc(e.message)}</div>`; }
}

/** شاشة الإقلاع الأول: كشف الطابعات المثبّتة واختيار واحدة */
export async function printerWizard({ first = true } = {}) {
  const m = modal(`<h2>🖨️ ${first ? 'مرحباً بك في Print Studio' : 'اختيار الطابعة'}</h2>
    <p class="sub">${first ? 'تم فحص الطابعات المثبّتة في Windows. اختر الطابعة التي تريد استخدامها، وسيتذكّرها البرنامج في المرات القادمة.' : 'اختر طابعة من الطابعات المثبّتة.'}</p>
    <div id="w-list" class="col" style="max-height:48vh;overflow:auto"><div class="progress ind"><i></i></div></div>
    <div class="foot"><button class="btn" id="w-add" disabled>إضافة الطابعة</button><button class="btn ghost" id="w-ref">${icon('refresh')} إعادة الفحص</button><button class="btn ghost" id="w-skip">${first ? 'تخطي الآن' : 'إغلاق'}</button></div>`, { cls: 'wiz', dismissible: !first });
  let sel = null, list = [];
  const draw = (err) => {
    const box = $('#w-list', m);
    if (err) { box.innerHTML = `<div class="card empty"><p>${esc(err)}</p><p class="sub">اختيار الطابعات يعمل على Windows فقط، ويمكنك المتابعة وتحديدها لاحقاً من الإعدادات.</p></div>`; return; }
    if (!list.length) { box.innerHTML = `<div class="card empty">لا توجد طابعات مثبّتة في Windows. ثبّت تعريف الطابعة ثم اضغط «إعادة الفحص».</div>`; return; }
    box.innerHTML = list.map((p, i) => `<div class="printer-i ${sel === p.name ? 'on' : ''}" data-i="${i}" tabindex="0" role="button">${printerArt}<div class="grow"><b>${esc(p.name)}</b><div class="sub" style="font-size:12px">${esc(p.driver || '—')} · ${esc(p.port || '')}</div></div>
      <div class="col" style="align-items:flex-end;gap:4px"><span class="pill ${p.state === 'ready' || p.state === 'busy' ? 'ok' : p.state === 'offline' ? 'bad' : 'warn'}">${esc(p.statusText)}</span>${p.isDefault ? '<span class="pill">افتراضية في Windows</span>' : ''}</div></div>`).join('');
    $$('.printer-i', box).forEach((el) => { const pick = () => { sel = list[+el.dataset.i].name; $('#w-add', m).disabled = false; draw(); }; el.onclick = pick; el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') pick(); }; });
  };
  const load = async () => { try { const r = await call('printers'); list = r.list; if (!sel) { const d = list.find((p) => p.name === S.settings.printer.name) || list.find((p) => p.isDefault); if (d) { sel = d.name; $('#w-add', m).disabled = false; } } draw(); } catch (e) { draw(e.message); } };
  $('#w-ref', m).onclick = load; $('#w-skip', m).onclick = () => { m.close(); };
  $('#w-add', m).onclick = (ev) => run(ev.currentTarget, async () => { await call('printerSelect', sel); await refreshState(); await refreshDevices(); m.close(); toast('تمت إضافة الطابعة: ' + sel, 'ok'); navStatus(); emit(); });
  await load(); return m;
}

async function boot() {
  buildNav(); await refreshState(); applyGeneral();
  S.listeners.add(navStatus); navStatus();
  const first = S.firstRun;
  go((location.hash || '#scan').slice(1));
  refreshDevices().then(() => {
    navStatus();
    if (!first && S.settings.printer.name && S.printers && !S.printers.error && !S.printers.selectedAvailable) toast(`الطابعة «${S.settings.printer.name}» غير متاحة حالياً`, 'warn', [{ label: 'اختيار طابعة أخرى', fn: () => printerWizard({ first: false }) }]);
    if (S.settings.scanner.id && S.scanners && !S.scanners.error && !S.scanners.selectedAvailable) toast(`السكانر «${S.settings.scanner.name || 'المحدد'}» غير متصل — تحقق من الكابل والتشغيل`, 'warn');
  });
  if (first) printerWizard({ first: true });
  window.addEventListener('hashchange', () => go(location.hash.slice(1)));
}
boot().catch((e) => { document.body.innerHTML = `<pre style="padding:30px;color:#fff;direction:ltr">${esc(e.stack || e)}</pre>`; });
