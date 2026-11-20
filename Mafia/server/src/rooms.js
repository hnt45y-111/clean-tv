// طبقة الغرف: أونلاين وأوفلاين (QR)، الراوي الآلي، الأصدقاء، الدعوات، إعادة الاتصال، اللقطات.
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Match, GameError } from './game/engine.js';
import { validateSettings, suggestMafia, LIMITS, DEFAULT_SETTINGS } from './game/roles.js';
import { one, all, run } from './db.js';
import { publicUser, avatarUrl } from './auth.js';
import { recordMatch } from './progress.js';

export class RoomError extends Error { constructor(code) { super(code); this.code = code; } }
const bad = (c) => { throw new RoomError(c); };
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newToken = () => Array.from(randomBytes(8), (b) => B32[b % 32]).join('');
const safeEq = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

const AUTO = { min: 5, cap: 8, countdownMs: 15000, fullDelayMs: 3000, roleRevealMs: 8000, dawnMs: 4000, resultMs: 7000, talkSeconds: 30, voteSeconds: 40, nightSeconds: 40 };

export class Hub {
  constructor(db, { autoTimings = {}, log = () => {} } = {}) {
    this.db = db; this.rooms = new Map(); this.conns = new Map(); // userId -> Set<conn>
    this.t = { ...AUTO, ...autoTimings }; this.log = log; this.timers = new Map();
  }

  // ---------- الاتصالات ----------
  attach(conn) {
    const set = this.conns.get(conn.user.id) || new Set(); set.add(conn); this.conns.set(conn.user.id, set);
    const room = this.roomOf(conn.user.id);
    if (room) { const m = room.members.get(conn.user.id); if (m) m.connected = true; this.touch(room); this.broadcast(room); } // الراوي ليس ضمن members
    this.pushFriendsPresence(conn.user.id, true);
    conn.send({ t: 'hello', user: publicUser(one(this.db, 'SELECT * FROM users WHERE id=?', conn.user.id)), serverTime: Date.now(),
      room: room ? this.view(room, conn.user.id) : null, friends: this.friendsView(conn.user.id) });
  }
  detach(conn) {
    const set = this.conns.get(conn.user.id); if (!set) return;
    set.delete(conn);
    if (set.size) return;
    this.conns.delete(conn.user.id);
    this.pushFriendsPresence(conn.user.id, false);
    this.cancelMatchmaking(conn.user.id);
    const room = this.roomOf(conn.user.id); if (!room) return;
    const m = room.members.get(conn.user.id); if (m) m.connected = false;
    this.broadcast(room);
    if (!m) return;
    if (room.status === 'lobby') {   // مهلة 90 ثانية قبل إخراج المنقطع من غرفة الانتظار
      setTimeout(() => { const r = this.rooms.get(room.code); const mm = r?.members.get(conn.user.id);
        if (r && r.status === 'lobby' && mm && !mm.connected && !this.conns.has(conn.user.id)) this.removeMember(r, conn.user.id, 'timeout'); }, this.t.lobbyGraceMs ?? 90000).unref?.();
    }
  }
  online(userId) { return this.conns.has(userId); }
  sendTo(userId, msg) { this.conns.get(userId)?.forEach((c) => c.send(msg)); }

  // ---------- الغرف ----------
  roomOf(userId) { for (const r of this.rooms.values()) if (r.members.has(userId) || r.host === userId) return r; return null; }
  newCode() { for (;;) { const c = String(randomInt(100000, 999999)); if (!this.rooms.has(c)) return c; } }
  joinKey(room) { return `${room.code}-${room.token}`; }

