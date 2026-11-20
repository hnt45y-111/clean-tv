// النقاط، الخبرة، المهام اليومية، الإنجازات. لا تؤثر إطلاقاً على قواعد المباراة أو توزيع الأدوار.
import { one, all, run } from './db.js';
import { avatarUrl } from './auth.js';

export const POINTS = { participate: 10, win: 20, survive: 5, vote: 2, ability: 10 };
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

// تعريف المهام: target = المطلوب، reward = نقاط (=XP)
export const TASK_DEFS = {
  play3:    { target: 3, reward: 30 },
  roles2:   { target: 2, reward: 25 },
  win1:     { target: 1, reward: 25 },
  vote1:    { target: 1, reward: 10 },
  friends1: { target: 1, reward: 30 },
  play1:    { target: 1, reward: 10 },
  survive1: { target: 1, reward: 15 },
};
const POOL = Object.keys(TASK_DEFS);
/** 5 مهام لكل يوم: ثابتة لليوم نفسه، تتغير يومياً بلا أي إدخال يدوي */
export function tasksForDay(day) {
  let h = 0; for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const keys = [...POOL]; const out = [];
  while (out.length < 5) { h = (h * 1103515245 + 12345) >>> 0; out.push(keys.splice(h % keys.length, 1)[0]); }
  return out;
}

export const ACHIEVEMENTS = {
  first_match:   (c) => c.matches >= 1,
  matches_10:    (c) => c.matches >= 10,
  first_win:     (c) => c.wins >= 1,
  wins_5:        (c) => c.wins >= 5,
  wins_25:       (c) => c.wins >= 25,
  all_roles:     (c) => c.roles.size >= 5,
  mafia_win:     (c) => c.last.role === 'mafia' && c.last.won,
  doctor_save:   (c) => c.last.stats.saved > 0,
  sniper_hit:    (c) => c.last.stats.sniperHit,
  detective_hit: (c) => c.last.stats.caught > 0,
  level_5:       (c) => c.level >= 5,
};

export function ensureTasks(db, userId, day = dayKey()) {
  for (const key of tasksForDay(day)) run(db, 'INSERT OR IGNORE INTO daily_tasks(user_id,day,key) VALUES(?,?,?)', userId, day, key);
  return all(db, 'SELECT key,progress,claimed FROM daily_tasks WHERE user_id=? AND day=?', userId, day)
    .map((t) => ({ ...t, target: TASK_DEFS[t.key].target, reward: TASK_DEFS[t.key].reward, done: t.progress >= TASK_DEFS[t.key].target }));
}
export function claimTask(db, userId, key, day = dayKey()) {
  const t = one(db, 'SELECT * FROM daily_tasks WHERE user_id=? AND day=? AND key=?', userId, day, key);
  const def = TASK_DEFS[key];
  if (!t || !def || t.progress < def.target || t.claimed) return null;
  run(db, 'UPDATE daily_tasks SET claimed=1 WHERE user_id=? AND day=? AND key=?', userId, day, key);
  run(db, 'UPDATE users SET points=points+?, xp=xp+? WHERE id=?', def.reward, def.reward, userId);
  return def.reward;
}
function bump(db, userId, day, key, by = 1, set = false) {
  const def = TASK_DEFS[key]; if (!def) return;
  if (set) run(db, 'UPDATE daily_tasks SET progress=MAX(progress,?) WHERE user_id=? AND day=? AND key=?', by, userId, day, key);
  else run(db, 'UPDATE daily_tasks SET progress=MIN(?, progress+?) WHERE user_id=? AND day=? AND key=?', def.target, by, userId, day, key);
}

/**
 * يسجّل نتيجة مباراة مكتملة. rows: [{userId, role, won, survived, voted, stats, friendsInRoom}]
 * يعيد لكل لاعب {points, xp, tasks:[…], newAchievements:[…]}
 */
