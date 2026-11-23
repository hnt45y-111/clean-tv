package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.ScrollPane;

/** Profile: name, avatar + hats, achievements, plus: title progress, stats, favourite challenge & win rate, tournament trophies, player ID / share. */
public class ProfileScr extends Scr {
    public static final int[] AV_UNLOCK = {1, 1, 5, 10, 20, 35, 50, 80}, HAT_UNLOCK = {0, 1, 8, 15, 30, 60, 100, 150};
    public static final String[] HATS = {"", "👑", "🎩", "🧢", "🎓", "⛑", "🪖", "🎀"};
    Group c = new Group(); float y; static final float CH = 2900;
    public ProfileScr(CalmGame g) { super(g); }
    float Y(float top) { return CH - top; }
    <T extends com.badlogic.gdx.scenes.scene2d.Actor> T at(T a, float cx, float top) { a.setPosition(cx - a.getWidth() / 2, CH - top - a.getHeight()); c.addActor(a); return a; }
    @Override protected void build() {
        back(); banner(I18n.t("profileTitle"), true, W / 2, 70); c.setSize(W, CH);
        Image av = new Image(g.a.hue("char_calm", MenuScr.hueFor(g.s.avatar))); av.setSize(360, 275); at(av, W / 2, 10);
        if (g.s.hat > 0) at(txt(HATS[g.s.hat], 90), W / 2, 0);
        Group nameBox = new Group(); nameBox.setSize(560, 96); nameBox.addActor(panelImg(560, 96, 28, 0x10083aff, 0x6a4cd8ff, 4));
        Image nm = txt(g.s.name, 48, Color.WHITE, 5, 500); nm.setPosition(280 - nm.getWidth() / 2, 48 - nm.getHeight() / 2); nameBox.addActor(nm);
        press(nameBox, () -> Gdx.input.getTextInput(new Input.TextInputListener() { public void input(String t) { Gdx.app.postRunnable(() -> { if (!t.trim().isEmpty()) { g.s.name = t.trim(); g.s.save(); } g.go(new ProfileScr(g)); }); } public void canceled() { } }, I18n.t("name"), g.s.name, ""));
        at(nameBox, W / 2, 310);
        // title progress
        int lv = g.s.level, ti = Math.min(6, (lv - 1) / 15); String title = I18n.arr("titles")[ti];
        at(txt(title, 56, Color.GOLD, 7, 780), W / 2, 450);
        float frac = ti >= 6 ? 1 : ((lv - 1) % 15) / 15f; Image bar = panelImg(700, 40, 20, 0x10083aff, 0x6a4cd8ff, 4); at(bar, W / 2, 540);
        Image fill = new Image(Gfx.panel(Math.max(40, 690 * frac), 30, 15, 0x5ed21aff, 0xb8ff5aff, 3)); fill.setSize(Math.max(40, 690 * frac), 30); fill.setPosition(W / 2 - 345, bar.getY() + 5); c.addActor(fill);
        if (ti < 6) at(txt(I18n.t("nextTitle", "n", (ti + 1) * 15 + 1), 30, new Color(1, 1, 1, .8f), 3, 780), W / 2, 590);
        // avatar + hats
        at(txt(I18n.t("avatar"), 44, Color.GOLD, 5, 600), W / 2, 670);
        for (int i = 0; i < 8; i++) {
            final int k = i; boolean ok = lv >= AV_UNLOCK[i]; Group cell = new Group(); cell.setSize(178, 150); cell.addActor(panelImg(178, 150, 24, 0x241670ff, g.s.avatar == i ? 0x8cf12aff : 0x4a3aa8ff, g.s.avatar == i ? 6 : 3));
            if (ok) { Image a = new Image(g.a.hue("char_calm", MenuScr.hueFor(i))); a.setSize(146, 112); a.setPosition(16, 22); cell.addActor(a); } else { Image l = txt("🔒", 54); l.setPosition(89 - l.getWidth() / 2, 70); cell.addActor(l); Image u = txt(I18n.t("unlock", "n", AV_UNLOCK[i]), 20, Color.WHITE, 3, 160); u.setPosition(89 - u.getWidth() / 2, 12); cell.addActor(u); }
            press(cell, () -> { if (ok) { g.s.avatar = k; g.s.save(); g.go(new ProfileScr(g)); } }); at(cell, 130 + (i % 4) * 213, 730 + (i / 4) * 165);
        }
        for (int i = 0; i < 8; i++) {
            final int k = i; boolean ok = lv >= HAT_UNLOCK[i]; Group cell = new Group(); cell.setSize(178, 100); cell.addActor(panelImg(178, 100, 24, 0x241670ff, g.s.hat == i ? 0x8cf12aff : 0x4a3aa8ff, g.s.hat == i ? 6 : 3));
            Image l = txt(ok ? (HATS[i].isEmpty() ? "-" : HATS[i]) : "🔒 " + HAT_UNLOCK[i], 46); l.setPosition(89 - l.getWidth() / 2, 50 - l.getHeight() / 2); cell.addActor(l);
            press(cell, () -> { if (ok) { g.s.hat = k; g.s.save(); g.go(new ProfileScr(g)); } }); at(cell, 130 + (i % 4) * 213, 1070 + (i / 4) * 120);
        }
        // stats
        at(txt(I18n.t("myStats"), 48, Color.GOLD, 6, 700), W / 2, 1340);
        String[][] st = {{I18n.t("level"), "" + lv}, {I18n.t("best"), "" + g.s.best}, {I18n.t("sWins"), "" + g.s.wins}, {I18n.t("sStreak"), "" + g.s.maxStreak}, {I18n.t("sFast"), g.s.fastest >= 999 ? "-" : "" + g.s.fastest}, {I18n.t("sBosses"), "" + g.s.bosses}, {I18n.t("sStars"), "" + g.s.stars}, {I18n.t("moves"), "" + g.s.moves}};
        for (int i = 0; i < 8; i++) { Group cell = new Group(); cell.setSize(190, 140); cell.addActor(panelImg(190, 140, 24, 0x1c1260f0, 0x4a3aa8ff, 3)); Image v = txt(st[i][1], 52, Color.GOLD, 6, 170); v.setPosition(95 - v.getWidth() / 2, 66); cell.addActor(v); Image l = txt(st[i][0], 27, Color.WHITE, 3, 175); l.setPosition(95 - l.getWidth() / 2, 18); cell.addActor(l); at(cell, 130 + (i % 4) * 213, 1400 + (i / 4) * 155); }
        // favourite challenge + win rate
        int fav = -1, best = 0; for (int i = 0; i < 12; i++) if (g.s.typePlays[i] > best) { best = g.s.typePlays[i]; fav = i; }
        String[] ids = Challenges.IDS; String favName = fav < 0 ? "-" : I18n.t("ctype_" + (fav < ids.length ? ids[fav] : "boss")); int rate = fav < 0 ? 0 : Math.round(100f * g.s.typeWins[fav] / g.s.typePlays[fav]); int tot = 0, tw = 0; for (int i = 0; i < 12; i++) { tot += g.s.typePlays[i]; tw += g.s.typeWins[i]; }
        Group fc = new Group(); fc.setSize(820, 150); fc.addActor(panelImg(820, 150, 28, 0x1c1260f0, 0x4a3aa8ff, 3)); Image f1 = txt(I18n.t("favType") + ": " + favName, 42, Color.WHITE, 5, 780); f1.setPosition(410 - f1.getWidth() / 2, 85); fc.addActor(f1);
        Image f2 = txt(I18n.t("winRate") + ": " + rate + "%   (" + (tot == 0 ? 0 : Math.round(100f * tw / tot)) + "% )", 36, Color.GOLD, 4, 780); f2.setPosition(410 - f2.getWidth() / 2, 25); fc.addActor(f2); at(fc, W / 2, 1730);
        // tournament trophies
        Group tc = new Group(); tc.setSize(820, 130); tc.addActor(panelImg(820, 130, 28, 0x1c1260f0, 0xffc21aff, 4)); Image t1 = txt(I18n.t("trophies") + ": " + g.s.tourTrophies, 46, Color.GOLD, 5, 780); t1.setPosition(410 - t1.getWidth() / 2, 45); tc.addActor(t1); at(tc, W / 2, 1900);
        // player ID + share
        at(txt(I18n.t("playerId") + ": " + g.s.pid, 46, Color.WHITE, 5, 780), W / 2, 2070);
        String msg = g.s.name + " · ID " + g.s.pid + " · " + I18n.t("level") + " " + lv + " · " + title + " · ★" + g.s.best;
        at(btn("btn_share", 640, I18n.t("shareProfile"), 54, 80, () -> g.plat.share(msg)), W / 2, 2160);
        // achievements
        at(txt(I18n.t("ach"), 48, Color.GOLD, 6, 700), W / 2, 2370);
        for (int i = 0; i < AchScr.KEYS.length; i++) {
            boolean on = (g.s.achBits >> i & 1) == 1; Group b = new Group(); b.setSize(190, 160); b.addActor(panelImg(190, 160, 24, on ? 0x2a1a7aff : 0x1a1050aa, on ? 0xffc21aff : 0x4a3aa8ff, 4));
            Image ic = img(on ? "ic_crown" : "pu_second", 80); ic.setPosition(55, 70); if (!on) ic.setColor(1, 1, 1, .35f); b.addActor(ic); Image n = txt(I18n.sub("achNames", AchScr.KEYS[i]), 24, Color.WHITE, 3, 175); n.setPosition(95 - n.getWidth() / 2, 18); b.addActor(n); at(b, 130 + (i % 4) * 213, 2430 + (i / 4) * 170);
        }
        ScrollPane sp = new ScrollPane(c); sp.setScrollingDisabled(true, false); sp.setOverscroll(false, true); sp.setSize(W, H - 340); sp.setPosition(0, 0); ui.addActor(sp); back().toFront();
    }
}
