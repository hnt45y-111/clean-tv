package com.calmnerves;

import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.InputEvent;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.utils.ClickListener;
import java.util.Random;

/** Shape match: swap neighbours to line up 3 or more equal shapes; every successful swap costs one move. */
public class Match3Scr extends BonusScr {
    static final int N = 7; static final float C = 112; static final String[] IC = {"ic_ball", "ic_car", "ic_star", "ic_gift", "ic_crown"};
    final int[][] t = new int[N][N]; final Image[][] im = new Image[N][N]; boolean busy; int sr = -1, sc = -1; Group board; final Random rnd = new Random();
    public Match3Scr(CalmGame g) { super(g); }
    @Override protected String title() { return I18n.t("match3"); } @Override protected String desc() { return I18n.t("match3d"); }
    float px(int c) { return c * C + 6; } float py(int r) { return (N - 1 - r) * C + 6; }
    @Override protected void buildGame() { board = new Group(); board.setSize(N * C, N * C); board.setPosition((W - N * C) / 2, H - 420 - N * C); ui.addActor(board); Image bg = panelImg(N * C + 20, N * C + 20, 30, 0x0c0838cc, 0x6a4cd8ff, 5); bg.setPosition(-10, -10); board.addActor(bg); fill(); }
    void fill() {
        for (int r = 0; r < N; r++) for (int c = 0; c < N; c++) { int v; do { v = rnd.nextInt(5); } while ((c >= 2 && t[r][c - 1] == v && t[r][c - 2] == v) || (r >= 2 && t[r - 1][c] == v && t[r - 2][c] == v)); t[r][c] = v; if (im[r][c] != null) im[r][c].remove(); im[r][c] = mk(r, c); }
        if (!hasMove()) { for (int r = 0; r < N; r++) for (int c = 0; c < N; c++) im[r][c].remove(); fill(); }
    }
    Image mk(int r, int c) {
        Image i = new Image(g.a.tex(IC[t[r][c]])); i.setSize(C - 12, C - 12); i.setOrigin(com.badlogic.gdx.utils.Align.center); i.setPosition(px(c), py(r)); board.addActor(i);
        final int rr = r, cc = c; i.addListener(new ClickListener() { @Override public void clicked(InputEvent e, float x, float y) { pick(rr, cc, i); } }); return i;
    }
    void pick(int r, int c, Image tapped) {
        if (busy) return; g.snd.play("tap");
        if (sr < 0) { sr = r; sc = c; im[r][c].addAction(Actions.scaleTo(1.18f, 1.18f, .1f)); return; }
        im[sr][sc].addAction(Actions.scaleTo(1, 1, .1f));
        if (Math.abs(sr - r) + Math.abs(sc - c) == 1) { int r0 = sr, c0 = sc; sr = -1; swapTry(r0, c0, r, c); } else { sr = r; sc = c; im[r][c].addAction(Actions.scaleTo(1.18f, 1.18f, .1f)); }
    }
    void swapData(int r1, int c1, int r2, int c2) { int v = t[r1][c1]; t[r1][c1] = t[r2][c2]; t[r2][c2] = v; Image a = im[r1][c1]; im[r1][c1] = im[r2][c2]; im[r2][c2] = a; }
    void rebind() { for (int r = 0; r < N; r++) for (int c = 0; c < N; c++) { final int rr = r, cc = c; Image i = im[r][c]; if (i == null) continue; i.clearListeners(); i.addListener(new ClickListener() { @Override public void clicked(InputEvent e, float x, float y) { pick(rr, cc, i); } }); } }
    void place(float dur) { for (int r = 0; r < N; r++) for (int c = 0; c < N; c++) if (im[r][c] != null) im[r][c].addAction(Actions.moveTo(px(c), py(r), dur, Interpolation.pow2Out)); }
    void swapTry(int r1, int c1, int r2, int c2) {
        if (g.s.moves <= 0) { toast(I18n.t("noMoves")); return; } busy = true; swapData(r1, c1, r2, c2); rebind(); place(.15f);
        board.addAction(Actions.delay(.2f, Actions.run(() -> {
            if (marks() == null) { swapData(r1, c1, r2, c2); rebind(); place(.15f); board.addAction(Actions.delay(.2f, Actions.run(() -> busy = false))); }
            else { spend(); resolve(1); }
        })));
    }
    /** @return marked cells or null when no run of 3+ exists; gain holds the star payout */
    int gain; boolean[][] marks() {
        boolean[][] m = new boolean[N][N]; boolean any = false; gain = 0;
        for (int r = 0; r < N; r++) for (int c = 0; c < N; ) { int e = c; while (e + 1 < N && t[r][e + 1] == t[r][c] && t[r][c] >= 0) e++; int L = e - c + 1; if (L >= 3) { any = true; gain += L == 3 ? 3 : L == 4 ? 6 : 10; for (int k = c; k <= e; k++) m[r][k] = true; } c = e + 1; }
        for (int c = 0; c < N; c++) for (int r = 0; r < N; ) { int e = r; while (e + 1 < N && t[e + 1][c] == t[r][c] && t[r][c] >= 0) e++; int L = e - r + 1; if (L >= 3) { any = true; gain += L == 3 ? 3 : L == 4 ? 6 : 10; for (int k = r; k <= e; k++) m[k][c] = true; } r = e + 1; }
        return any ? m : null;
    }
    void resolve(int combo) {
        boolean[][] m = marks(); if (m == null) { busy = false; if (!hasMove()) { for (int r = 0; r < N; r++) for (int c = 0; c < N; c++) { im[r][c].remove(); } fill(); } return; }
        int pay = gain * combo; float cx = 0, cy = 0; int n = 0;
        for (int r = 0; r < N; r++) for (int c = 0; c < N; c++) if (m[r][c]) { cx += px(c); cy += py(r); n++; Image i = im[r][c]; i.addAction(Actions.sequence(Actions.parallel(Actions.scaleTo(.1f, .1f, .25f), Actions.fadeOut(.25f)), Actions.removeActor())); im[r][c] = null; t[r][c] = -1; }
        reward(pay, board.getX() + cx / n, board.getY() + cy / n); g.snd.play(combo > 1 ? "combo" : "pop");
        board.addAction(Actions.delay(.3f, Actions.run(() -> {
            for (int c = 0; c < N; c++) { int w = N - 1; for (int r = N - 1; r >= 0; r--) if (t[r][c] >= 0) { t[w][c] = t[r][c]; im[w][c] = im[r][c]; if (w != r) { t[r][c] = -1; im[r][c] = null; } w--; }
                for (int r = w; r >= 0; r--) { t[r][c] = rnd.nextInt(5); Image i = mk(r, c); i.setY(py(r) + (w + 1 - r) * C + 200); im[r][c] = i; } }
            rebind(); place(.3f); board.addAction(Actions.delay(.38f, Actions.run(() -> resolve(combo + 1))));
        })));
    }
    boolean hasMove() {
        int[][] d = {{0, 1}, {1, 0}};
        for (int r = 0; r < N; r++) for (int c = 0; c < N; c++) for (int[] v : d) { int r2 = r + v[0], c2 = c + v[1]; if (r2 >= N || c2 >= N) continue; int a = t[r][c]; t[r][c] = t[r2][c2]; t[r2][c2] = a; boolean ok = marks() != null; a = t[r][c]; t[r][c] = t[r2][c2]; t[r2][c2] = a; if (ok) return true; }
        return false;
    }
}
