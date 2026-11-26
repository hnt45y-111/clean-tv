'use strict';
// الإعدادات الدائمة مع تحقق صارم من المفاتيح والقيم القادمة من الواجهة.
const DEFAULTS = {
  firstRunDone: false,
  printer: { name: '', driver: '' },
  scanner: { id: '', name: '' },
  scan: { dpi: 300, color: 'color', paper: 'A4', orientation: 'portrait' },
  save: { dir: '', format: 'pdf', askedDir: false },
  image: { format: 'jpg', dpi: 300, quality: 90, color: 'color' },
  pdf: { pageSize: 'A4', orientation: 'portrait', quality: 85, multiPage: true },
  word: { pageSize: 'A4', orientation: 'portrait', rtl: true, font: 'Arial', fontSize: 12, editable: true, keepLayout: true },
  general: { language: 'ar', theme: 'dark', animations: true, startOnBoot: false, openLastPage: false },
  background: { mode: 'default', preset: '', file: '', brightness: 100, opacity: 100 },
  archive: { dir: '' },
};
const ENUM = {
  'scan.color': ['color', 'gray', 'bw'], 'scan.paper': ['A4', 'A5', 'Letter', 'Legal'],
  'scan.orientation': ['portrait', 'landscape'],
  'save.format': ['pdf', 'docx', 'jpg', 'png'], 'image.format': ['jpg', 'png'],
  'image.color': ['color', 'gray', 'bw'],
  'pdf.pageSize': ['A4', 'A3', 'A5', 'Letter', 'Legal', 'fit'], 'pdf.orientation': ['portrait', 'landscape'],
  'word.pageSize': ['A4', 'A3', 'A5', 'Letter', 'Legal'], 'word.orientation': ['portrait', 'landscape'],
  'general.theme': ['dark', 'darker'], 'general.language': ['ar'],
  'background.mode': ['default', 'preset', 'image'],
};
const RANGE = {
  'scan.dpi': [75, 1200], 'image.dpi': [72, 1200], 'image.quality': [10, 100], 'pdf.quality': [10, 100],
  'word.fontSize': [6, 72], 'background.brightness': [20, 150], 'background.opacity': [10, 100],
};
const clone = (o) => JSON.parse(JSON.stringify(o));

function validate(key, v, def) {
  if (typeof def === 'boolean') return !!v;
  if (typeof def === 'number') {
    const n = Number(v); if (!Number.isFinite(n)) throw new Error('قيمة رقمية غير صالحة: ' + key);
    const [lo, hi] = RANGE[key] || [-1e9, 1e9]; return Math.min(hi, Math.max(lo, Math.round(n)));
  }
  const s = String(v == null ? '' : v);
  if (ENUM[key] && !ENUM[key].includes(s)) throw new Error('خيار غير مسموح: ' + key);
  if (s.length > 1024) throw new Error('قيمة طويلة جداً: ' + key);
  return s;
}

class Settings {
  constructor(db) { this.db = db; this.data = clone(DEFAULTS); this.load(); }
  load() {
    for (const r of this.db.all('SELECT key,value FROM settings')) {
      try { const [g, k] = r.key.split('.'); if (this.data[g] && k in this.data[g]) this.data[g][k] = JSON.parse(r.value); else if (k === undefined && g in this.data) this.data[g] = JSON.parse(r.value); } catch {}
    }
  }
  all() { return clone(this.data); }
  get(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), this.data); }
  /** set('save.dir', value) أو set({ 'scan.dpi': 600, ... }) */
  set(pathOrObj, value) {
    const entries = typeof pathOrObj === 'string' ? [[pathOrObj, value]] : Object.entries(pathOrObj);
    for (const [p, v] of entries) {
      const parts = p.split('.');
      let def = DEFAULTS, ref = this.data;
      for (let i = 0; i < parts.length - 1; i++) { def = def && def[parts[i]]; ref = ref && ref[parts[i]]; }
      const leaf = parts[parts.length - 1];
      if (!def || typeof def !== 'object' || !(leaf in def)) throw new Error('إعداد غير معروف: ' + p);
      const val = validate(p, v, def[leaf]);
      ref[leaf] = val;
      this.db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [p, JSON.stringify(val)]);
    }
    return this.all();
  }
  reset(group) {
    if (!(group in DEFAULTS)) throw new Error('مجموعة غير معروفة');
    this.data[group] = clone(DEFAULTS[group]);
    this.db.run("DELETE FROM settings WHERE key LIKE ? ", [group + '.%']);
    return this.all();
  }
}
module.exports = { Settings, DEFAULTS };
