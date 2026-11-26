'use strict';
// قاعدة SQLite محلية عبر sql.js (WASM) — بلا وحدات أصلية، تُحفظ في ملف.
const fs = require('fs');
const path = require('path');

let SQL = null;
async function loadSql() {
  if (SQL) return SQL;
  const init = require('sql.js');
  SQL = await init({ locateFile: (f) => path.join(path.dirname(require.resolve('sql.js')), f) });
  return SQL;
}

class DB {
  constructor(file) { this.file = file; this.db = null; this._t = null; }
  static async open(file) {
    const S = await loadSql();
    const d = new DB(file);
    d.db = fs.existsSync(file) ? new S.Database(fs.readFileSync(file)) : new S.Database();
    d.db.run(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS archive (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, path TEXT NOT NULL,
        type TEXT NOT NULL, pages INTEGER DEFAULT 1, size INTEGER DEFAULT 0,
        source TEXT DEFAULT '', text TEXT DEFAULT '', created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_arch_created ON archive(created);
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, detail TEXT DEFAULT '',
        ok INTEGER DEFAULT 1, created INTEGER NOT NULL);
    `);
    d.flush();
    return d;
  }
  flush() {
    if (this._t) { clearTimeout(this._t); this._t = null; }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, Buffer.from(this.db.export()));
    fs.renameSync(tmp, this.file);
  }
  _dirty() { if (!this._t) { this._t = setTimeout(() => { try { this.flush(); } catch {} }, 400); this._t.unref && this._t.unref(); } }
  run(sql, params = []) { this.db.run(sql, params); this._dirty(); }
  all(sql, params = []) {
    const st = this.db.prepare(sql); st.bind(params);
    const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); return rows;
  }
  get(sql, params = []) { return this.all(sql, params)[0] || null; }
  insert(sql, params = []) { this.run(sql, params); return this.get('SELECT last_insert_rowid() AS id').id; }
  close() { this.flush(); this.db.close(); }
}
module.exports = { DB };
