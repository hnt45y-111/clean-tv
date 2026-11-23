package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.utils.Align;
import java.util.*;

/** Card pairs: flip two cards (one move); matching pairs pay stars; clear the board for a bonus. */
public class PairsScr extends BonusScr {
    Group[] card = new Group[16]; int[] face = new int[16]; boolean[] open = new boolean[16], done = new boolean[16]; int first = -1, matched; boolean lock; Group board;
    public PairsScr(CalmGame g) { super(g); }
    @Override protected String title() { return I18n.t("pairs"); } @Override protected String desc() { return I18n.t("pairsd"); }
    @Override protected void buildGame() { board = new Group(); board.setSize(820, 820); board.setPosition(40, H - 420 - 820); ui.addActor(board); deal(); }
    void deal() {
        board.clearChildren(); matched = 0; first = -1; lock = false; List<Integer> l = new ArrayList<>(); for (int i = 0; i < 8; i++) { l.add(i); l.add(i); } Collections.shuffle(l);
        for (int i = 0; i < 16; i++) {
            face[i] = l.get(i); open[i] = false; done[i] = false; final int k = i; Group c = new Group(); c.setSize(190, 190); c.setOrigin(Align.center); c.setTransform(true); show(c, false, face[i]); c.setPosition((i % 4) * 210, 630 - (i / 4) * 210); board.addActor(c); card[i] = c; press(c, () -> flip(k));
        }
    }
    void show(Group c, boolean up, int f) {
        c.clearChildren();
        if (up) { Group t = tileBtn(Challenges.ICONS[f], 190); c.addActor(t); }
        else { Image bg = panelImg(190, 190, 30, 0x5a24d0ff, 0x1a0a3aff, 6); c.addActor(bg); Image q = txt("?", 100, Color.WHITE, 8, 150); q.setPosition(95 - q.getWidth() / 2, 95 - q.getHeight() / 2); c.addActor(q); }
    }
    void turn(int i, boolean up, Runnable after) { Group c = card[i]; c.addAction(Actions.sequence(Actions.scaleTo(0, 1, .12f), Actions.run(() -> show(c, up, face[i])), Actions.scaleTo(1, 1, .12f), Actions.run(after))); }
    void flip(int i) {
        if (lock || open[i] || done[i]) return; if (first < 0) { if (g.s.moves <= 0) { toast(I18n.t("noMoves")); return; } first = i; open[i] = true; turn(i, true, () -> { }); return; }
        int a = first; first = -1; lock = true; open[i] = true; spend(); turn(i, true, () -> {
            if (face[a] == face[i]) { done[a] = done[i] = true; matched++; reward(4, board.getX() + 420, board.getY() + 410); lock = false; if (matched == 8) { reward(10, W / 2, 1000); board.addAction(Actions.delay(1.2f, Actions.run(this::deal))); } }
            else board.addAction(Actions.delay(.6f, Actions.run(() -> { open[a] = open[i] = false; turn(a, false, () -> { }); turn(i, false, () -> lock = false); })));
        });
    }
}
