package com.mafia.game.core;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * آلة حالات المباراة — نقل مباشر لـ server/src/game/engine.js (نفس القواعد ونفس شكل العرض).
 * المراحل: roles → night → dawn → day → vote → voteResult → night … → ended
 */
public final class Match {
    public static final class Player {
        public String id, name, role; public boolean alive = true, manualMute = false, seen = false;
        public boolean voted = false, sniperHit = false; public int saved = 0, caught = 0; public String diedBy = null;
        public boolean converted = false, shield = false;
    }
    static final class Night {
        Map<String, String> kill = new LinkedHashMap<>(); String save, investigate, shoot; boolean shootSet;
        Map<String, String> done = new LinkedHashMap<>();
        String mdSave, guard, neg, witchKill; boolean witchLife, witchKillSet;
    }
    static final class Timer { long total, endsAt, remaining; boolean paused; }

    public Settings settings; public long startedAt;
    public String phase = "roles"; public int day = 0, nights = 0;
    public final List<Player> players = new ArrayList<>();
    Night night; Map<String, String> votes; // votes: null عند عدم وجود تصويت
    public String speaker; Timer timer;
    Map<String, Object> lastNight, lastVote;
    public boolean sniperUsed = false; String lastSaved;
    /** الأوفلاين: الراوي يسجّل أفعال الليل ونتيجة التصويت بنفسه (الإشارة باليد)، وهواتف اللاعبين لكشف الأدوار فقط */
    public boolean narratorDriven = false;
    public boolean witchLifeUsed = false, witchDeathUsed = false, negotiatorDecided = false;
    public String winner, endReason;
    final List<Map<String, Object>> log = new ArrayList<>();
    final Map<String, List<Map<String, Object>>> priv = new LinkedHashMap<>();
    private final Random rng;

    private Match(Random rng) { this.rng = rng; }

    public static Match create(List<String[]> idNames, Settings st, Random rng, long now) {
        Match m = new Match(rng); m.settings = st; m.startedAt = now;
        List<String> roles = Settings.shuffle(st.roleList(idNames.size()), rng);
        for (int k = 0; k < idNames.size(); k++) { Player p = new Player(); p.id = idNames.get(k)[0]; p.name = idNames.get(k)[1]; p.role = roles.get(k); p.shield = p.role.equals("super_citizen"); m.players.add(p); }
        return m;
    }

    // ---------- أدوات ----------
    public Player p(String id) { if (id == null) return null; for (Player x : players) if (x.id.equals(id)) return x; return null; }
    public List<Player> alive() { List<Player> l = new ArrayList<>(); for (Player x : players) if (x.alive) l.add(x); return l; }
    /** الفريق الحالي: المافيا وطبيب المافيا، والمفاوض إن اختار الانضمام */
    public static String team(Player x) { return x.role.equals("negotiator") ? (x.converted ? "mafia" : "town") : Settings.team(x.role); }
    static boolean isMafiaTeam(Player x) { return team(x).equals("mafia"); }
    List<Player> aliveTeamMafia() { List<Player> l = new ArrayList<>(); for (Player x : players) if (x.alive && isMafiaTeam(x)) l.add(x); return l; }
    List<Player> aliveRole(String r) { List<Player> l = new ArrayList<>(); for (Player x : players) if (x.alive && x.role.equals(r)) l.add(x); return l; }
    private void need(String... ph) { if (!Arrays.asList(ph).contains(phase)) throw new GameError("bad_phase"); }
    private static GameError fail(String c) { return new GameError(c); }
    private void log(String type, Map<String, Object> data) {
        Map<String, Object> e = Json.obj("type", type, "day", (long) day, "t", System.currentTimeMillis());
        if (data != null) e.putAll(data); log.add(e);
    }
    public boolean isMuted(String id) {
        Player x = p(id); if (x == null) return false;
        return (settings.narratorMute && x.manualMute) || (settings.muteDead && !x.alive) || (settings.muteNight && "night".equals(phase));
    }