  createRoom(user, { mode = 'online', settings = {} } = {}) {
    if (this.roomOf(user.id)) bad('already_in_room');
    if (!['online', 'offline'].includes(mode)) bad('bad_mode');
    const v = validateSettings(settings); if (!v.ok) bad(v.errors[0]);
    const room = this.blankRoom({ mode, host: user.id, settings: v.settings });
    if (mode === 'offline') room.settings.visibility = 'private';
    this.rooms.set(room.code, room); this.touch(room); this.broadcast(room);
    return room;
  }
  blankRoom({ mode, host, settings, auto = false }) {
    return { code: this.newCode(), token: newToken(), mode, host, auto, settings, members: new Map(), status: 'lobby', round: 0,
      match: null, history: [], scores: {}, invited: new Set(), banned: new Set(), startsAt: null, createdAt: Date.now() };
  }
  memberFrom(userId) {
    const u = one(this.db, 'SELECT * FROM users WHERE id=?', userId); const p = publicUser(u);
    return { id: u.id, uid: u.uid, name: u.name, avatar: p.avatar, frame: u.frame, level: p.level, ready: false, connected: this.online(u.id), guest: !!u.guest };
  }
  /** key: 'CODE' أو 'CODE-TOKEN' */
  findRoom(key) {
    const [code, token] = String(key || '').trim().toUpperCase().split('-');
    const room = this.rooms.get(code); if (!room || room.status === 'closed') bad('room_not_found');
    return { room, token };
  }
  joinRoom(user, key) {
    if (this.roomOf(user.id)) bad('already_in_room');
    const { room, token } = this.findRoom(key);
    if (room.banned.has(user.id)) bad('banned_from_room');
    // الأوفلاين يتطلب رمز الجلسة السري دائماً. الأونلاين الخاص: رمز الجلسة أو دعوة.
    const tokenOk = token && safeEq(token, room.token);
    if (room.mode === 'offline' && !tokenOk) bad('bad_token');
    if (room.mode === 'online' && room.settings.visibility === 'private' && !tokenOk && !room.invited.has(user.id)) bad('private_room');
    if (room.status !== 'lobby') bad('already_started');
    if (room.members.size >= room.settings.players) bad('room_full');
    this.addMember(room, user.id);
    return room;
  }
  addMember(room, userId) {
    room.members.set(userId, this.memberFrom(userId)); room.invited.delete(userId);
    this.touch(room); this.broadcast(room, { t: 'event', kind: 'joined', userId });
    if (room.auto) this.autoLobbyCheck(room);
  }
  removeMember(room, userId, why = 'left') {
    const m = room.members.get(userId); if (!m) return;
    if (room.match && room.status === 'playing') { room.match.playerLeft(String(userId)); room.members.delete(userId); room.left = (room.left || new Set()).add(userId); this.afterGameChange(room); }
    else room.members.delete(userId);
    this.sendTo(userId, { t: 'room', room: null, reason: why });
    if (room.auto && room.members.size === 0) return this.closeRoom(room);
    if (room.auto && room.status === 'lobby') this.autoLobbyCheck(room);
    this.touch(room); this.broadcast(room, { t: 'event', kind: 'left', userId, why });
  }
  closeRoom(room, why = 'closed') {
    room.status = 'closed'; clearTimeout(this.timers.get(room.code)); clearTimeout(room.autoTimer);
    for (const id of [...room.members.keys(), room.host].filter(Boolean)) this.sendTo(id, { t: 'room', room: null, reason: why });
    this.rooms.delete(room.code); run(this.db, 'DELETE FROM room_snapshots WHERE code=?', room.code);
  }

