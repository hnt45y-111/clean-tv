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
    const r = indexedDB.open('orders-db', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
      r.result.createObjectStore('files', { keyPath: 'id', autoIncrement: true }).createIndex('num', 'num');
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
let orders = [], filesIdx = new Map(), shown = PAGE;
async function load() {
  orders = await dbAll('orders');
  filesIdx = new Map();
  for (const f of await dbAll('files')) { if (!filesIdx.has(f.num)) filesIdx.set(f.num, []); filesIdx.get(f.num).push({ id: f.id, name: f.name }); }
  render();
}
const hasFile = o => !!o.fileNo && filesIdx.has(fileKey(o.fileNo));

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
    <td class="v${o.fileNo ? '' : ' e'}" data-l="الاضبارة">${o.fileNo ? `<button class="doss ${hasFile(o) ? 'has' : 'no'}" data-doss="${esc(o.fileNo)}" title="${hasFile(o) ? 'فتح الاضبارة' : 'لا يوجد ملف لهذه الاضبارة'}">${esc(o.fileNo)}</button>` : ''}</td>
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
document.addEventListener('click', e => { const m = $('details.menu'); if (m.open && !m.contains(e.target)) m.open = false; });

/* ---------- إضافة / تعديل ---------- */
let editing = null;
function openForm(o) {
  editing = o || null; const f = $('#fForm');
  $('#fTitle').textContent = o ? 'تعديل أمر' : 'إضافة أمر';
  f.reset();
  for (const k of FIELDS) { if (k === 'kind') f.kind.value = o ? o.kind : 'assign'; else f[k].value = o ? (o[k] || '') : ''; }
  $('#dForm').showModal();
}
$('#bAdd').onclick = () => openForm();
$('#fForm').onsubmit = async e => {
  e.preventDefault(); const f = e.target;
  const o = editing ? { ...editing } : {};
  for (const k of FIELDS) o[k] = (k === 'kind' ? f.kind.value : f[k].value).trim();
  if (!o.name) return toast('اكتب اسم المكلف');
  o.fileNo = latin(o.fileNo);
  await dbPutMany('orders', [o]); $('#dForm').close(); await load(); toast('تم الحفظ');
};
$('#rows').onclick = async e => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const o = orders.find(x => x.id === +tr.dataset.id);
  if (e.target.closest('[data-edit]')) openForm(o);
  else if (e.target.closest('[data-del]')) { if (confirm(`حذف أمر «${o.name}»؟`)) { await dbDel('orders', o.id); await load(); toast('تم الحذف'); } }
  else if (e.target.closest('[data-doss]')) openDossier(o.fileNo);
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
$('#impGo').onclick = async () => { const n = pending.length; await dbPutMany('orders', pending); pending = []; $('#dImp').close(); await load(); toast(`تم استيراد ${n} أمر`); };

/* ---------- تصدير / نسخ احتياطي ---------- */
const stamp = () => new Date().toISOString().slice(0, 10);
function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
const HEAD = ['اسم المكلف', 'انهاء تكليف', 'المنصب', 'القيادة', 'اللواء', 'الفوج', 'تاريخ الكتاب', 'رقم الكتاب', 'نوع الكتاب', 'رقم الاضبارة', 'الملاحظات'];
function xlsxOut(rows, name) {
  const ws = XLSX.utils.aoa_to_sheet([HEAD, ...rows]); ws['!cols'] = HEAD.map(h => ({ wch: Math.max(12, h.length + 4) }));
  const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, ws, 'الأوامر');
  save(new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
}
$('#mExp').onclick = () => { $('details.menu').open = false; xlsxOut(filtered().map(o => [o.name, o.kind === 'end' ? 'نعم' : '', o.position, o.command, o.brigade, o.battalion, fmtDate(o.bookDate), o.bookNo, o.bookType, o.fileNo, o.notes]), `الأوامر-${stamp()}.xlsx`); };
$('#mTpl').onclick = () => { $('details.menu').open = false; xlsxOut([['مثال: أحمد علي', '', 'آمر', 'قيادة العمليات', 'اللواء 1', 'الفوج 2', '05/03/2025', '123', 'أمر إداري', '1', '']], 'نموذج-الأوامر.xlsx'); };
$('#mBak').onclick = () => { $('details.menu').open = false; save(new Blob([JSON.stringify({ v: 1, orders: orders.map(({ id, ...r }) => r) })], { type: 'application/json' }), `نسخة-الأوامر-${stamp()}.json`); };
$('#mRes').onclick = () => { $('details.menu').open = false; $('#inJson').click(); };
$('#inJson').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text()); if (!Array.isArray(j.orders)) throw new Error('ملف غير صالح');
    const seen = new Set(orders.map(dupKey)), add = [];
    for (const r of j.orders) { const o = {}; FIELDS.forEach(k => o[k] = String(r[k] ?? '')); if (!o.name) continue; if (o.kind !== 'end') o.kind = 'assign'; const k = dupKey(o); if (!seen.has(k)) { seen.add(k); add.push(o); } }
    await dbPutMany('orders', add); await load(); toast(`تم استرجاع ${add.length} أمر`);
  } catch (err) { toast('تعذّر الاسترجاع: ' + err.message); }
};
$('#mClr').onclick = async () => { $('details.menu').open = false; if (orders.length && confirm(`حذف كل الأوامر (${orders.length})؟ لا يمكن التراجع. (ملفات الاضبارات لا تُحذف)`)) { await dbClear('orders'); await load(); toast('تم الحذف'); } };

