package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Preferences;
import com.badlogic.gdx.utils.IntArray;

/** Local save: progress, language, profile, seen questions. */
public class Store {
    private final Preferences p = Gdx.app.getPreferences("calmnerves3d");
    public String lang, diff, name, lastDaily, lastWheel, weeklyKey;
    public boolean sound, music, vib, tutorialDone;
    public int avatar, hat, level, stars, best, streak, maxStreak, wins, fast, bosses, steelBest, puFreeze, puFifty, puSecond;
    public IntArray seen = new IntArray();
    public int achBits;
    public int[] weekly = new int[5];

    public Store() {
        lang = p.getString("lang", "ar"); diff = p.getString("diff", "normal"); name = p.getString("name", "لاعب");
        lastDaily = p.getString("lastDaily", ""); lastWheel = p.getString("lastWheel", ""); weeklyKey = p.getString("weeklyKey", "");
        sound = p.getBoolean("sound", true); music = p.getBoolean("music", true); vib = p.getBoolean("vib", true); tutorialDone = p.getBoolean("tut", false);
        avatar = p.getInteger("avatar", 0); hat = p.getInteger("hat", 0); level = p.getInteger("level", 1); stars = p.getInteger("stars", 30);
        best = p.getInteger("best", 0); streak = p.getInteger("streak", 0); maxStreak = p.getInteger("maxStreak", 0); wins = p.getInteger("wins", 0);
        fast = p.getInteger("fast", 0); bosses = p.getInteger("bosses", 0); steelBest = p.getInteger("steelBest", 0);
        puFreeze = p.getInteger("puFreeze", 1); puFifty = p.getInteger("puFifty", 1); puSecond = p.getInteger("puSecond", 1);
        achBits = p.getInteger("ach", 0);
        for (String s : p.getString("seen", "").split(",")) if (!s.isEmpty()) seen.add(Integer.parseInt(s));
        String[] w = p.getString("weekly", "0,0,0,0,0").split(","); for (int i = 0; i < 5 && i < w.length; i++) weekly[i] = Integer.parseInt(w[i]);
    }

    public void save() {
        p.putString("lang", lang); p.putString("diff", diff); p.putString("name", name); p.putString("lastDaily", lastDaily); p.putString("lastWheel", lastWheel); p.putString("weeklyKey", weeklyKey);
        p.putBoolean("sound", sound); p.putBoolean("music", music); p.putBoolean("vib", vib); p.putBoolean("tut", tutorialDone);
        p.putInteger("avatar", avatar); p.putInteger("hat", hat); p.putInteger("level", level); p.putInteger("stars", stars); p.putInteger("best", best);
        p.putInteger("streak", streak); p.putInteger("maxStreak", maxStreak); p.putInteger("wins", wins); p.putInteger("fast", fast); p.putInteger("bosses", bosses);
        p.putInteger("steelBest", steelBest); p.putInteger("puFreeze", puFreeze); p.putInteger("puFifty", puFifty); p.putInteger("puSecond", puSecond); p.putInteger("ach", achBits);
        StringBuilder sb = new StringBuilder(); for (int i = 0; i < seen.size; i++) sb.append(i > 0 ? "," : "").append(seen.get(i)); p.putString("seen", sb.toString());
        StringBuilder w = new StringBuilder(); for (int i = 0; i < 5; i++) w.append(i > 0 ? "," : "").append(weekly[i]); p.putString("weekly", w.toString());
        p.flush();
    }
    public int diffIndex() { return Math.max(0, java.util.Arrays.asList("easy", "normal", "hard", "insane").indexOf(diff)); }
}