  // ---------- أوامر الغرفة ----------
  needHost(room, userId) { if (room.host !== userId) bad('not_host'); }
  setReady(user, ready) {
    const room = this.roomOf(user.id) || bad('no_room'); const m = room.members.get(user.id) || bad('not_member');
    if (room.status !== 'lobby') bad('already_started');
    m.ready = !!ready; this.touch(room); this.broadcast(room);
  }
  updateSettings(user, settings) {
    const room = this.roomOf(user.id) || bad('no_room'); this.needHost(room, user.id);
    if (room.status !== 'lobby' && room.status !== 'between') bad('already_started');
    const v = validateSettings({ ...room.settings, ...settings }); if (!v.ok) bad(v.errors[0]);
    if (v.settings.players < room.members.size) bad('players_below_members');
    if (room.mode === 'offline') v.settings.visibility = 'private';
    room.settings = v.settings; this.touch(room); this.broadcast(room);
  }
  kick(user, targetId) {
    const room = this.roomOf(user.id) || bad('no_room'); this.needHost(room, user.id);
    if (!room.members.has(targetId)) bad('not_member');
    room.banned.add(targetId); this.removeMember(room, targetId, 'kicked');
  }
  leave(user) {
    const room = this.roomOf(user.id) || bad('no_room');
    if (room.host === user.id) return this.closeRoom(room, 'host_left');
    this.removeMember(room, user.id, 'left');
  }
  close(user) { const room = this.roomOf(user.id) || bad('no_room'); this.needHost(room, user.id); this.closeRoom(room); }

  startMatch(user) {
    const room = this.roomOf(user.id) || bad('no_room'); this.needHost(room, user.id);
    this.beginRound(room);
  }
  beginRound(room) {
    if (!['lobby', 'between'].includes(room.status)) bad('already_started');
    const members = [...room.members.values()];
    const count = members.length;
    if (count < LIMITS.minPlayers) bad('not_enough_players');
    if (room.mode === 'online' && !room.auto && members.some((m) => !m.ready)) bad('not_all_ready');
    // العدد الفعلي قد يختلف عن المخطط: نعيد توزيع المافيا بصورة صالحة
    const st = { ...room.settings, players: count };
    if (room.auto || st.mafia * 2 >= count) st.mafia = suggestMafia(count);
    const v = validateSettings(st); if (!v.ok) bad(v.errors[0]);
    room.activeSettings = v.settings; room.round += 1; room.status = 'playing'; room.startsAt = null; room.left = new Set();
    room.match = Match.create({ players: members.map((m) => ({ id: String(m.id), name: m.name })), settings: v.settings });
    room.lastReport = null;
    this.afterGameChange(room); this.broadcast(room, { t: 'event', kind: 'match_start', round: room.round });
    this.sendNotifs([...room.members.keys()], { kind: 'match_start', room: room.code });
  }

  // أوامر اللعب. who = 'narrator' | معرّف اللاعب
  game(user, cmd, p = {}) {
    const room = this.roomOf(user.id) || bad('no_room'); const m = room.match;
    const isHost = room.host === user.id && !room.auto;
    const guard = (needsHost) => { if (needsHost && !isHost) bad('not_host'); if (!m || room.status !== 'playing') bad('no_match'); };
    const pid = String(user.id);
    try {
      switch (cmd) {
        case 'ack': guard(false); m.ackRole(pid); break;
        case 'night': guard(false); m.nightAction(pid, { kind: p.kind, target: p.target ? String(p.target) : null }); if (m.nightComplete() && room.auto) this.autoSoon(room, 1200); break;
        case 'vote': guard(false); m.castVote(pid, p.target ? String(p.target) : null); if (m.voteComplete() && room.auto) this.autoSoon(room, 1200); break;
        case 'beginNight': guard(true); m.beginNight(); break;
        case 'resolveNight': guard(true); m.resolveNight(); break;
        case 'beginDay': guard(true); m.beginDay(); break;
        case 'setSpeaker': guard(true); m.setSpeaker(String(p.id), clampSecs(p.seconds)); break;
        case 'nextSpeaker': guard(true); m.setSpeaker(m.nextSpeakerId(), clampSecs(p.seconds)); break;
        case 'clearSpeaker': guard(true); m.clearSpeaker(); break;
        case 'timer': guard(true);
          if (p.op === 'pause') m.timerPause(); else if (p.op === 'resume') m.timerResume(); else if (p.op === 'reset') m.timerReset(clampSecs(p.seconds)); else bad('bad_op'); break;
        case 'mute': guard(true); m.setMute(String(p.id), !!p.muted); break;
        case 'beginVote': guard(true); m.beginVote(); break;
        case 'closeVote': guard(true); m.closeVote(); break;
        case 'eliminate': guard(true); m.eliminate(String(p.id)); break;
        case 'endMatch': guard(true); m.endMatch(); break;
        case 'nextRound': if (!isHost) bad('not_host'); if (room.status !== 'between') bad('bad_phase'); this.beginRound(room); return;
        default: bad('bad_cmd');
      }
    } catch (e) { if (e instanceof GameError) throw new RoomError(e.code); throw e; }
    this.afterGameChange(room);
  }

