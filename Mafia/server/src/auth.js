import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { one, run } from './db.js';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const SESSION_MS = 30 * 24 * 3600 * 1000;
export class AuthError extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } }

export function hashPassword(pw) {
  const salt = randomBytes(16);
  return salt.toString('hex') + ':' + scryptSync(pw, salt, 64).toString('hex');
}
export function checkPassword(pw, stored) {
  const [salt, hash] = (stored || '').split(':'); if (!salt || !hash) return false;
  const a = scryptSync(pw, Buffer.from(salt, 'hex'), 64); const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 24);

function newUid(db) {
  for (let i = 0; i < 50; i++) { const u = String(randomInt(10000000, 99999999)); if (!one(db, 'SELECT 1 FROM users WHERE uid=?', u)) return u; }
  throw new AuthError('uid_failed', 500);
}
export const avatarUrl = (u) => (u.avatar ? `/api/avatar/${u.uid}?v=${u.avatar.length}` : null);
export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, uid: u.uid, name: u.name, avatar: avatarUrl(u), frame: u.frame, xp: u.xp, points: u.points,
    matches: u.matches, wins: u.wins, guest: !!u.guest, level: levelOf(u.xp).level };
}
/** مستوى = 1 + ⌊√(xp/50)⌋ ، والعتبة التالية = 50·level² */
export function levelOf(xp) {
  const level = 1 + Math.floor(Math.sqrt(xp / 50));
  const base = 50 * (level - 1) ** 2; const next = 50 * level ** 2;
  return { level, base, next, into: xp - base, span: next - base };
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url');
  run(db, 'INSERT INTO sessions VALUES(?,?,?)', sha(token), userId, Date.now() + SESSION_MS);
  return token;
}
export function userFromToken(db, token) {
  if (!token) return null;
  const r = one(db, 'SELECT user_id, expires_at FROM sessions WHERE token_hash=?', sha(token));
  if (!r) return null;
  if (r.expires_at < Date.now()) { run(db, 'DELETE FROM sessions WHERE token_hash=?', sha(token)); return null; }
  const u = one(db, 'SELECT * FROM users WHERE id=?', r.user_id);
  return u && !u.banned ? u : null;
}
export const logout = (db, token) => run(db, 'DELETE FROM sessions WHERE token_hash=?', sha(token));

export function register(db, { email, password, name }) {
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL.test(email)) throw new AuthError('bad_email');
  if (String(password || '').length < 8) throw new AuthError('weak_password');
  name = cleanName(name); if (name.length < 2) throw new AuthError('bad_name');
  if (one(db, 'SELECT 1 FROM users WHERE email=?', email)) throw new AuthError('email_taken', 409);
  const r = run(db, 'INSERT INTO users(uid,email,pass_hash,name,created_at) VALUES(?,?,?,?,?)', newUid(db), email, hashPassword(password), name, Date.now());
  return finish(db, Number(r.lastInsertRowid));
}
export function login(db, { email, password }) {
  const u = one(db, 'SELECT * FROM users WHERE email=?', String(email || '').trim().toLowerCase());
  if (!u || !checkPassword(String(password || ''), u.pass_hash)) throw new AuthError('bad_credentials', 401);
  if (u.banned) throw new AuthError('banned', 403);
  return finish(db, u.id);
}
export function guest(db, { name }) {
  name = cleanName(name) || 'لاعب';
  const r = run(db, 'INSERT INTO users(uid,name,guest,created_at) VALUES(?,?,1,?)', newUid(db), name, Date.now());
  return finish(db, Number(r.lastInsertRowid));
}
const finish = (db, id) => ({ token: createSession(db, id), user: publicUser(one(db, 'SELECT * FROM users WHERE id=?', id)) });

