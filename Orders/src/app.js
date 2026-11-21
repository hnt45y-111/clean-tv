'use strict';
/* الأوامر الإدارية — تخزين محلي (IndexedDB) + استيراد Excel + اضبارات PDF/صور */
const $ = s => document.querySelector(s);
const FIELDS = ['name','kind','position','command','brigade','battalion','bookDate','bookNo','bookType','fileNo','notes'];
const KIND = { assign: 'تكليف', end: 'إنهاء تكليف' };
const PAGE = 150;

/* ---------- نصوص وأرقام ---------- */
const latin = s => String(s).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
const nk = s => latin(s ?? '').toLowerCase()
  .replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const fileKey = s => { const t = latin(s ?? '').trim(); const m = /^0*(\d+)$/.exec(t); return m ? (m[1] || '0') : t.toLowerCase(); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = (y, m, d) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function parseDate(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  const t = latin(v).trim(); let m;
  if ((m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(t))) return iso(m[1], m[2], m[3]);
  if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(t))) return iso(m[3], m[2], m[1]);
  return t;
}
const fmtDate = s => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || ''); };
const cellStr = v => v == null ? '' : typeof v === 'number' ? String(v) : String(v).trim();

/* ---------- قاعدة البيانات ---------- */
let db;
const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = t => new Promise((res, rej) => { t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error); });
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('orders-db', 2);
    r.onupgradeneeded = e => {
      if (e.oldVersion < 1) {
        r.result.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
        r.result.createObjectStore('files', { keyPath: 'id', autoIncrement: true }).createIndex('num', 'num');
      }
      if (e.oldVersion < 2) r.result.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const dbAll = st => rq(db.transaction(st).objectStore(st).getAll());
const dbGet = (st, id) => rq(db.transaction(st).objectStore(st).get(id));
async function dbPutMany(st, arr) { const t = db.transaction(st, 'readwrite'); const s = t.objectStore(st); const ids = arr.map(o => s.put(o)); await done(t); return ids.map(r => r.result); }
async function dbDel(st, id) { const t = db.transaction(st, 'readwrite'); t.objectStore(st).delete(id); await done(t); }
async function dbClear(st) { const t = db.transaction(st, 'readwrite'); t.objectStore(st).clear(); await done(t); }

/* ---------- الحالة ---------- */
let orders = [], filesIdx = new Map(), allFiles = new Map(), shown = PAGE;
const DATA = 'الأوامر.json', FS = 'showDirectoryPicker' in window;
let dir = null, folderMode = false, needPerm = false, scanned = false, nextId = 1;
const addIdx = (num, m) => { if (!filesIdx.has(num)) filesIdx.set(num, []); filesIdx.get(num).push(m); };
async function readData() {
  try { const j = JSON.parse(await (await (await dir.getFileHandle(DATA)).getFile()).text()); orders = j.orders || []; nextId = Math.max(j.nextId || 1, ...orders.map(o => o.id + 1), 1); }
  catch (e) { if (e.name !== 'NotFoundError') throw e; orders = []; nextId = 1; }
}
async function writeData() {
  const w = await (await dir.getFileHandle(DATA, { create: true })).createWritable();
  await w.write(JSON.stringify({ v: 1, nextId, orders })); await w.close();
}
async function scan(d, depth = 0) {
  for await (const [n, h] of d.entries()) {
    if (h.kind === 'directory') { if (depth < 2) await scan(h, depth + 1); }
    else if (FEXT.test(n)) { const m = { name: n, handle: h }; allFiles.set(n, m); const num = fileKey(n.replace(/\.[^.]+$/, '')); if (/^\d+$/.test(num)) addIdx(num, m); }
  }
}
async function load(rescan = false) {
  if (folderMode) {
    orders = []; if (needPerm) { filesIdx = new Map(); allFiles = new Map(); }
    else {
      await readData();
      if (rescan || !scanned) { filesIdx = new Map(); allFiles = new Map(); await scan(dir); scanned = true; }
    }
  } else {
    orders = await dbAll('orders'); filesIdx = new Map(); allFiles = new Map();
    for (const f of await dbAll('files')) { const m = { id: f.id, name: f.name }; allFiles.set(f.id, m); if (f.num) addIdx(f.num, m); }
  }
  render(); banner();
}
async function putOrders(arr) {
  if (!folderMode) return dbPutMany('orders', arr);
  for (const o of arr) { if (o.id == null) o.id = nextId++; const i = orders.findIndex(x => x.id === o.id); if (i < 0) orders.push(o); else orders[i] = o; }
  await writeData();
}
async function delOrder(id) { if (!folderMode) return dbDel('orders', id); orders = orders.filter(o => o.id !== id); await writeData(); }
async function clearOrders() { if (!folderMode) return dbClear('orders'); orders = []; await writeData(); }
const permOK = async () => (await dir.queryPermission({ mode: 'readwrite' })) === 'granted' || (await dir.requestPermission({ mode: 'readwrite' })) === 'granted';
function banner() {
  const b = $('#banner'), t = $('#bText'), a = $('#bAct'), a2 = $('#bAct2'); a2.hidden = true; b.hidden = false; b.className = 'banner';
  if (folderMode && needPerm) { b.classList.add('warn'); t.textContent = `⚠ المجلد «${dir.name}» يحتاج إذنك من جديد حتى تظهر بياناتك.`; a.textContent = 'إعادة ربط المجلد'; a.onclick = relink; }
  else if (folderMode) { t.innerHTML = `📁 البيانات والاضبارات محفوظة في المجلد: <b>${esc(dir.name)}</b>`; a.textContent = 'تحديث الاضبارات'; a.onclick = async () => { await load(true); toast('تم تحديث الاضبارات'); }; }
  else if (FS) { t.textContent = 'البيانات محفوظة على هذا الجهاز فقط. اربط مجلداً ليحفظ فيه الأوامر ويقرأ منه الاضبارات.'; a.textContent = '📁 ربط مجلد'; a.onclick = linkFolder; }
  else { t.textContent = 'هذا المتصفح لا يدعم ربط المجلد (يدعمه Chrome/Edge على اللابتوب). البيانات محفوظة على هذا الجهاز.'; a.hidden = true; return; }
  a.hidden = false;
}
async function relink() { try { if (await permOK()) { needPerm = false; await load(true); } } catch (e) { toast('تعذّر الإذن: ' + e.message); } }
async function linkFolder() {
  let h; try { h = await showDirectoryPicker({ mode: 'readwrite', id: 'orders' }); } catch (e) { return; }
  const local = await dbAll('orders');
  dir = h; folderMode = true; needPerm = false; scanned = false;
  await dbPutMany('meta', [{ key: 'dir', handle: h }]);
  await load(true);
  if (local.length && confirm(`دمج ${local.length} أمر محفوظ على هذا الجهاز مع المجلد؟`)) {
    const seen = new Set(orders.map(dupKey)); const add = [];
    for (const { id, ...o } of local) { const k = dupKey(o); if (!seen.has(k)) { seen.add(k); add.push(o); } }
    await putOrders(add); await load();
  }
  toast(`تم ربط المجلد «${h.name}»`);
}
async function unlinkFolder() {
  if (!confirm('فك الربط؟ ملفات المجلد تبقى كما هي، والتطبيق يرجع لبيانات هذا الجهاز.')) return;
  const t = db.transaction('meta', 'readwrite'); t.objectStore('meta').delete('dir'); await done(t);
  dir = null; folderMode = false; needPerm = false; scanned = false; await load(); filesDialog();
}
function dossierList(o) {
  const d = o.dossier, m = d && (folderMode ? allFiles.get(d.name) : allFiles.get(d.id));
  if (m) return [m];
  return (o.fileNo && filesIdx.get(fileKey(o.fileNo))) || [];
}
const hasFile = o => dossierList(o).length > 0;
const dossCell = o => hasFile(o)
  ? `<div class="dcell"><button class="doss has" data-open title="فتح الاضبارة">${esc(o.fileNo || 'فتح')}</button><button class="ic" data-pick title="تغيير ملف الاضبارة" aria-label="تغيير ملف الاضبارة">✎</button></div>`
  : `<div class="dcell">${o.fileNo ? `<button class="doss no" data-open title="لا يوجد ملف">${esc(o.fileNo)}</button>` : ''}<button class="btn sm" data-pick>اختيار ملف</button></div>`;

/* ---------- العرض ---------- */
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 3500); }
function filtered() {
  const q = nk($('#q').value), k = $('#fk').value;
  return orders.filter(o => (!k || o.kind === k) && (!q || nk(FIELDS.map(f => f === 'kind' ? KIND[o.kind] : f === 'bookDate' ? fmtDate(o.bookDate) : o[f]).join(' ')).includes(q)))
    .sort((a, b) => (b.bookDate || '').localeCompare(a.bookDate || '') || b.id - a.id);
}
function render() {
  const list = filtered(), vis = list.slice(0, shown);
  $('#rows').innerHTML = vis.map(o => `<tr data-id="${o.id}">
    <td data-l=""><span class="nm">${esc(o.name)}</span></td><td class="k" data-l=""><span class="badge ${o.kind}">${KIND[o.kind]}</span></td>
    ${[['المنصب', 'position'], ['القيادة', 'command'], ['اللواء', 'brigade'], ['الفوج', 'battalion']].map(([l, f]) => `<td class="v${o[f] ? '' : ' e'}" data-l="${l}">${esc(o[f])}</td>`).join('')}
    <td class="v${o.bookDate ? '' : ' e'}" data-l="تاريخ الكتاب">${esc(fmtDate(o.bookDate))}</td>
    <td class="v${o.bookNo ? '' : ' e'}" data-l="رقم الكتاب">${esc(o.bookNo)}</td>
    <td class="v${o.bookType ? '' : ' e'}" data-l="نوع الكتاب">${esc(o.bookType)}</td>
    <td class="v" data-l="الاضبارة">${dossCell(o)}</td>
    <td class="v${o.notes ? '' : ' e'}" data-l="الملاحظات">${esc(o.notes)}</td>
    <td data-l=""><div class="acts"><button class="btn sm" data-edit>تعديل</button><button class="btn sm bad" data-del>حذف</button></div></td></tr>`).join('');
  const n = orders.length, ne = orders.filter(o => o.kind === 'end').length;
  $('#stats').innerHTML = `<span>الكل: <b>${n}</b></span><span>تكليف: <b>${n - ne}</b></span><span>إنهاء تكليف: <b>${ne}</b></span>${list.length !== n ? `<span>نتائج البحث: <b>${list.length}</b></span>` : ''}`;
  const em = $('#empty'); em.hidden = list.length > 0;
  em.textContent = n ? 'ما كو نتائج مطابقة.' : 'ما كو أوامر بعد. اضغط «إضافة أمر» أو «استيراد Excel».';
  $('#bMore').hidden = list.length <= shown;
  for (const f of ['position', 'command', 'brigade', 'battalion', 'bookType'])
    $('#l-' + f).innerHTML = [...new Set(orders.map(o => o[f]).filter(Boolean))].sort().map(v => `<option value="${esc(v)}">`).join('');
}
$('#q').oninput = $('#fk').onchange = () => { shown = PAGE; render(); };
$('#bMore').onclick = () => { shown += PAGE; render(); };
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) e.target.closest('dialog').close(); });
const closeSet = () => $('#dSet').close();
$('#bSet').onclick = () => $('#dSet').showModal();
$('#mFolder').onclick = () => { closeSet(); filesDialog(); };

