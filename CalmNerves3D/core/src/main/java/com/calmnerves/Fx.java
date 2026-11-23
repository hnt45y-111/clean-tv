package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.utils.Align;

/** Particle bursts, confetti, cracked screen, pop-ups: all built from Scene2D actions. */
public class Fx {
    static final int[] COLS = {0xffd21fff, 0x8cf12aff, 0xff8a14ff, 0xffffffff, 0x3aa0ffff, 0xff3b6bff, 0xa63cffff};
    public static void burst(Group host, float x, float y, int n, int[] cols) {
        if (cols == null) cols = COLS;
        for (int i = 0; i < n; i++) {
            Image p = new Image(Gfx.dot()); float s = 14 + MathUtils.random(22); p.setSize(s, s); p.setOrigin(Align.center); p.setPosition(x - s / 2, y - s / 2); p.setColor(new Color(cols[i % cols.length]));
            float a = MathUtils.random(MathUtils.PI2), d = 130 + MathUtils.random(300);
            p.addAction(Actions.sequence(Actions.parallel(Actions.moveBy(MathUtils.cos(a) * d, MathUtils.sin(a) * d + 60, .85f, Interpolation.pow2Out), Actions.scaleTo(.1f, .1f, .85f), Actions.fadeOut(.85f)), Actions.removeActor())); host.addActor(p);
        }
    }
    public static void confetti(Scr s, int n) {
        for (int i = 0; i < n; i++) {
            Image c = new Image(Gfx.white()); c.setSize(14 + MathUtils.random(8), 24 + MathUtils.random(10)); c.setOrigin(Align.center); c.setColor(new Color(COLS[i % COLS.length]));
            float x = MathUtils.random(Scr.W); c.setPosition(x, Scr.H + 40); c.setRotation(MathUtils.random(360));
            c.addAction(Actions.delay(MathUtils.random(1.6f), Actions.sequence(Actions.parallel(Actions.moveBy(MathUtils.random(-120, 120), -(Scr.H + 120), 2.2f + MathUtils.random(2f)), Actions.rotateBy(MathUtils.random(-720, 720), 3.5f)), Actions.removeActor())));
            s.ui.addActor(c);
        }
    }
    public static void cracks(Scr s) {
        Group gp = new Group(); gp.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.disabled); float cx = 450, cy = 1000; java.util.Random r = new java.util.Random(5);
        for (int k = 0; k < 9; k++) { float a = k * 40 + r.nextInt(25), x = cx, y = cy; for (int j = 0; j < 4; j++) { float len = 120 + r.nextInt(180), ang = a + r.nextInt(30) - 15; Image l = new Image(Gfx.white()); l.setSize(len, 4); l.setOrigin(0, 2); l.setPosition(x, y); l.setRotation(ang); l.setColor(1, 1, 1, .9f); gp.addActor(l); x += len * MathUtils.cosDeg(ang); y += len * MathUtils.sinDeg(ang); } }
        gp.getColor().a = 0; gp.addAction(Actions.fadeIn(.1f)); s.ui.addActor(gp);
    }
    public static void popText(Scr s, Group host, String t, boolean bad) {
        Image i = Txt.label(t, 90, bad ? new Color(0xff5a4aff) : Color.GOLD, 10, 800); i.setPosition(450 - i.getWidth() / 2, 1100); i.setOrigin(Align.center); i.setScale(.3f); i.getColor().a = 0;
        i.addAction(Actions.sequence(Actions.parallel(Actions.fadeIn(.15f), Actions.scaleTo(1.2f, 1.2f, .25f, Interpolation.swingOut)), Actions.parallel(Actions.moveBy(0, 140, 1f), Actions.fadeOut(1f)), Actions.removeActor())); host.addActor(i);
    }
    public static void shake(Actor a, float mag, float t) {
        float x = a.getX(), y = a.getY(); com.badlogic.gdx.scenes.scene2d.Action[] ac = new com.badlogic.gdx.scenes.scene2d.Action[10];
        for (int i = 0; i < 8; i++) ac[i] = Actions.moveTo(x + MathUtils.random(-mag, mag), y + MathUtils.random(-mag, mag), t / 9);
        ac[8] = Actions.moveTo(x, y, t / 9); a.addAction(Actions.sequence(java.util.Arrays.copyOf(ac, 9)));
    }
}
