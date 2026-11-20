import { h, icon, n, seal, arch, stars, empty, field, opts, toast, modal, confirmBox, fmtDate, fmtDateFull, fmtTime, dayName, iqd, nail, DAYS, spinner } from '../dom.js';
import { get, post, S, loadMeta } from '../api.js';
import { page, tabbar, sectionTitle } from '../layout.js';
import { code128 } from '../barcode.js';

// ---------- بطاقة الدور (الحجز) ----------
const STATUS = { pending: ['بانتظار موافقة الطبيب', 'brick'], confirmed: ['مؤكد', 'palm'], attended: ['حضرت', 'teal'], done: ['خلصت الزيارة', 'lapis'], rejected: ['اعتذر الطبيب', 'fired'], cancelled: ['ملغي', ''], postponed: ['مؤجل', 'brick'] };
export function ticket(b, { full = true } = {}) {
  const [st, tone] = STATUS[b.status] || [b.status, ''];
  return h('div', { class: 'ticket' },
    h('div', { class: 'top' },
      h('div', { class: 'row between' },
        h('div', {}, h('div', { class: 'small', style: 'color:var(--brick)' }, 'رقمك'), h('div', { class: 'no' }, b.status === 'pending' ? '—' : n(b.seq))),
        h('div', { style: 'text-align:end' }, h('div', { class: 'small', style: 'color:var(--brick)' }, fmtDateFull(b.date)), h('div', { style: 'font-family:var(--kufi);font-weight:600;font-size:18px' }, 'د. ' + b.doctor_name.replace(/^د\.?\s*/, '')), h('div', { class: 'small' }, `${b.specialty} · ${b.area}`))),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'badge ' + tone }, st), b.special ? h('span', { class: 'badge special' }, 'حالة خاصة') : null)),
    h('div', { class: 'body col' },
      b.status === 'confirmed' && b.date === (S.meta?.today || '') ? h('div', { class: 'row' }, icon('clock'), h('span', {}, b.ahead ? `قبلك ${n(b.ahead)} مراجعين · تقريبًا ${n(b.eta_minutes)} دقيقة` : 'انت الجاي، جهّز نفسك')) : null,
      b.hours ? h('div', { class: 'row small muted' }, icon('clock', 18), `دوام الطبيب ${fmtTime(b.hours.from)} – ${fmtTime(b.hours.to)}`) : null,
      b.status === 'pending' ? h('div', { class: 'small muted' }, 'العدد اكتمل لهذا اليوم. طلبك وصل للدكتور، ويوصلك رده بالتنبيهات.') : null),
    full && ['confirmed', 'attended'].includes(b.status) ? h('div', { class: 'back' }, h('div', { class: 'small muted', style: 'margin-bottom:8px' }, 'وّري الباركود للسكرتير'), code128(b.code), h('div', { class: 'code', style: 'margin-top:4px' }, b.code)) : null);
}

