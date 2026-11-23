package com.calmnerves;

import com.badlogic.gdx.scenes.scene2d.Group;

public class DiffScr extends Scr {
    public DiffScr(CalmGame g) { super(g); }
    @Override protected void onBack() { }
    @Override protected void build() {
        banner(I18n.t("pickDiff"), true, W / 2, 90); hero("char_calm", W / 2, 420, 520);
        String[] d = {"easy", "normal", "hard", "insane"}, a = {"btn_green", "btn_blue", "btn_orange", "btn_purple"};
        for (int i = 0; i < 4; i++) { final String k = d[i]; Group b = btn(a[i], 700, I18n.t(k), 70, 0, () -> { g.s.diff = k; g.s.tutorialDone = true; g.s.save(); g.go(new MapScr(g)); }); b.setHeight(b.getHeight()); put(b, W / 2, 940 + i * 220); pop(b, .2f * i); }
    }
}
