// المساعد الصوتي: يفهم أوامر عراقية قصيرة ويحوّلها لعمليات (حجز، إلغاء، تأجيل، تنبيه دواء، رقم الدور، موعد المراجعة)
// يُستدعى من شاشة المساعد (الميكروفون) ومن اختصارات Siri / مساعد گوگل عبر /api/voice
import { q, one, run, now } from './db.js';
import { nameKey, latinDigits, today, addDays, weekday } from './util.js';
import { createBooking, cancelBooking, postponeByPatient, bookingView, bookableDates } from './logic.js';

const DAYS = { الاحد: 0, الاثنين: 1, الاتنين: 1, الثلاثاء: 2, الثلاثا: 2, الاربعاء: 3, الاربعا: 3, الخميس: 4, الجمعه: 5, السبت: 6 };
const DAYNAME = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function parseDate(t) {
  if (/(بعد باچر|بعد بكره|بعد غد)/.test(t)) return addDays(today(), 2);
  if (/(باچر|بكره|غدا|غدًا|بکره)/.test(t)) return addDays(today(), 1);
  if (/(اليوم|هسه|الحين)/.test(t)) return today();
  for (const [w, n] of Object.entries(DAYS)) {
    if (t.includes(w)) { let d = addDays(today(), 1); while (weekday(d) !== n) d = addDays(d, 1); return d; }
  }
  return null;
}

function findDoctor(t) {
  const docs = q(`SELECT u.id, u.name, u.name_key FROM users u JOIN doctors d ON d.user_id=u.id WHERE u.role='doctor'`);
  const words = t.replace(/^.*?(?:الدكتور|الدكتوره|دكتور|دكتوره|د\.|عند)\s+/, '').split(' ').filter((w) => w.length > 1 && !DAYS[w] && !/^(يوم|الساعه|ساعه|باچر|بكره|اليوم|عند|الدكتور|دكتور|لي|لو|سمحت|رجاء)$/.test(w));
  let best = null, score = 0;
  for (const d of docs) {
    const parts = d.name_key.replace(/^(د\.?|دكتور|الدكتور)\s*/, '').split(' ');
    const s = words.reduce((a, w) => a + (parts.includes(w) ? 2 : parts.some((p) => p.startsWith(w) || w.startsWith(p)) ? 1 : 0), 0);
    if (s > score) { best = d; score = s; }
  }
  return score >= 1 ? best : null;
}

export function parseCommand(text) {
  const t = nameKey(latinDigits(text)).replace(/[؟?!.,،]/g, ' ').replace(/\s+/g, ' ');
  if (/(الغ[يى]|الغاء|كنسل)/.test(t) && /(حجز|دور|موعد)/.test(t)) return { intent: 'cancel', doctor: /عند/.test(t) ? findDoctor(t) : null };
  if (/(اجل|تاجيل|غير|بدل)/.test(t) && /(حجز|دور|موعد)/.test(t)) return { intent: 'postpone', date: parseDate(t) };
  if (/(نبه|ذكر|تنبيه|ضيف.*(دواء|علاج|حبه))/.test(t) && /(دواء|حبه|حبوب|علاج|شراب|كبسوله|حقنه|تنبيه)/.test(t)) {
    const times = t.match(/(\d+|وحده|مره|مرتين|ثلاث|اربع)\s*مر[ةهات]*/);
    const dayM = t.match(/(\d+)\s*(ايام|يوم)/);
    const name = (t.match(/(?:حبه|حبوب|دواء|شراب|كبسوله|حقنه)\s+([^\d\s]+(?:\s[^\d\s]+)?)/) || [])[1];
    return { intent: 'reminder', name: name || 'دواء', perDay: times ? (/مرتين/.test(times[0]) ? 2 : /ثلاث/.test(times[0]) ? 3 : /اربع/.test(times[0]) ? 4 : parseInt(times[1], 10) || 1) : 1, days: dayM ? parseInt(dayM[1], 10) : 5, rawName: (text.match(/(?:[Pp][a-zA-Z]+)/) || [])[0] };
  }
  if (/(احجز|حجز|ابي ادخل|اريد حجز|اريد احجز|سجلني)/.test(t)) return { intent: 'book', doctor: findDoctor(t), date: parseDate(t) };
  if (/(رقم.*دور|دوري|كم باقي|شكد باقي|متى دوري)/.test(t)) return { intent: 'queue' };
  if (/(موعد.*(مراجعه|حجز)|متى.*(مراجعه|موعد)|مراجعتي|حجزي)/.test(t)) return { intent: 'next' };
  return { intent: 'unknown' };
}

const sd = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
const fmt = (b) => `دورك رقم ${b.seq} عند ${b.doctor_name} يوم ${DAYNAME[weekday(b.date)]} ${sd(b.date)}`;

