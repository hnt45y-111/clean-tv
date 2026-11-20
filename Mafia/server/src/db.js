import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(file = process.env.MAFIA_DB || './data/mafia.db') {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE, pass_hash TEXT, google_sub TEXT UNIQUE,
      name TEXT NOT NULL, avatar TEXT, frame TEXT NOT NULL DEFAULT 'none',
      xp INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0,
      matches INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
      guest INTEGER NOT NULL DEFAULT 0, banned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS resets(
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS friends(
      a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL, -- pending (a طلب من b) | accepted
      created_at INTEGER NOT NULL, PRIMARY KEY(a,b));
    CREATE TABLE IF NOT EXISTS matches(
      id INTEGER PRIMARY KEY AUTOINCREMENT, room_code TEXT, mode TEXT, round INTEGER,
      winner TEXT, days INTEGER, players INTEGER, ended_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS match_players(
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL, won INTEGER NOT NULL, survived INTEGER NOT NULL, points INTEGER NOT NULL, PRIMARY KEY(match_id,user_id));
    CREATE TABLE IF NOT EXISTS daily_tasks(
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL, key TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0, claimed INTEGER NOT NULL DEFAULT 0, extra TEXT NOT NULL DEFAULT '', PRIMARY KEY(user_id,day,key));
    CREATE TABLE IF NOT EXISTS achievements(
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, key TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(user_id,key));
    CREATE TABLE IF NOT EXISTS reports(
      id INTEGER PRIMARY KEY AUTOINCREMENT, reporter INTEGER NOT NULL, target INTEGER NOT NULL, reason TEXT NOT NULL, room_code TEXT, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS room_snapshots(code TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
  `);
  return db;
}
// أدوات صغيرة فوق node:sqlite
export const one = (db, sql, ...a) => db.prepare(sql).get(...a);
export const all = (db, sql, ...a) => db.prepare(sql).all(...a);
export const run = (db, sql, ...a) => db.prepare(sql).run(...a);
