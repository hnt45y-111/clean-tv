package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.utils.Align;

public class MenuScr extends Scr {
    public MenuScr(CalmGame g) { super(g); }
    @Override protected void onBack() { com.badlogic.gdx.Gdx.app.exit(); }
    @Override protected void build() {
        g.snd.musicStop();
        Image logo = put(img("logo", 800), W / 2, 40); logo.setScale(.6f); logo.setY(logo.getY() + 700); logo.addAction(Actions.parallel(Actions.scaleTo(1, 1, .9f, Interpolation.swingOut), Actions.moveBy(0, -700, .9f, Interpolation.swingOut)));
        logo.addAction(Actions.delay(1, Actions.forever(Actions.sequence(Actions.scaleTo(1.03f, 1.03f, 1.1f, Interpolation.sine), Actions.scaleTo(1, 1, 1.1f, Interpolation.sine)))));
        hero(g.a.hue("char_calm", hueFor(g.s.avatar)), W / 2, 640, 640);
        Group start = btn("btn_start", 720, I18n.t("start"), 104, 118, () -> g.go(new MapScr(g))); put(start, W / 2, 1180); pop(start, .5f);
        start.addAction(Actions.delay(1.2f, Actions.forever(Actions.sequence(Actions.scaleTo(1.04f, 1.04f, .8f, Interpolation.sine), Actions.scaleTo(1, 1, .8f, Interpolation.sine)))));
        Group gear = roundLabel("round_gear", 190, I18n.t("settings"), () -> g.go(new SettingsScr(g))); put(gear, W / 2 - 150, 1440); pop(gear, .7f);
        Group tr = roundLabel("round_trophy", 190, I18n.t("achievements"), () -> g.go(new AchScr(g))); put(tr, W / 2 + 150, 1440); pop(tr, .8f);
        String[][] modes = {{"ic_gift", "daily", "daily"}, {"ic_crown", "endless", "steel"}, {"em_sun1", "practice", "practice"}, {"ic_ball", "duel", "duel"}};
        for (int i = 0; i < 4; i++) { final String id = modes[i][2]; Group m = modeTile(modes[i][0], I18n.t(modes[i][1]), () -> Modes.start(g, id)); put(m, 125 + i * 217, 1640); pop(m, .9f + i * .08f); }
        Group prof = new Group(); Image chip = new Image(Gfx.panel(300, 84, 42, 0x140a3acc, 0xff8a5cff, 3)); chip.setSize(300, 84); prof.setSize(300, 84); prof.addActor(chip);
        Image av = new Image(g.a.hue("char_calm", hueFor(g.s.avatar))); av.setSize(70, 54); av.setPosition(12, 14); prof.addActor(av);
        Image nm = txt(g.s.name, 40, Color.WHITE, 5, 190); nm.setPosition(100, 42 - nm.getHeight() / 2); prof.addActor(nm); press(prof, () -> g.go(new ProfileScr(g)));
        put(prof, 40 + 150, 28);
        Image season = txt(I18n.t("season", "s", I18n.arr("seasons")[seasonIdx()]), 30, new Color(1, 1, 1, .7f), 3, 800); put(season, W / 2, 1865);
    }
    static int seasonIdx() { return new int[]{3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3}[java.util.Calendar.getInstance().get(java.util.Calendar.MONTH)]; }
    static float hueFor(int av) { return new float[]{0, 85, 175, 235, 305, 0, -18, 130}[av]; }
    Group roundLabel(String asset, float w, String label, Runnable r) {
        Group b = round(asset, w, r); Image t = txt(label, 30, Color.WHITE, 4, w * .8f); t.setPosition(w / 2 - t.getWidth() / 2, w * .07f); b.addActor(t); return b;
    }
    Group modeTile(String icon, String label, Runnable r) {
        Group t = new Group(); t.setSize(200, 200); Image bg = new Image(Gfx.panel(200, 200, 26, 0x140a46dd, 0x6a4cd8ff, 3)); bg.setSize(200, 200); t.addActor(bg);
        Image ic = img(icon, 100); ic.setPosition(50, 90); t.addActor(ic); Image l = txt(label, 27, Color.WHITE, 3, 180); l.setPosition(100 - l.getWidth() / 2, 18); t.addActor(l); press(t, r); return t;
    }
}
