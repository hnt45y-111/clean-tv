package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.Group;

public class StoryScr extends Scr {
    final int world; public StoryScr(CalmGame g, int world) { super(g); this.world = world; }
    @Override protected int world() { return world; }
    @Override protected void onBack() { g.go(new MapScr(g)); }
    @Override protected void build() {
        banner(I18n.t("storyTitle") + " · " + I18n.t("worldWord") + " " + world, true, W / 2, 80);
        hero("think", W / 2, 400, 280);
        put(panelImg(780, 340, 40, 0xffffffff, 0x1a0a3aff, 5), W / 2, 960);
        put(txt(I18n.arr("story")[(world - 1) % 3], 44, new Color(0x1a0a3aff), 0, 700), W / 2, 1010);
        int ps = g.s.fast / Math.max(1, g.s.wins) > .5 ? 1 : g.s.maxStreak >= 8 ? 2 : g.s.wins > 20 ? 0 : 3; String style = I18n.arr("playstyles")[ps];
        put(txt("🏷 " + style, 50, Color.GOLD, 6, 760), W / 2, 1360);
        Group sh = btn("btn_share", 640, I18n.t("share"), 60, 90, () -> g.plat.share(style + " — " + I18n.t("title1") + " " + I18n.t("title2"))); put(sh, W / 2, 1500);
        Group c = btn("btn_green", 640, I18n.t("continue"), 64, 0, () -> g.go(new MapScr(g))); c.setHeight(c.getHeight()); put(c, W / 2, 1700);
    }
}
