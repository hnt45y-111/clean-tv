import { h, icon, n, empty, stars, field, opts, toast, modal, fmtDate, seal, nail } from '../dom.js';
import { get, post, S, loadMeta } from '../api.js';
import { page, tabbar, sectionTitle } from '../layout.js';
import { mapBlock, rateModal } from './patient.js';

const card = (p) => h('a', { class: 'card tap row', href: '#/pharmacy/' + p.id, style: 'color:inherit' },
  h('div', { class: 'arch palm', style: '--w:44px' }, 'ص'),
  h('div', { class: 'grow col' }, h('b', { style: 'font-family:var(--kufi);font-weight:600' }, p.title), h('div', { class: 'small muted' }, `${p.area} · ${p.hours || ''}`),
    h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, stars(p.rating.avg, p.rating.count), p.delivers ? h('span', { class: 'badge teal' }, 'توصيل للبيت') : null, p.home_visit ? h('span', { class: 'badge palm' }, 'صيدلاني جوّال') : null)),
  h('i', { class: 'chev' }));

export async function pharmaciesScreen() {
  const meta = await loadMeta();
  const f = { q: '', area: S.user?.area || '', delivery: '' };
  const list = h('div', { class: 'list' });
  const load = async () => {
    const p = new URLSearchParams(); if (f.q) p.set('q', f.q); if (f.area) p.set('area', f.area); if (f.delivery) p.set('delivery', '1');
    const r = await get('/pharmacies?' + p);
    list.replaceChildren(...(r.pharmacies.length ? r.pharmacies.map(card) : [empty('ماكو صيدليات هنا', 'جرّب منطقة ثانية')]));
  };
  const q = h('input', { placeholder: 'اسم الصيدلية', onInput: (e) => { f.q = e.target.value; clearTimeout(q._t); q._t = setTimeout(load, 300); } });
  load();
  return h('div', {}, page({ title: 'الصيدليات', back: '#/home' },
    h('div', { class: 'card form' }, q, h('select', { onChange: (e) => { f.area = e.target.value; load(); } }, opts(meta.areas, f.area, 'كل المناطق')),
      h('label', { class: 'row' }, h('input', { type: 'checkbox', onChange: (e) => { f.delivery = e.target.checked; load(); } }), 'يوصّل للبيت فقط')),
    list), tabbar('#/home'));
}

export async function pharmacyProfile(id) {
  const r = await get('/pharmacies/' + id), p = r.pharmacy;
  const isPatient = S.user.role === 'patient';
  const ask = (kind) => {
    const text = h('textarea', { placeholder: kind === 'urgent' ? 'اشرح الحالة المستعجلة' : 'اكتب اسم الدواء أو الصورة اللي تحتاجه' });
    modal((close) => [h('h3', {}, kind === 'urgent' ? 'حالة مستعجلة' : 'اطلب دواء'), h('p', { class: 'small muted' }, 'الصيدلاني يردّ عليك: تجي للصيدلية أو يزورك بالبيت (إذا جوّال).'), text,
      h('button', { class: 'btn block ' + (kind === 'urgent' ? 'fired' : ''), style: 'margin-top:16px', onClick: async () => { try { await post(`/pharmacies/${p.id}/request`, { kind, text: text.value }); close(); toast('انرسل طلبك للصيدلاني'); } catch (e) { toast(e.message, true); } } }, 'أرسل')]);
  };
  return h('div', {}, page({ title: p.title, sub: p.area, back: true },
    h('div', { class: 'card col' }, stars(p.rating.avg, p.rating.count),
      h('div', { class: 'row' }, icon('clock', 20), p.hours || 'الدوام غير محدد'),
      p.staff ? h('div', { class: 'row' }, icon('user', 20), p.staff) : null,
      p.work_method ? h('div', { class: 'row' }, icon('list', 20), p.work_method) : null,
      p.prices_note ? h('div', { class: 'row' }, icon('pill', 20), p.prices_note) : null,
      h('div', { class: 'row', style: 'flex-wrap:wrap' }, p.delivers ? h('span', { class: 'badge teal' }, 'توصيل أدوية للبيت') : null, p.home_visit ? h('span', { class: 'badge palm' }, 'صيدلاني جوّال: يزورك بالبيت') : null)),
    isPatient ? h('div', { class: 'row' }, h('button', { class: 'btn block palm', onClick: () => ask('drug') }, icon('pill', 20), 'اطلب دواء'), h('button', { class: 'btn block fired', onClick: () => ask('urgent') }, 'مستعجل')) : null,
    sectionTitle('الموقع'), h('div', { class: 'card col' }, h('div', { class: 'row' }, icon('pin', 20), p.address || p.area), mapBlock(p)),
    sectionTitle('الآراء'), isPatient ? h('button', { class: 'btn brick block', onClick: () => rateModal('pharmacy', p.id, p.title) }, icon('star', 20), 'قيّم الصيدلية') : null,
    h('div', { class: 'list' }, r.reviews.length ? r.reviews.map((v) => h('div', { class: 'card' }, h('div', { class: 'row between' }, h('b', {}, v.name.split(' ')[0]), stars(v.stars)), v.comment ? h('div', { class: 'small' }, v.comment) : null)) : [empty('ماكو آراء بعد', '')])), tabbar('#/home'));
}
