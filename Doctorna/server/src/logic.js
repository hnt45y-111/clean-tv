// قواعد العمل: الحجز والأرقام التسلسلية، الدوام، النقاط، التنبيهات، ربط السجلات
import { q, one, run, tx, now } from './db.js';
import { bad, need, today, nowHHMM, addDays, weekday, nameKey, normPhone, diffDays } from './util.js';

const ACTIVE = "('confirmed','attended','done')";

// ---------- التنبيهات والنقاط ----------
export function notify(userId, title, body = '', kind = 'info', link = '') {
  if (!userId) return;
  run('INSERT INTO notifications(user_id,title,body,kind,link,created) VALUES(?,?,?,?,?,?)', userId, title, body, kind, link, now());
}
export function addPoints(userId, delta, reason) {
  if (!userId || !delta) return;
  run('UPDATE users SET points=points+? WHERE id=?', delta, userId);
  run('INSERT INTO point_log(user_id,delta,reason,created) VALUES(?,?,?,?)', userId, delta, reason, now());
}

// ---------- دوام الطبيب ----------
export function defaultSchedule(doctorId) {
  for (let d = 0; d <= 6; d++) {
    run('INSERT OR REPLACE INTO schedule(doctor_id,weekday,open_time,close_time,closed) VALUES(?,?,?,?,?)', doctorId, d, '16:00', '21:00', d === 5 ? 1 : 0);
  }
}
export function onLeave(doctorId, date) {
  return one('SELECT * FROM leaves WHERE doctor_id=? AND from_date<=? AND to_date>=?', doctorId, date, date);
}
// هل الطبيب موجود هذا اليوم؟ يرجع {open, from, to, reason}
export function availability(doctorId, date) {
  const lv = onLeave(doctorId, date);
  if (lv) return { open: false, reason: lv.note || 'إجازة' };
  const s = one('SELECT * FROM schedule WHERE doctor_id=? AND weekday=?', doctorId, weekday(date));
  if (!s || s.closed) return { open: false, reason: 'عطلة' };
  return { open: true, from: s.open_time, to: s.close_time };
}
export function bookableDates(doctorId, days = 14) {
  const out = [];
  for (let i = 0; i <= days; i++) {
    const d = addDays(today(), i);
    const a = availability(doctorId, d);
    if (!a.open) continue;
    if (i === 0 && nowHHMM() >= a.to) continue;
    const c = one(`SELECT COUNT(*) n FROM bookings WHERE doctor_id=? AND date=? AND special=0 AND status IN ${ACTIVE}`, doctorId, d).n;
    const cap = one('SELECT capacity FROM doctors WHERE user_id=?', doctorId).capacity;
    out.push({ date: d, from: a.from, to: a.to, taken: c, capacity: cap, full: c >= cap });
  }
  return out;
}

// ---------- الحجز ----------
function freeSeq(doctorId, date, capacity) {
  const rows = q(`SELECT seq FROM bookings WHERE doctor_id=? AND date=? AND special=0 AND status IN ${ACTIVE}`, doctorId, date);
  if (rows.length >= capacity) return 0; // العدد مكتمل حتى لو بقى رقم فاضي بسبب حجز أضافه الطبيب فوق العدد
  const used = new Set(rows.map((r) => r.seq));
  for (let i = 1; i <= capacity; i++) if (!used.has(i)) return i;
  return 0;
}
function overflowSeq(doctorId, date) {
  return (one('SELECT COALESCE(MAX(seq),0) m FROM bookings WHERE doctor_id=? AND date=? AND special=0', doctorId, date).m) + 1;
}
function makeCode(id) {
  const d = new Date(Date.now() + 3 * 3600e3).toISOString();
  return `DR-${d.slice(2, 4)}${d.slice(5, 7)}-${String(id).padStart(4, '0')}`;
}