/* ---------- إضافة / تعديل ---------- */
let editing = null, formPin = null;
const showPin = () => { $('#fDoss').textContent = formPin ? formPin.name : (editing && hasFile(editing) ? 'حسب رقم الاضبارة' : 'لم يُختَر'); $('#fUnpin').hidden = !formPin; };
function pickFor(cb) {
  const i = $('#inOne');
  i.onchange = async () => { const f = i.files[0]; i.value = ''; if (f) { try { await cb(f); } catch (e) { toast('تعذّر: ' + e.message); } } };
  i.click();
}
async function storeFile(f) {
  if (!FEXT.test(f.name)) throw new Error('الملف لازم يكون PDF أو صورة');
  if (folderMode) {
    let name = f.name;
    for (let n = 2; ; n++) {
      let ex = null; try { ex = await (await dir.getFileHandle(name)).getFile(); } catch (e) { if (e.name !== 'NotFoundError') throw e; }
      if (!ex) break; if (ex.size === f.size) { allFiles.set(name, { name, handle: await dir.getFileHandle(name) }); return { name }; }
      name = f.name.replace(/(\.[^.]+)$/, ` (${n})$1`);
    }
    const h = await dir.getFileHandle(name, { create: true }), w = await h.createWritable(); await w.write(f); await w.close();
    allFiles.set(name, { name, handle: h }); return { name };
  }
  const old = (await dbAll('files')).find(x => x.name === f.name && x.blob.size === f.size);
  if (old) return { id: old.id, name: old.name };
  const [id] = await dbPutMany('files', [{ num: '', name: f.name, type: f.type, blob: f }]); return { id, name: f.name };
}
function openForm(o) {
  editing = o || null; const f = $('#fForm');
  $('#fTitle').textContent = o ? 'تعديل' : 'إضافة'; formPin = o && o.dossier || null; showPin();
  f.reset();
  for (const k of FIELDS) { if (k === 'kind') f.kind.value = o ? o.kind : 'assign'; else f[k].value = o ? (o[k] || '') : ''; }
  $('#dForm').showModal();
}
$('#bAdd').onclick = () => openForm();
$('#fPick').onclick = () => pickFor(async f => { formPin = await storeFile(f); showPin(); toast('تم اختيار الملف — اضغط حفظ'); });
$('#fUnpin').onclick = () => { formPin = null; showPin(); };
$('#fForm').onsubmit = async e => {
  e.preventDefault(); const f = e.target;
  const o = editing ? { ...editing } : {};
  for (const k of FIELDS) o[k] = (k === 'kind' ? f.kind.value : f[k].value).trim();
  if (!o.name) return toast('اكتب اسم المكلف');
  o.fileNo = latin(o.fileNo);
  if (formPin) o.dossier = formPin; else delete o.dossier;
  await putOrders([o]); $('#dForm').close(); await load(); toast('تم الحفظ');
};
$('#rows').onclick = async e => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const o = orders.find(x => x.id === +tr.dataset.id);
  if (e.target.closest('[data-edit]')) openForm(o);
  else if (e.target.closest('[data-del]')) { if (confirm(`حذف أمر «${o.name}»؟`)) { await delOrder(o.id); await load(); toast('تم الحذف'); } }
  else if (e.target.closest('[data-pick]')) pickFor(async f => { const ref = await storeFile(f); await putOrders([{ ...o, dossier: ref }]); await load(); toast(`تم تثبيت الاضبارة لـ «${o.name}»`); });
  else if (e.target.closest('[data-open]')) openDossier(o);
};