  afterGameChange(room) {
    const m = room.match; if (!m) return;
    if (m.phase === 'ended' && room.status === 'playing') this.finishRound(room);
    this.touch(room); this.broadcast(room); this.scheduleTimerEvent(room); if (room.auto) this.autoPlan(room);
  }
  finishRound(room) {
    const m = room.match; const res = m.results();
    const entry = { round: room.round, winner: m.s.winner, cancelled: m.s.endReason === 'cancelled', days: m.s.day, results: res, names: Object.fromEntries(m.s.players.map((p) => [p.id, p.name])) };
    if (m.s.winner) {
      const ids = res.map((r) => Number(r.id));
      const friendsSets = new Map(ids.map((id) => [id, new Set(this.friendIds(id))]));
      const rows = res.filter((r) => !room.left?.has(Number(r.id))).map((r) => ({
        userId: Number(r.id), role: r.role, won: r.won, survived: r.survived, voted: r.stats.voted, stats: r.stats,
        friendsInRoom: ids.some((o) => o !== Number(r.id) && friendsSets.get(Number(r.id)).has(o)),
      }));
      const rec = recordMatch(this.db, { roomCode: room.code, mode: room.mode, round: room.round, winner: m.s.winner, days: m.s.day, rows });
      entry.points = rec.per;
      for (const r of res) if (r.won) room.scores[r.id] = (room.scores[r.id] || 0) + 1;
      for (const r of rows) {
        const u = publicUser(one(this.db, 'SELECT * FROM users WHERE id=?', r.userId));
        this.sendTo(r.userId, { t: 'progress', user: u, gained: rec.per[r.userId] });
      }
    }
    room.history.push(entry); room.lastReport = entry;
    // تبقى الغرفة وأعضاؤها كما هي بين الجولات: لا QR ولا انضمام جديد
    const more = room.round < room.settings.rounds && room.members.size >= LIMITS.minPlayers;
    room.status = more && !room.auto ? 'between' : 'finished';
  }

  // ---------- مؤقت: بث انتهاء الوقت ----------
  scheduleTimerEvent(room) {
    clearTimeout(this.timers.get(room.code));
    const m = room.match; if (!m || !m.s.timer || m.s.timer.paused || m.phase === 'ended') return;
    const left = m.timerLeft();
    const h = setTimeout(() => { if (!this.rooms.has(room.code)) return; this.broadcast(room, { t: 'event', kind: 'timeup', phase: m.phase });
      if (room.auto) this.autoTimeUp(room); }, left + 30);
    h.unref?.(); this.timers.set(room.code, h);
  }

