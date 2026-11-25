package com.mafia.game.core;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/** إعدادات المباراة والتحقق منها — مطابقة لـ server/src/game/roles.js */
public final class Settings {
    public static final int MIN_PLAYERS = 4, MAX_PLAYERS = 20, MAX_ROUNDS = 10;

    public int players = 8, mafia = 2;
    public boolean doctor = true, detective = true, sniper = true;
    public int talkSeconds = 120, voteSeconds = 60, nightSeconds = 45, rounds = 1;
    public String visibility = "private";
    public boolean narratorMute = true, muteDead = true, muteNight = true, revealRoleOnDeath = true;
    /** أدوار إضافية اختيارية يفعّلها الراوي (معطّلة افتراضياً) */
    public boolean mafiaDoctor = false, superCitizen = false, negotiator = false, bodyguard = false, witch = false, mayor = false;
    public static final String[] EXTRA = { "mafiaDoctor", "superCitizen", "negotiator", "bodyguard", "witch", "mayor" };

    public Settings copy() { return fromMap(toMap()); }

    public Map<String, Object> toMap() {
        return Json.obj("players", (long) players, "mafia", (long) mafia, "doctor", doctor, "detective", detective, "sniper", sniper,
                "talkSeconds", (long) talkSeconds, "voteSeconds", (long) voteSeconds, "nightSeconds", (long) nightSeconds, "rounds", (long) rounds,
                "visibility", visibility, "narratorMute", narratorMute, "muteDead", muteDead, "muteNight", muteNight, "revealRoleOnDeath", revealRoleOnDeath,
                "mafiaDoctor", mafiaDoctor, "superCitizen", superCitizen, "negotiator", negotiator, "bodyguard", bodyguard, "witch", witch, "mayor", mayor);
    }
    public static Settings fromMap(Map<String, Object> m) { return validate(m).settings; }

    public static final class Result {
        public final boolean ok; public final List<String> errors; public final Settings settings;
        Result(List<String> e, Settings s) { errors = e; ok = e.isEmpty(); settings = s; }
    }

    private static int i(Map<String, Object> m, String k, int d) {
        if (!m.containsKey(k)) return d;
        Object v = m.get(k);
        if (v == null) return 0; // مثل +null في JS
        Double n = Json.num(v);
        return n == null || n.isNaN() || n.isInfinite() ? d : (int) (n > 0 ? Math.floor(n) : Math.ceil(n));
    }
    private static boolean b(Map<String, Object> m, String k, boolean d) {
        if (!m.containsKey(k)) return d;
        Object v = m.get(k);
        return v instanceof Boolean ? (Boolean) v : Json.truthy(v);
    }

    public static Result validate(Map<String, Object> m) {
        Settings s = new Settings();
        s.players = i(m, "players", 8); s.mafia = i(m, "mafia", 2);
        s.doctor = b(m, "doctor", true); s.detective = b(m, "detective", true); s.sniper = b(m, "sniper", true);
        s.talkSeconds = i(m, "talkSeconds", 120); s.voteSeconds = i(m, "voteSeconds", 60); s.nightSeconds = i(m, "nightSeconds", 45);
        s.rounds = i(m, "rounds", 1);
        s.visibility = "public".equals(m.get("visibility")) ? "public" : "private";
        s.narratorMute = b(m, "narratorMute", true); s.muteDead = b(m, "muteDead", true);
        s.muteNight = b(m, "muteNight", true); s.revealRoleOnDeath = b(m, "revealRoleOnDeath", true);
        s.mafiaDoctor = b(m, "mafiaDoctor", false); s.superCitizen = b(m, "superCitizen", false); s.negotiator = b(m, "negotiator", false);
        s.bodyguard = b(m, "bodyguard", false); s.witch = b(m, "witch", false); s.mayor = b(m, "mayor", false);
        List<String> e = new ArrayList<>();
        if (s.players < MIN_PLAYERS || s.players > MAX_PLAYERS) e.add("players_range");
        if (s.mafia < 1) e.add("mafia_min");
        if (s.mafiaTeam() * 2 >= s.players) e.add("mafia_too_many");
        int specials = s.specials();
        if (specials > s.players) e.add("roles_exceed_players");
        if (s.talkSeconds < 15 || s.talkSeconds > 600) e.add("talk_range");
        if (s.voteSeconds < 10 || s.voteSeconds > 300) e.add("vote_range");
        if (s.nightSeconds < 10 || s.nightSeconds > 300) e.add("night_range");
        if (s.rounds < 1 || s.rounds > MAX_ROUNDS) e.add("rounds_range");
        return new Result(e, s);
    }

    /** فريق المافيا عند البدء (المفاوض يبدأ مع المدينة) */
    public int mafiaTeam() { return mafia + (mafiaDoctor ? 1 : 0); }
    public int specials() {
        return mafia + (doctor ? 1 : 0) + (detective ? 1 : 0) + (sniper ? 1 : 0) + (mafiaDoctor ? 1 : 0) + (superCitizen ? 1 : 0)
                + (negotiator ? 1 : 0) + (bodyguard ? 1 : 0) + (witch ? 1 : 0) + (mayor ? 1 : 0);
    }

    public static int maxMafia(int players) { return Math.max(1, (players - 1) / 2); }
    public static int suggestMafia(int players) { return Math.min(maxMafia(players), Math.max(1, (int) Math.round(players / 4.0))); }

    public List<String> roleList(int count) {
        List<String> l = new ArrayList<>();
        for (int k = 0; k < mafia; k++) l.add("mafia");
        if (doctor) l.add("doctor");
        if (detective) l.add("detective");
        if (sniper) l.add("sniper");
        if (mafiaDoctor) l.add("mafia_doctor");
        if (superCitizen) l.add("super_citizen");
        if (negotiator) l.add("negotiator");
        if (bodyguard) l.add("bodyguard");
        if (witch) l.add("witch");
        if (mayor) l.add("mayor");
        if (l.size() > count) throw new GameError("roles_exceed_players");
        while (l.size() < count) l.add("citizen");
        return l;
    }

    public static <T> List<T> shuffle(List<T> in, Random rng) {
        List<T> a = new ArrayList<>(in);
        for (int k = a.size() - 1; k > 0; k--) { int j = rng.nextInt(k + 1); T t = a.get(k); a.set(k, a.get(j)); a.set(j, t); }
        return a;
    }

    /** الفريق الأصلي للدور (المفاوض يبدأ مع المدينة وقد يتحول) */
    public static String team(String role) { return "mafia".equals(role) || "mafia_doctor".equals(role) ? "mafia" : "town"; }
}