/* ---------- استيراد Excel ---------- */
const ALIAS = {
  name: ['اسم المكلف', 'المكلف', 'الاسم'], end: ['انهاء تكليف', 'انهاء التكليف', 'انهاء'], kind: ['نوع التكليف', 'النوع', 'نوعه'],
  position: ['المنصب'], command: ['القيادة'], brigade: ['اللواء'], battalion: ['الفوج'],
  bookDate: ['تاريخ الكتاب', 'التاريخ'], bookNo: ['رقم الكتاب'], bookType: ['نوع الكتاب'],
  fileNo: ['رقم الاضبارة', 'الاضبارة', 'رقم الاضبارة'], notes: ['الملاحظات', 'ملاحظات']
};
const HMAP = new Map();
for (const [k, arr] of Object.entries(ALIAS)) for (const a of arr) { const n = nk(a); HMAP.set(n, k); HMAP.set(n.replace(/^ال/, ''), k); }
const HNAME = { name: 'اسم المكلف', end: 'انهاء تكليف', kind: 'النوع', position: 'المنصب', command: 'القيادة', brigade: 'اللواء', battalion: 'الفوج', bookDate: 'تاريخ الكتاب', bookNo: 'رقم الكتاب', bookType: 'نوع الكتاب', fileNo: 'رقم الاضبارة', notes: 'الملاحظات' };
const FALSY = new Set(['', 'لا', '0', 'false', 'no', 'n', 'x', '-']);
const dupKey = o => [o.kind, nk(o.name), nk(o.bookNo), o.bookDate].join('|');