  // ---------- الراوي الآلي (الغرف العشوائية بلا راوٍ بشري) ----------
  autoSoon(room, ms) { clearTimeout(room.autoTimer); room.autoTimer = setTimeout(() => this.autoAdvance(room), ms); room.autoTimer.unref?.(); }
  autoPlan(room) {
    const m = room.match; if (!m || room.status !== 'playing') return;
    const T = this.t; const ph = m.phase;
    if (ph === 'roles') this.autoSoon(room, T.roleRevealMs);
    else if (ph === 'dawn') this.autoSoon(room, T.dawnMs);
    else if (ph === 'voteResult') this.autoSoon(room, T.resultMs);
    else if (ph === 'night' && m.nightComplete()) this.autoSoon(room, 1200);
    else if (ph === 'vote' && m.voteComplete()) this.autoSoon(room, 1200);
  }
  autoTimeUp(room) { this.autoAdvance(room, true); }
  autoAdvance(room) {
    const m = room.match; if (!m || room.status !== 'playing' || !this.rooms.has(room.code)) return;
    try {
      switch (m.phase) {
        case 'roles': case 'voteResult': m.beginNight(); break;
        case 'night': m.resolveNight(); break;
        case 'dawn': m.beginDay(); room.spoken = new Set(); m.setSpeaker(m.alive()[0].id, this.t.talkSeconds); room.spoken.add(m.s.speaker); break;
        case 'day': {
          room.spoken ||= new Set();
          const next = m.alive().find((x) => !room.spoken.has(x.id));
          if (next) { m.setSpeaker(next.id, this.t.talkSeconds); room.spoken.add(next.id); } else m.beginVote();
          break;
        }
        case 'vote': m.closeVote(); break;
        default: return;
      }
    } catch (e) { this.log('auto error', e.message); return; }
    this.afterGameChange(room);
  }
  // مؤقت الراوي الآلي: ينتهي وقت المتحدث/التصويت/الليل فيتقدم تلقائياً
  autoLobbyCheck(room) {
    if (room.status !== 'lobby') return;
    clearTimeout(room.autoTimer);
    const n = room.members.size; room.startsAt = null;
    if (n >= room.settings.players) room.startsAt = Date.now() + this.t.fullDelayMs;
    else if (n >= this.t.min) room.startsAt = Date.now() + this.t.countdownMs;
    if (room.startsAt) {
      room.autoTimer = setTimeout(() => { try { this.beginRound(room); } catch (e) { this.log('auto start', e.message); } }, room.startsAt - Date.now()); room.autoTimer.unref?.();
    }
    this.broadcast(room);
  }

  // ---------- البحث العشوائي ----------
  findMatch(user) {
    if (this.roomOf(user.id)) bad('already_in_room');
    let room = [...this.rooms.values()].find((r) => r.auto && r.status === 'lobby' && r.members.size < r.settings.players && !r.banned.has(user.id));
    if (!room) {
      const st = validateSettings({ ...DEFAULT_SETTINGS, players: this.t.cap, mafia: 2, visibility: 'public', talkSeconds: Math.max(15, this.t.talkSeconds), voteSeconds: Math.max(15, this.t.voteSeconds), nightSeconds: Math.max(15, this.t.nightSeconds) }).settings;
      room = this.blankRoom({ mode: 'online', host: null, settings: st, auto: true });
      this.rooms.set(room.code, room);
    }
    this.addMember(room, user.id); return room;
  }
  cancelMatchmaking(userId) { const r = this.roomOf(userId); if (r?.auto && r.status === 'lobby') this.removeMember(r, userId, 'left'); }
  listPublic() {
    return [...this.rooms.values()].filter((r) => r.mode === 'online' && r.settings.visibility === 'public' && r.status === 'lobby')
      .map((r) => ({ code: r.code, auto: r.auto, players: r.members.size, max: r.settings.players, mafia: r.settings.mafia, rounds: r.settings.rounds,
        host: r.host ? one(this.db, 'SELECT name FROM users WHERE id=?', r.host)?.name : null }));
  }

