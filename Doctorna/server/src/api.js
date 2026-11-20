// واجهة REST لدكتورنا — كل القواعد هنا وعلى الخادم، الواجهة تعرض فقط
import { q, one, run, tx, now } from './db.js';
import {
  HttpError, bad, need, str, int, nameKey, normPhone, today, addDays, isDate, isTime,
  hashPass, checkPass, token, refCode,
} from './util.js';
import {
  notify, addPoints, defaultSchedule, availability, bookableDates, createBooking, createSpecial, bookingView,
  decideBooking, cancelBooking, postponeByPatient, checkIn, linkHistory, patientFile, remindersFor, ratingOf, doseTimes,
} from './logic.js';
import { runCommand } from './voice.js';
import { postSale, platformInfo } from './platform.js';

export const SPECIALTIES = ['باطنية', 'أطفال', 'نسائية وتوليد', 'جراحة عامة', 'عظام', 'جلدية', 'عيون', 'أنف وأذن وحنجرة', 'قلبية', 'أسنان', 'مسالك بولية', 'أعصاب', 'نفسية', 'سكري وغدد صماء'];
export const AREAS = ['الكرادة', 'المنصور', 'الأعظمية', 'الكاظمية', 'زيونة', 'الدورة', 'الجادرية', 'اليرموك', 'البياع', 'الشعب', 'مدينة الصدر', 'العامرية', 'البصرة', 'الموصل', 'أربيل', 'النجف', 'كربلاء'];
export const TOPICS = ['السكري', 'الضغط', 'الربو', 'القلب', 'الكلى', 'أخرى'];
export const TIERS = [{ cost: 100, percent: 5 }, { cost: 250, percent: 12 }, { cost: 500, percent: 25 }];

const routes = [];
const route = (method, path, auth, fn) => {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ method, re, keys, auth, fn });
};
const R = { any: true, patient: ['patient'], doctor: ['doctor'], staff: ['doctor', 'secretary'], pharmacy: ['pharmacy'], lab: ['lab'], admin: ['admin'] };

// ---------- مساعدات ----------
const publicUser = (u) => u && ({ id: u.id, role: u.role, name: u.name, phone: u.phone, area: u.area, verified: !!u.verified, subscribed: !!u.subscribed, points: u.points, refcode: u.refcode, is_owner: !!u.is_owner, doctor_id: u.doctor_id });
const docId = (u) => (u.role === 'secretary' ? u.doctor_id : u.id);
const pickDoc = (d) => ({ id: d.user_id, name: d.name, verified: !!d.verified, specialty: d.specialty, area: d.area, address: d.address, lat: d.lat, lng: d.lng, bio: d.bio, capacity: d.capacity, avg_minutes: d.avg_minutes, price: d.price, rating: ratingOf('doctor', d.user_id) });
const getDoctor = (id) => { const d = one('SELECT d.*, u.name, u.verified FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.user_id=?', id); need(d, 'الطبيب غير موجود', 404); return d; };
const imgOk = (s) => { if (!s) return null; need(/^data:image\/(png|jpe?g|webp);base64,/.test(s) && s.length < 2_200_000, 'الصورة غير صالحة أو كبيرة'); return s; };

function identityFromBooking(bookingId, doctorUserId) {
  const b = one('SELECT * FROM bookings WHERE id=? AND doctor_id=?', bookingId, doctorUserId);
  need(b, 'الحجز غير موجود', 404);
  return b;
}