function parseWorkbook(buf) {
  const wb = XLSX.read(buf, { type: 'array' });
  const out = { orders: [], skipped: 0, cols: new Set(), sheets: 0 };
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
    let hi = -1, cols = {};
    for (let i = 0; i < Math.min(rows.length, 15) && hi < 0; i++) {
      const c = {}; rows[i].forEach((h, j) => { const k = HMAP.get(nk(h)) || HMAP.get(nk(h).replace(/^ال/, '')); if (k && c[k] == null) c[k] = j; });
      if (c.name != null && Object.keys(c).length >= 2) { hi = i; cols = c; }
    }
    if (hi < 0) continue;
    out.sheets++; Object.keys(cols).forEach(k => out.cols.add(k));
    for (const r of rows.slice(hi + 1)) {
      const g = k => cols[k] == null ? '' : cellStr(r[cols[k]]);
      if (r.every(v => cellStr(v) === '')) continue;
      const name = g('name'); if (!name) { out.skipped++; continue; }
      let end = false;
      if (cols.end != null) { const v = nk(g('end')); end = !FALSY.has(v); if (end && v.includes('تكليف') && !v.includes('انها')) end = false; }
      if (!end && cols.kind != null) end = nk(g('kind')).includes('انها');
      out.orders.push({
        name, kind: end ? 'end' : 'assign', position: g('position'), command: g('command'), brigade: g('brigade'), battalion: g('battalion'),
        bookDate: parseDate(cols.bookDate == null ? '' : r[cols.bookDate]), bookNo: latin(g('bookNo')), bookType: g('bookType'), fileNo: latin(g('fileNo')), notes: g('notes')
      });
    }
  }
  return out;
}
let pending = [];
$('#bImp').onclick = () => $('#inXlsx').click();
$('#inXlsx').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const body = $('#impBody'); pending = []; $('#impGo').disabled = true;
  try {
    const r = parseWorkbook(await file.arrayBuffer());
    if (!r.sheets) { body.innerHTML = `<p class="err">ما لقيت صف عناوين صحيح بالملف. لازم يحتوي عمود «اسم المكلف» وعمود واحد آخر على الأقل. العناوين المدعومة:<br>${Object.values(HNAME).join(' ، ')}</p>`; }
    else {
      const seen = new Set(orders.map(dupKey)); let dup = 0;
      for (const o of r.orders) { const k = dupKey(o); if (seen.has(k)) dup++; else { seen.add(k); pending.push(o); } }
      const ne = pending.filter(o => o.kind === 'end').length;
      body.innerHTML = `<div class="sum"><p><b>${esc(file.name)}</b></p>
        <p class="ok">سيُستورد: <b>${pending.length}</b> أمر (تكليف ${pending.length - ne} ، إنهاء تكليف ${ne})</p>
        ${dup ? `<p class="warn">مكرر ومتجاوَز: ${dup}</p>` : ''}${r.skipped ? `<p class="warn">صفوف بدون اسم متجاوَزة: ${r.skipped}</p>` : ''}
        <p class="note">الأعمدة المعروفة: ${[...r.cols].map(k => HNAME[k]).join(' ، ')}</p>
        ${r.cols.has('end') ? '<p class="note">عمود «انهاء تكليف»: أي صف فيه قيمة (مثل نعم أو ✓ أو 1) يُعتبر إنهاء تكليف، والفارغ يُعتبر تكليف.</p>' : '<p class="note">ما كو عمود «انهاء تكليف» — كل الصفوف تُعتبر تكليف.</p>'}</div>
        <div class="pv"><table><thead><tr><th>الاسم</th><th>النوع</th><th>المنصب</th><th>تاريخ الكتاب</th><th>رقم الكتاب</th><th>الاضبارة</th></tr></thead><tbody>
        ${pending.slice(0, 5).map(o => `<tr><td>${esc(o.name)}</td><td>${KIND[o.kind]}</td><td>${esc(o.position)}</td><td>${esc(fmtDate(o.bookDate))}</td><td>${esc(o.bookNo)}</td><td>${esc(o.fileNo)}</td></tr>`).join('')}</tbody></table></div>`;
      $('#impGo').disabled = !pending.length;
    }
  } catch (err) { body.innerHTML = `<p class="err">تعذّر قراءة الملف: ${esc(err.message)}</p>`; }
  $('#dImp').showModal();
};
$('#impGo').onclick = async () => { const n = pending.length; await putOrders(pending); pending = []; $('#dImp').close(); await load(); toast(`تم استيراد ${n} أمر`); };