    // ---------- المؤقت ----------
    void startTimer(long seconds, long now) { Timer t = new Timer(); t.total = seconds * 1000; t.endsAt = now + t.total; t.remaining = t.total; timer = t; }
    void startTimerMs(long ms, long now) { Timer t = new Timer(); t.total = ms; t.endsAt = now + ms; t.remaining = ms; timer = t; }
    public void timerPause(long now) { if (timer == null || timer.paused) return; timer.remaining = Math.max(0, timer.endsAt - now); timer.paused = true; }
    public void timerResume(long now) { if (timer == null || !timer.paused) return; timer.endsAt = now + timer.remaining; timer.paused = false; }
    public void timerReset(Integer seconds, long now) { if (seconds != null) startTimer(seconds, now); else if (timer != null) startTimerMs(timer.total, now); else startTimerMs(0, now); }
    public long timerLeft(long now) { if (timer == null) return 0; return timer.paused ? timer.remaining : Math.max(0, timer.endsAt - now); }
    public boolean hasRunningTimer() { return timer != null && !timer.paused; }

    // ---------- الأدوار ----------
    public void ackRole(String id) { need("roles"); Player x = p(id); if (x == null) throw fail("no_player"); x.seen = true; }

    // ---------- الليل ----------
    public void beginNight(long now) {
        need("roles", "voteResult", "day", "vote");
        nights++; phase = "night"; speaker = null; votes = null; night = new Night();
        startTimer(settings.nightSeconds, now);
        log("night", Json.obj("n", (long) nights));
    }
    /** الأدوار التي لم يُسجَّل فعلها بعد (وضع الراوي) */
    public List<String> pendingRoles() {
        List<String> out = new ArrayList<>(); if (night == null) return out;
        for (String r : activeNightRoles()) {
            if (r.equals("witch")) { if ((!witchLifeUsed && !night.done.containsKey("witch_life")) || (!witchDeathUsed && !night.done.containsKey("witch_kill"))) out.add(r); }
            else if (!night.done.containsKey(r)) out.add(r);
        }
        return out;
    }
    public List<String> activeNightRoles() {
        // ترتيب نداء الراوي: المفاوض ← المافيا ← طبيب المافيا ← الحارس ← طبيب المدينة ← المحقق ← الساحرة ← القناص
        List<String> r = new ArrayList<>();
        if (!negotiatorDecided && !aliveRole("negotiator").isEmpty()) r.add("negotiator");
        if (!aliveTeamMafia().isEmpty()) r.add("mafia");
        if (!aliveRole("mafia_doctor").isEmpty()) r.add("mafia_doctor");
        if (!aliveRole("bodyguard").isEmpty()) r.add("bodyguard");
        if (!aliveRole("doctor").isEmpty()) r.add("doctor");
        if (!aliveRole("detective").isEmpty()) r.add("detective");
        if (!aliveRole("witch").isEmpty() && (!witchLifeUsed || !witchDeathUsed)) r.add("witch");
        if (!sniperUsed && !aliveRole("sniper").isEmpty()) r.add("sniper");
        return r;
    }
    public List<String> pendingNight() {
        if (narratorDriven) return pendingRoles();
        List<String> out = new ArrayList<>(); if (night == null) return out;
        List<Player> need = new ArrayList<>(aliveRole("mafia")); need.addAll(aliveRole("doctor")); need.addAll(aliveRole("detective"));
        if (!sniperUsed) need.addAll(aliveRole("sniper"));
        for (Player x : need) if (!night.done.containsKey(x.id)) out.add(x.id);
        return out;
    }
    public boolean nightComplete() { return "night".equals(phase) && pendingNight().isEmpty(); }

