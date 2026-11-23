package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import java.util.*;

/** Colour memory: watch the sequence, repeat it. Each round costs one move; finishing it pays stars equal to 2 x length. */
public class SimonScr extends BonusScr {
    static final int[] COL = {0x34d52aff, 0x2a7bffff, 0xff8a14ff, 0xa63cffff};
    final List<Integer> seq = new ArrayList<>(); final Random rnd = new Random(); Group[] pad = new Group[4]; int pos; boolean input; Group board; Group startBtn;
    public SimonScr(CalmGame g) { super(g); }
    @Override protected String title() { return I18n.t("simon"); } @Override protected String desc() { return I18n.t("simond"); }
    @Override protected void buildGame() {
        board = new Group(); board.setSize(820, 820); board.setPosition(40, H - 520 - 820); ui.addActor(board);
        for (int i = 0; i < 4; i++) { final int k = i; Group p = new Group(); p.setSize(390, 390); p.addActor(panelImg(390, 390, 60, COL[i], 0x1a0a3aff, 8)); p.getColor().a = .55f; p.setPosition((i % 2) * 430, 430 - (i / 2) * 430); board.addActor(p); pad[i] = p; press(p, () -> tap(k)); }
        startBtn = btn("btn_green", 520, I18n.t("play"), 64, 0, this::startRound); put(startBtn, W / 2, 1620);
    }
    void flash(int i) { g.snd.play("tick"); pad[i].addAction(Actions.sequence(Actions.alpha(1f, .08f), Actions.delay(.25f), Actions.alpha(.55f, .15f))); }
    void startRound() {
        if (input) return; if (!spend()) return; if (seq.isEmpty()) seq.add(rnd.nextInt(4)); else seq.add(rnd.nextInt(4)); pos = 0; input = false; startBtn.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.disabled);
        float t = .4f; for (int s : seq) { final int k = s; board.addAction(Actions.delay(t, Actions.run(() -> flash(k)))); t += .55f; } board.addAction(Actions.delay(t, Actions.run(() -> input = true)));
    }
    void tap(int i) {
        if (!input) return; flash(i);
        if (seq.get(pos) != i) { input = false; g.snd.play("wrong"); toast("✗ " + I18n.t("wrong")); seq.clear(); startBtn.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.enabled); return; }
        if (++pos == seq.size()) { input = false; reward(seq.size() * 2, W / 2, 900); startBtn.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.enabled); }
    }
}
