package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;

public class MenuScr extends Scr {
    public MenuScr(CalmGame g) { super(g); }
    @Override protected void onBack() { com.badlogic.gdx.Gdx.app.exit(); }
    @Override protected void build() {
        g.snd.musicStop();
        Image logo = put(img("logo", 500), W / 2, 140); logo.setScale(.5f); logo.setY(logo.getY() + 600); logo.addAction(Actions.parallel(Actions.scaleTo(1, 1, .9f, Interpolation.swingOut), Actions.moveBy(0, -600, .9f, Interpolation.swingOut)));
        logo.addAction(Actions.delay(1, Actions.forever(Actions.sequence(Actions.scaleTo(1.03f, 1.03f, 1.1f, Interpolation.sine), Actions.scaleTo(1, 1, 1.1f, Interpolation.sine)))));
        hero(g.a.hue("char_calm", hueFor(g.s.avatar)), W / 2, 650, 380);
        Group start = btn("btn_start", 640, I18n.t("start"), 96, 104, () -> g.go(new MapScr(g))); put(start, W / 2, 985); pop(start, .5f);
        start.addAction(Actions.delay(1.2f, Actions.forever(Actions.sequence(Actions.scaleTo(1.04f, 1.04f, .8f, Interpolation.sine), Actions.scaleTo(1, 1, .8f, Interpolation.sine)))));
        Group gear = round("round_gear", 120, () -> g.go(new SettingsScr(g))); gear.setPosition(W - 26 - 120, H - 26 - 120); ui.addActor(gear);
        Group tr = round("round_trophy", 120, () -> g.go(new AchScr(g))); tr.setPosition(W - 26 - 250, H - 26 - 120); ui.addActor(tr);
        String[][] modes = {{"ic_gift", "daily", "daily"}, {"ic_crown", "tournament", "tournament"}, {"ic_star", "arena", "arena"}, {"flame", "endless", "steel"}, {"em_sun1", "practice", "practice"}, {"ic_ball", "duel", "duel"}};
        for (int i = 0; i < 6; i++) { final String id = modes[i][2]; Group m = modeTile(modes[i][0], I18n.t(modes[i][1]), () -> Modes.start(g, id)); put(m, 165 + (i % 3) * 285, 1300 + (i / 3) * 215); pop(m, .9f + i * .06f); }
        Group join = chip(I18n.t("joinCode"), false, 820, () -> Modes.start(g, "join")); put(join, W / 2, 1745);
        Group prof = new Group(); Image chipBg = new Image(Gfx.panel(300, 84, 42, 0x140a3acc, 0xff8a5cff, 3)); chipBg.setSize(300, 84); prof.setSize(300, 84); prof.addActor(chipBg);
        Image av = new Image(g.a.hue("char_calm", hueFor(g.s.avatar))); av.setSize(70, 54); av.setPosition(12, 14); prof.addActor(av);
        Image nm = txt(g.s.name, 40, Color.WHITE, 5, 190); nm.setPosition(100, 42 - nm.getHeight() / 2); prof.addActor(nm); press(prof, () -> g.go(new ProfileScr(g)));
        put(prof, 40 + 150, 28);
        Image mv = txt(I18n.t("moves") + " " + g.s.moves + "   ★ " + g.s.stars, 34, Color.GOLD, 4, 700); put(mv, W / 2, 1860);
    }
    static int seasonIdx() { return new int[]{3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3}[java.util.Calendar.getInstance().get(java.util.Calendar.MONTH)]; }
    static float hueFor(int av) { return new float[]{0, 85, 175, 235, 305, 40, -18, 130}[av]; }
    Group modeTile(String icon, String label, Runnable r) {
        Group t = new Group(); t.setSize(270, 200); Image bg = new Image(Gfx.panel(270, 200, 28, 0x140a46dd, 0x6a4cd8ff, 3)); bg.setSize(270, 200); t.addActor(bg);
        Image ic = img(icon, 100); ic.setPosition(85, 85); t.addActor(ic); Image l = txt(label, 29, Color.WHITE, 3, 250); l.setPosition(135 - l.getWidth() / 2, 20); t.addActor(l); press(t, r); return t;
    }
}