// execute=false → معاينة فقط (يعرض للمستخدم ويسأله يأكد). execute=true → ينفّذ.
export function runCommand(user, text, execute) {
  const c = parseCommand(text);
  const myNext = () => one(`SELECT id FROM bookings WHERE patient_id=? AND status IN ('confirmed','pending') AND date>=? ORDER BY date, seq LIMIT 1`, user.id, today());
  switch (c.intent) {
    case 'book': {
      if (!c.doctor) return { ok: false, reply: 'ما لگيت الدكتور. گول «احجزلي عند الدكتور» وبعدها اسمه.' };
      let date = c.date;
      if (!date) { const d = bookableDates(c.doctor.id).find((x) => !x.full); date = d?.date; }
      if (!date) return { ok: false, reply: `ماكو يوم متاح عند ${c.doctor.name} هالأيام.` };
      const summary = `أحجزلك عند ${c.doctor.name} يوم ${DAYNAME[weekday(date)]} ${sd(date)}؟`;
      if (!execute) return { ok: true, intent: 'book', needs_confirm: true, reply: summary };
      const b = createBooking({ doctorId: c.doctor.id, patientId: user.id, name: user.name, phone: user.phone, date });
      return { ok: true, intent: 'book', reply: b.status === 'pending' ? `العدد مكتمل. أرسلت طلبك للدكتور وراح يوصلك رده.` : `تم. ${fmt(b)}`, booking: b };
    }
    case 'cancel': {
      let b = c.doctor ? one(`SELECT id FROM bookings WHERE patient_id=? AND doctor_id=? AND status IN ('confirmed','pending') AND date>=? ORDER BY date LIMIT 1`, user.id, c.doctor.id, today()) : myNext();
      if (!b) return { ok: false, reply: 'ماكو عندك حجز فعّال حتى ألغيه.' };
      const v = bookingView(b.id);
      if (!execute) return { ok: true, intent: 'cancel', needs_confirm: true, reply: `ألغي حجزك عند ${v.doctor_name} يوم ${sd(v.date)}؟` };
      cancelBooking(b.id, user);
      return { ok: true, intent: 'cancel', reply: 'تم إلغاء الحجز.' };
    }
    case 'postpone': {
      const b = myNext();
      if (!b) return { ok: false, reply: 'ماكو عندك حجز حتى أأجله.' };
      if (!c.date) return { ok: false, reply: 'لأي يوم تريد تأجله؟ مثلًا: أجّل حجزي ليوم السبت.' };
      const v = bookingView(b.id);
      if (!execute) return { ok: true, intent: 'postpone', needs_confirm: true, reply: `أأجل حجزك عند ${v.doctor_name} من ${sd(v.date)} إلى ${sd(c.date)}؟` };
      const nb = postponeByPatient(b.id, user, c.date);
      return { ok: true, intent: 'postpone', reply: `تم التأجيل. ${fmt(nb)}`, booking: nb };
    }
    case 'reminder': {
      const name = c.rawName || c.name;
      if (!execute) return { ok: true, intent: 'reminder', needs_confirm: true, reply: `أضيف تنبيه «${name}» ${c.perDay} مرة باليوم لمدة ${c.days} أيام؟` };
      run(`INSERT INTO prescriptions(doctor_id,patient_id,patient_name,name_key,phone,drug_name,times_per_day,days,first_dose,status,received_date,notes,created)
           VALUES(0,?,?,?,?,?,?,?,?,?,?,?,?)`, user.id, user.name, user.name_key, user.phone, name, c.perDay, c.days, '08:00', 'self', today(), 'تنبيه أضفته بصوتك', now());
      return { ok: true, intent: 'reminder', reply: `تم. راح أنبهك على ${name}.` };
    }
    case 'queue': {
      const b = one(`SELECT id FROM bookings WHERE patient_id=? AND status IN ('confirmed','attended') AND date=? LIMIT 1`, user.id, today());
      if (!b) return { ok: true, intent: 'queue', reply: 'ماكو عندك حجز اليوم.' };
      const v = bookingView(b.id);
      return { ok: true, intent: 'queue', reply: `دورك رقم ${v.seq}، وقبلك ${v.ahead} مراجعين، تقريبًا ${v.eta_minutes} دقيقة.`, booking: v };
    }
    case 'next': {
      const b = myNext();
      if (!b) return { ok: true, intent: 'next', reply: 'ماكو عندك مراجعة قادمة.' };
      return { ok: true, intent: 'next', reply: `مراجعتك الجاية: ${fmt(bookingView(b.id))}.` };
    }
    default:
      return { ok: false, intent: 'unknown', reply: 'ما فهمت. جرّب: «احجزلي عند الدكتور فلان يوم الأحد»، أو «ألغي حجزي»، أو «شنو رقم دوري».' };
  }
}