/* ---------- مجلد الاضبارات ---------- */
const FEXT = /\.(pdf|jpe?g|png|webp|gif|bmp)$/i;
function filesDialog() {
  const total = [...filesIdx.values()].reduce((a, v) => a + v.length, 0);
  $('#fInfo').innerHTML = total ? `الملفات المحفوظة: <b>${total}</b> (اضبارات: ${filesIdx.size})` : 'ما كو ملفات محفوظة بعد.';
  const miss = [...new Set(orders.filter(o => o.fileNo && !hasFile(o)).map(o => o.fileNo))];
  $('#missing').innerHTML = miss.length ? miss.slice(0, 300).map(n => `<span>${esc(n)}</span>`).join('') : '<span class="note">لا يوجد</span>';
  $('#dFiles').showModal();
}
$('#bFiles').onclick = filesDialog;
$('#bPickDir').onclick = () => $('#inDir').click();
$('#bPickFiles').onclick = () => $('#inFiles').click();
async function addFiles(list) {
  const arr = [...list].filter(f => FEXT.test(f.name)); if (!arr.length) return toast('ما لقيت PDF أو صور');
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
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
async function openDossier(no) {
  const list = filesIdx.get(fileKey(no));
  if (!list) { toast(`ما لقيت ملف للاضبارة ${no} — اختر مجلد الاضبارات`); return filesDialog(); }
  $('#vTitle').textContent = `اضبارة ${no}`;
  const tabs = $('#vTabs'); tabs.hidden = list.length < 2;
  tabs.innerHTML = list.map((f, i) => `<button class="btn sm" data-i="${i}">${esc(f.name)}</button>`).join('');
  tabs.onclick = e => { const b = e.target.closest('[data-i]'); if (b) showFile(list[+b.dataset.i]); };
  $('#dView').showModal(); showFile(list[0]);
}
async function showFile(meta) {
  const my = ++vToken, box = $('#vbody'); box.textContent = 'جارٍ الفتح…'; vZoom = 1; vPdf = null;
  const rec = await dbGet('files', meta.id); if (my !== vToken) return;
  vBlob = rec.blob; if (vUrl) URL.revokeObjectURL(vUrl); vUrl = URL.createObjectURL(vBlob);
  const dl = $('#vDl'); dl.href = vUrl; dl.download = meta.name;
  if (/\.pdf$/i.test(meta.name)) {
    try {
      if (!window.pdfjsLib) { await loadScript('pdf.min.js'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js'; }
      vPdf = await pdfjsLib.getDocument({ data: await vBlob.arrayBuffer() }).promise; if (my !== vToken) return;
      await renderPdf(my);
    } catch (err) { box.innerHTML = `<p style="padding:20px">تعذّر عرض الملف داخل التطبيق. استخدم زر «تنزيل».</p>`; }
  } else { box.innerHTML = `<img alt="${esc(meta.name)}" src="${vUrl}">`; }
}
async function renderPdf(my) {
  const box = $('#vbody'); box.textContent = ''; const w = Math.max(280, box.clientWidth - 16) * vZoom, dpr = Math.min(devicePixelRatio || 1, 2);
  for (let i = 1; i <= vPdf.numPages; i++) {
    const p = await vPdf.getPage(i); if (my !== vToken) return;
    const base = p.getViewport({ scale: 1 }), vp = p.getViewport({ scale: (w / base.width) * dpr });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.style.width = w + 'px'; c.style.height = (vp.height / dpr) + 'px';
    box.appendChild(c); await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  }
}
const zoom = d => { vZoom = Math.min(4, Math.max(.5, vZoom + d)); if (vPdf) renderPdf(++vToken); else { const i = $('#vbody img'); if (i) { i.style.maxWidth = 'none'; i.style.width = (vZoom * 100) + '%'; } } };
$('#zIn').onclick = () => zoom(.25); $('#zOut').onclick = () => zoom(-.25);
$('#dView').addEventListener('close', () => { vToken++; vPdf = null; $('#vbody').textContent = ''; if (vUrl) { URL.revokeObjectURL(vUrl); vUrl = null; } });

/* ---------- تشغيل ---------- */
(async () => {
  try { db = await openDB(); await load(); }
  catch (e) { $('#empty').hidden = false; $('#empty').textContent = 'تعذّر فتح قاعدة البيانات المحلية: ' + e.message; }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
