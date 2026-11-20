package com.mafia.game.core;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * الغرف داخل هاتف الراوي (أوفلاين): نقل لـ server/src/rooms.js بنفس البروتوكول والعرض،
 * بلا حسابات أونلاين: كل لاعب يدخل باسمه فقط. كل العمليات متزامنة على هذا الكائن.
 */
public final class Hub {
    public interface Conn { long userId(); boolean loopback(); void send(Map<String, Object> msg); void close(); }

    public static final class User { public long id; public String uid, name, token; }
    static final class Member { long id; String uid, name; boolean ready; }
    static final class Room {
        String code, token, mode = "offline"; long host; Settings settings, activeSettings;
        final LinkedHashMap<Long, Member> members = new LinkedHashMap<>();
        String status = "lobby"; int round = 0; Match match;
        final List<Map<String, Object>> history = new ArrayList<>(); final Map<String, Object> scores = new LinkedHashMap<>();
        final Set<Long> banned = new HashSet<>(); Set<Long> left = new HashSet<>(); Map<String, Object> lastReport; long createdAt;
        /** لاعبون بلا هاتف (أو لم يتصل هاتفهم): يضيفهم الراوي بالاسم ويكشف أدوارهم على هاتفه */
        final LinkedHashMap<String, String> guests = new LinkedHashMap<>(); int nextGuest = 1;
        int size() { return members.size() + guests.size(); }
    }

