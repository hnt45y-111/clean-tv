package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.ui.Image;

public class SettingsScr extends Scr {
    public SettingsScr(CalmGame g) { super(g); }
    @Override protected void build() {
        back(); banner(I18n.t("settings"), true, W / 2, 70);
        Image panel = panelImg(840, 1520, 50, 0x0e083cdd, 0x6a4cd8ff, 5); put(panel, W / 2, 330);
        float y = 370; Image h1 = txt(I18n.t("language"), 46, Color.GOLD, 5, 700); put(h1, W / 2, y); y += 80;
        for (int i = 0; i < 5; i++) { final String l = I18n.LANGS[i]; Group c = chip(I18n.LANG_NAMES[i], l.equals(I18n.lang), 250, () -> { g.setLang(l); g.go(new SettingsScr(g)); }); put(c, 140 + (i % 3) * 310 + 0, y + (i / 3) * 100); }
        y += 220; put(txt(I18n.t("settingsHint"), 30, new Color(1, 1, 1, .6f), 3, 760), W / 2, y); y += 70;
        String[] keys = {"sound", "music", "vibration"};
        for (int i = 0; i < 3; i++) { final int k = i; Image l = txt(I18n.t(keys[i]), 46, Color.WHITE, 5, 420); put(l, 200, y + 14); Group t = toggle(k == 0 ? g.s.sound : k == 1 ? g.s.music : g.s.vib, v -> { if (k == 0) g.s.sound = v; else if (k == 1) g.s.music = v; else g.s.vib = v; g.s.save(); g.snd.vib(40); }); put(t, 700, y); y += 120; }
        y += 20; put(txt(I18n.t("difficulty"), 46, Color.GOLD, 5, 700), W / 2, y); y += 80; String[] d = {"easy", "normal", "hard", "insane"};
        for (int i = 0; i < 4; i++) { final String k = d[i]; Group c = chip(I18n.t(k), k.equals(g.s.diff), 190, () -> { g.s.diff = k; g.s.save(); g.go(new SettingsScr(g)); }); put(c, 130 + i * 213, y); }
    }
}