// ---------- الحسابات ----------
route('POST', '/api/register', false, async ({ body }) => {
  const role = str(body.role, 20) || 'patient';
  need(['patient', 'doctor', 'pharmacy', 'lab'].includes(role), 'نوع الحساب غير صحيح');
  let name = str(body.name, 80);
  if (role === 'doctor' && name && !/^د\.?\s/.test(name)) name = 'د. ' + name;
  const phone = normPhone(body.phone), pass = String(body.password || '');
  need(name.length >= 3, 'اكتب الاسم الثلاثي');
  if (role === 'patient') need(name.split(/\s+/).length >= 3, 'اكتب الاسم الثلاثي (مثلًا: علي حسين كاظم)');
  need(phone, 'رقم الهاتف غير صحيح (07xxxxxxxxx)');
  need(pass.length >= 6, 'كلمة السر ست خانات على الأقل');
  need(!one('SELECT id FROM users WHERE phone=?', phone), 'هذا الرقم مسجّل من قبل', 409);
  const ref = body.ref ? one('SELECT id FROM users WHERE refcode=?', str(body.ref, 20).toUpperCase()) : null;
  const { salt, hash } = hashPass(pass);
  const id = tx(() => {
    const r = run(`INSERT INTO users(role,phone,name,name_key,pass_hash,salt,area,refcode,referred_by,created) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      role, phone, name, nameKey(name), hash, salt, str(body.area, 40), refCode(), ref?.id ?? null, now());
    const uid = Number(r.lastInsertRowid);
    if (role === 'doctor') {
      need(SPECIALTIES.includes(body.specialty), 'اختار التخصص');
      run('INSERT INTO doctors(user_id,specialty,area,address,license,license_pending) VALUES(?,?,?,?,?,1)', uid, body.specialty, str(body.area, 40), str(body.address, 200), str(body.license, 60));
      defaultSchedule(uid);
    }
    if (role === 'pharmacy' || role === 'lab') {
      run('INSERT INTO pharmacies(user_id,title,kind,area,address) VALUES(?,?,?,?,?)', uid, str(body.title, 80) || name, role === 'lab' ? 'lab' : 'pharmacy', str(body.area, 40), str(body.address, 200));
    }
    if (ref) { addPoints(ref.id, 100, 'دعوة صديق'); addPoints(uid, 50, 'هدية التسجيل بدعوة'); notify(ref.id, 'صديقك سجّل بدعوتك', '+١٠٠ نقطة', 'reward', '#/rewards'); }
    return uid;
  });
  const user = one('SELECT * FROM users WHERE id=?', id);
  if (role === 'patient') linkHistory(user);
  const t = token(); run('INSERT INTO sessions(token,user_id,created) VALUES(?,?,?)', t, id, now());
  return { token: t, user: publicUser(user) };
});

const attempts = new Map();
route('POST', '/api/login', false, async ({ body, ip }) => {
  const phone = normPhone(body.phone);
  const key = ip + phone, a = attempts.get(key) || { n: 0, t: now() };
  if (now() - a.t > 10 * 60e3) { a.n = 0; a.t = now(); }
  need(a.n < 8, 'محاولات كثيرة، جرّب بعد ١٠ دقايق', 429);
  const u = phone && one('SELECT * FROM users WHERE phone=?', phone);
  if (!u || !checkPass(String(body.password || ''), u.salt, u.pass_hash)) { a.n++; attempts.set(key, a); bad('الرقم أو كلمة السر غلط', 401); }
  attempts.delete(key);
  const t = token(); run('INSERT INTO sessions(token,user_id,created) VALUES(?,?,?)', t, u.id, now());
  return { token: t, user: publicUser(u) };
});
route('POST', '/api/logout', R.any, ({ tokenValue }) => { run('DELETE FROM sessions WHERE token=?', tokenValue); return { ok: true }; });
route('GET', '/api/me', R.any, ({ user }) => {
  const extra = {};
  if (user.role === 'doctor') extra.doctor = pickDoc(getDoctor(user.id));
  if (user.role === 'pharmacy' || user.role === 'lab') extra.pharmacy = one('SELECT * FROM pharmacies WHERE user_id=?', user.id);
  if (user.role === 'secretary') extra.doctor = pickDoc(getDoctor(user.doctor_id));
  return { user: publicUser(user), ...extra, unread: one('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', user.id).n };
});
route('PUT', '/api/me', R.any, ({ user, body }) => {
  run('UPDATE users SET name=?, name_key=?, area=? WHERE id=?', str(body.name, 80) || user.name, nameKey(str(body.name, 80) || user.name), str(body.area, 40), user.id);
  return { user: publicUser(one('SELECT * FROM users WHERE id=?', user.id)) };
});
route('POST', '/api/me/subscribe', R.any, ({ user, body }) => {
  run('UPDATE users SET subscribed=? WHERE id=?', body.on === false ? 0 : 1, user.id);
  return { subscribed: body.on !== false };
});
route('GET', '/api/meta', false, () => ({ specialties: SPECIALTIES, areas: AREAS, topics: TOPICS, tiers: TIERS, platform: platformInfo(), today: today() }));

// ---------- الأطباء ----------
route('GET', '/api/doctors', false, ({ query }) => {
  let rows = q('SELECT d.*, u.name, u.verified FROM doctors d JOIN users u ON u.id=d.user_id').map(pickDoc);
  if (query.specialty) rows = rows.filter((d) => d.specialty === query.specialty);
  if (query.area) rows = rows.filter((d) => d.area === query.area);
  if (query.q) { const k = nameKey(query.q); rows = rows.filter((d) => nameKey(d.name + ' ' + d.specialty + ' ' + d.area).includes(k)); }
  if (query.min_rating) rows = rows.filter((d) => d.rating.avg >= Number(query.min_rating));
  const t = today();
  rows = rows.map((d) => ({ ...d, available_today: availability(d.id, t).open }));
  rows.sort((a, b) => (b.verified - a.verified) || (b.rating.avg - a.rating.avg) || a.name.localeCompare(b.name, 'ar'));
  return { doctors: rows };
});
route('GET', '/api/doctors/:id', false, ({ params }) => {
  const d = getDoctor(int(params.id));
  const t = today();
  return {
    doctor: pickDoc(d),
    schedule: q('SELECT weekday,open_time,close_time,closed FROM schedule WHERE doctor_id=? ORDER BY weekday', d.user_id),
    leaves: q('SELECT from_date,to_date,note FROM leaves WHERE doctor_id=? AND to_date>=?', d.user_id, t),
    today: availability(d.user_id, t),
    dates: bookableDates(d.user_id),
    reviews: q(`SELECT r.stars, r.comment, r.created, u.name FROM ratings r JOIN users u ON u.id=r.user_id WHERE r.target_type='doctor' AND r.target_id=? ORDER BY r.id DESC LIMIT 20`, d.user_id),
    free_today: (() => { const c = one(`SELECT COUNT(*) n FROM bookings WHERE doctor_id=? AND date=? AND special=0 AND status IN ('confirmed','attended','done')`, d.user_id, t).n; return Math.max(0, d.capacity - c); })(),
  };
});
route('PUT', '/api/doctor/profile', R.doctor, ({ user, body }) => {
  const d = getDoctor(user.id);
  if (body.specialty) need(SPECIALTIES.includes(body.specialty), 'تخصص غير صحيح');
  const cap = body.capacity != null ? int(body.capacity) : d.capacity;
  need(cap >= 1 && cap <= 200, 'العدد اليومي بين ١ و ٢٠٠');
  const avg = body.avg_minutes != null ? int(body.avg_minutes) : d.avg_minutes;
  need(avg >= 1 && avg <= 120, 'مدة الكشف بين ١ و ١٢٠ دقيقة');
  run(`UPDATE doctors SET specialty=?, area=?, address=?, lat=?, lng=?, bio=?, capacity=?, avg_minutes=?, price=? WHERE user_id=?`,
    body.specialty || d.specialty, str(body.area ?? d.area, 40), str(body.address ?? d.address, 200),
    body.lat === '' || body.lat == null ? d.lat : Number(body.lat), body.lng === '' || body.lng == null ? d.lng : Number(body.lng),
    str(body.bio ?? d.bio, 800), cap, avg, int(body.price ?? d.price), user.id);
  if (body.license != null) run('UPDATE doctors SET license=?, license_pending=1 WHERE user_id=?', str(body.license, 60), user.id);
  return { doctor: pickDoc(getDoctor(user.id)) };
});
route('GET', '/api/doctor/schedule', R.doctor, ({ user }) => ({
  schedule: q('SELECT weekday,open_time,close_time,closed FROM schedule WHERE doctor_id=? ORDER BY weekday', user.id),
  leaves: q('SELECT * FROM leaves WHERE doctor_id=? ORDER BY from_date', user.id),
}));
route('PUT', '/api/doctor/schedule', R.doctor, ({ user, body }) => {
  need(Array.isArray(body.schedule) && body.schedule.length === 7, 'الجدول ٧ أيام');
  tx(() => {
    for (const s of body.schedule) {
      const wd = int(s.weekday, -1); need(wd >= 0 && wd <= 6, 'يوم غير صحيح');
      if (!s.closed) { need(isTime(s.open_time) && isTime(s.close_time) && s.open_time < s.close_time, 'ساعات الدوام غير صحيحة'); }
      run('INSERT OR REPLACE INTO schedule(doctor_id,weekday,open_time,close_time,closed) VALUES(?,?,?,?,?)', user.id, wd, s.closed ? null : s.open_time, s.closed ? null : s.close_time, s.closed ? 1 : 0);
    }
  });
  return { ok: true };
});
route('POST', '/api/doctor/leaves', R.doctor, ({ user, body }) => {
  need(isDate(body.from_date) && isDate(body.to_date) && body.to_date >= body.from_date, 'تواريخ الإجازة غير صحيحة');
  run('INSERT INTO leaves(doctor_id,from_date,to_date,note) VALUES(?,?,?,?)', user.id, body.from_date, body.to_date, str(body.note, 100));
  const hit = q(`SELECT * FROM bookings WHERE doctor_id=? AND date>=? AND date<=? AND status IN ('confirmed','pending')`, user.id, body.from_date, body.to_date);
  for (const b of hit) notify(b.patient_id, 'تغيّر دوام الطبيب', `${user.name} بإجازة يوم ${b.date}. تگدر تأجل أو تلغي حجزك.`, 'booking', '#/bookings');
  return { ok: true, affected: hit.length };
});
route('DELETE', '/api/doctor/leaves/:id', R.doctor, ({ user, params }) => { run('DELETE FROM leaves WHERE id=? AND doctor_id=?', int(params.id), user.id); return { ok: true }; });
route('POST', '/api/doctor/secretary', R.doctor, ({ user, body }) => {
  const name = str(body.name, 80), phone = normPhone(body.phone), pass = String(body.password || '');
  need(name.length >= 3 && phone && pass.length >= 6, 'الاسم والهاتف وكلمة سر (٦ خانات) مطلوبين');
  need(!one('SELECT id FROM users WHERE phone=?', phone), 'الرقم مسجّل من قبل', 409);
  const { salt, hash } = hashPass(pass);
  run(`INSERT INTO users(role,phone,name,name_key,pass_hash,salt,doctor_id,refcode,created) VALUES('secretary',?,?,?,?,?,?,?,?)`, phone, name, nameKey(name), hash, salt, user.id, refCode(), now());
  return { ok: true };
});
route('GET', '/api/doctor/secretaries', R.doctor, ({ user }) => ({ secretaries: q(`SELECT id,name,phone FROM users WHERE role='secretary' AND doctor_id=?`, user.id) }));

// ---------- الحجز (المريض) ----------
route('POST', '/api/bookings', R.patient, ({ user, body }) => {
  need(isDate(body.date), 'اختار اليوم');
  return { booking: createBooking({ doctorId: int(body.doctor_id), patientId: user.id, name: user.name, phone: user.phone, date: body.date, note: str(body.note, 200) }) };
});
route('GET', '/api/bookings', R.patient, ({ user }) => ({
  bookings: q('SELECT id FROM bookings WHERE patient_id=? ORDER BY date DESC, id DESC LIMIT 100', user.id).map((r) => bookingView(r.id)),
}));
route('GET', '/api/bookings/:id', R.any, ({ user, params }) => {
  const b = bookingView(int(params.id)); need(b, 'غير موجود', 404);
  need(b.patient_id === user.id || b.doctor_id === docId(user), 'ما تگدر', 403);
  return { booking: b };
});
route('POST', '/api/bookings/:id/cancel', R.any, ({ user, params }) => ({ booking: cancelBooking(int(params.id), user) }));
route('POST', '/api/bookings/:id/postpone', R.patient, ({ user, params, body }) => {
  need(isDate(body.date), 'اختار اليوم');
  return { booking: postponeByPatient(int(params.id), user, body.date) };
});

// ---------- لوحة الطبيب / السكرتير ----------
route('GET', '/api/doctor/queue', R.staff, ({ user, query }) => {
  const id = docId(user), date = isDate(query.date) ? query.date : today();
  const rows = q(`SELECT id FROM bookings WHERE doctor_id=? AND date=? AND status IN ('confirmed','attended','done') ORDER BY special, seq, id`, id, date).map((r) => bookingView(r.id));
  const pending = q(`SELECT id FROM bookings WHERE doctor_id=? AND status='pending' ORDER BY date, id`, id).map((r) => bookingView(r.id));
  const d = getDoctor(id);
  return { date, queue: rows, pending, capacity: d.capacity, availability: availability(id, date) };
});
route('POST', '/api/doctor/bookings/:id/decide', R.doctor, ({ user, params, body }) => ({ booking: decideBooking(user.id, int(params.id), body.action, body.date) }));
route('POST', '/api/doctor/checkin', R.staff, ({ user, body }) => ({ booking: checkIn(docId(user), body.code || '') }));
route('POST', '/api/doctor/walkin', R.staff, ({ user, body }) => {
  const id = docId(user), date = isDate(body.date) ? body.date : today();
  const ph = normPhone(body.phone), patient = ph && one(`SELECT * FROM users WHERE phone=? AND role='patient'`, ph);
  const b = createBooking({ doctorId: id, patientId: patient && patient.name_key === nameKey(body.name || '') ? patient.id : null, name: str(body.name, 80), phone: body.phone, date, source: 'clinic', force: true });
  return { booking: b };
});
route('POST', '/api/doctor/special', R.doctor, ({ user, body }) => ({ booking: createSpecial({ doctorId: user.id, seq: int(body.seq), name: str(body.name, 80), phone: body.phone, note: str(body.note, 100) }) }));
route('POST', '/api/doctor/bookings/:id/done', R.doctor, ({ user, params }) => {
  const b = identityFromBooking(int(params.id), user.id);
  need(['confirmed', 'attended'].includes(b.status), 'الحالة لا تسمح');
  run(`UPDATE bookings SET status='done', done_at=? WHERE id=?`, now(), b.id);
  notify(b.patient_id, 'الله يشافيك', `قيّم زيارتك عند ${user.name}`, 'rate', '#/doctor/' + user.id);
  return { booking: bookingView(b.id) };
});

// ---------- الملف الطبي ----------
route('GET', '/api/doctor/patient', R.doctor, ({ user, query }) => {
  const b = identityFromBooking(int(query.booking_id), user.id);
  return { patient: { name: b.patient_name, phone: b.phone, has_account: !!b.patient_id }, booking: bookingView(b.id), file: patientFile(b) };
});
route('POST', '/api/doctor/visit', R.doctor, ({ user, body }) => {
  const b = identityFromBooking(int(body.booking_id), user.id);
  const r = run(`INSERT INTO visits(doctor_id,patient_id,patient_name,name_key,phone,booking_id,date,complaint,diagnosis,notes,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    user.id, b.patient_id, b.patient_name, b.name_key, b.phone, b.id, b.date, str(body.complaint, 500), str(body.diagnosis, 500), str(body.notes, 1000), now());
  return { id: Number(r.lastInsertRowid) };
});
route('GET', '/api/drugs', R.any, ({ query }) => {
  const k = str(query.q, 40);
  if (k.length < 1) return { drugs: [] };
  const like = `%${k}%`;
  return { drugs: q('SELECT * FROM drugs WHERE name_en LIKE ? OR name_ar LIKE ? ORDER BY name_en LIMIT 12', like, like) };
});
route('POST', '/api/doctor/prescribe', R.doctor, ({ user, body }) => {
  const b = identityFromBooking(int(body.booking_id), user.id);
  const drug = body.drug_id ? one('SELECT * FROM drugs WHERE id=?', int(body.drug_id)) : null;
  const name = drug ? `${drug.name_en} ${drug.strength}`.trim() : str(body.drug_name, 100);
  need(name, 'اختار الدواء');
  const per = int(body.times_per_day, 1), days = int(body.days, 5);
  need(per >= 1 && per <= 6 && days >= 1 && days <= 365, 'الجرعات أو المدة غير صحيحة');
  const first = isTime(body.first_dose) ? body.first_dose : '08:00';
  const ph = body.pharmacy_id ? one(`SELECT user_id FROM pharmacies WHERE user_id=? AND kind='pharmacy'`, int(body.pharmacy_id)) : null;
  const r = run(`INSERT INTO prescriptions(doctor_id,patient_id,patient_name,name_key,phone,booking_id,drug_id,drug_name,form,times_per_day,days,first_dose,notes,pharmacy_id,status,created)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ordered',?)`,
    user.id, b.patient_id, b.patient_name, b.name_key, b.phone, b.id, drug?.id ?? null, name, drug?.form ?? '', per, days, first, str(body.notes, 200), ph?.user_id ?? null, now());
  if (ph) notify(ph.user_id, 'طلب علاج من طبيب', `${b.patient_name} · ${name}`, 'order', '#/pharmacy');
  notify(b.patient_id, 'الدكتور كتب لك علاج', `${name} — ${ph ? 'انرسل للصيدلية' : 'اختار صيدلية'}`, 'rx', '#/file');
  return { id: Number(r.lastInsertRowid) };
});
route('POST', '/api/doctor/lab', R.doctor, ({ user, body }) => {
  const b = identityFromBooking(int(body.booking_id), user.id);
  need(str(body.test, 120), 'اكتب التحليل المطلوب');
  const lab = body.lab_id ? one(`SELECT user_id FROM pharmacies WHERE user_id=? AND kind='lab'`, int(body.lab_id)) : null;
  const r = run(`INSERT INTO labs(doctor_id,patient_id,patient_name,name_key,phone,test,lab_id,created) VALUES(?,?,?,?,?,?,?,?)`, user.id, b.patient_id, b.patient_name, b.name_key, b.phone, str(body.test, 120), lab?.user_id ?? null, now());
  notify(lab?.user_id, 'طلب تحليل جديد', `${b.patient_name} · ${str(body.test, 60)}`, 'lab', '#/lab');
  notify(b.patient_id, 'الدكتور طلب منك تحليل', str(body.test, 60), 'lab', '#/file');
  return { id: Number(r.lastInsertRowid) };
});
route('GET', '/api/file', R.patient, ({ user }) => ({ patient: { name: user.name, phone: user.phone }, file: patientFile({ patient_id: user.id, name_key: user.name_key, phone: user.phone }) }));
route('POST', '/api/rx/:id/send', R.patient, ({ user, params, body }) => {
  const rx = one('SELECT * FROM prescriptions WHERE id=? AND patient_id=?', int(params.id), user.id); need(rx, 'غير موجود', 404);
  need(rx.status === 'ordered', 'هذا العلاج انباع أو انلغى');
  const ph = one(`SELECT user_id, title FROM pharmacies WHERE user_id=? AND kind='pharmacy'`, int(body.pharmacy_id)); need(ph, 'صيدلية غير موجودة', 404);
  run('UPDATE prescriptions SET pharmacy_id=? WHERE id=?', ph.user_id, rx.id);
  notify(ph.user_id, 'طلب علاج جديد', `${user.name} · ${rx.drug_name}`, 'order', '#/pharmacy');
  return { ok: true };
});

// ---------- الصيدليات ----------
const pickPh = (p) => ({ id: p.user_id, title: p.title, kind: p.kind, area: p.area, address: p.address, lat: p.lat, lng: p.lng, staff: p.staff, work_method: p.work_method, prices_note: p.prices_note, delivers: !!p.delivers, home_visit: !!p.home_visit, hours: p.hours, rating: ratingOf('pharmacy', p.user_id) });
route('GET', '/api/pharmacies', false, ({ query }) => {
  let rows = q(`SELECT * FROM pharmacies WHERE kind IN ('pharmacy','mobile')`).map(pickPh);
  if (query.area) rows = rows.filter((p) => p.area === query.area);
  if (query.q) { const k = nameKey(query.q); rows = rows.filter((p) => nameKey(p.title + ' ' + p.area).includes(k)); }
  if (query.delivery === '1') rows = rows.filter((p) => p.delivers);
  rows.sort((a, b) => b.rating.avg - a.rating.avg);
  return { pharmacies: rows };
});
route('GET', '/api/pharmacies/:id', false, ({ params }) => {
  const p = one('SELECT * FROM pharmacies WHERE user_id=?', int(params.id)); need(p, 'غير موجودة', 404);
  return { pharmacy: pickPh(p), reviews: q(`SELECT r.stars, r.comment, u.name FROM ratings r JOIN users u ON u.id=r.user_id WHERE r.target_type='pharmacy' AND r.target_id=? ORDER BY r.id DESC LIMIT 20`, p.user_id) };
});
route('GET', '/api/labs', false, () => ({ labs: q(`SELECT user_id id, title, area, address FROM pharmacies WHERE kind='lab'`) }));
route('POST', '/api/pharmacies/:id/request', R.patient, ({ user, params, body }) => {
  const p = one('SELECT * FROM pharmacies WHERE user_id=?', int(params.id)); need(p, 'غير موجودة', 404);
  const kind = body.kind === 'urgent' ? 'urgent' : 'drug';
  need(str(body.text, 300), 'اكتب شنو تحتاج');
  const r = run('INSERT INTO pharm_requests(user_id,pharmacy_id,kind,text,created) VALUES(?,?,?,?,?)', user.id, p.user_id, kind, str(body.text, 300), now());
  notify(p.user_id, kind === 'urgent' ? 'حالة مستعجلة' : 'طلب دواء', `${user.name} · ${str(body.text, 60)}`, kind === 'urgent' ? 'urgent' : 'order', '#/pharmacy');
  return { id: Number(r.lastInsertRowid) };
});
route('GET', '/api/my/pharm-requests', R.patient, ({ user }) => ({ requests: q('SELECT r.*, p.title FROM pharm_requests r JOIN pharmacies p ON p.user_id=r.pharmacy_id WHERE r.user_id=? ORDER BY r.id DESC LIMIT 50', user.id) }));
route('PUT', '/api/pharmacy/profile', ['pharmacy', 'lab'], ({ user, body }) => {
  const p = one('SELECT * FROM pharmacies WHERE user_id=?', user.id);
  run(`UPDATE pharmacies SET title=?, area=?, address=?, lat=?, lng=?, staff=?, work_method=?, prices_note=?, delivers=?, home_visit=?, hours=?, kind=? WHERE user_id=?`,
    str(body.title ?? p.title, 80), str(body.area ?? p.area, 40), str(body.address ?? p.address, 200), body.lat === '' || body.lat == null ? p.lat : Number(body.lat), body.lng === '' || body.lng == null ? p.lng : Number(body.lng),
    str(body.staff ?? p.staff, 300), str(body.work_method ?? p.work_method, 300), str(body.prices_note ?? p.prices_note, 300),
    body.delivers == null ? p.delivers : body.delivers ? 1 : 0, body.home_visit == null ? p.home_visit : body.home_visit ? 1 : 0, str(body.hours ?? p.hours, 100),
    p.kind === 'lab' ? 'lab' : (body.home_visit ? 'mobile' : 'pharmacy'), user.id);
  return { pharmacy: pickPh(one('SELECT * FROM pharmacies WHERE user_id=?', user.id)) };
});
route('GET', '/api/pharmacy/orders', R.pharmacy, ({ user }) => ({
  orders: q(`SELECT p.*, u.name doctor_name FROM prescriptions p LEFT JOIN users u ON u.id=p.doctor_id WHERE p.pharmacy_id=? AND p.status='ordered' ORDER BY p.id DESC`, user.id),
  requests: q(`SELECT r.*, u.name patient_name, u.phone patient_phone FROM pharm_requests r JOIN users u ON u.id=r.user_id WHERE r.pharmacy_id=? ORDER BY (r.status='new') DESC, r.id DESC LIMIT 60`, user.id),
  sales: q('SELECT * FROM sales WHERE pharmacy_id=? ORDER BY id DESC LIMIT 30', user.id),
}));

function applyCoupon(code, amount) {
  if (!code) return { amount, coupon: null };
  const c = one('SELECT * FROM coupons WHERE code=? AND used=0', str(code, 20).toUpperCase());
  need(c, 'الكوبون غير صالح أو مستخدم');
  return { amount: Math.round(amount * (100 - c.percent) / 100), coupon: c };
}
async function completeSale(user, rx, amount, couponCode) {
  const { amount: finalAmount, coupon } = applyCoupon(couponCode, amount);
  const plat = await postSale({ pharmacy: user.id, drug: rx.drug_name, amount: finalAmount, at: now() });
  tx(() => {
    run(`UPDATE prescriptions SET status='sold', received_date=?, pharmacy_id=? WHERE id=?`, today(), user.id, rx.id);
    run('INSERT INTO sales(pharmacy_id,prescription_id,drug_name,amount,platform_ref,created) VALUES(?,?,?,?,?,?)', user.id, rx.id, rx.drug_name, finalAmount, plat.ref, now());
    if (coupon) run('UPDATE coupons SET used=1 WHERE id=?', coupon.id);
    if (rx.patient_id) {
      addPoints(rx.patient_id, Math.max(1, Math.floor(finalAmount / 1000)), 'شراء دواء: ' + rx.drug_name);
      notify(rx.patient_id, 'وقت علاجك راح يبدي', `${rx.drug_name} · انسجل بملفك الطبي`, 'rx', '#/file');
    }
  });
  return { amount: finalAmount, platform: plat };
}
route('POST', '/api/pharmacy/orders/:id/sell', R.pharmacy, async ({ user, params, body }) => {
  const rx = one(`SELECT * FROM prescriptions WHERE id=? AND pharmacy_id=? AND status='ordered'`, int(params.id), user.id); need(rx, 'الطلب غير موجود', 404);
  const drug = rx.drug_id ? one('SELECT price FROM drugs WHERE id=?', rx.drug_id) : null;
  return completeSale(user, rx, int(body.amount, drug?.price || 0), body.coupon);
});
route('POST', '/api/pharmacy/sell', R.pharmacy, async ({ user, body }) => {
  const name = str(body.name, 80), ph = normPhone(body.phone);
  need(name.length >= 3 && ph, 'اسم المريض وهاتفه مطلوبين');
  const drug = body.drug_id ? one('SELECT * FROM drugs WHERE id=?', int(body.drug_id)) : null;
  const dn = drug ? `${drug.name_en} ${drug.strength}`.trim() : str(body.drug_name, 100); need(dn, 'اختار الدواء');
  const per = int(body.times_per_day, 1), days = int(body.days, 5);
  need(per >= 1 && per <= 6 && days >= 1 && days <= 365, 'الجرعات أو المدة غير صحيحة');
  const acc = one(`SELECT id FROM users WHERE phone=? AND name_key=? AND role='patient'`, ph, nameKey(name));
  const r = run(`INSERT INTO prescriptions(doctor_id,patient_id,patient_name,name_key,phone,drug_id,drug_name,form,times_per_day,days,first_dose,notes,pharmacy_id,status,created)
                 VALUES(0,?,?,?,?,?,?,?,?,?,?,?,?,'ordered',?)`, acc?.id ?? null, name, nameKey(name), ph, drug?.id ?? null, dn, drug?.form ?? '', per, days, isTime(body.first_dose) ? body.first_dose : '08:00', str(body.notes, 200), user.id, now());
  const rx = one('SELECT * FROM prescriptions WHERE id=?', Number(r.lastInsertRowid));
  return completeSale(user, rx, int(body.amount, drug?.price || 0), body.coupon);
});
route('POST', '/api/pharmacy/requests/:id/reply', R.pharmacy, ({ user, params, body }) => {
  const r = one('SELECT * FROM pharm_requests WHERE id=? AND pharmacy_id=?', int(params.id), user.id); need(r, 'غير موجود', 404);
  const status = ['come', 'visit', 'done', 'unavailable'].includes(body.status) ? body.status : 'done';
  run('UPDATE pharm_requests SET status=?, reply=? WHERE id=?', status, str(body.reply, 200), r.id);
  const msg = { come: 'تعال للصيدلية', visit: 'الصيدلاني الجوّال راح يزورك بالبيت', done: 'تم', unavailable: 'غير متوفر حاليًا' }[status];
  notify(r.user_id, 'رد الصيدلية: ' + msg, str(body.reply, 100), 'order', '#/pharmacies');
  return { ok: true };
});

// ---------- المختبر ----------
route('GET', '/api/lab/orders', R.lab, ({ user }) => ({ orders: q(`SELECT l.*, u.name doctor_name FROM labs l JOIN users u ON u.id=l.doctor_id WHERE (l.lab_id=? OR l.lab_id IS NULL) ORDER BY (l.status='requested') DESC, l.id DESC LIMIT 100`, user.id) }));
route('POST', '/api/lab/orders/:id/result', R.lab, ({ user, params, body }) => {
  const l = one('SELECT * FROM labs WHERE id=? AND (lab_id=? OR lab_id IS NULL)', int(params.id), user.id); need(l, 'غير موجود', 404);
  need(str(body.result, 3000), 'اكتب النتيجة');
  run(`UPDATE labs SET status='ready', result=?, lab_id=?, done_at=? WHERE id=?`, str(body.result, 3000), user.id, now(), l.id);
  notify(l.doctor_id, 'نتيجة تحليل وصلت', `${l.patient_name} · ${l.test}`, 'lab', '#/doctor');
  notify(l.patient_id, 'نتيجة تحليلك جاهزة', l.test, 'lab', '#/file');
  return { ok: true };
});

// ---------- المراسلة ----------
route('POST', '/api/chats', R.patient, ({ user, body }) => {
  const did = int(body.doctor_id); getDoctor(did);
  const c = one('SELECT * FROM chats WHERE patient_id=? AND doctor_id=?', user.id, did);
  if (c) return { chat: c };
  const r = run('INSERT INTO chats(patient_id,doctor_id,created) VALUES(?,?,?)', user.id, did, now());
  notify(did, 'طلب تواصل من مريض', user.name, 'request', '#/messages');
  return { chat: one('SELECT * FROM chats WHERE id=?', Number(r.lastInsertRowid)) };
});
route('GET', '/api/chats', R.any, ({ user }) => {
  const col = user.role === 'patient' ? 'patient_id' : 'doctor_id', id = user.id;
  need(['patient', 'doctor'].includes(user.role), 'ما تگدر', 403);
  return { chats: q(`SELECT c.*, pu.name patient_name, du.name doctor_name, (SELECT body FROM messages m WHERE m.chat_id=c.id ORDER BY m.id DESC LIMIT 1) last_body FROM chats c JOIN users pu ON pu.id=c.patient_id JOIN users du ON du.id=c.doctor_id WHERE c.${col}=? ORDER BY c.id DESC`, id) };
});
const chatFor = (user, id) => {
  const c = one('SELECT * FROM chats WHERE id=?', id); need(c, 'غير موجودة', 404);
  need(c.patient_id === user.id || c.doctor_id === user.id, 'ما تگدر', 403);
  return c;
};
route('POST', '/api/chats/:id/decide', R.doctor, ({ user, params, body }) => {
  const c = chatFor(user, int(params.id));
  run('UPDATE chats SET status=? WHERE id=?', body.accept ? 'accepted' : 'declined', c.id);
  notify(c.patient_id, body.accept ? 'الدكتور وافق على المراسلة' : 'الدكتور اعتذر عن المراسلة', `${user.name}`, 'chat', '#/messages');
  return { ok: true };
});
route('GET', '/api/chats/:id/messages', R.any, ({ user, params }) => {
  const c = chatFor(user, int(params.id));
  return { chat: c, messages: q('SELECT * FROM messages WHERE chat_id=? ORDER BY id', c.id) };
});
route('POST', '/api/chats/:id/messages', R.any, ({ user, params, body }) => {
  const c = chatFor(user, int(params.id));
  need(c.status === 'accepted', 'المراسلة تنفتح بعد موافقة الطبيب');
  const text = str(body.body, 2000), image = imgOk(body.image);
  need(text || image, 'اكتب رسالة أو أرفق صورة');
  const kind = body.kind === 'diagnosis' && user.role === 'doctor' ? 'diagnosis' : 'text';
  run('INSERT INTO messages(chat_id,sender_id,kind,body,image,created) VALUES(?,?,?,?,?,?)', c.id, user.id, kind, text, image, now());
  notify(user.id === c.doctor_id ? c.patient_id : c.doctor_id, kind === 'diagnosis' ? 'تشخيص مبدئي من الدكتور' : 'رسالة جديدة', text.slice(0, 60), 'chat', '#/messages');
  return { ok: true };
});

// ---------- التنبيهات ----------
route('GET', '/api/notifications', R.any, ({ user }) => ({ notifications: q('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 60', user.id) }));
route('POST', '/api/notifications/read', R.any, ({ user }) => { run('UPDATE notifications SET read=1 WHERE user_id=?', user.id); return { ok: true }; });
route('GET', '/api/reminders', R.patient, ({ user }) => ({ reminders: remindersFor(user.id), today: today() }));

// ---------- التقييم ----------
route('POST', '/api/ratings', R.any, ({ user, body }) => {
  const type = ['doctor', 'pharmacy', 'admin'].includes(body.type) ? body.type : null; need(type, 'نوع التقييم غير صحيح');
  const id = int(body.target_id), stars = int(body.stars);
  need(stars >= 1 && stars <= 5, 'التقييم من ١ إلى ٥');
  need(id !== user.id, 'ما تگدر تقيّم نفسك');
  if (type === 'doctor') {
    getDoctor(id);
    need(one(`SELECT id FROM bookings WHERE doctor_id=? AND patient_id=? AND status IN ('attended','done')`, id, user.id), 'تگدر تقيّم الطبيب بعد ما تراجعه');
  } else if (type === 'pharmacy') {
    need(one('SELECT user_id FROM pharmacies WHERE user_id=?', id), 'غير موجودة', 404);
    need(one(`SELECT 1 FROM prescriptions WHERE patient_id=? AND pharmacy_id=? AND status='sold' UNION SELECT 1 FROM pharm_requests WHERE user_id=? AND pharmacy_id=? AND status IN ('come','visit','done')`, user.id, id, user.id, id), 'تگدر تقيّم الصيدلية بعد ما تتعامل وياها');
  } else need(one(`SELECT id FROM users WHERE id=? AND role='admin'`, id), 'غير موجود', 404);
  run(`INSERT INTO ratings(target_type,target_id,user_id,stars,comment,created) VALUES(?,?,?,?,?,?)
       ON CONFLICT(target_type,target_id,user_id) DO UPDATE SET stars=excluded.stars, comment=excluded.comment, created=excluded.created`, type, id, user.id, stars, str(body.comment, 300), now());
  return { rating: ratingOf(type, id) };
});
route('GET', '/api/admins', false, () => ({ admins: q(`SELECT id, name FROM users WHERE role='admin'`).map((a) => ({ ...a, rating: ratingOf('admin', a.id) })) }));

// ---------- المنتدى والمدونة والأمراض المزمنة ----------
const postRow = (p) => ({ ...p, author: p.author, comments: p.comments });
route('GET', '/api/posts', false, ({ query }) => {
  const kind = ['forum', 'blog', 'chronic', 'support'].includes(query.kind) ? query.kind : 'forum';
  const args = [kind]; let extra = '';
  if (query.topic) { extra = ' AND p.topic=?'; args.push(query.topic); }
  return { posts: q(`SELECT p.*, u.name author, u.role author_role, u.verified author_verified, (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comments
                     FROM posts p JOIN users u ON u.id=p.user_id WHERE p.kind=? AND p.status='published'${extra} ORDER BY p.id DESC LIMIT 60`, ...args).map(postRow) };
});
route('GET', '/api/posts/:id', false, ({ params }) => {
  const p = one(`SELECT p.*, u.name author, u.role author_role, u.verified author_verified FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.status='published'`, int(params.id));
  need(p, 'غير موجود', 404);
  return { post: p, comments: q('SELECT c.*, u.name author, u.verified author_verified, u.role author_role FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id', p.id) };
});
route('POST', '/api/posts', R.any, ({ user, body }) => {
  const kind = ['forum', 'blog', 'chronic', 'support'].includes(body.kind) ? body.kind : 'forum';
  const title = str(body.title, 120), text = str(body.body, 6000);
  need(title.length >= 3 && text.length >= 5, 'اكتب عنوان ونص');
  const expert = user.role === 'admin' || (user.role === 'doctor' && user.verified);
  if (kind === 'blog' || kind === 'chronic') need(expert, 'المدونة ونصايح الأمراض المزمنة للأطباء الموثّقين فقط', 403);
  if (kind === 'chronic') need(TOPICS.includes(body.topic), 'اختار المرض');
  const status = expert || user.subscribed ? 'published' : 'pending';
  const r = run('INSERT INTO posts(user_id,kind,topic,title,body,status,created) VALUES(?,?,?,?,?,?,?)', user.id, kind, str(body.topic, 30), title, text, status, now());
  if (status === 'pending') for (const a of q(`SELECT id FROM users WHERE role='admin'`)) notify(a.id, 'منشور ينتظر الموافقة', title, 'request', '#/admin');
  return { id: Number(r.lastInsertRowid), post_status: status };
});
route('POST', '/api/posts/:id/comments', R.any, ({ user, params, body }) => {
  need(one(`SELECT id FROM posts WHERE id=? AND status='published'`, int(params.id)), 'غير موجود', 404);
  need(str(body.body, 800), 'اكتب تعليق');
  run('INSERT INTO comments(post_id,user_id,body,created) VALUES(?,?,?,?)', int(params.id), user.id, str(body.body, 800), now());
  return { ok: true };
});

// ---------- المكافآت والإحالة ----------
route('GET', '/api/rewards', R.any, ({ user }) => ({
  points: one('SELECT points FROM users WHERE id=?', user.id).points, refcode: user.refcode, tiers: TIERS,
  log: q('SELECT * FROM point_log WHERE user_id=? ORDER BY id DESC LIMIT 30', user.id),
  coupons: q('SELECT code,percent,used FROM coupons WHERE user_id=? ORDER BY id DESC', user.id),
  invited: one('SELECT COUNT(*) n FROM users WHERE referred_by=?', user.id).n,
}));
route('POST', '/api/rewards/redeem', R.any, ({ user, body }) => {
  const t = TIERS.find((x) => x.cost === int(body.cost)); need(t, 'فئة غير معروفة');
  return tx(() => {
    const pts = one('SELECT points FROM users WHERE id=?', user.id).points;
    need(pts >= t.cost, 'نقاطك ما تكفي');
    addPoints(user.id, -t.cost, `استبدال كوبون ${t.percent}٪`);
    const code = 'CP' + token().slice(0, 6).toUpperCase();
    run('INSERT INTO coupons(user_id,code,percent,cost,created) VALUES(?,?,?,?,?)', user.id, code, t.percent, t.cost, now());
    return { code, percent: t.percent };
  });
});

// ---------- المساعد الصوتي ----------
route('POST', '/api/voice', R.patient, ({ user, body }) => runCommand(user, str(body.text, 300), !!body.execute));

// ---------- الإدارة ----------
route('GET', '/api/admin/overview', R.admin, () => ({
  counts: {
    patients: one(`SELECT COUNT(*) n FROM users WHERE role='patient'`).n, doctors: one(`SELECT COUNT(*) n FROM users WHERE role='doctor'`).n,
    pharmacies: one(`SELECT COUNT(*) n FROM pharmacies`).n, bookings: one('SELECT COUNT(*) n FROM bookings').n, sales: one('SELECT COUNT(*) n FROM sales').n,
  },
  pending_doctors: q(`SELECT u.id, u.name, u.phone, d.specialty, d.license FROM users u JOIN doctors d ON d.user_id=u.id WHERE u.role='doctor' AND u.verified=0 ORDER BY u.id DESC`),
  pending_posts: q(`SELECT p.id, p.kind, p.title, p.body, u.name author FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='pending' ORDER BY p.id`),
  admins: q(`SELECT id, name, phone, is_owner FROM users WHERE role='admin'`),
  drugs: one('SELECT COUNT(*) n FROM drugs').n,
}));
route('POST', '/api/admin/verify', R.admin, ({ body }) => {
  const u = one('SELECT * FROM users WHERE id=?', int(body.user_id)); need(u && u.role === 'doctor', 'طبيب غير موجود', 404);
  run('UPDATE users SET verified=? WHERE id=?', body.verified === false ? 0 : 1, u.id);
  run('UPDATE doctors SET license_pending=0 WHERE user_id=?', u.id);
  notify(u.id, body.verified === false ? 'أُلغي توثيق حسابك' : 'تم توثيقك طبيبًا موثّقًا', '', 'info');
  return { ok: true };
});
route('POST', '/api/admin/posts/:id/decide', R.admin, ({ params, body }) => {
  const p = one('SELECT * FROM posts WHERE id=?', int(params.id)); need(p, 'غير موجود', 404);
  run('UPDATE posts SET status=? WHERE id=?', body.approve ? 'published' : 'rejected', p.id);
  notify(p.user_id, body.approve ? 'تم نشر منشورك' : 'ما انقبل منشورك', p.title, 'info', '#/forum');
  return { ok: true };
});
route('POST', '/api/admin/admins', R.admin, ({ user, body }) => {
  need(user.is_owner, 'التعيين لمالك التطبيق فقط', 403);
  const u = one('SELECT * FROM users WHERE phone=?', normPhone(body.phone)); need(u, 'ماكو حساب بهذا الرقم', 404);
  need(u.role === 'patient' || u.role === 'admin', 'الأدمن يكون حساب مريض عادي');
  run(`UPDATE users SET role='admin' WHERE id=?`, u.id);
  return { ok: true };
});
route('DELETE', '/api/admin/admins/:id', R.admin, ({ user, params }) => {
  need(user.is_owner, 'للمالك فقط', 403);
  const u = one('SELECT * FROM users WHERE id=?', int(params.id)); need(u && !u.is_owner, 'ما ينشال', 400);
  run(`UPDATE users SET role='patient' WHERE id=? AND role='admin'`, u.id);
  return { ok: true };
});
route('POST', '/api/admin/drugs/import', R.admin, ({ body }) => {
  need(Array.isArray(body.drugs) && body.drugs.length <= 20000, 'قائمة الأدوية غير صحيحة');
  let n = 0;
  tx(() => { for (const d of body.drugs) { if (!d.name_en) continue; run('INSERT INTO drugs(name_en,name_ar,form,strength,price) VALUES(?,?,?,?,?)', str(d.name_en, 80), str(d.name_ar, 80), str(d.form, 30) || 'حبوب', str(d.strength, 30), int(d.price)); n++; } });
  return { imported: n };
});

// ---------- الموزّع ----------
export async function handle(method, path, ctx) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.re.exec(path);
    if (!m) continue;
    ctx.params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    if (r.auth) {
      if (!ctx.user) throw new HttpError(401, 'سجّل دخولك أول');
      if (Array.isArray(r.auth) && !r.auth.includes(ctx.user.role)) throw new HttpError(403, 'هذي الصفحة مو لحسابك');
    }
    return r.fn(ctx);
  }
  throw new HttpError(404, 'غير موجود');
}