// ---------- الرئيسية ----------
export async function homeScreen() {
  const [meta, bk, rem, docs] = await Promise.all([loadMeta(), get('/bookings'), get('/reminders'), get('/doctors')]);
  const t = meta.today;
  const todayB = bk.bookings.find((b) => b.date === t && ['confirmed', 'attended'].includes(b.status));
  const next = bk.bookings.filter((b) => b.date > t && ['confirmed', 'pending'].includes(b.status)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const first = S.user.name.split(' ')[0];
  const nowHM = new Date(Date.now() + 3 * 3600e3).toISOString().slice(11, 16);
  const doses = rem.reminders.filter((r) => r.type === 'dose').sort((a, b) => a.time.localeCompare(b.time));
  const nextDose = doses.find((d) => d.time >= nowHM) || doses[0];
  const near = docs.doctors.filter((d) => S.user.area && d.area === S.user.area).slice(0, 3);
  const search = h('input', { placeholder: 'دوّر على طبيب، صيدلية، أو دواء', 'aria-label': 'بحث', onKeydown: (e) => e.key === 'Enter' && search.value.trim() && (location.hash = '#/doctors?q=' + encodeURIComponent(search.value.trim())) });
  const tiles = [
    ['#/doctors', 'doctor', 'أطباء', ''], ['#/pharmacies', 'pharm', 'صيدليات', 'palm'], ['#/file', 'file', 'ملفي الطبي', ''], ['#/file', 'lab', 'مختبر', 'teal'],
    ['#/voice', 'mic', 'المساعد', 'brick'], ['#/forum?kind=chronic', 'heart', 'أمراض مزمنة', 'fired'], ['#/forum?kind=blog', 'book', 'المدونة', ''], ['#/rewards', 'gift', 'مكافآت', 'brick'],
  ];
  return h('div', {}, page({ title: `هال بيك يا ${first}`, sub: 'شلون صحتك اليوم؟' },
    h('div', {}, search),
    todayB ? h('div', {}, sectionTitle('بطاقة دورك اليوم', ['#/bookings', 'كل حجوزاتي']), h('a', { href: '#/ticket/' + todayB.id, style: 'display:block' }, ticket(todayB, { full: false }))) : null,
    !todayB && next ? h('a', { class: 'card tap dr-line', href: '#/ticket/' + next.id, style: 'display:block' }, h('div', { class: 'small muted' }, 'مراجعتك الجاية'), h('b', {}, `د. ${next.doctor_name.replace(/^د\.?\s*/, '')} — ${fmtDate(next.date)}`), h('div', { class: 'small' }, next.status === 'pending' ? 'بانتظار موافقة الطبيب' : `دورك رقم ${n(next.seq)}`)) : null,
    nextDose ? h('a', { class: 'card tap dr-line brick', href: '#/notifications', style: 'display:block' }, h('div', { class: 'small muted' }, 'وقت علاجك الجاي · ' + fmtTime(nextDose.time)), h('b', {}, nextDose.drug), h('div', { class: 'small' }, nextDose.body.split('—')[1] || '')) : null,
    h('div', { class: 'grid' }, tiles.map(([href, ic, label, tone]) => h('a', { class: 'tile ' + tone, href }, icon(ic, 28), label))),
    near.length ? sectionTitle('أطباء قريبين منك', ['#/doctors', 'الكل']) : sectionTitle('أطباء', ['#/doctors', 'الكل']),
    h('div', { class: 'list' }, (near.length ? near : docs.doctors.slice(0, 3)).map(doctorCard))),
    tabbar('#/home'));
}

export function doctorCard(d) {
  return h('a', { class: 'card tap row', href: '#/doctor/' + d.id, style: 'color:inherit' },
    arch(d.name, 48), h('div', { class: 'grow' },
      h('div', { class: 'row', style: 'gap:6px' }, h('b', { style: 'font-family:var(--kufi);font-weight:600' }, d.name), d.verified ? seal(18) : null),
      h('div', { class: 'small muted' }, `${d.specialty} · ${d.area}`),
      h('div', { class: 'row small', style: 'margin-top:4px' }, stars(d.rating.avg, d.rating.count), d.available_today ? h('span', { class: 'badge palm' }, 'موجود اليوم') : null)),
    h('i', { class: 'chev' }));
}

// ---------- قائمة الأطباء ----------
export async function doctorsScreen() {
  const meta = await loadMeta();
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  const f = { q: qs.get('q') || '', specialty: '', area: S.user?.area || '', min: '' };
  const list = h('div', { class: 'list' });
  const load = async () => {
    list.replaceChildren(spinner());
    const p = new URLSearchParams(); if (f.q) p.set('q', f.q); if (f.specialty) p.set('specialty', f.specialty); if (f.area) p.set('area', f.area); if (f.min) p.set('min_rating', f.min);
    const r = await get('/doctors?' + p);
    list.replaceChildren(...(r.doctors.length ? r.doctors.map(doctorCard) : [empty('ماكو أطباء بهذا البحث', 'جرّب تغيّر التخصص أو المنطقة')]));
  };
  const sel = (key, items, ph) => h('select', { 'aria-label': ph, onChange: (e) => { f[key] = e.target.value; load(); } }, opts(items, f[key], ph));
  const q = h('input', { placeholder: 'اسم الطبيب أو التخصص', value: f.q, onInput: (e) => { f.q = e.target.value; clearTimeout(q._t); q._t = setTimeout(load, 300); } });
  const view = page({ title: 'أطباء', back: '#/home' },
    h('div', { class: 'card form' }, q,
      h('div', { class: 'row' }, sel('specialty', meta.specialties, 'كل التخصصات'), sel('area', meta.areas, 'كل المناطق')),
      sel('min', [{ value: '4', label: '٤ نجوم فأكثر' }, { value: '3', label: '٣ نجوم فأكثر' }], 'أي تقييم')),
    list);
  load();
  return h('div', {}, view, tabbar('#/home'));
}

// ---------- ملف الطبيب والحجز ----------
const mapUrl = (lat, lng, label) => lat != null && lng != null ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}` : `https://www.google.com/maps/search/${encodeURIComponent(label)}`;
export const mapBlock = (x) => h('div', { class: 'col' },
  x.lat != null && x.lng != null ? h('iframe', { class: 'map', title: 'الخريطة', loading: 'lazy', src: `https://www.openstreetmap.org/export/embed.html?bbox=${x.lng - 0.006},${x.lat - 0.004},${x.lng + 0.006},${x.lat + 0.004}&marker=${x.lat},${x.lng}&layer=mapnik` }) : null,
  h('a', { class: 'btn ghost small', href: mapUrl(x.lat, x.lng, x.address || x.title || ''), target: '_blank', rel: 'noopener' }, icon('pin', 18), 'افتح العنوان على الخريطة'));

