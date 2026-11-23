package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;

/** Result / share screen: crown banner, celebrating (or furious) character, score panel, challenge-friends + share + home + continue. */
public class ResultScr extends Scr {
    final boolean win; final int level, score; final long seed; final float combo; final Runnable next; float shown, tgt; Image num; Group panel;
    public ResultScr(CalmGame g, boolean win, int level, long seed, int score, float combo, Runnable next) { super(g); this.win = win; this.level = level; this.seed = seed; this.score = score; this.combo = combo; this.next = next; }
    @Override protected void build() {
        back();
        String[] lines = I18n.arr(win ? "winLines" : "loseLines"); banner(lines[(int) (Math.random() * lines.length)], true, W / 2, 70);
        hero(win ? "win" : "boss", W / 2, 330, 720);
        panel = new Group(); Image bg = img("score", 760); panel.setSize(bg.getWidth(), bg.getHeight()); panel.addActor(bg);
        Image l = txt(I18n.t("score"), 38, Color.WHITE, 4, 500); l.setPosition(panel.getWidth() / 2 - l.getWidth() / 2, panel.getHeight() * .70f); panel.addActor(l);
        Image st = img("star", 96); st.setPosition(panel.getWidth() / 2 - 190, panel.getHeight() * .10f); panel.addActor(st);
        put(panel, W / 2, 1010); pop(panel, .2f); tgt = score; num = null;
        if (combo > 1.01f) put(txt(I18n.t("combo") + " ×" + String.format(java.util.Locale.US, "%.1f", combo), 36, new Color(0x8cf12aff), 5, 400), W / 2, 1010 + panel.getHeight() + 2);
        Group ch = btn("btn_challenge", 760, I18n.t("challengeFriends"), 58, 70, () -> g.plat.share(I18n.t("friendMsg", "s", score) + "  CALM-" + seed + "-" + level)); put(ch, W / 2, 1010 + panel.getHeight() + 70); pop(ch, .35f);
        Group home = round("round_home", 170, () -> g.go(new MenuScr(g))); put(home, 130, 1560);
        Group sh = btn("btn_share", 560, I18n.t("share"), 58, 80, () -> g.plat.share(lines[0] + " — " + I18n.t("title1") + " " + I18n.t("title2") + " ★" + score)); put(sh, 520, 1575); pop(sh, .45f);
        Group nx = btn("btn_purple", 560, win ? I18n.t("next") : I18n.t("retry"), 60, 0, next); nx.setSize(nx.getWidth(), nx.getHeight()); put(nx, W / 2, 1745); pop(nx, .55f);
        if (win) { Fx.confetti(this, 90); g.snd.play("win"); } else { Fx.cracks(this); g.snd.play("wrong"); }
    }
    @Override protected void update(float dt) {
        if (panel == null) return; shown = Math.min(tgt, shown + Math.max(1, tgt * dt * 1.2f)); int v = (int) shown;
        if (num == null || !num.getName().equals("" + v)) { if (num != null) num.remove(); num = txt("" + v, 96, Color.GOLD, 10, 400); num.setName("" + v); num.setPosition(panel.getX() + panel.getWidth() / 2 - num.getWidth() / 2 + 60, panel.getY() + panel.getHeight() * .09f); ui.addActor(num); }
    }
}