    private static final String B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final SecureRandom rnd = new SecureRandom();
    private final Map<String, User> byToken = new LinkedHashMap<>();
    private final Map<Long, User> users = new LinkedHashMap<>();
    private final Map<Long, Set<Conn>> conns = new LinkedHashMap<>();
    private final Map<String, Room> rooms = new LinkedHashMap<>();
    private final Map<String, ScheduledFuture<?>> timers = new LinkedHashMap<>();
    private final ScheduledExecutorService sched = Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "mafia-timers"); t.setDaemon(true); return t; });
    private final File snapshot; private ScheduledFuture<?> saveTask; private long nextUserId = 1;
    public long lobbyGraceMs = 90_000;

    public Hub(File snapshot) { this.snapshot = snapshot; }

    // ---------- المستخدمون ----------
    private String token() { byte[] b = new byte[32]; rnd.nextBytes(b); return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }
    private String newUid() { for (;;) { String u = String.valueOf(10_000_000 + rnd.nextInt(90_000_000)); boolean used = false; for (User x : users.values()) if (x.uid.equals(u)) used = true; if (!used) return u; } }
    static String cleanName(Object n) { String s = n == null ? "" : String.valueOf(n).replaceAll("\\s+", " ").trim(); return s.length() > 24 ? s.substring(0, 24) : s; }

    public synchronized Map<String, Object> guest(Object name) {
        User u = new User(); u.id = nextUserId++; u.uid = newUid(); u.name = cleanName(name); if (u.name.isEmpty()) u.name = "لاعب"; u.token = token();
        users.put(u.id, u); byToken.put(u.token, u); save();
        return Json.obj("token", u.token, "user", publicUser(u));
    }
    public synchronized User byToken(String t) { return t == null ? null : byToken.get(t); }
    public synchronized void logout(String t) { byToken.remove(t); save(); }
    public synchronized Map<String, Object> rename(User u, Object name) {
        String n = cleanName(name); if (n.length() < 2) throw new GameError("bad_name");
        u.name = n; Room r = roomOf(u.id); if (r != null && r.members.containsKey(u.id)) { r.members.get(u.id).name = n; broadcast(r, null); } save();
        return publicUser(u);
    }
    public static Map<String, Object> publicUser(User u) {
        return Json.obj("id", u.id, "uid", u.uid, "name", u.name, "avatar", null, "frame", "none", "xp", 0L, "points", 0L, "matches", 0L, "wins", 0L, "guest", true, "level", 1L);
    }

    // ---------- الاتصالات ----------
    public synchronized void attach(Conn c) {
        conns.computeIfAbsent(c.userId(), k -> new LinkedHashSet<>()).add(c);
        Room room = roomOf(c.userId());
        if (room != null) { touch(room); broadcast(room, null); }
        c.send(Json.obj("t", "hello", "user", publicUser(users.get(c.userId())), "serverTime", System.currentTimeMillis(),
                "room", room != null ? view(room, c.userId()) : null, "friends", emptyFriends()));
    }
    public synchronized void detach(Conn c) {
        Set<Conn> set = conns.get(c.userId()); if (set == null) return;
        set.remove(c); if (!set.isEmpty()) return;
        conns.remove(c.userId());
        final long uid = c.userId(); Room room = roomOf(uid); if (room == null) return;
        broadcast(room, null);
        if (!room.members.containsKey(uid)) return; // الراوي ليس ضمن الأعضاء
        if (room.status.equals("lobby")) {
            final String code = room.code;
            sched.schedule(() -> { synchronized (Hub.this) { Room r = rooms.get(code);
                if (r != null && r.status.equals("lobby") && r.members.containsKey(uid) && !online(uid)) removeMember(r, uid, "timeout"); } }, lobbyGraceMs, TimeUnit.MILLISECONDS);
        }
    }
    boolean online(long id) { return conns.containsKey(id); }
    void sendTo(long id, Map<String, Object> msg) { Set<Conn> s = conns.get(id); if (s != null) for (Conn c : new ArrayList<>(s)) c.send(msg); }
    static Map<String, Object> emptyFriends() { return Json.obj("friends", new ArrayList<>(), "incoming", new ArrayList<>(), "outgoing", new ArrayList<>()); }

    // ---------- الغرف ----------
    Room roomOf(long uid) { for (Room r : rooms.values()) if (r.members.containsKey(uid) || r.host == uid) return r; return null; }
    private String newCode() { for (;;) { String c = String.valueOf(100_000 + rnd.nextInt(900_000)); if (!rooms.containsKey(c)) return c; } }
    private String newRoomToken() { StringBuilder sb = new StringBuilder(); for (int k = 0; k < 8; k++) sb.append(B32.charAt(rnd.nextInt(32))); return sb.toString(); }
    String joinKey(Room r) { return r.code + "-" + r.token; }
    private static GameError bad(String c) { return new GameError(c); }

    public synchronized void createRoom(Conn c, Map<String, Object> msg) {
        if (!c.loopback()) throw bad("not_host"); // إنشاء الغرف من هاتف الراوي فقط
        long uid = c.userId();
        if (roomOf(uid) != null) throw bad("already_in_room");
        Object mode = msg.get("mode");
        if (mode != null && !"offline".equals(mode)) throw bad("bad_mode");
        Settings.Result v = Settings.validate(Json.map(msg.get("settings"))); if (!v.ok) throw bad(v.errors.get(0));
        Room r = new Room(); r.code = newCode(); r.token = newRoomToken(); r.host = uid; r.settings = v.settings; r.settings.visibility = "private"; r.createdAt = System.currentTimeMillis();
        rooms.put(r.code, r); touch(r); broadcast(r, null);
    }
    Member memberFrom(long id) { User u = users.get(id); Member m = new Member(); m.id = u.id; m.uid = u.uid; m.name = u.name; return m; }

    public synchronized void joinRoom(long uid, Object key) {
        if (roomOf(uid) != null) throw bad("already_in_room");
        String[] parts = String.valueOf(key == null ? "" : key).trim().toUpperCase().split("-");
        Room room = rooms.get(parts[0]); if (room == null || room.status.equals("closed")) throw bad("room_not_found");
        if (room.banned.contains(uid)) throw bad("banned_from_room");
        boolean tokenOk = parts.length > 1 && MessageDigest.isEqual(parts[1].getBytes(StandardCharsets.UTF_8), room.token.getBytes(StandardCharsets.UTF_8));
        if (!tokenOk) throw bad("bad_token");
        if (!room.status.equals("lobby")) throw bad("already_started");
        if (room.size() >= room.settings.players) throw bad("room_full");
        room.members.put(uid, memberFrom(uid));
        touch(room); broadcast(room, Json.obj("t", "event", "kind", "joined", "userId", uid));
    }
    void removeMember(Room room, long uid, String why) {
        if (!room.members.containsKey(uid)) return;
        if (room.match != null && room.status.equals("playing")) { room.match.playerLeft(String.valueOf(uid)); room.members.remove(uid); room.left.add(uid); afterGameChange(room); }
        else room.members.remove(uid);
        sendTo(uid, Json.obj("t", "room", "room", null, "reason", why));
        touch(room); broadcast(room, Json.obj("t", "event", "kind", "left", "userId", uid, "why", why));
    }
    void closeRoom(Room room, String why) {
        room.status = "closed"; ScheduledFuture<?> t = timers.remove(room.code); if (t != null) t.cancel(false);
        List<Long> ids = new ArrayList<>(room.members.keySet()); ids.add(room.host);
        for (long id : ids) sendTo(id, Json.obj("t", "room", "room", null, "reason", why));
        rooms.remove(room.code); save();
    }
    private Room needRoom(long uid) { Room r = roomOf(uid); if (r == null) throw bad("no_room"); return r; }
    private void needHost(Room r, long uid) { if (r.host != uid) throw bad("not_host"); }

    public synchronized void setReady(long uid, boolean ready) {
        Room r = needRoom(uid); Member m = r.members.get(uid); if (m == null) throw bad("not_member");
        if (!r.status.equals("lobby")) throw bad("already_started");
        m.ready = ready; touch(r); broadcast(r, null);
    }
    public synchronized void updateSettings(long uid, Map<String, Object> s) {
        Room r = needRoom(uid); needHost(r, uid);
        if (!r.status.equals("lobby") && !r.status.equals("between")) throw bad("already_started");
        Map<String, Object> merged = r.settings.toMap(); merged.putAll(s);
        Settings.Result v = Settings.validate(merged); if (!v.ok) throw bad(v.errors.get(0));
        if (v.settings.players < r.size()) throw bad("players_below_members");
        v.settings.visibility = "private"; r.settings = v.settings; touch(r); broadcast(r, null);
    }
    public synchronized void kick(long uid, long target) {
        Room r = needRoom(uid); needHost(r, uid); if (!r.members.containsKey(target)) throw bad("not_member");
        r.banned.add(target); removeMember(r, target, "kicked");
    }
    public synchronized void addGuest(long uid, Object name) {
        Room r = needRoom(uid); needHost(r, uid);
        if (!r.status.equals("lobby") && !r.status.equals("between")) throw bad("already_started");
        String n = cleanName(name); if (n.isEmpty()) throw bad("bad_name");
        if (r.size() >= Settings.MAX_PLAYERS) throw bad("room_full");
        if (r.size() >= r.settings.players) { Map<String, Object> st = r.settings.toMap(); st.put("players", (long) (r.size() + 1)); Settings.Result v = Settings.validate(st); if (v.ok) r.settings = v.settings; }
        r.guests.put("g" + (r.nextGuest++), n); touch(r); broadcast(r, null);
    }
    public synchronized void removeGuest(long uid, Object id) {
        Room r = needRoom(uid); needHost(r, uid);
        if (!r.status.equals("lobby") && !r.status.equals("between")) throw bad("already_started");
        if (r.guests.remove(String.valueOf(id)) == null) throw bad("not_member");
        touch(r); broadcast(r, null);
    }

    public synchronized void leave(long uid) { Room r = needRoom(uid); if (r.host == uid) { closeRoom(r, "host_left"); return; } removeMember(r, uid, "left"); }
    public synchronized void close(long uid) { Room r = needRoom(uid); needHost(r, uid); closeRoom(r, "closed"); }
    public synchronized void startMatch(long uid) { Room r = needRoom(uid); needHost(r, uid); beginRound(r); }

    void beginRound(Room room) {
        if (!room.status.equals("lobby") && !room.status.equals("between")) throw bad("already_started");
        int count = room.size();
        if (count < Settings.MIN_PLAYERS) throw bad("not_enough_players");
        Map<String, Object> st = room.settings.toMap(); st.put("players", (long) count);
        if (room.settings.mafia * 2 >= count) st.put("mafia", (long) Settings.suggestMafia(count));
        Settings.Result v = Settings.validate(st); if (!v.ok) throw bad(v.errors.get(0));
        room.activeSettings = v.settings; room.round++; room.status = "playing"; room.left = new HashSet<>();
        List<String[]> ps = new ArrayList<>(); for (Member m : room.members.values()) ps.add(new String[] { String.valueOf(m.id), m.name });
        for (Map.Entry<String, String> g : room.guests.entrySet()) ps.add(new String[] { g.getKey(), g.getValue() });
        room.match = Match.create(ps, v.settings, rnd, System.currentTimeMillis()); room.lastReport = null;
        room.match.narratorDriven = true; // الأوفلاين: الراوي يسجّل كل شيء
        afterGameChange(room);
        broadcast(room, Json.obj("t", "event", "kind", "match_start", "round", (long) room.round));
        for (long id : room.members.keySet()) sendTo(id, Json.obj("t", "notif", "kind", "match_start", "room", room.code));
    }

    private static Integer clampSecs(Object s) {
        if (s == null) return null; Double d = Json.num(s);
        int v = d == null || d.isNaN() ? 0 : (int) (d > 0 ? Math.floor(d) : Math.ceil(d));
        if (v == 0) v = 10; return Math.min(600, Math.max(10, v));
    }
    private static String sid(Object o) { if (o == null) return null; Double d = Json.num(o); if (o instanceof Number && d != null && d == Math.rint(d)) return String.valueOf(d.longValue()); return String.valueOf(o); }

    public synchronized void game(long uid, String cmd, Map<String, Object> p) {
        Room room = needRoom(uid); Match m = room.match; boolean isHost = room.host == uid; String pid = String.valueOf(uid); long now = System.currentTimeMillis();
        boolean active = m != null && room.status.equals("playing");
        if (cmd == null) cmd = "";
        switch (cmd) {
            case "nextRound": if (!isHost) throw bad("not_host"); if (!room.status.equals("between")) throw bad("bad_phase"); beginRound(room); return;
            case "ack": case "night": case "vote": if (!active) throw bad("no_match"); break;
            default: if (!isHost) throw bad("not_host"); if (!active) throw bad("no_match");
        }
        switch (cmd) {
            case "ack": m.ackRole(pid); break;
            case "night": m.nightAction(pid, p.get("kind") == null ? null : String.valueOf(p.get("kind")), Json.truthy(p.get("target")) ? sid(p.get("target")) : null); break;
            case "vote": m.castVote(pid, Json.truthy(p.get("target")) ? sid(p.get("target")) : null); break;
            case "beginNight": m.beginNight(now); break;
            case "resolveNight": m.resolveNight(); break;
            case "beginDay": m.beginDay(); break;
            case "setSpeaker": m.setSpeaker(sid(p.get("id")), clampSecs(p.get("seconds")), now); break;
            case "nextSpeaker": m.setSpeaker(m.nextSpeakerId(), clampSecs(p.get("seconds")), now); break;
            case "clearSpeaker": m.clearSpeaker(); break;
            case "timer": {
                Object op = p.get("op");
                if ("pause".equals(op)) m.timerPause(now); else if ("resume".equals(op)) m.timerResume(now); else if ("reset".equals(op)) m.timerReset(clampSecs(p.get("seconds")), now); else throw bad("bad_op");
                break;
            }
            case "mute": m.setMute(sid(p.get("id")), Json.truthy(p.get("muted"))); break;
            case "beginVote": m.beginVote(now); break;
            case "closeVote": m.closeVote(); break;
            case "eliminate": m.eliminate(sid(p.get("id"))); break;
            case "endMatch": m.endMatch(); break;
            case "record": m.recordNight(p.get("kind") == null ? null : String.valueOf(p.get("kind")), Json.truthy(p.get("target")) ? sid(p.get("target")) : null); break;
            case "voteResult": m.recordVote(Json.truthy(p.get("target")) ? sid(p.get("target")) : null); break;
            case "reveal": m.ackRole(sid(p.get("id"))); break; // الراوي عرض الدور على هاتفه
            default: throw bad("bad_cmd");
        }
        afterGameChange(room);
    }

    void afterGameChange(Room room) {
        Match m = room.match; if (m == null) return;
        if (m.phase.equals("ended") && room.status.equals("playing")) finishRound(room);
        touch(room); broadcast(room, null); scheduleTimerEvent(room);
    }
    void finishRound(Room room) {
        Match m = room.match; List<Map<String, Object>> res = m.results();
        Map<String, Object> names = new LinkedHashMap<>(); for (Match.Player p : m.players) names.put(p.id, p.name);
        Map<String, Object> entry = Json.obj("round", (long) room.round, "winner", m.winner, "cancelled", "cancelled".equals(m.endReason), "days", (long) m.day, "results", res, "names", names);
        if (m.winner != null) for (Map<String, Object> r : res) if (Json.truthy(r.get("won"))) { String id = (String) r.get("id"); room.scores.put(id, (Long) room.scores.getOrDefault(id, 0L) + 1); }
        room.history.add(entry); room.lastReport = entry;
        boolean more = room.round < room.settings.rounds && room.size() >= Settings.MIN_PLAYERS;
        room.status = more ? "between" : "finished";
    }

    void scheduleTimerEvent(final Room room) {
        ScheduledFuture<?> old = timers.remove(room.code); if (old != null) old.cancel(false);
        final Match m = room.match; if (m == null || !m.hasRunningTimer() || m.phase.equals("ended")) return;
        long left = m.timerLeft(System.currentTimeMillis());
        timers.put(room.code, sched.schedule(() -> { synchronized (Hub.this) { if (!rooms.containsKey(room.code)) return; broadcast(room, Json.obj("t", "event", "kind", "timeup", "phase", m.phase)); } }, left + 30, TimeUnit.MILLISECONDS));
    }

    // ---------- العرض والبث ----------
    Map<String, Object> view(Room room, long uid) {
        boolean isHost = room.host == uid; String viewer = isHost ? "narrator" : String.valueOf(uid);
        User h = users.get(room.host);
        List<Object> members = new ArrayList<>();
        for (Member m : room.members.values()) members.add(Json.obj("id", m.id, "uid", m.uid, "name", m.name, "avatar", null, "frame", "none", "level", 1L, "ready", m.ready, "connected", online(m.id), "guest", true));
        List<Object> hist = new ArrayList<>();
        for (Map<String, Object> e : room.history) hist.add(Json.obj("round", e.get("round"), "winner", e.get("winner"), "cancelled", e.get("cancelled"), "days", e.get("days")));
        Map<String, Object> v = Json.obj("code", room.code, "mode", room.mode, "auto", false, "status", room.status, "round", (long) room.round, "settings", room.settings.toMap(),
                "activeSettings", room.activeSettings == null ? null : room.activeSettings.toMap(), "host", room.host, "isHost", isHost, "me", uid, "startsAt", null, "serverTime", System.currentTimeMillis());
        if (isHost) v.put("joinKey", joinKey(room));
        v.put("hostInfo", h == null ? null : Json.obj("id", h.id, "name", h.name, "avatar", null, "uid", h.uid, "connected", online(h.id)));
        v.put("members", members);
        List<Object> gs = new ArrayList<>(); for (Map.Entry<String, String> g : room.guests.entrySet()) gs.add(Json.obj("id", g.getKey(), "name", g.getValue()));
        v.put("guests", gs); v.put("scores", new LinkedHashMap<>(room.scores)); v.put("history", hist);
        v.put("report", room.lastReport != null && (room.status.equals("between") || room.status.equals("finished")) ? room.lastReport : null);
        v.put("match", room.match != null && !room.status.equals("lobby") ? room.match.view(room.members.containsKey(uid) || isHost ? viewer : "none", System.currentTimeMillis()) : null);
        return v;
    }
    void broadcast(Room room, Map<String, Object> event) {
        Set<Long> ids = new LinkedHashSet<>(room.members.keySet()); ids.add(room.host);
        for (long id : ids) { sendTo(id, Json.obj("t", "room", "room", view(room, id))); if (event != null) sendTo(id, event); }
    }

    // ---------- الحفظ والاسترجاع ----------
    void touch(Room r) { save(); }
    private void save() {
        if (snapshot == null) return;
        if (saveTask != null && !saveTask.isDone()) return; // دمج عمليات الحفظ المتقاربة
        saveTask = sched.schedule(() -> { String json; synchronized (Hub.this) { json = Json.stringify(snapshotMap()); }
            try { File tmp = new File(snapshot.getPath() + ".tmp"); try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(json.getBytes(StandardCharsets.UTF_8)); } if (!tmp.renameTo(snapshot)) { snapshot.delete(); tmp.renameTo(snapshot); } }
            catch (Exception ignored) { } }, 300, TimeUnit.MILLISECONDS);
    }
    private Map<String, Object> snapshotMap() {
        List<Object> us = new ArrayList<>(); for (User u : users.values()) us.add(Json.obj("id", u.id, "uid", u.uid, "name", u.name, "token", byToken.containsKey(u.token) ? u.token : null));
        List<Object> rs = new ArrayList<>();
        for (Room r : rooms.values()) {
            List<Object> ms = new ArrayList<>(); for (Member m : r.members.values()) ms.add(Json.obj("id", m.id, "ready", m.ready));
            rs.add(Json.obj("code", r.code, "token", r.token, "host", r.host, "settings", r.settings.toMap(), "activeSettings", r.activeSettings == null ? null : r.activeSettings.toMap(),
                    "status", r.status, "round", (long) r.round, "history", new ArrayList<Object>(r.history), "scores", new LinkedHashMap<>(r.scores), "banned", new ArrayList<Object>(r.banned),
                    "left", new ArrayList<Object>(r.left), "members", ms, "guests", new LinkedHashMap<String, Object>(r.guests), "nextGuest", (long) r.nextGuest, "match", r.match == null ? null : r.match.toMap(), "createdAt", r.createdAt));
        }
        return Json.obj("v", 1L, "savedAt", System.currentTimeMillis(), "nextUserId", nextUserId, "users", us, "rooms", rs);
    }
    /** يعيد عدد الغرف المسترجعة. اللقطة الأقدم من 6 ساعات تُهمل. */
    public synchronized int restore() {
        if (snapshot == null || !snapshot.exists()) return 0;
        try {
            Map<String, Object> s = Json.map(Json.parse(new String(Files.readAllBytes(snapshot.toPath()), StandardCharsets.UTF_8)));
            if (System.currentTimeMillis() - lng(s.get("savedAt")) > 6 * 3600_000L) return 0;
            nextUserId = Math.max(1, lng(s.get("nextUserId")));
            for (Object o : Json.list(s.get("users"))) { Map<String, Object> m = Json.map(o); User u = new User(); u.id = lng(m.get("id")); u.uid = (String) m.get("uid"); u.name = (String) m.get("name"); u.token = (String) m.get("token");
                users.put(u.id, u); if (u.token != null) byToken.put(u.token, u); nextUserId = Math.max(nextUserId, u.id + 1); }
            int n = 0;
            for (Object o : Json.list(s.get("rooms"))) {
                Map<String, Object> m = Json.map(o); Room r = new Room(); r.code = (String) m.get("code"); r.token = (String) m.get("token"); r.host = lng(m.get("host"));
                r.settings = Settings.fromMap(Json.map(m.get("settings"))); r.activeSettings = m.get("activeSettings") == null ? null : Settings.fromMap(Json.map(m.get("activeSettings")));
                r.status = (String) m.get("status"); r.round = (int) lng(m.get("round")); r.createdAt = lng(m.get("createdAt"));
                for (Object h : Json.list(m.get("history"))) r.history.add(Json.map(h));
                r.scores.putAll(Json.map(m.get("scores")));
                for (Object b : Json.list(m.get("banned"))) r.banned.add(lng(b));
                for (Object b : Json.list(m.get("left"))) r.left.add(lng(b));
                for (Object mo : Json.list(m.get("members"))) { Map<String, Object> mm = Json.map(mo); long id = lng(mm.get("id")); if (users.containsKey(id)) { Member mb = memberFrom(id); mb.ready = Json.truthy(mm.get("ready")); r.members.put(id, mb); } }
                for (Map.Entry<String, Object> g : Json.map(m.get("guests")).entrySet()) r.guests.put(g.getKey(), String.valueOf(g.getValue()));
                r.nextGuest = (int) Math.max(1, lng(m.get("nextGuest")));
                if (m.get("match") != null) r.match = Match.fromMap(Json.map(m.get("match")), rnd);
                r.lastReport = r.history.isEmpty() ? null : r.history.get(r.history.size() - 1);
                rooms.put(r.code, r); n++;
                if (r.match != null && r.status.equals("playing")) scheduleTimerEvent(r);
            }
            return n;
        } catch (Exception e) { return 0; }
    }
    private static long lng(Object o) { Double d = Json.num(o); return d == null ? 0 : d.longValue(); }

    public synchronized int roomCount() { return rooms.size(); }
    public void shutdown() { sched.shutdownNow(); }
}