export async function doctorProfile(id) {
  const r = await get('/doctors/' + id);
  const d = r.doctor;
  const isPatient = S.user.role === 'patient';
  const myB = isPatient ? (await get('/bookings')).bookings : [];
  const attended = myB.some((b) => b.doctor_id === d.id && ['attended', 'done'].includes(b.status));
  let chosen = null; const confirmBtn = h('button', { class: 'btn block', disabled: true, onClick: () => book() }, 'اختار اليوم أول');
  const book = async () => {
    confirmBtn.disabled = true;
    try {
      const x = await post('/bookings', { doctor_id: d.id, date: chosen });
      toast(x.booking.status === 'pending' ? 'العدد مكتمل، انرسل طلبك للدكتور' : `تم. دورك رقم ${n(x.booking.seq)}`);
      location.hash = '#/ticket/' + x.booking.id;
    } catch (e) { toast(e.message, true); confirmBtn.disabled = false; }
  };
  const chipEls = r.dates.map((x) => h('button', { class: 'chip', onClick: (e) => {
    chipEls.forEach((c) => c.classList.remove('on')); e.currentTarget.classList.add('on'); chosen = x.date;
    confirmBtn.disabled = false; confirmBtn.textContent = x.full ? `العدد مكتمل — أرسل طلب للدكتور (${fmtDate(x.date)})` : `احجز دوري يوم ${fmtDate(x.date)}`;
  } }, h('b', {}, fmtDate(x.date)), h('span', { class: 'small' }, x.full ? 'مكتمل' : `باقي ${n(x.capacity - x.taken)}`)));
  const sched = r.schedule.map((s) => h('tr', {}, h('td', {}, DAYS[s.weekday]), h('td', {}, s.closed ? h('span', { class: 'muted' }, 'عطلة') : `${fmtTime(s.open_time)} – ${fmtTime(s.close_time)}`)));
  return h('div', {}, page({ title: d.name, sub: `${d.specialty} · ${d.area}`, back: true },
    h('div', { class: 'card row top' }, arch(d.name, 72), h('div', { class: 'grow col' },
      h('div', { class: 'row', style: 'gap:6px' }, d.verified ? [seal(22), h('span', { class: 'badge lapis' }, 'طبيب موثّق')] : null),
      stars(d.rating.avg, d.rating.count),
      r.today.open ? h('span', { class: 'badge palm' }, `موجود اليوم ${fmtTime(r.today.from)} – ${fmtTime(r.today.to)}`) : h('span', { class: 'badge' }, `مو موجود اليوم (${r.today.reason})`),
      r.today.open ? h('div', { class: 'small muted' }, r.free_today ? `باقي ${n(r.free_today)} مقعد اليوم` : 'العدد اكتمل اليوم') : null,
      d.price ? h('div', { class: 'small' }, 'الكشفية: ', h('b', {}, iqd(d.price))) : null)),
    d.bio ? h('div', { class: 'card' }, h('div', { class: 'naskh', style: 'font-size:17px;line-height:1.9' }, d.bio)) : null,
    isPatient ? h('div', { class: 'card col' }, h('h3', {}, 'احجز دورك'), r.dates.length ? h('div', { class: 'chips' }, chipEls) : h('div', { class: 'muted' }, 'ماكو أيام متاحة هالفترة'), confirmBtn,
      h('button', { class: 'btn ghost block', onClick: async () => { try { await post('/chats', { doctor_id: d.id }); toast('انرسل طلب المراسلة للدكتور'); location.hash = '#/messages'; } catch (e) { toast(e.message, true); } } }, icon('chat', 20), 'راسل الدكتور')) : null,
    sectionTitle('جدول الدوام'), h('div', { class: 'card' }, h('table', { class: 'tbl' }, h('tbody', {}, sched)), r.leaves.length ? h('div', { class: 'small', style: 'margin-top:8px;color:var(--fired)' }, 'إجازات: ' + r.leaves.map((l) => fmtDate(l.from_date) + (l.to_date !== l.from_date ? ' → ' + fmtDate(l.to_date) : '')).join('، ')) : null),
    sectionTitle('العيادة'), h('div', { class: 'card col' }, h('div', { class: 'row' }, icon('pin', 20), d.address || d.area), mapBlock(d)),
    sectionTitle('آراء المراجعين'),
    isPatient && attended ? h('button', { class: 'btn brick block', onClick: () => rateModal('doctor', d.id, d.name) }, icon('star', 20), 'قيّم زيارتك') : null,
    h('div', { class: 'list' }, r.reviews.length ? r.reviews.map((v) => h('div', { class: 'card' }, h('div', { class: 'row between' }, h('b', {}, v.name.split(' ')[0] + ' ' + (v.name.split(' ')[1]?.[0] || '') + '.'), stars(v.stars)), v.comment ? h('div', { class: 'small', style: 'margin-top:4px' }, v.comment) : null)) : [empty('ماكو آراء بعد', 'كون أول واحد يقيّم')])),
    tabbar('#/doctors'));
}

