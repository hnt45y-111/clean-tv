import { esc, $, call, modal, toast, run, loading } from './util.js';
import { S, setSetting, refreshState } from './state.js';

const FORMATS = [['pdf', 'PDF'], ['docx', 'Word (.docx)'], ['jpg', 'صورة JPG'], ['png', 'صورة PNG']];

/** نافذة «حفظ وتصدير»: اسم الملف + مكان الحفظ + الصيغة والخيارات. */
export function openExportDialog({ ids = [], title = 'حفظ وتصدير' } = {}) {
  const st = S.settings; let fmt = st.save.format; let dir = st.save.dir;
  const m = modal(`
    <h2>💾 ${esc(title)}</h2>
    <div class="col">
      <label class="f">اسم الملف<input type="text" id="x-name" placeholder="مثال: تقرير التدريب" maxlength="150" autofocus></label>
      <div class="sub" style="margin-top:-6px;font-size:12px">اكتب الاسم فقط — يُضاف الامتداد تلقائياً حسب الصيغة.</div>
      <label class="f">مكان الحفظ
        <div class="row"><div class="inp grow" id="x-dir" style="direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
        <button class="btn ghost sm" id="x-pick"></button></div></label>
      <div class="f">الصيغة<div class="seg" id="x-fmt">${FORMATS.map(([k, l]) => `<button data-f="${k}">${l}</button>`).join('')}</div></div>
      <div id="x-opts"></div>
      <div class="sub" id="x-preview" style="direction:ltr;text-align:right"></div>
    </div>
    <div class="foot"><button class="btn green" id="x-go">تصدير وحفظ</button><button class="btn ghost" id="x-cancel">إلغاء</button></div>`);
  const nameEl = $('#x-name', m);
  const preview = () => { const n = nameEl.value.trim(); $('#x-preview', m).textContent = n ? 'سيُحفظ باسم: ' + (n.replace(/\.(pdf|docx|jpe?g|png)$/i, (x) => (x.toLowerCase().slice(1) === fmt || (fmt === 'jpg' && /jpe?g/i.test(x)) ? '' : x)) + '.' + fmt) : ''; };
  const renderDir = () => { $('#x-dir', m).textContent = dir || 'لم يُحدَّد مكان بعد'; $('#x-pick', m).textContent = dir ? 'تغيير مكان الحفظ' : 'اختيار مكان الحفظ'; };
  const optsHtml = () => {
    if (fmt === 'jpg' || fmt === 'png') return `<div class="grid3"><label class="f">الدقة<select id="o-dpi">${[72, 150, 200, 300, 600].map((d) => `<option ${d === st.image.dpi ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      ${fmt === 'jpg' ? `<label class="f">الجودة <span id="o-qv">${st.image.quality}</span>%<input type="range" id="o-q" min="30" max="100" value="${st.image.quality}"></label>` : '<span></span>'}
      <label class="f">اللون<select id="o-col"><option value="color" ${st.image.color === 'color' ? 'selected' : ''}>ملوّن</option><option value="gray" ${st.image.color === 'gray' ? 'selected' : ''}>رمادي</option><option value="bw" ${st.image.color === 'bw' ? 'selected' : ''}>أبيض وأسود</option></select></label></div>
      <div class="sub" style="margin-top:6px">عند وجود أكثر من صفحة تُحفظ كل صفحة كصورة مرقّمة.</div>`;
    if (fmt === 'pdf') return `<div class="grid3"><label class="f">حجم الصفحة<select id="o-ps">${['A4', 'A3', 'A5', 'Letter', 'Legal', 'fit'].map((d) => `<option value="${d}" ${d === st.pdf.pageSize ? 'selected' : ''}>${d === 'fit' ? 'بحجم الصورة' : d}</option>`).join('')}</select></label>
      <label class="f">الاتجاه<select id="o-or"><option value="portrait" ${st.pdf.orientation === 'portrait' ? 'selected' : ''}>طولي</option><option value="landscape" ${st.pdf.orientation === 'landscape' ? 'selected' : ''}>عرضي</option></select></label>
      <label class="f">الجودة <span id="o-qv">${st.pdf.quality}</span>%<input type="range" id="o-q" min="30" max="100" value="${st.pdf.quality}"></label></div>`;
    return `<div class="col"><div class="f">نوع مستند Word</div><div class="seg" id="o-wm"><button data-m="text" class="on">نص قابل للتحرير (OCR)</button><button data-m="image">صورة الصفحة كما هي</button></div>
      <div class="sub" id="o-wnote">سيُحلَّل المستند ويُعاد بناؤه كفقرات وعناوين وجداول حقيقية قابلة للتحرير. قد يستغرق ذلك بعض الوقت، وتُراجَع النتيجة في «التعرف الذكي» للتدقيق الكامل.</div>
      <div class="grid2"><label class="f">حجم الصفحة<select id="o-ps">${['A4', 'A3', 'A5', 'Letter', 'Legal'].map((d) => `<option ${d === st.word.pageSize ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="f">الاتجاه<select id="o-or"><option value="portrait" ${st.word.orientation === 'portrait' ? 'selected' : ''}>طولي</option><option value="landscape" ${st.word.orientation === 'landscape' ? 'selected' : ''}>عرضي</option></select></label></div></div>`;
  };
  const setFmt = (f) => { fmt = f; $('#x-opts', m).innerHTML = optsHtml(); for (const b of m.querySelectorAll('#x-fmt button')) b.classList.toggle('on', b.dataset.f === f); preview();
    const q = $('#o-q', m); if (q) q.oninput = () => { $('#o-qv', m).textContent = q.value; };
    const wm = $('#o-wm', m); if (wm) wm.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; wm.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
  };
  m.querySelectorAll('#x-fmt button').forEach((b) => (b.onclick = () => setFmt(b.dataset.f)));
  nameEl.oninput = preview; renderDir(); setFmt(fmt);
  $('#x-cancel', m).onclick = () => m.close();
  $('#x-pick', m).onclick = async () => { const d = await run(null, () => call('folderPick', !S.settings.save.dir)); if (d) { dir = d; await call('settingsSet', { 'save.dir': d, 'save.askedDir': true }); await refreshState(); renderDir(); } };
  $('#x-go', m).onclick = (ev) => run(ev.currentTarget, async () => {
    const name = nameEl.value.trim(); if (!name) { nameEl.focus(); throw new Error('اكتب اسم الملف أولاً'); }
    if (!dir) { const d = await call('folderPick', true); if (!d) throw new Error('اختر مكان الحفظ أولاً'); dir = d; await refreshState(); renderDir(); }
    const opts = {}; let content = 'image';
    if (fmt === 'jpg' || fmt === 'png') Object.assign(opts, { dpi: +$('#o-dpi', m).value, quality: +($('#o-q', m)?.value || 90), color: $('#o-col', m).value });
    else if (fmt === 'pdf') Object.assign(opts, { pageSize: $('#o-ps', m).value, orientation: $('#o-or', m).value, quality: +$('#o-q', m).value });
    else { Object.assign(opts, { pageSize: $('#o-ps', m).value, orientation: $('#o-or', m).value }); content = $('#o-wm .on', m).dataset.m; }
    let lo; if (fmt === 'docx' && content === 'text') lo = loading('جارٍ التعرف على النص وبناء مستند Word…');
    try {
      const r = await call('exportPages', { name, format: fmt, dir, ids, options: opts, content });
      m.close(); await setSetting({ 'save.format': fmt });
      toast(`تم الحفظ: ${r.files.length > 1 ? r.files.length + ' ملفات' : r.files[0].split(/[\\/]/).pop()}`, 'ok', [{ label: 'فتح الملف', fn: () => call('openPath', r.files[0]).catch((e) => toast(e.message, 'err')) }, { label: 'فتح المجلد', fn: () => call('reveal', r.files[0]).catch((e) => toast(e.message, 'err')) }]);
    } finally { if (lo) lo.close(); }
  });
  setTimeout(() => nameEl.focus(), 50);
  return m;
}

/** نافذة تصدير عامة (اسم + مكان + صيغة + خيارات إضافية) للهويات والتعرف الذكي. */
export function openSimpleExport({ title, formats, extra = '', onExport, defaultName = '' }) {
  let fmt = formats[0][0]; let dir = S.settings.save.dir;
  const m = modal(`<h2>💾 ${esc(title)}</h2><div class="col">
    <label class="f">اسم الملف<input type="text" id="s-name" value="${esc(defaultName)}" placeholder="اكتب الاسم بدون امتداد" maxlength="150"></label>
    <label class="f">مكان الحفظ<div class="row"><div class="inp grow" id="s-dir" style="direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div><button class="btn ghost sm" id="s-pick"></button></div></label>
    <div class="f">الصيغة<div class="seg" id="s-fmt">${formats.map(([k, l]) => `<button data-f="${k}" class="${k === fmt ? 'on' : ''}">${l}</button>`).join('')}</div></div>${extra}</div>
    <div class="foot"><button class="btn green" id="s-go">تصدير وحفظ</button><button class="btn ghost" id="s-cancel">إلغاء</button></div>`);
  const renderDir = () => { $('#s-dir', m).textContent = dir || 'لم يُحدَّد مكان بعد'; $('#s-pick', m).textContent = dir ? 'تغيير مكان الحفظ' : 'اختيار مكان الحفظ'; }; renderDir();
  $('#s-fmt', m).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; fmt = b.dataset.f; $('#s-fmt', m).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
  $('#s-cancel', m).onclick = () => m.close();
  $('#s-pick', m).onclick = async () => { const d = await run(null, () => call('folderPick', !S.settings.save.dir)); if (d) { dir = d; await call('settingsSet', { 'save.dir': d, 'save.askedDir': true }); await refreshState(); renderDir(); } };
  $('#s-go', m).onclick = (ev) => run(ev.currentTarget, async () => {
    const name = $('#s-name', m).value.trim(); if (!name) { $('#s-name', m).focus(); throw new Error('اكتب اسم الملف أولاً'); }
    if (!dir) { const d = await call('folderPick', true); if (!d) throw new Error('اختر مكان الحفظ أولاً'); dir = d; await refreshState(); renderDir(); }
    const r = await onExport({ name, format: fmt, dir, m }); if (!r) return; m.close();
    toast(`تم الحفظ: ${r.files.length > 1 ? r.files.length + ' ملفات' : r.files[0].split(/[\\/]/).pop()}${r.note ? ' — ' + r.note : ''}`, 'ok', [{ label: 'فتح الملف', fn: () => call('openPath', r.files[0]).catch((e) => toast(e.message, 'err')) }, { label: 'فتح المجلد', fn: () => call('reveal', r.files[0]).catch((e) => toast(e.message, 'err')) }]);
  });
  setTimeout(() => $('#s-name', m).focus(), 50); return m;
}