    /** وضع الراوي: يسجّل ما أشار إليه صاحب الدور. يمكن تعديل الاختيار قبل إنهاء الليل. */
    public Map<String, Object> recordNight(String kind, String target) { return recordNight(kind, target, null); }
    public Map<String, Object> recordNight(String kind, String target, String choice) {
        need("night");
        if (!narratorDriven) throw fail("forbidden");
        Night n = night;
        Player tgt = null;
        if (target != null) { tgt = p(target); if (tgt == null || !tgt.alive) throw fail("bad_target"); }
        if (kind == null) kind = "";
        String role;
        switch (kind) {
            case "kill": role = "mafia"; if (aliveTeamMafia().isEmpty()) throw fail("forbidden");
                if (tgt == null || isMafiaTeam(tgt)) throw fail("bad_target");
                n.kill.clear(); n.kill.put("mafia", target); break;
            case "save": role = "doctor"; if (aliveRole("doctor").isEmpty()) throw fail("forbidden");
                if (tgt == null) throw fail("bad_target");
                if (target.equals(lastSaved)) throw fail("same_save");
                n.save = target; break;
            case "investigate": { role = "detective"; List<Player> d = aliveRole("detective"); if (d.isEmpty()) throw fail("forbidden");
                if (tgt == null || tgt.id.equals(d.get(0).id)) throw fail("bad_target");
                n.investigate = target; break; }
            case "shoot": { role = "sniper"; List<Player> sn = aliveRole("sniper"); if (sn.isEmpty() || sniperUsed) throw fail("forbidden");
                if (tgt != null && tgt.id.equals(sn.get(0).id)) throw fail("bad_target");
                n.shoot = target; n.shootSet = true; break; }
            case "negotiate": role = "negotiator"; if (aliveRole("negotiator").isEmpty() || negotiatorDecided) throw fail("forbidden");
                if (!"town".equals(choice) && !"mafia".equals(choice)) throw fail("bad_choice");
                n.neg = choice; break;
            case "mdsave": role = "mafia_doctor"; if (aliveRole("mafia_doctor").isEmpty()) throw fail("forbidden");
                if (tgt == null || !isMafiaTeam(tgt)) throw fail("bad_target"); // ينقذ المافيا فقط
                n.mdSave = target; break;
            case "guard": { role = "bodyguard"; List<Player> bg = aliveRole("bodyguard"); if (bg.isEmpty()) throw fail("forbidden");
                if (tgt == null || tgt.id.equals(bg.get(0).id)) throw fail("bad_target");
                n.guard = target; break; }
            case "witch_life": if (aliveRole("witch").isEmpty() || witchLifeUsed) throw fail("forbidden");
                n.witchLife = "use".equals(choice); n.done.put("witch_life", kind); return Json.obj("pending", (long) pendingRoles().size());
            case "witch_kill": { List<Player> w = aliveRole("witch"); if (w.isEmpty() || witchDeathUsed) throw fail("forbidden");
                if (tgt != null && tgt.id.equals(w.get(0).id)) throw fail("bad_target");
                n.witchKill = target; n.witchKillSet = true; n.done.put("witch_kill", kind); return Json.obj("pending", (long) pendingRoles().size()); }
            default: throw fail("bad_kind");
        }
        n.done.put(role, kind);
        return Json.obj("pending", (long) pendingRoles().size());
    }

    public void nightAction(String id, String kind, String target) {
        need("night");
        if (narratorDriven) throw fail("forbidden"); // في الأوفلاين يسجّل الراوي
        Player x = p(id); if (x == null) throw fail("no_player");
        if (!x.alive) throw fail("dead");
        Night n = night;
        if (n.done.containsKey(id)) throw fail("already_acted");
        Player tgt = null;
        if (target != null) { tgt = p(target); if (tgt == null) throw fail("bad_target"); }
        if (tgt != null && !tgt.alive) throw fail("bad_target");
        if (kind == null) kind = "";
        switch (kind) {
            case "kill":
                if (!x.role.equals("mafia")) throw fail("forbidden");
                if (tgt == null || isMafiaTeam(tgt)) throw fail("bad_target");
                n.kill.put(id, target); break;
            case "save":
                if (!x.role.equals("doctor")) throw fail("forbidden");
                if (tgt == null) throw fail("bad_target");
                if (target.equals(lastSaved)) throw fail("same_save");
                n.save = target; break;
            case "investigate": {
                if (!x.role.equals("detective")) throw fail("forbidden");
                if (tgt == null || tgt.id.equals(id)) throw fail("bad_target");
                n.investigate = target;
                boolean isMafia = isMafiaTeam(tgt);
                priv.computeIfAbsent(id, k -> new ArrayList<>()).add(Json.obj("type", "investigation", "night", (long) nights, "target", target, "isMafia", isMafia));
                if (isMafia) x.caught++;
                break;
            }
            case "shoot":
                if (!x.role.equals("sniper") || sniperUsed) throw fail("forbidden");
                if (tgt != null && tgt.id.equals(id)) throw fail("bad_target");
                n.shoot = target; n.shootSet = true; break; // null = تمرير
            default: throw fail("bad_kind");
        }
        n.done.put(id, kind);
    }

