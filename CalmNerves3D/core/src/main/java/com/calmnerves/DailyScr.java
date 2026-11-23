package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.utils.Align;

public class DailyScr extends Scr {
    static final int[] PRIZE = {5, 10, 15, 25, 5, 50, 10, 20};
    public DailyScr(CalmGame g) { super(g); }
    @Override protected void build() {
        back(); banner(I18n.t("daily"), true, W / 2, 70); String today = Modes.today();
        put(panelImg(800, 520, 44, 0x241670ff, 0x6a4cd8ff, 5), W / 2, 330);
        put(img("ic_gift", 200), W / 2, 360); put(txt(I18n.t("chest"), 48, Color.GOLD, 5, 700), W / 2, 590);
        if (today.equals(g.s.lastDaily)) put(txt(I18n.t("come"), 40), W / 2, 700); else { Group b = btn("btn_green", 420, I18n.t("play"), 64, 0, () -> Modes.dailyRun(g)); b.setHeight(b.getHeight()); put(b, W / 2, 680); }
        put(panelImg(800, 920, 44, 0x241670ff, 0x6a4cd8ff, 5), W / 2, 880);
        put(txt(I18n.t("wheel"), 48, Color.GOLD, 5, 700), W / 2, 910);
        Group wheel = new Group(); wheel.setSize(520, 520); wheel.setOrigin(Align.center); wheel.setTransform(true);
        Pixmap p = new Pixmap(512, 512, Pixmap.Format.RGBA8888); int[] cols = {0xff3b6bff, 0xffd21fff, 0x34d52aff, 0x2a9bffff, 0xa63cffff, 0xff8a14ff, 0xff3b6bff, 0x46e6c8ff};
        for (int i = 0; i < 8; i++) { p.setColor(cols[i]); double a0 = Math.PI / 2 - i * Math.PI / 4, a1 = a0 - Math.PI / 4; for (int k = 0; k < 60; k++) { double a = a0 + (a1 - a0) * k / 59.0, b = a0 + (a1 - a0) * (k + 1) / 59.0; p.fillTriangle(256, 256, 256 + (int) (250 * Math.cos(a)), 256 - (int) (250 * Math.sin(a)), 256 + (int) (250 * Math.cos(b)), 256 - (int) (250 * Math.sin(b))); } }
        p.setColor(0x1a0a3aff); for (int r = 250; r < 256; r++) p.drawCircle(256, 256, r); Texture wt = new Texture(p, true); wt.setFilter(Texture.TextureFilter.MipMapLinearLinear, Texture.TextureFilter.Linear); p.dispose();
        Image wi = new Image(wt); wi.setSize(520, 520); wheel.addActor(wi);
        for (int i = 0; i < 8; i++) { double a = Math.PI / 2 - (i + .5) * Math.PI / 4; Image n = txt("" + PRIZE[i], 48, Color.WHITE, 6, 120); n.setPosition(260 + (float) (180 * Math.cos(a)) - n.getWidth() / 2, 260 + (float) (180 * Math.sin(a)) - n.getHeight() / 2); wheel.addActor(n); }
        put(wheel, W / 2, 1060); Image ptr = new Image(Gfx.white()); ptr.setSize(46, 46); ptr.setOrigin(com.badlogic.gdx.utils.Align.center); ptr.setRotation(45); ptr.setColor(1, .2f, .2f, 1); put(ptr, W / 2, 1045);
        if (today.equals(g.s.lastWheel)) put(txt(I18n.t("come"), 40), W / 2, 1650); else {
            Group[] sb = new Group[1]; sb[0] = btn("btn_orange", 420, I18n.t("spin"), 64, 0, () -> {
                sb[0].setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.disabled); int k = (int) (Math.random() * 8); g.s.lastWheel = today; g.snd.play("combo");
                wheel.addAction(Actions.sequence(Actions.rotateBy(1440 + k * 45 + 22.5f, 3.2f, Interpolation.pow3Out), Actions.run(() -> { g.s.stars += PRIZE[k]; g.s.save(); g.snd.play("win"); Fx.confetti(this, 60); toast("+" + PRIZE[k] + " ★"); }), Actions.delay(1.6f), Actions.run(() -> g.go(new DailyScr(g)))));
            }); sb[0].setHeight(sb[0].getHeight()); put(sb[0], W / 2, 1640);
        }
    }
}