export function rateModal(type, id, name) {
  let val = 0;
  const starEls = [1, 2, 3, 4, 5].map((i) => h('i', { class: 'st', onClick: () => { val = i; starEls.forEach((s, j) => s.classList.toggle('on', j < i)); } }));
  const text = h('textarea', { placeholder: 'اكتب رأيك (اختياري)' });
  modal((close) => [h('h3', {}, 'قيّم ' + name), h('div', { class: 'stars big', style: 'margin:16px 0' }, starEls), text,
    h('button', { class: 'btn block', style: 'margin-top:16px', onClick: async () => { if (!val) return toast('اختار عدد النجوم', true); try { await post('/ratings', { type, target_id: id, stars: val, comment: text.value }); close(); toast('شكرًا لرأيك'); location.reload(); } catch (e) { toast(e.message, true); } } }, 'أرسل')]);
}

// ---------- حجوزاتي ----------
export async function bookingsScreen() {
  const { bookings } = await get('/bookings');
  const t = (await loadMeta()).today;
  const up = bookings.filter((b) => b.date >= t && ['pending', 'confirmed', 'attended'].includes(b.status)).sort((a, b) => a.date.localeCompare(b.date));
  const past = bookings.filter((b) => !up.includes(b));
  const row = (b) => h('a', { class: 'card tap row dr-line ' + ({ pending: 'brick', confirmed: 'palm', done: '', cancelled: 'fired', rejected: 'fired' }[b.status] || ''), href: '#/ticket/' + b.id, style: 'color:inherit' },
    h('div', { class: 'grow' }, h('b', {}, 'د. ' + b.doctor_name.replace(/^د\.?\s*/, '')), h('div', { class: 'small muted' }, `${fmtDate(b.date)} · ${b.specialty}`), h('span', { class: 'badge ' + STATUS[b.status]?.[1] }, STATUS[b.status]?.[0])),
    h('div', { style: 'font-family:var(--kufi-d);font-size:32px;color:var(--lapis)' }, b.seq ? n(b.seq) : '—'), h('i', { class: 'chev' }));
  return h('div', {}, page({ title: 'حجوزاتي' },
    h('a', { class: 'btn block', href: '#/doctors' }, icon('plus', 20), 'احجز عند طبيب'),
    sectionTitle('القادمة'), up.length ? h('div', { class: 'list' }, up.map(row)) : empty('ماكو حجوزات قادمة', 'دوّر على طبيب واحجز دورك'),
    past.length ? [sectionTitle('السابقة'), h('div', { class: 'list' }, past.map(row))] : null), tabbar('#/bookings'));
}

