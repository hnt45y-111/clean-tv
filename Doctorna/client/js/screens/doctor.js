import { h, icon, n, empty, field, opts, toast, modal, confirmBox, seal, arch, fmtDate, fmtDateFull, fmtTime, nail, DAYS, spinner, latin } from '../dom.js';
import { get, post, put, del, S, loadMeta } from '../api.js';
import { page, tabbar, sectionTitle } from '../layout.js';
import { fileView } from './file.js';

const ST = { pending: ['معلّق', 'brick'], confirmed: ['بالانتظار', ''], attended: ['حضر', 'teal'], done: ['خلّص', 'palm'] };

// ---------- لوحة اليوم ----------
export async function doctorHome() {
  const isDoc = S.user.role === 'doctor';
  const date = new URLSearchParams(location.hash.split('?')[1] || '').get('date') || (await loadMeta()).today;
  const r = await get('/doctor/queue?date=' + date);
  const shift = (d) => { const t = new Date(date + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + d); location.hash = '#/doctor?date=' + t.toISOString().slice(0, 10); };
  const row = (b) => h('div', { class: 'card row dr-line ' + ({ attended: 'teal', done: 'palm' }[b.status] || (b.special ? 'fired' : '')) },
    h('div', { style: 'font-family:var(--kufi-d);font-size:36px;width:48px;text-align:center;color:var(--lapis)' }, n(b.seq)),
    h('div', { class: 'grow' }, h('b', {}, b.patient_name), h('div', { class: 'small muted latin' }, b.phone), h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, h('span', { class: 'badge ' + ST[b.status][1] }, ST[b.status][0]), b.special ? h('span', { class: 'badge special' }, 'حالة خاصة') : null, b.source === 'clinic' ? h('span', { class: 'badge' }, 'من العيادة') : null)),
    isDoc && b.status !== 'done' ? h('a', { class: 'btn small', href: '#/doctor/patient/' + b.id }, 'افتح') : (isDoc ? h('a', { class: 'btn small ghost', href: '#/doctor/patient/' + b.id }, 'الملف') : null));
  const pend = (b) => h('div', { class: 'card col dr-line brick' }, h('div', { class: 'row between' }, h('b', {}, b.patient_name), h('span', { class: 'small' }, fmtDate(b.date))),
    h('div', { class: 'small muted' }, 'العدد اكتمل وهذا الطلب يحتاج موافقتك'),
    h('div', { class: 'row' }, h('button', { class: 'btn small palm', onClick: () => act(b, 'accept') }, 'اقبل'), h('button', { class: 'btn small ghost', onClick: () => postponeBox(b) }, 'أجّل'), h('button', { class: 'btn small fired', onClick: () => act(b, 'reject') }, 'ارفض')));
  const act = async (b, action, d) => { try { await post(`/doctor/bookings/${b.id}/decide`, { action, date: d }); toast('تم'); location.reload(); } catch (e) { toast(e.message, true); } };
  const postponeBox = (b) => { const d = h('input', { type: 'date', min: b.date }); modal((close) => [h('h3', {}, 'أجّل الطلب ليوم'), field('اليوم (بالاتفاق مع المريض)', d), h('button', { class: 'btn block', style: 'margin-top:16px', onClick: () => { close(); act(b, 'postpone', d.value); } }, 'أجّل')]); };
  const total = r.queue.filter((b) => !b.special).length;
  return h('div', {}, page({ title: isDoc ? 'اليوم' : 'العيادة', sub: S.extra.doctor ? S.extra.doctor.name : '' },
    h('div', { class: 'card row between' }, h('button', { class: 'ico-btn', onClick: () => shift(-1), 'aria-label': 'اليوم السابق' }, icon('back')), h('div', { style: 'text-align:center' }, h('b', {}, fmtDateFull(date)), h('div', { class: 'small muted' }, r.availability.open ? `دوام ${fmtTime(r.availability.from)} – ${fmtTime(r.availability.to)}` : `مو دوام (${r.availability.reason})`)), h('button', { class: 'ico-btn', style: 'transform:scaleX(-1)', onClick: () => shift(1), 'aria-label': 'اليوم التالي' }, icon('back'))),
    h('div', { class: 'kpi' }, [['الحجوزات', `${n(total)}/${n(r.capacity)}`], ['حضروا', n(r.queue.filter((b) => b.status === 'attended').length)], ['خلّصوا', n(r.queue.filter((b) => b.status === 'done').length)]].map(([l, v]) => h('div', { class: 'card' }, h('b', {}, v), h('div', { class: 'small muted' }, l)))),
    h('div', { class: 'row' }, h('button', { class: 'btn block', onClick: scanBox }, icon('qr', 22), 'سجّل حضور'), h('button', { class: 'btn block brick', onClick: () => walkin(date, isDoc) }, icon('plus', 22), 'إضافة مريض')),
    r.pending.length ? [sectionTitle('طلبات تنتظر موافقتك'), h('div', { class: 'list' }, r.pending.map(pend))] : null,
    sectionTitle('طابور اليوم'), r.queue.length ? h('div', { class: 'list' }, r.queue.map(row)) : empty('ماكو حجوزات بهذا اليوم', 'المريض يحجز من التطبيق أو سجّله من العيادة')),
    tabbar('#/doctor'));
}