  // ---------- العرض والبث ----------
  view(room, userId) {
    const isHost = room.host === userId && !room.auto; const viewer = isHost ? 'narrator' : String(userId);
    const hostRow = room.host ? room.members.get(room.host) || this.memberFrom(room.host) : null;
    return {
      code: room.code, mode: room.mode, auto: room.auto, status: room.status, round: room.round, settings: room.settings, activeSettings: room.activeSettings || null,
      host: room.host, isHost, me: userId, startsAt: room.startsAt, serverTime: Date.now(),
      joinKey: isHost ? this.joinKey(room) : undefined,
      hostInfo: hostRow ? { id: hostRow.id, name: hostRow.name, avatar: hostRow.avatar, uid: hostRow.uid, connected: this.online(room.host) } : null,
      members: [...room.members.values()].map((m) => ({ ...m, connected: this.online(m.id) })),
      scores: room.scores, history: room.history.map((h) => ({ round: h.round, winner: h.winner, cancelled: h.cancelled, days: h.days })),
      report: room.lastReport && ['between', 'finished'].includes(room.status) ? room.lastReport : null,
      match: room.match && room.status !== 'lobby' ? room.match.view(room.members.has(userId) || isHost ? viewer : 'none') : null,
    };
  }
  broadcast(room, event) {
    const ids = new Set([...room.members.keys(), ...(room.host ? [room.host] : [])]);
    for (const id of ids) { this.sendTo(id, { t: 'room', room: this.view(room, id) }); if (event) this.sendTo(id, event); }
  }
  sendNotifs(ids, n) { ids.forEach((id) => this.sendTo(id, { t: 'notif', ...n })); }

  // ---------- اللقطات (استرجاع بعد انقطاع الخادم) ----------
  touch(room) {
    if (room.status === 'closed') return;
    const snap = { code: room.code, token: room.token, mode: room.mode, host: room.host, auto: room.auto, settings: room.settings, activeSettings: room.activeSettings, status: room.status, round: room.round,
      history: room.history, scores: room.scores, banned: [...room.banned], left: [...(room.left || [])], members: [...room.members.values()].map((m) => ({ id: m.id, ready: m.ready })), match: room.match ? room.match.toJSON() : null };
    run(this.db, 'INSERT OR REPLACE INTO room_snapshots VALUES(?,?,?)', room.code, JSON.stringify(snap), Date.now());
  }
  restore() {
    let n = 0;
    for (const r of all(this.db, 'SELECT * FROM room_snapshots')) {
      try {
        const s = JSON.parse(r.json); if (Date.now() - r.updated_at > 6 * 3600 * 1000) { run(this.db, 'DELETE FROM room_snapshots WHERE code=?', r.code); continue; }
        const room = { ...this.blankRoom({ mode: s.mode, host: s.host, settings: s.settings, auto: s.auto }), code: s.code, token: s.token, status: s.status, round: s.round,
          activeSettings: s.activeSettings, history: s.history, scores: s.scores, banned: new Set(s.banned), left: new Set(s.left), match: s.match ? Match.restore(s.match) : null };
        for (const m of s.members) { if (one(this.db, 'SELECT 1 FROM users WHERE id=?', m.id)) { const mm = this.memberFrom(m.id); mm.ready = m.ready; mm.connected = false; room.members.set(m.id, mm); } }
        room.lastReport = room.history.at(-1) || null;
        this.rooms.set(room.code, room); n++;
        if (room.match && room.status === 'playing') { this.scheduleTimerEvent(room); if (room.auto) this.autoPlan(room); }
      } catch (e) { this.log('restore failed', r.code, e.message); }
    }
    return n;
  }