export async function ticketScreen(id) {
  await loadMeta();
  const { booking: b } = await get('/bookings/' + id);
  const acts = [];
  if (['pending', 'confirmed'].includes(b.status)) {
    acts.push(h('button', { class: 'btn ghost block', onClick: () => postponeModal(b) }, 'أجّل الحجز'));
    acts.push(h('button', { class: 'btn fired block', onClick: async () => { if (await confirmBox('تلغي الحجز؟', `دورك رقم ${n(b.seq)} راح ينلغي.`, 'نعم، ألغي', 'fired')) { try { await post(`/bookings/${b.id}/cancel`); toast('انلغى الحجز'); location.hash = '#/bookings'; } catch (e) { toast(e.message, true); } } } }, 'ألغي الحجز'));
  }
  if (['attended', 'done'].includes(b.status)) acts.push(h('button', { class: 'btn brick block', onClick: () => rateModal('doctor', b.doctor_id, 'د. ' + b.doctor_name) }, icon('star', 20), 'قيّم الزيارة'));
  return h('div', {}, page({ title: 'بطاقة الحجز', back: '#/bookings' },
    h('div', { class: 'print-area' }, ticket(b)),
    h('div', { class: 'card col' }, h('div', { class: 'row' }, icon('pin', 20), h('span', {}, b.address || b.area)),
      h('a', { class: 'btn ghost small', href: '#/doctor/' + b.doctor_id }, 'ملف الطبيب'),
      h('button', { class: 'btn ghost small noprint', onClick: () => window.print() }, icon('print', 18), 'اطبع / احفظ PDF')),
    ...acts), tabbar('#/bookings'));
}

async function postponeModal(b) {
  const r = await get('/doctors/' + b.doctor_id);
  let chosen = null;
  const go = h('button', { class: 'btn block', disabled: true, style: 'margin-top:16px' }, 'أجّل');
  const chips = r.dates.filter((x) => x.date !== b.date).map((x) => h('button', { class: 'chip', onClick: (e) => { chips.forEach((c) => c.classList.remove('on')); e.currentTarget.classList.add('on'); chosen = x.date; go.disabled = false; } }, h('b', {}, fmtDate(x.date)), h('span', { class: 'small' }, x.full ? 'مكتمل' : `باقي ${n(x.capacity - x.taken)}`)));
  modal((close) => { go.onclick = async () => { try { const x = await post(`/bookings/${b.id}/postpone`, { date: chosen }); close(); toast('تم التأجيل'); location.hash = '#/ticket/' + x.booking.id; } catch (e) { toast(e.message, true); } }; return [h('h3', {}, 'أجّل لأي يوم؟'), h('div', { class: 'chips', style: 'margin-top:12px' }, chips), go]; });
}