function scanBox() {
  const input = h('input', { placeholder: 'DR-2611-0012', dir: 'ltr', style: 'text-align:center;letter-spacing:1px' });
  const video = h('video', { class: 'scanbox hide', playsinline: true, muted: true });
  let stream, stop = false;
  const submit = async (code, close) => { try { const x = await post('/doctor/checkin', { code }); stop = true; stream?.getTracks().forEach((t) => t.stop()); close(); toast(`حضر ${x.booking.patient_name} · رقم ${n(x.booking.seq)}`); location.reload(); } catch (e) { toast(e.message, true); } };
  modal((close) => {
    const cam = h('button', { class: 'btn ghost block', onClick: async () => {
      if (!('BarcodeDetector' in window)) return toast('الكاميرا ما تدعم قراءة الباركود بهذا المتصفح، اكتب الرمز', true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); video.srcObject = stream; video.classList.remove('hide'); await video.play();
        const det = new BarcodeDetector({ formats: ['code_128'] });
        (async function loop() { if (stop) return; try { const c = await det.detect(video); if (c[0]) return submit(c[0].rawValue, close); } catch {} requestAnimationFrame(loop); })();
      } catch { toast('ما اشتغلت الكاميرا، اكتب الرمز', true); }
    } }, icon('cam', 20), 'افتح الكاميرا واقرأ الباركود');
    return [h('h3', {}, 'تسجيل حضور المريض'), h('div', { class: 'col', style: 'margin-top:12px' }, cam, video, field('أو اكتب رمز البطاقة', input), h('button', { class: 'btn block', onClick: () => submit(input.value, close) }, 'سجّل'))];
  });
}

function walkin(date, isDoc) {
  const name = h('input', { placeholder: 'الاسم الثلاثي' }), phone = h('input', { type: 'tel', placeholder: '07xxxxxxxxx', dir: 'ltr', style: 'text-align:right' });
  modal((close) => [h('h3', {}, 'إضافة مريض من العيادة'), h('p', { class: 'small muted' }, 'اسمه الثلاثي ورقم هاتفه فقط. ينسجل برقم تسلسلي وتنطبع له بطاقة. لو سوّى حساب بعدين بنفس الاسم والهاتف، يطلع له سجله.'),
    h('div', { class: 'form' }, field('الاسم الثلاثي', name), field('الهاتف', phone), h('button', { class: 'btn block', onClick: async () => { try { const x = await post('/doctor/walkin', { name: name.value, phone: phone.value, date }); close(); printTicket(x.booking); } catch (e) { toast(e.message, true); } } }, 'سجّل وطباعة البطاقة'),
      isDoc ? h('button', { class: 'btn ghost block', onClick: () => { close(); special(date); } }, 'حالة خاصة (مستعجل)') : null)]);
}
async function printTicket(b) {
  const { code128 } = await import('../barcode.js');
  const box = h('div', { class: 'print-area', style: 'display:none' }, h('div', { class: 'card', style: 'text-align:center' }, h('h2', {}, 'دكتورنا'), h('div', { style: 'font-family:var(--kufi-d);font-size:72px' }, n(b.seq)), h('div', {}, b.patient_name), h('div', { class: 'small' }, `د. ${b.doctor_name.replace(/^د\.?\s*/, '')} · ${fmtDate(b.date)}`), code128(b.code), h('div', { class: 'code' }, b.code)));
  document.getElementById('app').append(box);
  modal((close) => [h('h3', {}, `تم التسجيل · رقم ${n(b.seq)}`), h('div', { style: 'text-align:center;margin:12px 0' }, code128(b.code), h('div', { class: 'code' }, b.code)), h('button', { class: 'btn block', onClick: () => window.print() }, icon('print', 20), 'اطبع البطاقة'), h('button', { class: 'btn ghost block', style: 'margin-top:8px', onClick: () => { close(); box.remove(); location.reload(); } }, 'تم')]);
}
function special(date) {
  const seq = h('input', { type: 'number', min: 1, placeholder: 'رقم المريض اللي كمّل' }), name = h('input', { placeholder: 'الاسم الثلاثي' }), phone = h('input', { type: 'tel', placeholder: '07xxxxxxxxx', dir: 'ltr', style: 'text-align:right' });
  modal((close) => [h('h3', {}, 'حالة خاصة'), h('p', { class: 'small muted' }, 'ينسجل نفس الرقم مكرّرًا بوسم «حالة خاصة» بشرط إن صاحب الرقم دخل وكمّل.'), h('div', { class: 'form' }, field('الرقم', seq), field('الاسم', name), field('الهاتف', phone),
    h('button', { class: 'btn block fired', onClick: async () => { try { const x = await post('/doctor/special', { seq: Number(seq.value), name: name.value, phone: phone.value }); close(); printTicket(x.booking); } catch (e) { toast(e.message, true); } } }, 'سجّل الحالة'))]);
}