/* ---------- تصدير / نسخ احتياطي ---------- */
const stamp = () => new Date().toISOString().slice(0, 10);
function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
const HEAD = ['اسم المكلف', 'انهاء تكليف', 'المنصب', 'القيادة', 'اللواء', 'الفوج', 'تاريخ الكتاب', 'رقم الكتاب', 'نوع الكتاب', 'رقم الاضبارة', 'الملاحظات'];
function xlsxOut(rows, name) {
  const ws = XLSX.utils.aoa_to_sheet([HEAD, ...rows]); ws['!cols'] = HEAD.map(h => ({ wch: Math.max(12, h.length + 4) }));
  const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, ws, 'الأوامر');
  save(new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
}
$('#mExp').onclick = () => { closeSet(); xlsxOut(filtered().map(o => [o.name, o.kind === 'end' ? 'نعم' : '', o.position, o.command, o.brigade, o.battalion, fmtDate(o.bookDate), o.bookNo, o.bookType, o.fileNo, o.notes]), `الأوامر-${stamp()}.xlsx`); };
$('#mTpl').onclick = () => { closeSet(); xlsxOut([['مثال: أحمد علي', '', 'آمر', 'قيادة العمليات', 'اللواء 1', 'الفوج 2', '05/03/2025', '123', 'أمر إداري', '1', '']], 'نموذج-الأوامر.xlsx'); };
$('#mBak').onclick = () => { closeSet(); save(new Blob([JSON.stringify({ v: 1, orders: orders.map(({ id, ...r }) => r) })], { type: 'application/json' }), `نسخة-الأوامر-${stamp()}.json`); };
$('#mRes').onclick = () => { closeSet(); $('#inJson').click(); };
$('#inJson').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text()); if (!Array.isArray(j.orders)) throw new Error('ملف غير صالح');
    const seen = new Set(orders.map(dupKey)), add = [];
    for (const r of j.orders) { const o = {}; FIELDS.forEach(k => o[k] = String(r[k] ?? '')); if (!o.name) continue; if (o.kind !== 'end') o.kind = 'assign'; if (folderMode && r.dossier && r.dossier.name) o.dossier = { name: String(r.dossier.name) }; const k = dupKey(o); if (!seen.has(k)) { seen.add(k); add.push(o); } }
    await putOrders(add); await load(); toast(`تم استرجاع ${add.length} أمر`);
  } catch (err) { toast('تعذّر الاسترجاع: ' + err.message); }
};
$('#mClr').onclick = async () => { closeSet(); if (orders.length && confirm(`حذف كل الأوامر (${orders.length})؟ لا يمكن التراجع. (ملفات الاضبارات لا تُحذف)`)) { await clearOrders(); await load(); toast('تم الحذف'); } };

