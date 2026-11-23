package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.utils.Align;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** A challenge type. Add a new one by subclassing and registering it in Challenges (see README). Play area is root: 828 x 640 (y up). */
public abstract class Challenge {
    protected GameScr gs; protected Group root; protected Random rnd; protected int level, d; protected Runnable onWin, onFail; protected float ownTime;
    protected final List<Actor> wrongBtns = new ArrayList<>(); protected final List<Actor> answerBtns = new ArrayList<>();
    public static final float PW = 828, PH = 640;
    public void attach(GameScr gs, Group root, Random rnd, int level, int d) { this.gs = gs; this.root = root; this.rnd = rnd; this.level = level; this.d = d; if (onWin == null) onWin = gs::win; if (onFail == null) onFail = gs::fail; }
    public abstract void build();
    public abstract float time();
    public boolean survive() { return false; }
    public void update(float dt) { }
    public void dispose() { }
    public void reverse() { for (Actor a : answerBtns) a.setY(PH - a.getY() - a.getHeight()); }
    protected void win() { onWin.run(); } protected void fail() { onFail.run(); }
    protected float timerSec(float base) { return Math.max(4, Math.round(base - d * 1.5f - Math.min(level, 100) * .03f)); }
    protected Group sbtn(String asset, float w, float h, String label, int size, Runnable r) {
        Group b = new Group(); b.setSize(w, h); Image bg = new Image(gs.g.a.tex(asset)); bg.setSize(w, h); b.addActor(bg);
        if (label != null) { Image t = Txt.label(label, size, Color.WHITE, Math.max(4, size / 9), w * .86f); t.setPosition(w / 2 - t.getWidth() / 2, h / 2 - t.getHeight() / 2 + 2); b.addActor(t); }
        gs.press(b, r); return b;
    }
    protected Image tex(String n, float w) { com.badlogic.gdx.graphics.Texture t = gs.g.a.tex(n); Image i = new Image(t); i.setSize(w, w * t.getHeight() / t.getWidth()); i.setOrigin(Align.center); return i; }
    protected Group tile(String icon, float size, boolean glow) {
        Group t = new Group(); t.setSize(size, size); Image bg = new Image(Gfx.panel(size, size, size * .16f, 0x14106aff, glow ? 0xffb52eff : 0x6a4cd8ff, 5)); bg.setSize(size, size); t.addActor(bg);
        Image ic = tex(icon, size * .74f); ic.setPosition(size * .13f, size * .13f); t.addActor(ic); t.setOrigin(Align.center); return t;
    }
    /** answers[0] is correct. Four glossy buttons that (optionally) glide and swap places. */
    protected void answers(String[] labels, boolean glide) {
        final int n = labels.length; final float gap = 22, bh = Math.min(150, (PH - (n - 1) * gap) / n); final String[] asset = {"btn_blue", "btn_green", "btn_orange", "btn_purple"};
        final int[] slot = new int[n]; List<Integer> ord = new ArrayList<>(); for (int i = 0; i < n; i++) ord.add(i); java.util.Collections.shuffle(ord, rnd); for (int i = 0; i < n; i++) slot[i] = ord.get(i);
        final Group[] btns = new Group[n]; final boolean[] done = {false};
        for (int i = 0; i < n; i++) {
            final int k = i; Group b = sbtn(asset[i % 4], 800, bh, labels[i], 58, () -> { if (done[0]) return; done[0] = true; if (k == 0) win(); else fail(); });
            b.setPosition(14, PH - (slot[i] + 1) * bh - slot[i] * gap); b.setTransform(true); root.addActor(b); btns[i] = b; answerBtns.add(b); if (i > 0) wrongBtns.add(b);
        }
        if (glide) root.addAction(Actions.forever(Actions.delay(Math.max(.8f, 1.6f - d * .25f), Actions.run(() -> {
            int a = rnd.nextInt(n), c = (a + 1 + rnd.nextInt(n - 1)) % n, t = slot[a]; slot[a] = slot[c]; slot[c] = t;
            for (int i = 0; i < n; i++) btns[i].addAction(Actions.moveTo(14, PH - (slot[i] + 1) * bh - slot[i] * gap, .7f, Interpolation.sine));
        }))));
    }
    protected int maxD() { return Math.min(3, 1 + (level + d * 8) / 25); }
}
