// طبقة الترجمة: العربية أساسية (RTL). لإضافة لغة: ملف جديد في lang/ ثم تسجيله هنا.
import ar from './lang/ar.js';
import { prefs } from './store.js';

export const LANGS = { ar: { name: 'العربية', dir: 'rtl', dict: ar } }; // أضف هنا لغات جديدة: { name, dir, dict }
export function t(key, vars) {
  const L = LANGS[prefs.lang] || LANGS.ar;
  let s = L.dict[key] ?? ar[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
export function applyLang() {
  const L = LANGS[prefs.lang] || LANGS.ar;
  document.documentElement.lang = prefs.lang; document.documentElement.dir = L.dir;
}
export const err = (code) => { const k = 'err.' + code; const s = t(k); return s === k ? t('err.generic') : s; };