// ---------- ملف المريض عند الطبيب ----------
export async function patientScreen(id) {
  const r = await get('/doctor/patient?booking_id=' + id), b = r.booking;
  const [phs, labs] = await Promise.all([get('/pharmacies'), get('/labs')]);
  const hold = h('div'); const draw = async () => { const x = await get('/doctor/patient?booking_id=' + id); hold.replaceChildren(fileView(x.file, { patient: x.patient })); }; hold.append(fileView(r.file, { patient: r.patient }));
  return h('div', {}, page({ title: r.patient.name, sub: `رقم ${n(b.seq)} · ${fmtDate(b.date)}`, back: '#/doctor' },
    h('div', { class: 'row' }, h('span', { class: 'badge ' + ST[b.status][1] }, ST[b.status][0]), b.special ? h('span', { class: 'badge special' }, 'حالة خاصة') : null, h('span', { class: 'small muted latin' }, r.patient.phone), r.patient.has_account ? null : h('span', { class: 'badge' }, 'بدون تطبيق')),
    h('div', { class: 'grid', style: 'grid-template-columns:repeat(3,1fr)' },
      h('button', { class: 'tile', onClick: () => visitBox(id, draw) }, icon('edit', 28), 'تشخيص وزيارة'),
      h('button', { class: 'tile palm', onClick: () => rxBox(id, phs.pharmacies, draw) }, icon('pill', 28), 'اكتب علاج'),
      h('button', { class: 'tile teal', onClick: () => labBox(id, labs.labs, draw) }, icon('lab', 28), 'اطلب تحليل')),
    ['confirmed', 'attended'].includes(b.status) ? h('button', { class: 'btn palm block', onClick: async () => { await post(`/doctor/bookings/${id}/done`); toast('خلّصت الزيارة'); location.hash = '#/doctor'; } }, icon('check', 22), 'خلّصت الزيارة') : null,
    sectionTitle('ملفه الطبي'), hold), tabbar('#/doctor'));
}
function visitBox(id, done) {
  const c = h('input', { placeholder: 'الشكوى' }), d = h('input', { placeholder: 'التشخيص' }), nt = h('textarea', { placeholder: 'ملاحظات' });
  modal((close) => [h('h3', {}, 'زيارة'), h('div', { class: 'form' }, field('الشكوى', c), field('التشخيص', d), field('ملاحظات', nt), h('button', { class: 'btn block', onClick: async () => { try { await post('/doctor/visit', { booking_id: id, complaint: c.value, diagnosis: d.value, notes: nt.value }); close(); toast('انحفظت الزيارة'); done(); } catch (e) { toast(e.message, true); } } }, 'احفظ'))]);
}
function rxBox(id, pharmacies, done) {
  let drug = null;
  const q = h('input', { placeholder: 'اكتب اسم الدواء (Panadol، بنادول…)', autocomplete: 'off' }), res = h('div', { class: 'list' });
  const per = h('select', {}, [1, 2, 3, 4].map((x) => h('option', { value: x, selected: x === 3 }, `${n(x)} مرة باليوم`))), days = h('input', { type: 'number', min: 1, value: 5 }), first = h('input', { type: 'time', value: '08:00' }), notes = h('input', { placeholder: 'مثلًا: بعد الأكل' });
  const ph = h('select', {}, opts(pharmacies.map((p) => ({ value: String(p.id), label: p.title + ' — ' + p.area })), '', 'اختار الصيدلية (اختياري)'));
  q.addEventListener('input', () => { drug = null; clearTimeout(q._t); q._t = setTimeout(async () => { if (!q.value.trim()) return res.replaceChildren(); const r = await get('/drugs?q=' + encodeURIComponent(q.value)); res.replaceChildren(...r.drugs.map((d) => h('button', { class: 'card tap row', style: 'text-align:start;cursor:pointer', onClick: () => { drug = d; q.value = `${d.name_en} ${d.strength}`; res.replaceChildren(); } }, h('div', { class: 'grow' }, h('b', { class: 'latin' }, `${d.name_en} ${d.strength}`), h('div', { class: 'small muted' }, `${d.name_ar} · ${d.form}`))))); }, 200); });
  modal((close) => [h('h3', {}, 'اكتب علاج'), h('div', { class: 'form' }, field('الدواء', q), res, h('div', { class: 'row' }, field('الجرعات', per), field('المدة (أيام)', days)), field('أول جرعة', first), field('ملاحظات', notes), field('ابعثه للصيدلية', ph),
    h('button', { class: 'btn block palm', onClick: async () => { try { await post('/doctor/prescribe', { booking_id: id, drug_id: drug?.id, drug_name: drug ? '' : q.value, times_per_day: Number(per.value), days: Number(days.value), first_dose: first.value, notes: notes.value, pharmacy_id: ph.value ? Number(ph.value) : null }); close(); toast(ph.value ? 'انرسل للصيدلية' : 'انكتب العلاج'); done(); } catch (e) { toast(e.message, true); } } }, 'احفظ وأرسل'))]);
}
function labBox(id, labs, done) {
  const t = h('input', { placeholder: 'مثلًا: CBC، سكر صائم…' }), l = h('select', {}, opts(labs.map((x) => ({ value: String(x.id), label: x.title + ' — ' + x.area })), '', 'أي مختبر'));
  modal((close) => [h('h3', {}, 'اطلب تحليل'), h('div', { class: 'form' }, field('التحليل', t), field('المختبر', l), h('button', { class: 'btn block teal', onClick: async () => { try { await post('/doctor/lab', { booking_id: id, test: t.value, lab_id: l.value ? Number(l.value) : null }); close(); toast('انطلب التحليل'); done(); } catch (e) { toast(e.message, true); } } }, 'أرسل الطلب'))]);
}