export function recordMatch(db, { roomCode, mode, round, winner, days, rows, now = Date.now() }) {
  const mr = run(db, 'INSERT INTO matches(room_code,mode,round,winner,days,players,ended_at) VALUES(?,?,?,?,?,?,?)', roomCode, mode, round, winner, days, rows.length, now);
  const matchId = Number(mr.lastInsertRowid); const day = dayKey(now); const out = {};
  for (const r of rows) {
    let pts = POINTS.participate + (r.won ? POINTS.win : 0) + (r.survived ? POINTS.survive : 0) + (r.voted ? POINTS.vote : 0)
      + ((r.stats.saved || r.stats.sniperHit || r.stats.caught) ? POINTS.ability : 0);
    run(db, 'INSERT OR REPLACE INTO match_players VALUES(?,?,?,?,?,?)', matchId, r.userId, r.role, +r.won, +r.survived, pts);
    run(db, 'UPDATE users SET matches=matches+1, wins=wins+?, points=points+?, xp=xp+? WHERE id=?', +r.won, pts, pts, r.userId);
    ensureTasks(db, r.userId, day);
    bump(db, r.userId, day, 'play1'); bump(db, r.userId, day, 'play3');
    if (r.won) bump(db, r.userId, day, 'win1');
    if (r.voted) bump(db, r.userId, day, 'vote1');
    if (r.survived) bump(db, r.userId, day, 'survive1');
    if (r.friendsInRoom) bump(db, r.userId, day, 'friends1');
    // «العب بأدوار مختلفة»: نتتبع الأدوار المميزة لليوم في عمود extra
    const row = one(db, "SELECT extra FROM daily_tasks WHERE user_id=? AND day=? AND key='roles2'", r.userId, day);
    if (row) {
      const set = new Set((row.extra || '').split(',').filter(Boolean)); set.add(r.role);
      run(db, "UPDATE daily_tasks SET extra=? WHERE user_id=? AND day=? AND key='roles2'", [...set].join(','), r.userId, day);
      bump(db, r.userId, day, 'roles2', set.size, true);
    }
    // الإنجازات
    const u = one(db, 'SELECT * FROM users WHERE id=?', r.userId);
    const roles = new Set(all(db, 'SELECT DISTINCT role FROM match_players WHERE user_id=?', r.userId).map((x) => x.role));
    const ctx = { matches: u.matches, wins: u.wins, roles, last: r, level: 1 + Math.floor(Math.sqrt(u.xp / 50)) };
    const fresh = [];
    for (const [key, test] of Object.entries(ACHIEVEMENTS)) {
      if (test(ctx) && !one(db, 'SELECT 1 FROM achievements WHERE user_id=? AND key=?', r.userId, key)) {
        run(db, 'INSERT INTO achievements VALUES(?,?,?)', r.userId, key, now); fresh.push(key);
      }
    }
    out[r.userId] = { points: pts, newAchievements: fresh };
  }
  return { matchId, per: out };
}

export function statsFor(db, userId) {
  const u = one(db, 'SELECT * FROM users WHERE id=?', userId);
  const byRole = all(db, 'SELECT role, COUNT(*) n, SUM(won) w FROM match_players WHERE user_id=? GROUP BY role', userId);
  const history = all(db, `SELECT m.id, m.mode, m.round, m.winner, m.days, m.players, m.ended_at, mp.role, mp.won, mp.survived, mp.points
    FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.user_id=? ORDER BY m.id DESC LIMIT 50`, userId);
  const ach = all(db, 'SELECT key, at FROM achievements WHERE user_id=?', userId);
  return { matches: u.matches, wins: u.wins, losses: u.matches - u.wins, winRate: u.matches ? Math.round((u.wins / u.matches) * 100) : 0,
    points: u.points, xp: u.xp, byRole, history, achievements: ach, allAchievements: Object.keys(ACHIEVEMENTS) };
}
export const leaderboard = (db, limit = 50) =>
  all(db, 'SELECT id, uid, name, avatar, frame, points, wins, matches, xp FROM users WHERE guest=0 AND matches>0 ORDER BY points DESC, wins DESC LIMIT ?', limit)
    .map((u) => ({ ...u, avatar: avatarUrl(u) }));
