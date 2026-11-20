// قاعدة بيانات دكتورنا (SQLite المدمج في Node) — بلا أي اعتماد خارجي
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DOCTORNA_DB || resolve(here, '../data/doctorna.db');
if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('patient','doctor','pharmacy','lab','secretary','admin')),
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  area TEXT DEFAULT '',
  is_owner INTEGER DEFAULT 0,
  subscribed INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  refcode TEXT UNIQUE,
  referred_by INTEGER,
  doctor_id INTEGER,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS doctors(
  user_id INTEGER PRIMARY KEY, specialty TEXT NOT NULL, area TEXT DEFAULT '', address TEXT DEFAULT '',
  lat REAL, lng REAL, bio TEXT DEFAULT '', capacity INTEGER DEFAULT 20, avg_minutes INTEGER DEFAULT 10,
  price INTEGER DEFAULT 0, license TEXT DEFAULT '', license_pending INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS schedule(
  doctor_id INTEGER NOT NULL, weekday INTEGER NOT NULL, open_time TEXT, close_time TEXT, closed INTEGER DEFAULT 0,
  PRIMARY KEY(doctor_id, weekday)
);
CREATE TABLE IF NOT EXISTS leaves(
  id INTEGER PRIMARY KEY, doctor_id INTEGER NOT NULL, from_date TEXT NOT NULL, to_date TEXT NOT NULL, note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS pharmacies(
  user_id INTEGER PRIMARY KEY, title TEXT NOT NULL, kind TEXT DEFAULT 'pharmacy', area TEXT DEFAULT '', address TEXT DEFAULT '',
  lat REAL, lng REAL, staff TEXT DEFAULT '', work_method TEXT DEFAULT '', prices_note TEXT DEFAULT '',
  delivers INTEGER DEFAULT 1, home_visit INTEGER DEFAULT 0, hours TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY, doctor_id INTEGER NOT NULL, patient_id INTEGER, patient_name TEXT NOT NULL, name_key TEXT NOT NULL,
  phone TEXT NOT NULL, date TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT 0, code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'confirmed', special INTEGER DEFAULT 0, source TEXT DEFAULT 'app', note TEXT DEFAULT '',
  attended_at INTEGER, done_at INTEGER, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bk_doc_date ON bookings(doctor_id, date);
CREATE INDEX IF NOT EXISTS bk_patient ON bookings(patient_id);
CREATE TABLE IF NOT EXISTS drugs(
  id INTEGER PRIMARY KEY, name_en TEXT NOT NULL, name_ar TEXT NOT NULL, form TEXT NOT NULL, strength TEXT DEFAULT '', price INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS prescriptions(
  id INTEGER PRIMARY KEY, doctor_id INTEGER NOT NULL, patient_id INTEGER, patient_name TEXT NOT NULL, name_key TEXT NOT NULL, phone TEXT NOT NULL,
  booking_id INTEGER, drug_id INTEGER, drug_name TEXT NOT NULL, form TEXT DEFAULT '', times_per_day INTEGER DEFAULT 1, days INTEGER DEFAULT 5,
  first_dose TEXT DEFAULT '08:00', notes TEXT DEFAULT '', pharmacy_id INTEGER, status TEXT DEFAULT 'ordered', received_date TEXT, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rx_patient ON prescriptions(patient_id);
CREATE TABLE IF NOT EXISTS sales(
  id INTEGER PRIMARY KEY, pharmacy_id INTEGER NOT NULL, prescription_id INTEGER, drug_name TEXT, amount INTEGER, platform_ref TEXT, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS visits(
  id INTEGER PRIMARY KEY, doctor_id INTEGER NOT NULL, patient_id INTEGER, patient_name TEXT NOT NULL, name_key TEXT NOT NULL, phone TEXT NOT NULL,
  booking_id INTEGER, date TEXT NOT NULL, complaint TEXT DEFAULT '', diagnosis TEXT DEFAULT '', notes TEXT DEFAULT '', created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS labs(
  id INTEGER PRIMARY KEY, doctor_id INTEGER NOT NULL, patient_id INTEGER, patient_name TEXT NOT NULL, name_key TEXT NOT NULL, phone TEXT NOT NULL,
  test TEXT NOT NULL, lab_id INTEGER, status TEXT DEFAULT 'requested', result TEXT DEFAULT '', created INTEGER NOT NULL, done_at INTEGER
);
CREATE TABLE IF NOT EXISTS chats(
  id INTEGER PRIMARY KEY, patient_id INTEGER NOT NULL, doctor_id INTEGER NOT NULL, status TEXT DEFAULT 'pending', created INTEGER NOT NULL,
  UNIQUE(patient_id, doctor_id)
);
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY, chat_id INTEGER NOT NULL, sender_id INTEGER NOT NULL, kind TEXT DEFAULT 'text', body TEXT DEFAULT '', image TEXT, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pharm_requests(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, pharmacy_id INTEGER NOT NULL, kind TEXT DEFAULT 'drug', text TEXT NOT NULL,
  status TEXT DEFAULT 'new', reply TEXT DEFAULT '', created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ratings(
  id INTEGER PRIMARY KEY, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, user_id INTEGER NOT NULL, stars INTEGER NOT NULL, comment TEXT DEFAULT '',
  created INTEGER NOT NULL, UNIQUE(target_type, target_id, user_id)
);
CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL, topic TEXT DEFAULT '', title TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT DEFAULT 'pending', created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS comments(
  id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS coupons(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, code TEXT NOT NULL UNIQUE, percent INTEGER NOT NULL, cost INTEGER NOT NULL, used INTEGER DEFAULT 0, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS point_log(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT '', kind TEXT DEFAULT 'info', link TEXT DEFAULT '', read INTEGER DEFAULT 0, created INTEGER NOT NULL
);
`);

export const now = () => Date.now();
export const q = (sql, ...p) => db.prepare(sql).all(...p);
export const one = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);
export const tx = (fn) => {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
};
