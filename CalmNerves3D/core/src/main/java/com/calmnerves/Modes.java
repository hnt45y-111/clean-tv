package com.calmnerves;

import java.util.Calendar;
import java.util.function.Consumer;

/** Game-mode orchestration: campaign (tutorial + 500 levels), daily, endless Steel Nerves, practice, local duel. */
public class Modes {
    static final String[] TUT = {"dontpress", "riddle", "memory", "gauge", null};
    public static String today() { Calendar c = Calendar.getInstance(); return c.get(Calendar.YEAR) + "-" + (c.get(Calendar.MONTH) + 1) + "-" + c.get(Calendar.DAY_OF_MONTH); }
    static int hash(String s) { int h = (int) 2166136261L; for (int i = 0; i < s.length(); i++) { h ^= s.charAt(i); h *= 16777619; } return h & 0x7fffffff; }
    static float mult(int streak) { return 1 + Math.min(streak, 10) * .1f; }
    static int score(Result r, int streak) { return Math.round((100 + r.left * 10) * mult(streak)); }

    public static void campaign(CalmGame g, int level) {
        boolean tut = !g.s.tutorialDone && level <= 5, boss = level % 10 == 0 || (tut && level == 5); GameScr.Opts o = new GameScr.Opts(); o.level = level; o.seed = hash("lvl" + level); o.boss = boss;
        if (tut) { o.type = TUT[level - 1]; o.tutorial = I18n.arr("tutorial")[level - 1]; }
        g.go(new GameScr(g, o, r -> {
            if (r.quit) { g.go(new MapScr(g)); return; }
            if (r.win) {
                int sc = afterWin(g, r, level, true); final boolean t = tut;
                Runnable next = t && level == 5 ? () -> g.go(new DiffScr(g)) : boss && !t ? () -> g.go(new StoryScr(g, level / 10)) : () -> campaign(g, level + 1);
                g.go(new ResultScr(g, true, level, o.seed, sc, mult(g.s.streak), next));
            } else { g.s.streak = 0; g.s.save(); g.go(new ResultScr(g, false, level, o.seed, 0, 1, () -> campaign(g, level))); }
        }));
    }
    static int afterWin(CalmGame g, Result r, int level, boolean campaign) {
        Store s = g.s; s.streak++; s.maxStreak = Math.max(s.maxStreak, s.streak); s.wins++; if (r.secs < 4) s.fast++; if (r.boss) s.bosses++;
        int sc = score(r, s.streak); s.best = Math.max(s.best, sc); s.stars += 5 + (r.boss ? 25 : 0) + Math.min(10, s.streak);
        if (campaign && level == s.level && level < 500) s.level++; if (s.streak >= 3) g.snd.play("combo"); checkAch(g); s.save(); return sc;
    }
    static void checkAch(CalmGame g) {
        Store s = g.s; boolean[] c = {s.wins >= 1, s.level > 10, s.level > 50, s.maxStreak >= 5, s.maxStreak >= 10, s.bosses >= 1, s.stars >= 100, s.stars >= 500, !s.lastDaily.isEmpty(), s.steelBest > 0};
        for (int i = 0; i < c.length; i++) if (c[i] && (s.achBits >> i & 1) == 0) { s.achBits |= 1 << i; g.toasts.add("🏅 " + I18n.sub("achNames", AchScr.KEYS[i])); }
    }
    /** n seeded challenges in a row (friend link / daily / duel). done gets {wins, score} or null when the player quit. */
    static void runSet(CalmGame g, long seed, int n, int level, String title, Consumer<int[]> done) { step(g, seed, n, level, title, 0, 0, 0, done); }
    static void step(CalmGame g, long seed, int n, int level, String title, int i, int wins, int score, Consumer<int[]> done) {
        if (i >= n) { done.accept(new int[]{wins, score}); return; } GameScr.Opts o = new GameScr.Opts(); o.level = level; o.seed = seed + i * 7919L; o.title = title + " " + (i + 1) + "/" + n; o.noPU = true;
        g.go(new GameScr(g, o, r -> { if (r.quit) { done.accept(null); return; } int w = wins, sc = score; if (r.win) { w++; sc += score(r, w); } step(g, seed, n, level, title, i + 1, w, sc, done); }));
    }
    public static void dailyRun(CalmGame g) {
        long d = hash(today());
        runSet(g, d, 3, Math.max(5, g.s.level), I18n.t("daily"), res -> {
            if (res == null) { g.go(new DailyScr(g)); return; } boolean ok = res[0] == 3; if (ok) { g.s.stars += 40; g.s.lastDaily = today(); checkAch(g); g.s.save(); }
            g.go(new ResultScr(g, ok, g.s.level, d, res[1], 1, () -> g.go(new DailyScr(g))));
        });
    }
    public static void start(CalmGame g, String id) {
        switch (id) {
            case "daily": g.go(new DailyScr(g)); break;
            case "practice": practice(g); break;
            case "steel": steel(g, 0, 0); break;
            case "duel": duel(g); break;
        }
    }
    static void practice(CalmGame g) { GameScr.Opts o = new GameScr.Opts(); o.level = Math.max(1, g.s.level); o.seed = (long) (Math.random() * 1e9); o.practice = true; o.noPU = true; o.title = I18n.t("practice"); g.go(new GameScr(g, o, r -> { if (r.quit) g.go(new MenuScr(g)); else practice(g); })); }
    static void steel(CalmGame g, int wins, int score) {
        GameScr.Opts o = new GameScr.Opts(); o.level = Math.max(10, g.s.level) + wins; o.seed = (long) (Math.random() * 1e9); o.shrink = wins / 3; o.title = I18n.t("endless") + " · " + wins;
        g.go(new GameScr(g, o, r -> {
            if (r.quit) { g.go(new MenuScr(g)); return; }
            if (r.win) { steel(g, wins + 1, score + score(r, wins + 1)); return; }
            String wk = Calendar.getInstance().get(Calendar.YEAR) + "-" + Calendar.getInstance().get(Calendar.WEEK_OF_YEAR); if (!wk.equals(g.s.weeklyKey)) { g.s.weeklyKey = wk; g.s.weekly = new int[5]; }
            int[] w = g.s.weekly; int[] all = java.util.Arrays.copyOf(w, 6); all[5] = score; java.util.Arrays.sort(all); for (int i = 0; i < 5; i++) w[i] = all[5 - i]; g.s.steelBest = Math.max(g.s.steelBest, Math.max(1, score)); checkAch(g); g.s.save();
            g.toasts.add(I18n.t("weekly") + ": " + w[0] + " · " + w[1] + " · " + w[2]);
            g.go(new ResultScr(g, wins >= 3, wins, 0, score, 1, () -> steel(g, 0, 0)));
        }));
    }
    static void duel(CalmGame g) {
        long seed = (long) (Math.random() * 1e9); int lv = Math.max(5, g.s.level);
        runSet(g, seed, 3, lv, I18n.t("player") + " 1", a -> { if (a == null) { g.go(new MenuScr(g)); return; }
            runSet(g, seed, 3, lv, I18n.t("player") + " 2", b -> { if (b == null) { g.go(new MenuScr(g)); return; }
                g.toasts.add((a[1] == b[1] ? I18n.t("draw") : I18n.t("winner") + ": " + I18n.t("player") + " " + (a[1] > b[1] ? 1 : 2)) + "  (" + a[1] + " - " + b[1] + ")");
                g.go(new ResultScr(g, true, 0, seed, Math.max(a[1], b[1]), 1, () -> g.go(new MenuScr(g)))); }); });
    }
}