/** تسجيل الدخول بحساب Google: يتحقق من id_token عبر خدمة Google الرسمية ومن الـ audience */
export async function googleLogin(db, { idToken }, { clientId, fetchImpl = fetch }) {
  if (!clientId) throw new AuthError('google_disabled', 501);
  const res = await fetchImpl('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken || ''));
  if (!res.ok) throw new AuthError('google_invalid', 401);
  const g = await res.json();
  if (g.aud !== clientId || !(g.email_verified === true || g.email_verified === 'true')) throw new AuthError('google_invalid', 401);
  let u = one(db, 'SELECT * FROM users WHERE google_sub=?', g.sub) || one(db, 'SELECT * FROM users WHERE email=?', String(g.email).toLowerCase());
  if (!u) {
    const r = run(db, 'INSERT INTO users(uid,email,google_sub,name,created_at) VALUES(?,?,?,?,?)', newUid(db), String(g.email).toLowerCase(), g.sub, cleanName(g.name) || 'لاعب', Date.now());
    u = one(db, 'SELECT * FROM users WHERE id=?', Number(r.lastInsertRowid));
  } else if (!u.google_sub) run(db, 'UPDATE users SET google_sub=? WHERE id=?', g.sub, u.id);
  return finish(db, u.id);
}

/** استعادة كلمة المرور: يُولَّد رمز من 6 أرقام صالح 15 دقيقة ويُسلَّم عبر mailer (SMTP أو سجل الخادم) */
export async function forgotPassword(db, { email }, mailer) {
  const u = one(db, 'SELECT * FROM users WHERE email=?', String(email || '').trim().toLowerCase());
  if (!u) return { ok: true }; // لا نكشف وجود الحساب
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  run(db, 'DELETE FROM resets WHERE user_id=?', u.id);
  run(db, 'INSERT INTO resets(user_id,code_hash,expires_at) VALUES(?,?,?)', u.id, sha(code), Date.now() + 15 * 60 * 1000);
  await mailer(u.email, code);
  return { ok: true };
}
export function resetPassword(db, { email, code, password }) {
  if (String(password || '').length < 8) throw new AuthError('weak_password');
  const u = one(db, 'SELECT * FROM users WHERE email=?', String(email || '').trim().toLowerCase());
  const r = u && one(db, 'SELECT * FROM resets WHERE user_id=?', u.id);
  if (!r || r.expires_at < Date.now() || r.tries >= 5) throw new AuthError('bad_code', 400);
  if (r.code_hash !== sha(String(code || '').trim())) { run(db, 'UPDATE resets SET tries=tries+1 WHERE user_id=?', u.id); throw new AuthError('bad_code', 400); }
  run(db, 'UPDATE users SET pass_hash=? WHERE id=?', hashPassword(password), u.id);
  run(db, 'DELETE FROM resets WHERE user_id=?', u.id);
  run(db, 'DELETE FROM sessions WHERE user_id=?', u.id); // إلغاء كل الجلسات القديمة
  return { ok: true };
}

export const FRAMES = ['none', 'gold', 'crimson', 'emerald', 'royal', 'neon'];
const FRAME_LEVEL = { none: 1, gold: 1, crimson: 3, emerald: 5, royal: 8, neon: 12 };
export function updateProfile(db, user, { name, avatar, frame }) {
  if (name !== undefined) { name = cleanName(name); if (name.length < 2) throw new AuthError('bad_name'); run(db, 'UPDATE users SET name=? WHERE id=?', name, user.id); }
  if (avatar !== undefined) {
    if (avatar !== null && (!/^data:image\/(jpeg|png|webp);base64,/.test(avatar) || avatar.length > 120_000)) throw new AuthError('bad_avatar');
    run(db, 'UPDATE users SET avatar=? WHERE id=?', avatar, user.id);
  }
  if (frame !== undefined) {
    if (!FRAMES.includes(frame)) throw new AuthError('bad_frame');
    if (levelOf(user.xp).level < FRAME_LEVEL[frame]) throw new AuthError('frame_locked');
    run(db, 'UPDATE users SET frame=? WHERE id=?', frame, user.id);
  }
  return publicUser(one(db, 'SELECT * FROM users WHERE id=?', user.id));
}
export const FRAME_LEVELS = FRAME_LEVEL;

// حد معدّل بسيط للمحاولات (ذاكرة)
export function rateLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now(); const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now); hits.set(key, arr);
    if (arr.length > max) throw new AuthError('rate_limited', 429);
  };
}
