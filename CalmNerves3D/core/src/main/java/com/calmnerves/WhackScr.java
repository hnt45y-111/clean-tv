package com.calmnerves;

import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.utils.Align;
import java.util.Random;

/** Whack-a-nerve: faces pop out of holes; each tap costs one move; a hit pays 1 star, the golden crown pays 5. */
public class WhackScr extends BonusScr {
    final Image[] pop = new Image[9]; final boolean[] gold = new boolean[9]; final float[] life = new float[9]; float spawn = .5f; final Random rnd = new Random(); Group board;
    public WhackScr(CalmGame g) { super(g); }
    @Override protected String title() { return I18n.t("whack"); } @Override protected String desc() { return I18n.t("whackd"); }
    @Override protected void buildGame() {
        board = new Group(); board.setSize(820, 820); board.setPosition(40, H - 480 - 820); ui.addActor(board);
        for (int i = 0; i < 9; i++) { final int k = i; Group h = new Group(); h.setSize(250, 250); Image hole = new Image(Gfx.panel(230, 130, 65, 0x0a0620ff, 0x3a2a8aff, 6)); hole.setSize(230, 130); hole.setPosition(10, 20); h.addActor(hole); h.setPosition((i % 3) * 285 - 5, 590 - (i / 3) * 285); board.addActor(h); press(h, () -> hit(k)); }
    }
    @Override protected void update(float dt) {
        spawn -= dt; if (spawn <= 0 && g.s.moves > 0) { spawn = .6f + rnd.nextFloat() * .5f; int k = rnd.nextInt(9); if (pop[k] == null) show(k); }
        for (int i = 0; i < 9; i++) if (pop[i] != null && (life[i] -= dt) <= 0) hide(i);
    }
    void show(int k) {
        gold[k] = rnd.nextInt(7) == 0; Image f = img(gold[k] ? "ic_crown" : rnd.nextBoolean() ? "flame" : "flame2", 170); f.setOrigin(Align.center); f.setPosition((k % 3) * 285 + 35, 590 - (k / 3) * 285 + 60); f.setScale(0); f.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.disabled);
        f.addAction(Actions.scaleTo(1, 1, .18f, Interpolation.swingOut)); board.addActor(f); pop[k] = f; life[k] = gold[k] ? .8f : 1.1f;
    }
    void hide(int k) { Image f = pop[k]; pop[k] = null; if (f != null) f.addAction(Actions.sequence(Actions.scaleTo(0, 0, .12f), Actions.removeActor())); }
    void hit(int k) {
        if (g.s.moves <= 0) { toast(I18n.t("noMoves")); return; } spend();
        if (pop[k] != null) { boolean gd = gold[k]; float x = board.getX() + (k % 3) * 285 + 120, y = board.getY() + 590 - (k / 3) * 285 + 130; hide(k); reward(gd ? 5 : 1, x, y); } else g.snd.play("wrong");
    }
}