// ---------- دوام العيادة وإعداداتها ----------
export async function doctorSettings() {
  const meta = await loadMeta();
  const [{ schedule, leaves }, me, secs] = await Promise.all([get('/doctor/schedule'), get('/me'), get('/doctor/secretaries')]);
  const d = me.doctor;
  const rows = schedule.map((s) => ({ ...s, o: h('input', { type: 'time', value: s.open_time || '16:00', style: 'min-height:40px;padding:4px 8px' }), c: h('input', { type: 'time', value: s.close_time || '21:00', style: 'min-height:40px;padding:4px 8px' }), x: h('input', { type: 'checkbox', checked: !!s.closed }) }));
  const f = { spec: h('select', {}, opts(meta.specialties, d.specialty)), area: h('select', {}, opts(meta.areas, d.area, 'المنطقة')), addr: h('input', { value: d.address }), cap: h('input', { type: 'number', min: 1, value: d.capacity }), avg: h('input', { type: 'number', min: 1, value: d.avg_minutes }), price: h('input', { type: 'number', value: d.price }), bio: h('textarea', { value: d.bio }), lat: h('input', { value: d.lat ?? '', dir: 'ltr', placeholder: '33.3' }), lng: h('input', { value: d.lng ?? '', dir: 'ltr', placeholder: '44.4' }), lic: h('input', { placeholder: 'رقم هوية النقابة' }) };
  f.bio.value = d.bio;
  const gps = () => navigator.geolocation?.getCurrentPosition((p) => { f.lat.value = p.coords.latitude.toFixed(5); f.lng.value = p.coords.longitude.toFixed(5); toast('انحسب موقعك'); }, () => toast('ما گدرت أحدد الموقع', true));
  const lf = h('input', { type: 'date' }), lt = h('input', { type: 'date' }), ln = h('input', { placeholder: 'السبب (اختياري)' });
  const sn = h('input', { placeholder: 'اسم السكرتير/ة' }), sp = h('input', { type: 'tel', placeholder: '07xxxxxxxxx', dir: 'ltr', style: 'text-align:right' }), sw = h('input', { type: 'password', placeholder: 'كلمة سر', dir: 'ltr', style: 'text-align:right' });
  return h('div', {}, page({ title: 'دوامي وعيادتي', back: '#/me' },
    h('div', { class: 'card col' }, h('h3', {}, 'جدول الدوام الأسبوعي'), h('div', { class: 'hint' }, 'ثابت كل أسبوع، وتعدّله بأي وقت. المريض يحجز بأيام وأوقات الدوام فقط.'),
      h('table', { class: 'tbl' }, h('tbody', {}, rows.map((r) => h('tr', {}, h('td', {}, DAYS[r.weekday]), h('td', {}, r.o), h('td', {}, r.c), h('td', {}, h('label', { class: 'row small' }, r.x, 'عطلة')))))),
      h('button', { class: 'btn block', onClick: async () => { try { await put('/doctor/schedule', { schedule: rows.map((r) => ({ weekday: r.weekday, open_time: r.o.value, close_time: r.c.value, closed: r.x.checked })) }); toast('انحفظ الدوام'); } catch (e) { toast(e.message, true); } } }, 'احفظ الدوام')),
    h('div', { class: 'card col' }, h('h3', {}, 'الإجازات'), ...leaves.map((l) => h('div', { class: 'row between' }, h('span', {}, `${fmtDate(l.from_date)} → ${fmtDate(l.to_date)} ${l.note ? '· ' + l.note : ''}`), h('button', { class: 'btn small ghost', onClick: async () => { await del('/doctor/leaves/' + l.id); location.reload(); } }, 'احذف'))),
      h('div', { class: 'row' }, field('من', lf), field('إلى', lt)), field('السبب', ln), h('button', { class: 'btn ghost block', onClick: async () => { try { const r = await post('/doctor/leaves', { from_date: lf.value, to_date: lt.value, note: ln.value }); toast(r.affected ? `انحفظت. تم تنبيه ${n(r.affected)} مراجع` : 'انحفظت الإجازة'); location.reload(); } catch (e) { toast(e.message, true); } } }, 'أضف إجازة')),
    h('div', { class: 'card form' }, h('h3', {}, 'العيادة'), field('التخصص', f.spec), field('المنطقة', f.area), field('العنوان', f.addr), h('div', { class: 'row' }, field('العدد اليومي', f.cap), field('دقائق الكشف', f.avg)), field('الكشفية (دينار)', f.price), field('نبذة', f.bio),
      h('div', { class: 'row' }, field('خط العرض', f.lat), field('خط الطول', f.lng)), h('button', { class: 'btn ghost small', onClick: gps }, icon('pin', 18), 'حدّد موقعي'),
      field('رقم النقابة للتوثيق', f.lic, me.user.verified ? 'حسابك موثّق ✓' : 'بانتظار تحقق الإدارة'),
      h('button', { class: 'btn block', onClick: async () => { try { await put('/doctor/profile', { specialty: f.spec.value, area: f.area.value, address: f.addr.value, capacity: f.cap.value, avg_minutes: f.avg.value, price: f.price.value, bio: f.bio.value, lat: f.lat.value, lng: f.lng.value, license: f.lic.value || undefined }); toast('انحفظ'); } catch (e) { toast(e.message, true); } } }, 'احفظ')),
    h('div', { class: 'card col' }, h('h3', {}, 'السكرتير'), h('div', { class: 'hint' }, 'السكرتير يسجّل الحضور ويضيف مرضى من العيادة، بدون ما يشوف الملفات الطبية.'), ...secs.secretaries.map((s) => h('div', { class: 'row small' }, icon('user', 18), s.name, h('span', { class: 'latin muted' }, s.phone))),
      field('الاسم', sn), field('الهاتف', sp), field('كلمة السر', sw), h('button', { class: 'btn ghost block', onClick: async () => { try { await post('/doctor/secretary', { name: sn.value, phone: sp.value, password: sw.value }); toast('انضاف السكرتير'); location.reload(); } catch (e) { toast(e.message, true); } } }, 'أضف سكرتير'))), tabbar('#/me'));
}
