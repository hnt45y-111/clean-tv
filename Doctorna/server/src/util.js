// أدوات مشتركة: أرقام عربية، تطبيع الأسماء والهواتف، تاريخ بغداد
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const E = '٠١٢٣٤٥٦٧٨٩', P = '۰۱۲۳۴۵۶۷۸۹';
export const latinDigits = (s) => String(s ?? '').replace(/[٠-٩۰-۹]/g, (c) => { const i = E.indexOf(c); return i >= 0 ? i : P.indexOf(c); });

// مفتاح الاسم: يوحّد الهمزات والياء والتاء المربوطة ويشيل التشكيل والمسافات الزايدة
export const nameKey = (s) => latinDigits(s).replace(/[ً-ٰٟـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/\s+/g, ' ').trim().toLowerCase();

export const normPhone = (s) => {
  const d = latinDigits(s).replace(/\D/g, '');
  if (d.length < 10) return '';
  return '0' + d.slice(-10);
};

// ----- الوقت (بغداد UTC+3) مع إمكانية تثبيت الساعة بالاختبارات -----
let offsetMs = 0;
export const setClock = (ms) => { offsetMs = ms; };
export const nowMs = () => Date.now() + offsetMs;
const baghdad = () => new Date(nowMs() + 3 * 3600e3);
export const today = () => baghdad().toISOString().slice(0, 10);
export const nowHHMM = () => baghdad().toISOString().slice(11, 16);
export const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export const weekday = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
export const diffDays = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');

// ----- كلمات المرور -----
export const hashPass = (pass, salt = randomBytes(16).toString('hex')) => ({ salt, hash: scryptSync(pass, salt, 64).toString('hex') });
export const checkPass = (pass, salt, hash) => {
  const a = Buffer.from(scryptSync(pass, salt, 64).toString('hex')), b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
};
export const token = () => randomBytes(24).toString('hex');
export const refCode = () => 'DR' + randomBytes(3).toString('hex').toUpperCase();

export class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
export const bad = (msg, status = 400) => { throw new HttpError(status, msg); };
export const need = (cond, msg, status = 400) => { if (!cond) throw new HttpError(status, msg); };
export const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
export const int = (v, d = 0) => { const n = parseInt(latinDigits(v), 10); return Number.isFinite(n) ? n : d; };