export function createBooking({ doctorId, patientId = null, name, phone, date, source = 'app', note = '', force = false }) {
  const doc = one('SELECT d.*, u.name dname FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.user_id=?', doctorId);
  need(doc, 'الطبيب غير موجود', 404);
  need(name && name.trim().length >= 3, 'اكتب الاسم الثلاثي');
  const ph = normPhone(phone); need(ph, 'رقم الهاتف غير صحيح');
  const nk = nameKey(name);
  const av = availability(doctorId, date);
  need(date >= today(), 'التاريخ مضى');
  need(diffDays(today(), date) <= 30, 'الحجز متاح لشهر قدّام فقط');
  need(av.open, `الطبيب مو موجود بهذا اليوم (${av.reason})`);
  if (date === today() && !force) need(nowHHMM() < av.to, 'انتهى دوام الطبيب اليوم');
  const dup = one(`SELECT id FROM bookings WHERE doctor_id=? AND date=? AND name_key=? AND phone=? AND status IN ('pending','confirmed','attended')`, doctorId, date, nk, ph);
  need(!dup, 'عندك حجز بنفس اليوم عند هذا الطبيب');
  return tx(() => {
    let seq = freeSeq(doctorId, date, doc.capacity), status = 'confirmed';
    if (!seq) {
      if (force) seq = overflowSeq(doctorId, date); // العيادة تضيف فوق العدد
      else { status = 'pending'; }
    }
    const r = run(`INSERT INTO bookings(doctor_id,patient_id,patient_name,name_key,phone,date,seq,code,status,source,note,created)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, doctorId, patientId, name.trim(), nk, ph, date, seq, 'tmp' + Math.random(), status, source, note, now());
    const id = Number(r.lastInsertRowid);
    run('UPDATE bookings SET code=? WHERE id=?', makeCode(id), id);
    if (status === 'confirmed') { if (patientId) addPoints(patientId, 10, 'حجز عند د. ' + doc.dname); }
    else notify(doctorId, 'طلب حجز بعد اكتمال العدد', `${name.trim()} · ${date}`, 'request', '#/doctor');
    return bookingView(id);
  });
}

// حالة خاصة: نفس رقم مريض خلّص ودخل وكمّل
export function createSpecial({ doctorId, seq, name, phone, date = today(), note = '' }) {
  const owner = one(`SELECT * FROM bookings WHERE doctor_id=? AND date=? AND seq=? AND special=0 AND status IN ('done','attended') ORDER BY id DESC`, doctorId, date, seq);
  need(owner, 'صاحب هذا الرقم لازم يدخل ويكمّل أول');
  need(owner.status === 'done', 'صاحب هذا الرقم لسه ما كمّل');
  const ph = normPhone(phone); need(ph && name?.trim().length >= 3, 'الاسم والهاتف مطلوبين');
  return tx(() => {
    const r = run(`INSERT INTO bookings(doctor_id,patient_id,patient_name,name_key,phone,date,seq,code,status,special,source,note,created)
                   VALUES(?,?,?,?,?,?,?,?,'confirmed',1,'clinic',?,?)`,
      doctorId, one('SELECT id FROM users WHERE phone=? AND role=\'patient\'', ph)?.id ?? null, name.trim(), nameKey(name), ph, date, seq, 'tmp' + Math.random(), note, now());
    const id = Number(r.lastInsertRowid);
    run('UPDATE bookings SET code=? WHERE id=?', makeCode(id), id);
    return bookingView(id);
  });
}

export function bookingView(id) {
  const b = one(`SELECT b.*, u.name doctor_name, d.specialty, d.area, d.address, d.avg_minutes, d.capacity, u.verified doctor_verified
                 FROM bookings b JOIN users u ON u.id=b.doctor_id JOIN doctors d ON d.user_id=b.doctor_id WHERE b.id=?`, id);
  if (!b) return null;
  let ahead = 0;
  if (['confirmed', 'attended'].includes(b.status) && !b.special) {
    ahead = one(`SELECT COUNT(*) n FROM bookings WHERE doctor_id=? AND date=? AND special=0 AND seq<? AND seq>0 AND status='confirmed'`, b.doctor_id, b.date, b.seq).n;
  }
  const av = availability(b.doctor_id, b.date);
  return { ...b, ahead, eta_minutes: ahead * b.avg_minutes, hours: av.open ? { from: av.from, to: av.to } : null };
}

export function decideBooking(doctorId, bookingId, action, newDate) {
  const b = one('SELECT * FROM bookings WHERE id=? AND doctor_id=?', bookingId, doctorId);
  need(b, 'الحجز غير موجود', 404);
  need(b.status === 'pending', 'هذا الطلب مو معلّق');
  const dn = one('SELECT name FROM users WHERE id=?', doctorId).name;
  if (action === 'accept') {
    run(`UPDATE bookings SET status='confirmed', seq=? WHERE id=?`, overflowSeq(doctorId, b.date), bookingId);
    notify(b.patient_id, 'الدكتور وافق على حجزك', `${dn} · ${b.date}`, 'booking', '#/bookings');
    if (b.patient_id) addPoints(b.patient_id, 10, 'حجز عند د. ' + dn);
  } else if (action === 'reject') {
    run(`UPDATE bookings SET status='rejected' WHERE id=?`, bookingId);
    notify(b.patient_id, 'الدكتور اعتذر عن الطلب', `${dn} · ${b.date}`, 'booking', '#/bookings');
  } else if (action === 'postpone') {
    need(newDate && newDate > b.date, 'اختار يوم بعد اليوم الحالي');
    need(availability(doctorId, newDate).open, 'الطبيب مو موجود بهذا اليوم');
    const cap = one('SELECT capacity FROM doctors WHERE user_id=?', doctorId).capacity;
    const seq = freeSeq(doctorId, newDate, cap);
    run(`UPDATE bookings SET date=?, seq=?, status=? WHERE id=?`, newDate, seq, seq ? 'confirmed' : 'pending', bookingId);
    notify(b.patient_id, 'تأجيل حجزك', `الدكتور اقترح ${newDate}`, 'booking', '#/bookings');
    if (seq && b.patient_id) addPoints(b.patient_id, 10, 'حجز عند د. ' + dn);
  } else bad('إجراء غير معروف');
  return bookingView(bookingId);
}

export function cancelBooking(bookingId, user) {
  const b = one('SELECT * FROM bookings WHERE id=?', bookingId);
  need(b, 'الحجز غير موجود', 404);
  need(b.patient_id === user.id || b.doctor_id === user.id || b.doctor_id === user.doctor_id, 'ما تگدر', 403);
  need(['pending', 'confirmed'].includes(b.status), 'ما ينلغي بهذي الحالة');
  run(`UPDATE bookings SET status='cancelled' WHERE id=?`, bookingId);
  if (b.patient_id !== user.id) notify(b.patient_id, 'تم إلغاء حجزك', b.date, 'booking', '#/bookings');
  else notify(b.doctor_id, 'مريض ألغى حجزه', `${b.patient_name} · ${b.date}`, 'info');
  return bookingView(bookingId);
}

export function postponeByPatient(bookingId, user, newDate) {
  const b = one('SELECT * FROM bookings WHERE id=? AND patient_id=?', bookingId, user.id);
  need(b, 'الحجز غير موجود', 404);
  need(['pending', 'confirmed'].includes(b.status), 'ما ينأجل بهذي الحالة');
  cancelBooking(bookingId, user);
  return createBooking({ doctorId: b.doctor_id, patientId: user.id, name: b.patient_name, phone: b.phone, date: newDate });
}

export function checkIn(doctorId, code) {
  const b = one('SELECT * FROM bookings WHERE code=?', String(code).trim().toUpperCase());
  need(b, 'الباركود غير معروف', 404);
  need(b.doctor_id === doctorId, 'هذا الحجز عند طبيب ثاني', 403);
  need(b.date === today(), `الحجز ليوم ${b.date}`);
  need(['confirmed', 'attended'].includes(b.status), 'الحجز مو فعّال');
  if (b.status === 'confirmed') run(`UPDATE bookings SET status='attended', attended_at=? WHERE id=?`, now(), b.id);
  return bookingView(b.id);
}

// ---------- ربط سجل المراجع الذي سجّله الطبيب بحسابه عند إنشاء الحساب ----------
export function linkHistory(user) {
  const nk = user.name_key, ph = user.phone;
  for (const t of ['bookings', 'visits', 'prescriptions', 'labs']) {
    run(`UPDATE ${t} SET patient_id=? WHERE patient_id IS NULL AND phone=? AND name_key=?`, user.id, ph, nk);
  }
}
// هوية المريض لأي سجل: patient_id أو (الاسم + الهاتف)
export function identityWhere(id) {
  return { sql: '(patient_id=? OR (name_key=? AND phone=?))', params: [id.patient_id ?? -1, id.name_key, id.phone] };
}
export function patientFile(identity) {
  const w = identityWhere(identity);
  const visits = q(`SELECT v.*, u.name doctor_name FROM visits v JOIN users u ON u.id=v.doctor_id WHERE ${w.sql.replaceAll('patient_id', 'v.patient_id').replaceAll('name_key', 'v.name_key').replaceAll('phone', 'v.phone')} ORDER BY v.date DESC, v.id DESC`, ...w.params);
  const rx = q(`SELECT p.*, u.name doctor_name FROM prescriptions p LEFT JOIN users u ON u.id=p.doctor_id WHERE ${w.sql.replaceAll('patient_id', 'p.patient_id').replaceAll('name_key', 'p.name_key').replaceAll('phone', 'p.phone')} ORDER BY p.id DESC`, ...w.params);
  const labs = q(`SELECT l.*, u.name doctor_name FROM labs l JOIN users u ON u.id=l.doctor_id WHERE ${w.sql.replaceAll('patient_id', 'l.patient_id').replaceAll('name_key', 'l.name_key').replaceAll('phone', 'l.phone')} ORDER BY l.id DESC`, ...w.params);
  return { visits, prescriptions: rx, labs };
}

// ---------- جرعات الدواء ----------
export function doseTimes(first, perDay) {
  const [h, m] = first.split(':').map(Number);
  const step = Math.floor(24 / Math.max(1, perDay));
  return Array.from({ length: perDay }, (_, i) => `${String(((h + step * i) % 24)).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

export function remindersFor(userId) {
  const t = today(), out = [];
  for (const b of q(`SELECT b.*, u.name dn FROM bookings b JOIN users u ON u.id=b.doctor_id WHERE b.patient_id=? AND b.status='confirmed' AND b.date>=?`, userId, t)) {
    const d = diffDays(t, b.date);
    if (d <= 7) out.push({ type: 'visit', id: 'v' + b.id, title: d === 0 ? 'مراجعتك اليوم' : d === 1 ? 'باچر مراجعتك' : `مراجعتك بعد ${d} أيام`, body: `عند ${b.dn} · دورك رقم ${b.seq}`, date: b.date, time: null });
  }
  for (const p of q(`SELECT * FROM prescriptions WHERE patient_id=? AND status IN ('sold','self') AND received_date IS NOT NULL`, userId)) {
    const end = addDays(p.received_date, p.days - 1);
    if (t < p.received_date || t > end) continue;
    const doses = doseTimes(p.first_dose, p.times_per_day);
    doses.forEach((tm, i) => out.push({ type: 'dose', id: `d${p.id}-${i}`, title: 'وقت علاجك', body: `${p.drug_name} — ${p.notes || 'حبّة وحدة'} (الجرعة ${i + 1} من ${doses.length})`, date: t, time: tm, drug: p.drug_name, form: p.form }));
  }
  return out;
}

export function ratingOf(type, id) {
  const r = one('SELECT ROUND(AVG(stars),1) avg, COUNT(*) n FROM ratings WHERE target_type=? AND target_id=?', type, id);
  return { avg: r.avg || 0, count: r.n };
}