  // ---------- الأصدقاء ----------
  friendIds(userId) {
    return all(this.db, "SELECT CASE WHEN a=? THEN b ELSE a END AS f FROM friends WHERE status='accepted' AND (a=? OR b=?)", userId, userId, userId).map((r) => r.f);
  }
  friendsView(userId) {
    const row = (u) => ({ id: u.id, uid: u.uid, name: u.name, avatar: avatarUrl(u), frame: u.frame, online: this.online(u.id), inRoom: this.roomOf(u.id)?.code || null });
    const friends = all(this.db, "SELECT u.* FROM friends f JOIN users u ON u.id = CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE f.status='accepted' AND (f.a=? OR f.b=?)", userId, userId, userId).map(row);
    const incoming = all(this.db, "SELECT u.* FROM friends f JOIN users u ON u.id=f.a WHERE f.b=? AND f.status='pending'", userId).map(row);
    const outgoing = all(this.db, "SELECT u.* FROM friends f JOIN users u ON u.id=f.b WHERE f.a=? AND f.status='pending'", userId).map(row);
    return { friends, incoming, outgoing };
  }
  pushFriends(userId) { this.sendTo(userId, { t: 'friends', ...this.friendsView(userId) }); }
  pushFriendsPresence(userId) { this.friendIds(userId).forEach((f) => this.pushFriends(f)); }
  friendRequest(user, uid) {
    const t = one(this.db, 'SELECT * FROM users WHERE uid=?', String(uid || '').trim()); if (!t) bad('user_not_found');
    if (t.id === user.id) bad('self_friend');
    const ex = one(this.db, 'SELECT * FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)', user.id, t.id, t.id, user.id);
    if (ex?.status === 'accepted') bad('already_friends');
    if (ex && ex.a === user.id) bad('already_requested');
    if (ex && ex.a === t.id) return this.friendAccept(user, t.id); // طلب متبادل = قبول
    run(this.db, "INSERT INTO friends VALUES(?,?, 'pending', ?)", user.id, t.id, Date.now());
    this.pushFriends(user.id); this.pushFriends(t.id); this.sendNotifs([t.id], { kind: 'friend_request', from: user.name });
  }
  friendAccept(user, fromId) {
    const r = run(this.db, "UPDATE friends SET status='accepted' WHERE a=? AND b=? AND status='pending'", fromId, user.id);
    if (!r.changes) bad('no_request');
    this.pushFriends(user.id); this.pushFriends(fromId); this.sendNotifs([fromId], { kind: 'friend_accepted', from: user.name });
  }
  friendRemove(user, otherId) {
    run(this.db, 'DELETE FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)', user.id, otherId, otherId, user.id);
    this.pushFriends(user.id); this.pushFriends(otherId);
  }
  invite(user, targetId) {
    const room = this.roomOf(user.id) || bad('no_room'); if (room.status !== 'lobby') bad('already_started');
    if (room.mode !== 'online') bad('bad_mode');
    if (room.host !== user.id && !room.members.has(user.id)) bad('not_member');
    if (!this.friendIds(user.id).includes(targetId)) bad('not_friend');
    if (this.roomOf(targetId)) bad('target_busy');
    room.invited.add(targetId);
    this.sendTo(targetId, { t: 'invite', code: room.code, from: user.name, fromId: user.id, auto: room.auto });
    this.sendNotifs([targetId], { kind: 'invite', from: user.name, room: room.code });
  }
  report(user, targetId, reason) {
    const t = one(this.db, 'SELECT id FROM users WHERE id=?', targetId); if (!t || t.id === user.id) bad('bad_target');
    const room = this.roomOf(user.id);
    reason = String(reason || '').slice(0, 300); if (!reason) bad('bad_reason');
    if (one(this.db, 'SELECT 1 FROM reports WHERE reporter=? AND target=? AND room_code IS ?', user.id, targetId, room?.code ?? null)) bad('already_reported');
    run(this.db, 'INSERT INTO reports(reporter,target,reason,room_code,at) VALUES(?,?,?,?,?)', user.id, targetId, reason, room?.code ?? null, Date.now());
    // 5 مبلّغين مختلفين => حظر تلقائي من المراجعة اليدوية لاحقاً (علامة فقط)
    const n = one(this.db, 'SELECT COUNT(DISTINCT reporter) c FROM reports WHERE target=?', targetId).c;
    return { reports: n };
  }
}
const clampSecs = (s) => (s === undefined || s === null ? undefined : Math.min(600, Math.max(10, Math.trunc(+s) || 10)));