/* ---------- مجلد الاضبارات ---------- */
const FEXT = /\.(pdf|jpe?g|png|webp|gif|bmp)$/i;
function filesDialog() {
  const total = [...filesIdx.values()].reduce((a, v) => a + v.length, 0);
  const inf = total ? `ملفات الاضبارات: <b>${total}</b> (اضبارات: ${filesIdx.size})` : 'ما كو ملفات اضبارات بعد.';
  $('#fInfo').innerHTML = folderMode ? `المجلد المربوط: <b>${esc(dir.name)}</b><br>الأوامر محفوظة فيه بملف <b>${DATA}</b> (لا تحذفه)، وضع ملفات الاضبارات داخل المجلد نفسه باسم الرقم ثم اضغط «تحديث».<br>${inf}` : inf;
  $('#bLink').hidden = !FS; $('#bLink').textContent = folderMode ? 'تغيير المجلد' : '📁 ربط مجلد';
  $('#bRescan').hidden = !folderMode || needPerm; $('#bUnlink').hidden = !folderMode;
  $('#bPickDir').hidden = FS || folderMode; $('#bPickFiles').hidden = folderMode && needPerm; $('#bPickFiles').textContent = folderMode ? 'نسخ ملفات إلى المجلد' : 'اختيار ملفات';
  $('#bDelFiles').hidden = folderMode;
  const miss = orders.filter(o => !hasFile(o)).map(o => o.name + (o.fileNo ? ` (${o.fileNo})` : ''));
  $('#missing').innerHTML = miss.length ? miss.slice(0, 300).map(n => `<span>${esc(n)}</span>`).join('') : '<span class="note">لا يوجد</span>';
  $('#dFiles').showModal();
}
$('#bFiles').onclick = filesDialog;
$('#bPickDir').onclick = () => $('#inDir').click();
$('#bLink').onclick = async () => { await linkFolder(); filesDialog(); };
$('#bRescan').onclick = async () => { await load(true); filesDialog(); toast('تم التحديث'); };
$('#bUnlink').onclick = unlinkFolder;
$('#bPickFiles').onclick = () => $('#inFiles').click();
async function addFiles(list) {
  const arr = [...list].filter(f => FEXT.test(f.name)); if (!arr.length) return toast('ما لقيت PDF أو صور');
  if (folderMode) {
    let n = 0, sk = 0;
    for (const f of arr) { if (!/^\d+$/.test(fileKey(f.name.replace(/\.[^.]+$/, '')))) { sk++; continue; } const w = await (await dir.getFileHandle(f.name, { create: true })).createWritable(); await w.write(f); await w.close(); n++; }
    await load(true); filesDialog(); return toast(`تم نسخ ${n} ملف إلى المجلد${sk ? ` — تجاوزت ${sk} (الاسم لازم يكون رقم فقط)` : ''}`);
  }
  const existing = await dbAll('files'), recs = []; let skipped = 0;
  for (const f of arr) {
    const stem = f.name.replace(/\.[^.]+$/, ''), num = fileKey(stem);
    if (!/^\d+$/.test(num)) { skipped++; continue; }
    const old = existing.find(x => x.num === num && x.name.toLowerCase() === f.name.toLowerCase());
    recs.push({ ...(old ? { id: old.id } : {}), num, name: f.name, type: f.type, blob: f });
  }
  if (recs.length) await dbPutMany('files', recs);
  await load(); filesDialog();
  toast(`تمت إضافة ${recs.length} ملف${skipped ? ` — تجاوزت ${skipped} (الاسم لازم يكون رقم فقط)` : ''}`);
}
$('#inDir').onchange = e => { const l = e.target.files; addFiles(l).finally(() => e.target.value = ''); };
$('#inFiles').onchange = e => { const l = e.target.files; addFiles(l).finally(() => e.target.value = ''); };
$('#bDelFiles').onclick = async () => { if (filesIdx.size && confirm('حذف كل ملفات الاضبارات المحفوظة داخل التطبيق؟')) { await dbClear('files'); await load(); filesDialog(); } };