    public Map<String, Object> resolveNight() {
        need("night");
        Night n = night; List<Map<String, Object>> deaths = new ArrayList<>();
        Map<String, Object> info = new LinkedHashMap<>();
        // 0) قرار المفاوض: يبقى مع المدينة أو ينضم للمافيا (مرة واحدة)
        List<Player> negs = aliveRole("negotiator");
        if (!negs.isEmpty() && n.neg != null && !negotiatorDecided) { negotiatorDecided = true; negs.get(0).converted = n.neg.equals("mafia"); info.put("negotiator", n.neg); }
        // 1) ضحية المافيا: الأعلى اختياراً، والتعادل عشوائي
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String t : n.kill.values()) counts.put(t, counts.getOrDefault(t, 0) + 1);
        String killTarget = null; int top = 0;
        for (int c : counts.values()) top = Math.max(top, c);
        if (top > 0) { List<String> tied = new ArrayList<>(); for (Map.Entry<String, Integer> e : counts.entrySet()) if (e.getValue() == top) tied.add(e.getKey()); killTarget = tied.get(rng.nextInt(tied.size())); }
        Player victim = killTarget == null ? null : p(killTarget);
        if (victim != null && isMafiaTeam(victim)) victim = null; // انضم للمافيا في الليلة نفسها
        boolean saved = false;
        if (n.witchLife && !witchLifeUsed) witchLifeUsed = true;
        if (victim != null) {
            List<Player> bg = aliveRole("bodyguard");
            if (victim.id.equals(n.save)) { saved = true; List<Player> d = aliveRole("doctor"); if (!d.isEmpty()) d.get(0).saved++; }
            else if (!bg.isEmpty() && victim.id.equals(n.guard) && !bg.get(0).id.equals(victim.id)) { deaths.add(Json.obj("id", bg.get(0).id, "cause", "bodyguard")); info.put("guarded", victim.id); }
            else if (n.witchLife) info.put("witchSaved", victim.id);
            else if (victim.shield) { victim.shield = false; info.put("shielded", victim.id); }
            else deaths.add(Json.obj("id", victim.id, "cause", "mafia"));
        }
        // 2) جرعة الموت
        if (n.witchKillSet && n.witchKill != null && !witchDeathUsed) {
            witchDeathUsed = true; Player w = p(n.witchKill);
            if (w != null && w.alive && !hasDeath(deaths, w.id)) deaths.add(Json.obj("id", w.id, "cause", "witch"));
        }
        if (narratorDriven && n.investigate != null) { Player it = p(n.investigate); List<Player> d = aliveRole("detective");
            if (it != null && isMafiaTeam(it) && !d.isEmpty()) d.get(0).caught++; }
        // 3) القناص: إصابة مافيا تقتله (إلا إن أنقذه طبيب المافيا)، وإصابة غيره تقتل القناص
        List<Player> sns = aliveRole("sniper"); Player sn = sns.isEmpty() ? null : sns.get(0);
        if (sn != null && n.shoot != null) {
            sniperUsed = true; Player t = p(n.shoot);
            if (isMafiaTeam(t)) {
                if (t.id.equals(n.mdSave) && !aliveRole("mafia_doctor").isEmpty()) info.put("sniperBlocked", t.id);
                else { sn.sniperHit = true; if (!hasDeath(deaths, t.id)) deaths.add(Json.obj("id", t.id, "cause", "sniper")); }
            } else if (!hasDeath(deaths, sn.id)) deaths.add(Json.obj("id", sn.id, "cause", "sniper_miss"));
        }
        lastSaved = n.save;
        for (Map<String, Object> d : deaths) kill((String) d.get("id"), (String) d.get("cause"));
        lastNight = Json.obj("n", (long) nights, "deaths", deaths, "saved", saved); lastNight.putAll(info);
        phase = "dawn"; timer = null;
        log("dawn", Json.obj("deaths", deaths, "saved", saved));
        checkWin();
        return lastNight;
    }
    private static boolean hasDeath(List<Map<String, Object>> d, String id) { for (Map<String, Object> x : d) if (id.equals(x.get("id"))) return true; return false; }

    void kill(String id, String cause) {
        Player x = p(id); if (x == null || !x.alive) return;
        x.alive = false; x.diedBy = cause; x.manualMute = false;
        if (id.equals(speaker)) speaker = null;
    }

    // ---------- النهار ----------
    public void beginDay() { need("dawn"); phase = "day"; day++; timer = null; speaker = null; log("day", null); }
    public void setSpeaker(String id, Integer seconds, long now) {
        need("day");
        Player x = p(id); if (x == null) throw fail("no_player");
        if (!x.alive) throw fail("dead");
        speaker = id;
        startTimer(seconds != null && seconds != 0 ? seconds : settings.talkSeconds, now);
        log("speaker", Json.obj("id", id));
    }
    public void setSpeakerMs(String id, long ms, long now) { need("day"); Player x = p(id); if (x == null) throw fail("no_player"); if (!x.alive) throw fail("dead"); speaker = id; startTimerMs(ms, now); log("speaker", Json.obj("id", id)); }
    public String nextSpeakerId() {
        List<Player> al = alive(); if (al.isEmpty()) return null;
        int i = -1; for (int k = 0; k < al.size(); k++) if (al.get(k).id.equals(speaker)) i = k;
        return al.get((i + 1) % al.size()).id;
    }
    public void clearSpeaker() { speaker = null; timer = null; }
    public void setMute(String id, boolean muted) {
        if (!settings.narratorMute) throw fail("mute_disabled");
        Player x = p(id); if (x == null) throw fail("no_player");
        if (!x.alive) throw fail("dead");
        x.manualMute = muted;
    }

    // ---------- التصويت ----------
    public void beginVote(long now) { need("day"); phase = "vote"; speaker = null; votes = new LinkedHashMap<>(); startTimer(settings.voteSeconds, now); log("vote_start", null); }
    /** وضع الراوي: التصويت باليد، والراوي يسجّل من خرج (أو لا أحد) */
    public Map<String, Object> recordVote(String target) {
        need("day", "vote");
        if (!narratorDriven) throw fail("forbidden");
        if (target != null) { Player t = p(target); if (t == null || !t.alive) throw fail("bad_target"); }
        lastVote = Json.obj("day", (long) day, "votes", new LinkedHashMap<String, Object>(), "tally", new LinkedHashMap<String, Object>(), "abstain", 0L,
                "eliminated", target, "tie", false, "manual", true);
        if (target != null) kill(target, "vote");
        phase = "voteResult"; speaker = null; votes = null; timer = null;
        log("vote_result", Json.obj("eliminated", target));
        checkWin();
        return lastVote;
    }

    public void castVote(String id, String target) {
        need("vote");
        if (narratorDriven) throw fail("forbidden");
        Player x = p(id); if (x == null) throw fail("no_player");
        if (!x.alive) throw fail("dead");
        if (votes.containsKey(id)) throw fail("already_voted");
        if (target != null) { Player t = p(target); if (t == null) throw fail("bad_target"); if (!t.alive || target.equals(id)) throw fail("bad_target"); }
        votes.put(id, target); x.voted = true;
    }
    public boolean voteComplete() { if (!"vote".equals(phase)) return false; for (Player x : alive()) if (!votes.containsKey(x.id)) return false; return true; }
    public Map<String, Object> closeVote() {
        need("vote");
        Map<String, Object> tally = new LinkedHashMap<>(); int abstain = 0;
        for (Map.Entry<String, String> e : votes.entrySet()) { String t = e.getValue(); Player vp = p(e.getKey()); long w = vp != null && vp.role.equals("mayor") ? 2 : 1;
            if (t == null) abstain += w; else tally.put(t, ((Long) tally.getOrDefault(t, 0L)) + w); }
        long top = 0; for (Object v : tally.values()) top = Math.max(top, (Long) v);
        List<String> leaders = new ArrayList<>(); for (Map.Entry<String, Object> e : tally.entrySet()) if ((Long) e.getValue() == top) leaders.add(e.getKey());
        String eliminated = top > 0 && leaders.size() == 1 && top > abstain ? leaders.get(0) : null;
        lastVote = Json.obj("day", (long) day, "votes", new LinkedHashMap<String, Object>(votes), "tally", tally, "abstain", (long) abstain,
                "eliminated", eliminated, "tie", top > 0 && leaders.size() > 1);
        if (eliminated != null) kill(eliminated, "vote");
        phase = "voteResult"; timer = null;
        log("vote_result", Json.obj("eliminated", eliminated));
        checkWin();
        return lastVote;
    }

    // ---------- استبعاد وإنهاء ----------
    public void eliminate(String id) {
        if (phase.equals("ended") || phase.equals("roles")) throw fail("bad_phase");
        Player x = p(id); if (x == null) throw fail("no_player");
        if (!x.alive) throw fail("dead");
        kill(id, "narrator"); log("eliminate", Json.obj("id", id)); checkWin();
    }
    public void playerLeft(String id) { Player x = p(id); if (x != null && x.alive && !phase.equals("ended")) { kill(id, "left"); checkWin(); } }
    public String checkWin() {
        if (phase.equals("ended")) return winner;
        int m = aliveTeamMafia().size(); int o = alive().size() - m;
        String w = null;
        if (m == 0) w = "town"; else if (m >= o) w = "mafia";
        if (w != null) { winner = w; endReason = "rules"; phase = "ended"; timer = null; speaker = null; log("end", Json.obj("winner", w)); }
        return w;
    }
    public void endMatch() { if (phase.equals("ended")) return; winner = null; endReason = "cancelled"; phase = "ended"; timer = null; log("end", Json.obj("winner", null)); }

    // ---------- العرض (حماية الأسرار) ----------
    public Map<String, Object> view(String viewer, long now) {
        boolean isN = "narrator".equals(viewer); Player me = isN ? null : p(viewer); boolean ended = phase.equals("ended");
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("phase", phase); v.put("day", (long) day); v.put("nights", (long) nights); v.put("speaker", speaker);
        v.put("timer", timer == null ? null : Json.obj("total", timer.total, "left", timerLeft(now), "paused", timer.paused, "endsAt", timer.paused ? null : (Object) timer.endsAt));
        List<Object> ps = new ArrayList<>();
        for (Player x : players) {
            boolean show = isN || ended || x.id.equals(viewer) || (!x.alive && settings.revealRoleOnDeath) || (me != null && isMafiaTeam(me) && isMafiaTeam(x));
            Map<String, Object> pv = Json.obj("id", x.id, "name", x.name, "alive", x.alive, "muted", isMuted(x.id), "manual", x.manualMute && x.alive, "role", show ? x.role : null);
            if (isN) { pv.put("seen", x.seen); pv.put("team", team(x)); if (x.role.equals("super_citizen")) pv.put("shield", x.shield); }
            ps.add(pv);
        }
        v.put("players", ps);
        if (phase.equals("dawn") || phase.equals("day")) {
            List<Object> d = new ArrayList<>();
            if (lastNight != null) for (Object o : Json.list(lastNight.get("deaths"))) d.add(Json.obj("id", Json.map(o).get("id")));
            v.put("lastNight", Json.obj("deaths", d));
        } else v.put("lastNight", null);
        boolean showVote = phase.equals("voteResult") || ended || phase.equals("night") || phase.equals("day");
        v.put("lastVote", showVote && lastVote != null ? Json.obj("day", lastVote.get("day"), "tally", lastVote.get("tally"), "abstain", lastVote.get("abstain"),
                "eliminated", lastVote.get("eliminated"), "tie", lastVote.get("tie"), "votes", lastVote.get("votes")) : null);
        v.put("winner", winner); v.put("endReason", endReason); v.put("narratorDriven", narratorDriven);
        if (lastVote != null && v.get("lastVote") != null && Json.truthy(lastVote.get("manual"))) Json.map(v.get("lastVote")).put("manual", true);
        if (isN) {
            v.put("sniperUsed", sniperUsed);
            Map<String, Object> nv = null;
            if (night != null && phase.equals("night") && narratorDriven) {
                Player it = p(night.investigate);
                nv = Json.obj("mode", "narrator", "kill", night.kill.get("mafia"), "save", night.save, "cannotSave", lastSaved, "investigate", night.investigate,
                        "investigateIsMafia", it == null ? null : (Object) isMafiaTeam(it), "shoot", night.shoot, "shootSet", night.shootSet,
                        "mdSave", night.mdSave, "guard", night.guard, "neg", night.neg, "witchLife", night.done.containsKey("witch_life") ? (Object) night.witchLife : null,
                        "witchKill", night.witchKill, "witchKillSet", night.witchKillSet, "witchLifeUsed", witchLifeUsed, "witchDeathUsed", witchDeathUsed,
                        "done", new LinkedHashMap<String, Object>(night.done), "pending", pendingRoles(), "roles", activeNightRoles());
            } else if (night != null && phase.equals("night")) {
                nv = Json.obj("kill", new LinkedHashMap<String, Object>(night.kill), "save", night.save, "investigate", night.investigate);
                if (night.shootSet) nv.put("shoot", night.shoot);
                nv.put("done", new LinkedHashMap<String, Object>(night.done)); nv.put("pending", pendingNight());
            }
            int from = Math.max(0, log.size() - 40);
            v.put("narrator", Json.obj("night", nv, "liveVotes", phase.equals("vote") ? new LinkedHashMap<String, Object>(votes) : null, "lastNight", lastNight, "log", new ArrayList<>(log.subList(from, log.size()))));
        } else if (me != null) {
            Map<String, Object> mv = Json.obj("id", me.id, "role", me.role, "alive", me.alive, "team", team(me));
            if (me.role.equals("negotiator")) mv.put("converted", me.converted);
            if (isMafiaTeam(me)) { List<Object> mates = new ArrayList<>(); for (Player x : players) if (isMafiaTeam(x) && !x.id.equals(me.id)) mates.add(x.id); mv.put("mates", mates); }
            mv.put("priv", priv.containsKey(me.id) ? priv.get(me.id) : new ArrayList<>());
            if (phase.equals("night") && me.alive && !narratorDriven) {
                mv.put("acted", night.done.containsKey(me.id));
                if (me.role.equals("mafia")) mv.put("mafiaVotes", new LinkedHashMap<String, Object>(night.kill));
                if (me.role.equals("sniper")) mv.put("sniperUsed", sniperUsed);
                if (me.role.equals("doctor")) mv.put("cannotSave", lastSaved);
            }
            if (phase.equals("vote")) mv.put("voted", votes.containsKey(me.id));
            v.put("me", mv);
            if (phase.equals("vote")) v.put("voteProgress", Json.obj("done", (long) votes.size(), "total", (long) alive().size()));
        }
        return v;
    }

    public List<Map<String, Object>> results() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Player x : players) {
            String team = team(x);
            out.add(Json.obj("id", x.id, "role", x.role, "team", team, "survived", x.alive, "won", winner != null && team.equals(winner),
                    "stats", Json.obj("voted", x.voted, "saved", (long) x.saved, "sniperHit", x.sniperHit, "caught", (long) x.caught, "diedBy", x.diedBy)));
        }
        return out;
    }

    // ---------- لقطة للحفظ والاسترجاع ----------
    public Map<String, Object> toMap() {
        List<Object> ps = new ArrayList<>();
        for (Player x : players) ps.add(Json.obj("id", x.id, "name", x.name, "role", x.role, "alive", x.alive, "manualMute", x.manualMute, "seen", x.seen,
                "voted", x.voted, "saved", (long) x.saved, "sniperHit", x.sniperHit, "caught", (long) x.caught, "diedBy", x.diedBy, "converted", x.converted, "shield", x.shield));
        Map<String, Object> nm = null;
        if (night != null) nm = Json.obj("kill", new LinkedHashMap<String, Object>(night.kill), "save", night.save, "investigate", night.investigate, "shoot", night.shoot, "shootSet", night.shootSet, "done", new LinkedHashMap<String, Object>(night.done),
                "mdSave", night.mdSave, "guard", night.guard, "neg", night.neg, "witchLife", night.witchLife, "witchKill", night.witchKill, "witchKillSet", night.witchKillSet);
        Map<String, Object> pr = new LinkedHashMap<>(); for (Map.Entry<String, List<Map<String, Object>>> e : priv.entrySet()) pr.put(e.getKey(), new ArrayList<Object>(e.getValue()));
        return Json.obj("settings", settings.toMap(), "startedAt", startedAt, "phase", phase, "day", (long) day, "nights", (long) nights, "players", ps, "night", nm,
                "votes", votes == null ? null : new LinkedHashMap<String, Object>(votes), "speaker", speaker,
                "timer", timer == null ? null : Json.obj("total", timer.total, "endsAt", timer.endsAt, "remaining", timer.remaining, "paused", timer.paused),
                "lastNight", lastNight, "lastVote", lastVote, "sniperUsed", sniperUsed, "lastSaved", lastSaved, "narratorDriven", narratorDriven, "witchLifeUsed", witchLifeUsed, "witchDeathUsed", witchDeathUsed, "negotiatorDecided", negotiatorDecided, "winner", winner, "endReason", endReason, "log", new ArrayList<Object>(log), "priv", pr);
    }
    private static long L(Object o) { Double d = Json.num(o); return d == null ? 0 : d.longValue(); }
    private static String S(Object o) { return o == null ? null : String.valueOf(o); }
    @SuppressWarnings("unchecked")
    public static Match fromMap(Map<String, Object> m, Random rng) {
        Match x = new Match(rng);
        x.settings = Settings.fromMap(Json.map(m.get("settings"))); x.startedAt = L(m.get("startedAt"));
        x.phase = S(m.get("phase")); x.day = (int) L(m.get("day")); x.nights = (int) L(m.get("nights"));
        for (Object o : Json.list(m.get("players"))) { Map<String, Object> pm = Json.map(o); Player p = new Player();
            p.id = S(pm.get("id")); p.name = S(pm.get("name")); p.role = S(pm.get("role")); p.alive = Json.truthy(pm.get("alive")); p.manualMute = Json.truthy(pm.get("manualMute")); p.seen = Json.truthy(pm.get("seen"));
            p.voted = Json.truthy(pm.get("voted")); p.saved = (int) L(pm.get("saved")); p.sniperHit = Json.truthy(pm.get("sniperHit")); p.caught = (int) L(pm.get("caught")); p.diedBy = S(pm.get("diedBy")); p.converted = Json.truthy(pm.get("converted")); p.shield = Json.truthy(pm.get("shield")); x.players.add(p); }
        if (m.get("night") != null) { Map<String, Object> nm = Json.map(m.get("night")); Night n = new Night();
            for (Map.Entry<String, Object> e : Json.map(nm.get("kill")).entrySet()) n.kill.put(e.getKey(), S(e.getValue()));
            n.save = S(nm.get("save")); n.investigate = S(nm.get("investigate")); n.shoot = S(nm.get("shoot")); n.shootSet = Json.truthy(nm.get("shootSet"));
            for (Map.Entry<String, Object> e : Json.map(nm.get("done")).entrySet()) n.done.put(e.getKey(), S(e.getValue()));
            n.mdSave = S(nm.get("mdSave")); n.guard = S(nm.get("guard")); n.neg = S(nm.get("neg")); n.witchLife = Json.truthy(nm.get("witchLife")); n.witchKill = S(nm.get("witchKill")); n.witchKillSet = Json.truthy(nm.get("witchKillSet"));
            x.night = n; }
        if (m.get("votes") != null) { x.votes = new LinkedHashMap<>(); for (Map.Entry<String, Object> e : Json.map(m.get("votes")).entrySet()) x.votes.put(e.getKey(), S(e.getValue())); }
        x.speaker = S(m.get("speaker"));
        if (m.get("timer") != null) { Map<String, Object> tm = Json.map(m.get("timer")); Timer t = new Timer(); t.total = L(tm.get("total")); t.endsAt = L(tm.get("endsAt")); t.remaining = L(tm.get("remaining")); t.paused = Json.truthy(tm.get("paused")); x.timer = t; }
        x.lastNight = m.get("lastNight") == null ? null : Json.map(m.get("lastNight")); x.lastVote = m.get("lastVote") == null ? null : Json.map(m.get("lastVote"));
        x.sniperUsed = Json.truthy(m.get("sniperUsed")); x.narratorDriven = Json.truthy(m.get("narratorDriven"));
        x.witchLifeUsed = Json.truthy(m.get("witchLifeUsed")); x.witchDeathUsed = Json.truthy(m.get("witchDeathUsed")); x.negotiatorDecided = Json.truthy(m.get("negotiatorDecided")); x.lastSaved = S(m.get("lastSaved")); x.winner = S(m.get("winner")); x.endReason = S(m.get("endReason"));
        for (Object o : Json.list(m.get("log"))) x.log.add(Json.map(o));
        for (Map.Entry<String, Object> e : Json.map(m.get("priv")).entrySet()) { List<Map<String, Object>> l = new ArrayList<>(); for (Object o : Json.list(e.getValue())) l.add(Json.map(o)); x.priv.put(e.getKey(), l); }
        return x;
    }
}
