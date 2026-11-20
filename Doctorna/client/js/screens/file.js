import { h, icon, n, empty, fmtDate, fmtDateFull, fmtTime, toast, modal, field, opts, seal } from '../dom.js';
import { get, post, S } from '../api.js';
import { page, tabbar, sectionTitle } from '../layout.js';

const formIcon = { 'حبوب': 'pill', 'كبسول': 'pill', 'شراب': 'lab', 'حقنة': 'pill', 'مرهم': 'pharm', 'قطرة': 'lab', 'بخاخ': 'pharm' };
export const drugTile = (form) => h('div', { class: 'pill', title: form || 'دواء' }, icon(formIcon[form] || 'pill', 28));

// مدخل الملف الطبي: يُستخدم للمريض (ملفه) وللطبيب (ملف مراجعه) وللطباعة PDF
export function fileView(file, { patient, pharmacies = [], canSend = false, onSent } = {}) {
  const items = [
    ...file.visits.map((v) => ({ t: 'v', date: v.date, id: v.id, v })),
    ...file.prescriptions.map((p) => ({ t: 'p', date: p.received_date || new Date(p.created + 3 * 3600e3).toISOString().slice(0, 10), id: p.id, p })),
    ...file.labs.map((l) => ({ t: 'l', date: new Date(l.created + 3 * 3600e3).toISOString().slice(0, 10), id: l.id, l })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  if (!items.length) return empty('ملفك فاضي لحد الآن', 'زياراتك وأدويتك وتحاليلك تنكتب هنا تلقائيًا');
  const card = (it) => {
    if (it.t === 'v') return h('div', { class: 'tl' }, h('div', { class: 'card col' },
      h('div', { class: 'row between' }, h('b', {}, 'زيارة · د. ' + it.v.doctor_name.replace(/^د\.?\s*/, '')), h('span', { class: 'small muted' }, fmtDate(it.v.date))),
      it.v.complaint ? h('div', {}, h('span', { class: 'muted small' }, 'الشكوى: '), it.v.complaint) : null,
      it.v.diagnosis ? h('div', {}, h('span', { class: 'muted small' }, 'التشخيص: '), h('b', {}, it.v.diagnosis)) : null,
      it.v.notes ? h('div', { class: 'small' }, it.v.notes) : null));
    if (it.t === 'p') {
      const p = it.p, sold = ['sold', 'self'].includes(p.status);
      return h('div', { class: 'tl palm' }, h('div', { class: 'card row top' }, drugTile(p.form), h('div', { class: 'grow col' },
        h('div', { class: 'row between' }, h('b', { class: 'latin' }, p.drug_name), h('span', { class: 'badge ' + (sold ? 'palm' : 'brick') }, sold ? 'انستلم' : 'بانتظار الصيدلية')),
        h('div', { class: 'small' }, `${n(p.times_per_day)} مرة باليوم · لمدة ${n(p.days)} أيام`, p.notes ? ' · ' + p.notes : ''),
        h('div', { class: 'small muted' }, sold ? `تاريخ الاستلام ${fmtDate(p.received_date)}` : 'ما انستلم بعد', p.doctor_name ? ` · د. ${p.doctor_name.replace(/^د\.?\s*/, '')}` : ' · بيع مباشر'),
        canSend && p.status === 'ordered' ? h('button', { class: 'btn small ghost noprint', onClick: () => sendModal(p, pharmacies, onSent) }, p.pharmacy_id ? 'غيّر الصيدلية' : 'ابعث للصيدلية') : null)));
    }
    const l = it.l;
    return h('div', { class: 'tl teal' }, h('div', { class: 'card col' },
      h('div', { class: 'row between' }, h('b', {}, 'تحليل: ' + l.test), h('span', { class: 'badge ' + (l.status === 'ready' ? 'teal' : 'brick') }, l.status === 'ready' ? 'جاهزة' : 'مطلوب')),
      l.status === 'ready' ? h('table', { class: 'tbl' }, h('tbody', {}, l.result.split('\n').map((ln) => h('tr', {}, h('td', { class: 'latin', colspan: 2 }, ln))))) : h('div', { class: 'small muted' }, 'بانتظار نتيجة المختبر'),
      l.status === 'ready' ? h('button', { class: 'btn small ghost noprint', onClick: () => window.print() }, icon('print', 18), 'حمّل النتيجة PDF') : null));
  };
  return h('div', { class: 'print-area' },
    h('div', { class: 'card', style: 'margin-bottom:12px' }, h('div', { class: 'row' }, icon('file', 24), h('div', {}, h('b', {}, 'الملف الطبي — ' + (patient?.name || '')), h('div', { class: 'small muted latin' }, patient?.phone || '')))),
    h('div', { class: 'timeline' }, items.map(card)));
}

function sendModal(p, pharmacies, onSent) {
  const sel = h('select', {}, opts(pharmacies.map((x) => ({ value: String(x.id), label: `${x.title} — ${x.area}` })), String(p.pharmacy_id || ''), 'اختار الصيدلية'));
  modal((close) => [h('h3', {}, 'ابعث العلاج للصيدلية'), h('p', { class: 'small muted' }, p.drug_name), field('الصيدلية', sel),
    h('button', { class: 'btn block', style: 'margin-top:16px', onClick: async () => { if (!sel.value) return toast('اختار صيدلية', true); try { await post(`/rx/${p.id}/send`, { pharmacy_id: Number(sel.value) }); close(); toast('انرسل للصيدلية'); onSent?.(); } catch (e) { toast(e.message, true); } } }, 'أرسل')]);
}

export async function fileScreen() {
  const [f, ph] = await Promise.all([get('/file'), get('/pharmacies')]);
  const holder = h('div');
  const draw = async () => { const x = await get('/file'); holder.replaceChildren(fileView(x.file, { patient: x.patient, pharmacies: ph.pharmacies, canSend: true, onSent: draw })); };
  holder.append(fileView(f.file, { patient: f.patient, pharmacies: ph.pharmacies, canSend: true, onSent: draw }));
  return h('div', {}, page({ title: 'ملفي الطبي', sub: 'كل زياراتك وأدويتك وتحاليلك', back: '#/home' },
    h('button', { class: 'btn ghost block noprint', onClick: () => window.print() }, icon('print', 20), 'حمّل الملف PDF (طباعة)'), holder), tabbar('#/home'));
}