/* ---------- عارض الاضبارة ---------- */
let vToken = 0, vUrl = null, vPdf = null, vZoom = 1, vBlob = null;
async function openDossier(o) {
  const list = dossierList(o);
  if (!list.length) return toast(`ما كو ملف لاضبارة «${o.name}» — اضغط «اختيار ملف»`);
  $('#vTitle').textContent = `اضبارة ${o.fileNo || o.name}`;
  const tabs = $('#vTabs'); tabs.hidden = list.length < 2;
  tabs.innerHTML = list.map((f, i) => `<button class="btn sm" data-i="${i}">${esc(f.name)}</button>`).join('');
  tabs.onclick = e => { const b = e.target.closest('[data-i]'); if (b) showFile(list[+b.dataset.i]); };
  $('#dView').showModal(); showFile(list[0]);
}
async function showFile(meta) {
  const my = ++vToken, box = $('#vbody'); box.textContent = 'جارٍ الفتح…'; vZoom = 1; vPdf = null;
  vBlob = meta.handle ? await meta.handle.getFile() : (await dbGet('files', meta.id)).blob; if (my !== vToken) return; if (vUrl) URL.revokeObjectURL(vUrl); vUrl = URL.createObjectURL(vBlob);
  const dl = $('#vDl'); dl.href = vUrl; dl.download = meta.name;
  if (/\.pdf$/i.test(meta.name)) {
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) { const b64 = $('#pdfWorker').textContent.trim(); const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([u], { type: 'text/javascript' })); }
      vPdf = await pdfjsLib.getDocument({ data: await vBlob.arrayBuffer() }).promise; if (my !== vToken) return;
      await renderPdf(my);
    } catch (err) { box.innerHTML = `<p style="padding:20px">تعذّر عرض الملف داخل التطبيق. استخدم زر «تنزيل».</p>`; }
  } else { box.innerHTML = `<img alt="${esc(meta.name)}" src="${vUrl}">`; }
}
async function renderPdf(my, fw, fd) {
  const box = $('#vbody'); box.textContent = ''; const w = fw || Math.max(280, box.clientWidth - 16) * vZoom, dpr = fd || Math.min(devicePixelRatio || 1, 2);
  for (let i = 1; i <= vPdf.numPages; i++) {
    const p = await vPdf.getPage(i); if (my !== vToken) return;
    const base = p.getViewport({ scale: 1 }), vp = p.getViewport({ scale: (w / base.width) * dpr });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.style.width = w + 'px'; c.style.height = (vp.height / dpr) + 'px';
    box.appendChild(c); await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  }
}
const zoom = d => { vZoom = Math.min(4, Math.max(.5, vZoom + d)); if (vPdf) renderPdf(++vToken); else { const i = $('#vbody img'); if (i) { i.style.maxWidth = 'none'; i.style.width = (vZoom * 100) + '%'; } } };
$('#vPrint').onclick = async () => { if (vPdf) { await renderPdf(++vToken, 1600, 1); window.print(); renderPdf(++vToken); } else window.print(); };
$('#zIn').onclick = () => zoom(.25); $('#zOut').onclick = () => zoom(-.25);
$('#dView').addEventListener('close', () => { vToken++; vPdf = null; $('#vbody').textContent = ''; if (vUrl) { URL.revokeObjectURL(vUrl); vUrl = null; } });

/* ---------- تشغيل ---------- */
(async () => {
  try {
    db = await openDB();
    const m = FS ? await rq(db.transaction('meta').objectStore('meta').get('dir')) : null;
    if (m) { dir = m.handle; folderMode = true; try { needPerm = (await dir.queryPermission({ mode: 'readwrite' })) !== 'granted'; } catch (e) { needPerm = true; } }
    await load();
  }
  catch (e) { $('#empty').hidden = false; $('#empty').textContent = 'تعذّر فتح قاعدة البيانات المحلية: ' + e.message; }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
