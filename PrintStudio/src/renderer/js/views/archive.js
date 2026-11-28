import { $, $$, esc, call, run, toast, modal, confirmBox, icon, actions, fmtDate, fmtSize, fileUrl } from '../util.js';
import { S } from '../state.js';
import { openPdf, renderPage } from '../pdfjs.js';
import { go } from '../main.js';

const TYPES = [['', 'كل الأنواع'], ['pdf', 'PDF'], ['docx', 'Word'], ['xlsx', 'Excel'], ['jpg', 'JPG'], ['png', 'PNG'], ['txt', 'نص']];
const SRC = { scan: 'مسح', ocr: 'تعرّف ذكي', id: 'هويات', 'pdf-tool': 'أدوات PDF' };

export async function mount(root) {
  let f = { q: '', type: '', from: '', to: '' }, rows = [];
  async function load() {
    const q = { q: f.q, type: f.type, from: f.from ? new Date(f.from).getTime() : 0, to: f.to ? new Date(f.to).getTime() + 864e5 : 0 };
    rows = await call('archiveList', q); list();
  }
  function list() {
    $('#al', root).innerHTML = rows.length ? `<table class="t"><thead><tr><th>الاسم</th><th>النوع</th><th>الصفحات</th><th>الحجم</th><th>المصدر</th><th>التاريخ</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td><span class="pill">${esc(r.type)}</span></td><td>${r.pages || '—'}</td><td>${fmtSize(r.size)}</td><td>${esc(SRC[r.source] || SRC[r.source] || 'ملف')}</td><td>${fmtDate(r.created)}</td>
      <td style="white-space:nowrap"><button class="btn sm ghost" data-act="pv" data-id="${r.id}" title="معاينة">${icon('eye')}</button> <button class="btn sm ghost" data-act="open" data-id="${r.id}" title="فتح">${icon('open')}</button> <button class="btn sm ghost" data-act="dir" data-id="${r.id}" title="فتح المجلد">${icon('folder')}</button> ${r.type === 'pdf' ? `<button class="btn sm ghost" data-act="read" data-id="${r.id}" title="قراءة في القارئ">${icon('pdf')}</button>` : ''} ${['pdf', 'jpg', 'png'].includes(r.type) ? `<button class="btn sm ghost" data-act="reprint" data-id="${r.id}" title="إعادة الطباعة">${icon('printer')}</button>` : ''} <button class="btn sm red" data-act="del" data-id="${r.id}" title="حذف من الأرشيف">${icon('trash')}</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">لا توجد ملفات مطابقة. تُضاف الملفات إلى الأرشيف تلقائياً عند التصدير.</div>';
  }
  root.innerHTML = `<div class="page-h"><span class="tag">🗂</span><h1>الأرشيف</h1><span class="grow"></span><span class="pill" id="cnt"></span></div>
    <div class="card" style="margin-bottom:14px"><div class="row"><label class="f grow">بحث (اسم الملف أو محتواه)<input type="text" id="fq" placeholder="اكتب للبحث…"></label>
    <label class="f">النوع<select id="ft">${TYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label><label class="f">من تاريخ<input type="date" id="ff" class="inp"></label><label class="f">إلى تاريخ<input type="date" id="fe" class="inp"></label></div></div>
    <div class="card" id="al"></div>`;
  let tm; $('#fq', root).oninput = (e) => { f.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => load().then(cnt), 200); };
  $('#ft', root).onchange = (e) => { f.type = e.target.value; load().then(cnt); }; $('#ff', root).onchange = (e) => { f.from = e.target.value; load().then(cnt); }; $('#fe', root).onchange = (e) => { f.to = e.target.value; load().then(cnt); };
  const cnt = () => { $('#cnt', root).textContent = rows.length + ' ملف'; };
  actions(root, {
    open: (b) => run(b, () => call('archiveOpen', +b.dataset.id)), dir: (b) => run(b, () => call('archiveReveal', +b.dataset.id)),
    read: (b) => run(b, async () => { const r = await call('archiveGet', +b.dataset.id); sessionStorage.setItem('reader-preload', r.path); go('reader'); }),
    reprint: (b) => run(b, async () => { const r = await call('archiveGet', +b.dataset.id); sessionStorage.setItem('print-preload', r.path); go('print'); }),
    del: async (b) => { if (await confirmBox('إزالة هذا الملف من الأرشيف؟ (يُحذف السجل ونسخة الأرشيف)', 'إزالة', true)) { await call('archiveDelete', +b.dataset.id, true); await load(); cnt(); toast('أُزيل من الأرشيف', 'ok'); } },
    pv: (b) => run(b, async () => {
      const r = await call('archiveGet', +b.dataset.id); const m = modal(`<h2>${esc(r.name)}</h2><div class="arch-pv" id="pv"><div class="progress ind" style="width:60%"><i></i></div></div><div class="foot"><button class="btn" id="po">فتح الملف</button><button class="btn ghost" id="pc">إغلاق</button></div>`, { wide: true });
      $('#pc', m).onclick = () => m.close(); $('#po', m).onclick = () => run(null, () => call('archiveOpen', r.id)); const box = $('#pv', m);
      if (r.type === 'pdf') { const doc = await openPdf(await call('readFile', r.path)); box.innerHTML = ''; box.style.display = 'block'; box.style.padding = '12px'; for (let i = 1; i <= Math.min(doc.numPages, 12); i++) { const pg = await renderPage(doc, i, 1.1); const im = new Image(); im.src = pg.url; im.style.cssText = 'display:block;margin:8px auto;max-width:100%;background:#fff'; box.append(im); } }
      else if (r.type === 'jpg' || r.type === 'png') box.innerHTML = `<img src="${fileUrl(r.path)}" alt="">`;
      else box.innerHTML = `<div class="empty">لا توجد معاينة لهذا النوع (${esc(r.type)}).<br>استخدم «فتح الملف» لعرضه في البرنامج المناسب.</div>`;
    }),
  });
  await load(); cnt();
}
