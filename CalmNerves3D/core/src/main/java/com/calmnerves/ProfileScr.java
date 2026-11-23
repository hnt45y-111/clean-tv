package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.ui.Image;

public class ProfileScr extends Scr {
    public static final int[] AV_UNLOCK = {1, 1, 5, 10, 20, 35, 50, 80}, HAT_UNLOCK = {0, 1, 8, 15, 30, 60, 100, 150};
    public static final String[] HATS = {"", "👑", "🎩", "🧢", "🎓", "⛑", "🪖", "🎀"};
    public ProfileScr(CalmGame g) { super(g); }
    @Override protected void build() {
        back(); banner(I18n.t("profileTitle"), true, W / 2, 70);
        put(panelImg(840, 1180, 50, 0x0e083cdd, 0x6a4cd8ff, 5), W / 2, 690);
        hero(g.a.hue("char_calm", MenuScr.hueFor(g.s.avatar)), W / 2, 330, 340);
        Group nameBox = new Group(); nameBox.setSize(560, 96); nameBox.addActor(panelImg(560, 96, 28, 0x10083aff, 0x6a4cd8ff, 4));
        Image nm = txt(g.s.name, 48, Color.WHITE, 5, 500); nm.setPosition(280 - nm.getWidth() / 2, 48 - nm.getHeight() / 2); nameBox.addActor(nm);
        press(nameBox, () -> Gdx.input.getTextInput(new Input.TextInputListener() {
            public void input(String t) { Gdx.app.postRunnable(() -> { if (!t.trim().isEmpty()) { g.s.name = t.trim(); g.s.save(); } g.go(new ProfileScr(g)); }); }
            public void canceled() { } }, I18n.t("name"), g.s.name, ""));
        put(nameBox, W / 2, 720);
        put(txt(I18n.t("avatar"), 44, Color.GOLD, 5, 600), W / 2, 850);
        for (int i = 0; i < 8; i++) {
            final int k = i; boolean ok = g.s.level >= AV_UNLOCK[i]; Group c = new Group(); c.setSize(178, 150); c.addActor(panelImg(178, 150, 24, 0x241670ff, g.s.avatar == i ? 0x8cf12aff : 0x4a3aa8ff, g.s.avatar == i ? 6 : 3));
            if (ok) { Image av = new Image(g.a.hue("char_calm", MenuScr.hueFor(i))); av.setSize(146, 112); av.setPosition(16, 22); c.addActor(av); } else { Image l = txt("🔒", 54); l.setPosition(89 - l.getWidth() / 2, 70); c.addActor(l); Image u = txt(I18n.t("unlock", "n", AV_UNLOCK[i]), 20, Color.WHITE, 3, 160); u.setPosition(89 - u.getWidth() / 2, 12); c.addActor(u); }
            press(c, () -> { if (ok) { g.s.avatar = k; g.s.save(); g.go(new ProfileScr(g)); } }); put(c, 130 + (i % 4) * 213, 930 + (i / 4) * 170);
        }
        for (int i = 0; i < 8; i++) {
            final int k = i; boolean ok = g.s.level >= HAT_UNLOCK[i]; Group c = new Group(); c.setSize(178, 110); c.addActor(panelImg(178, 110, 24, 0x241670ff, g.s.hat == i ? 0x8cf12aff : 0x4a3aa8ff, g.s.hat == i ? 6 : 3));
            Image l = txt(ok ? (HATS[i].isEmpty() ? "-" : HATS[i]) : "🔒 " + HAT_UNLOCK[i], 46); l.setPosition(89 - l.getWidth() / 2, 55 - l.getHeight() / 2); c.addActor(l);
            press(c, () -> { if (ok) { g.s.hat = k; g.s.save(); g.go(new ProfileScr(g)); } }); put(c, 130 + (i % 4) * 213, 1290 + (i / 4) * 130);
        }
        int n = Integer.bitCount(g.s.achBits); String[][] st = {{I18n.t("level"), "" + g.s.level}, {I18n.t("best"), "" + g.s.best}, {I18n.t("ach"), n + "/10"}, {I18n.t("stage"), I18n.arr("titles")[Math.min(6, (g.s.level - 1) / 15)]}};
        for (int i = 0; i < 4; i++) { Image v = txt(st[i][1], 42, Color.GOLD, 5, 190); put(v, 130 + i * 213, 1580); Image l = txt(st[i][0], 28, Color.WHITE, 3, 190); put(l, 130 + i * 213, 1640); }
    }
}
