package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.glutils.ShapeRenderer;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.utils.Align;
import java.util.Random;
import java.util.function.Consumer;

/** One challenge on screen: HUD (ring or plate timer), reacting character, prompt, play area, taunts, power-ups, twists. */
public class GameScr extends Scr {
    public static class Opts { public int level = 1; public long seed; public String type; public boolean boss, practice, noPU; public String tutorial, title; public int shrink; }
    static String lastType = "";
    final Opts o; final Consumer<Result> cb; Challenge ch; final Random rnd; boolean surv, noTimer, over, armed, bossMode; float total, left, frozen, tauntT = 2f, glitchT; int d;
    Group play = new Group(), hud = new Group(), promptG = new Group(), puRow = new Group(); Image digits, taunt, promptTxt; String digitsStr = "", ptxt = ""; boolean parch, mirror, low;
    Layer3 hero; Texture calmTex; String state = "calm"; ShapeRenderer sr = new ShapeRenderer(); float pct = 1; Image flash;
    String[] puKeys = {"freeze", "fifty", "second"}; int[] puCost = {20, 25, 30};

    public GameScr(CalmGame g, Opts o, Consumer<Result> cb) { super(g); this.o = o; this.cb = cb; rnd = new Random(o.seed); }
    @Override protected int world() { return Math.max(0, (o.level - 1) / 10); }
    @Override protected void onBack() { finish(false, true); }

    @Override protected void build() {
        String id = o.boss ? "boss" : o.type != null ? o.type : Challenges.pick(o.level, rnd, lastType); lastType = id; ch = Challenges.create(id); bossMode = id.equals("boss"); d = g.s.diffIndex();
        total = left = ch.time(); noTimer = o.practice || o.tutorial != null; if (noTimer) total = left = 99; if (o.shrink > 0) total = left = Math.max(4, total - o.shrink); surv = ch.survive() || bossMode;
        back(); banner(o.title != null ? o.title : I18n.t("stage") + " " + o.level, false, W / 2, 48);
        buildHud(); calmTex = g.a.hue("char_calm", MenuScr.hueFor(g.s.avatar)); hero = hero(calmTex, W / 2, 470, 500); react(bossMode ? "furious" : "calm");
        promptG.setSize(840, 150); put(promptG, W / 2, 880); renderPrompt();
        play.setSize(Challenge.PW, Challenge.PH); play.setPosition(36, H - 1000 - Challenge.PH - 10); ui.addActor(play);
        taunt = null; buildPu();
        flash = new Image(Gfx.white()); flash.setSize(W, H); flash.setColor(1, 1, 1, 0); flash.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.disabled); ui.addActor(flash);
        ch.attach(this, play, rnd, o.level, d); ch.build();
        if (o.tutorial != null) { Group b = new Group(); Image bb = panelImg(660, 120, 34, 0xffffffff, 0x1a0a3aff, 5); b.setSize(660, 120); b.addActor(bb); Image t = txt(o.tutorial, 32, new Color(0x1a0a3aff), 0, 620); t.setPosition(330 - t.getWidth() / 2, 60 - t.getHeight() / 2); b.addActor(t); b.setPosition(W / 2 - 330 + 40, H - 150); ui.addActor(b); b.addAction(Actions.sequence(Actions.delay(6f), Actions.fadeOut(.5f), Actions.removeActor())); }
        g.snd.musicStart(world() + 1);
        if (bossMode) ui.addAction(Actions.forever(Actions.delay(1.7f, Actions.run(() -> { flash.addAction(Actions.sequence(Actions.alpha(.55f), Actions.fadeOut(.12f))); g.bg.bump(); }))));
        if (o.level > 10 && o.tutorial == null && !o.practice && Math.random() < .35) ui.addAction(Actions.delay(2f + (float) Math.random() * 3, Actions.run(this::twist)));
    }

    void twist() {
        if (over) return; int k = (int) (Math.random() * 3);
        if (k == 0) { say(I18n.t("twistFlip")); play.setTransform(true); play.setOrigin(Align.center); play.addAction(Actions.sequence(Actions.rotateBy(180, .5f), Actions.delay(2f), Actions.rotateBy(-180, .5f))); }
        else if (k == 1) { say(I18n.t("twistRev")); ch.reverse(); } else { g.snd.play("glitch"); g.snd.vib(80); glitchT = 1.2f; say(I18n.t("twistGlitch")); }
    }

    // ---------------- HUD ----------------
    void buildHud() {
        if (surv) {
            hud.setSize(560, 150); hud.addActor(panelImg(560, 150, 30, 0x0b0b16ff, 0x555566ff, 6)); Image sw = img("stopwatch", 110); sw.setPosition(30, 20); hud.addActor(sw); put(hud, W / 2, 200);
            Image sp = new Image(Gfx.white()); for (int i = 0; i < 6; i++) { Image l = new Image(Gfx.white()); l.setSize(120 - i * 10, 5); l.setColor(1, .27f, .2f, .8f); l.setPosition(-110 + i * 6, 20 + i * 22); hud.addActor(l); }
        } else {
            hud.setSize(250, 250); hud.addActor(new Actor() {
                @Override public void draw(Batch b, float pa) {
                    b.end(); Gdx.gl.glEnable(GL20.GL_BLEND); sr.setProjectionMatrix(b.getProjectionMatrix()); sr.setTransformMatrix(b.getTransformMatrix()); sr.begin(ShapeRenderer.ShapeType.Filled);
                    float cx = 125, cy = 125; sr.setColor(.063f, .03f, .227f, 1); sr.circle(cx, cy, 124, 64);
                    Color c = pct > .5f ? new Color(.2f, .84f, .16f, 1) : pct > .25f ? new Color(1, .6f, .08f, 1) : new Color(1, .16f, .16f, 1); sr.setColor(c); sr.arc(cx, cy, 124, 90 - 360 * pct, 360 * pct, 64);
                    sr.setColor(.063f, .03f, .227f, 1); sr.circle(cx, cy, 98, 64); sr.end(); b.begin();
                }
            }); put(hud, W / 2, 190);
        }
        hud.setTransform(true); hud.setOrigin(Align.center); updateDigits(true);
    }
    void updateDigits(boolean force) {
        int sec = Math.max(0, (int) Math.ceil(left)); String s = noTimer ? "--" : surv ? "00:" + (sec < 10 ? "0" : "") + sec : "" + sec; Color c = surv ? new Color(0xff1a1aff) : Color.WHITE; if (low && (int) (left * 4) % 2 == 0) c = new Color(1, .5f, .5f, 1);
        String key = s + (int) (c.r * 255) + (int) (c.g * 255); if (key.equals(digitsStr) && !force) return; digitsStr = key; if (digits != null) digits.remove();
        digits = txt(s, surv ? 118 : 100, c, surv ? 8 : 10, 400); digits.setPosition(surv ? 330 - digits.getWidth() / 2 + 35 : hud.getWidth() / 2 - digits.getWidth() / 2, hud.getHeight() / 2 - digits.getHeight() / 2); hud.addActor(digits);
    }

    // ---------------- prompt / taunt / character ----------------
    public void prompt(String s) { ptxt = s; renderPrompt(); }
    public void promptParch(boolean p) { parch = p; renderPrompt(); }
    public void promptMirror(boolean m) { mirror = m; renderPrompt(); }
    void renderPrompt() {
        promptG.clearChildren(); if (ptxt.isEmpty()) return;
        if (parch) { Image bg = img("parch", 560); bg.setPosition(promptG.getWidth() / 2 - 280, -20); promptG.addActor(bg); Image t = txt(ptxt, 44, new Color(0x3a2410ff), 0, 480); t.setPosition(promptG.getWidth() / 2 - t.getWidth() / 2, 82); promptG.addActor(t); }
        else { promptG.addActor(panelImg(840, 150, 36, 0x0a0528e8, 0x5a3ac8ff, 5)); promptTxt = txt(ptxt, ptxt.length() > 90 ? 32 : ptxt.length() > 50 ? 40 : 54, Color.WHITE, 5, 780); promptTxt.setPosition(420 - promptTxt.getWidth() / 2, 75 - promptTxt.getHeight() / 2); if (mirror) { promptTxt.setScaleX(-1); } promptG.addActor(promptTxt); }
    }
    public void say(String s) { if (taunt != null) taunt.remove(); taunt = txt(s, 38, new Color(0xffd27aff), 5, 800); put(taunt, W / 2, 1690); taunt.getColor().a = 0; taunt.addAction(Actions.fadeIn(.2f)); }
    public void react(String st) {
        state = st; Texture t = st.equals("calm") ? calmTex : g.a.tex(st.equals("think") || st.equals("worried") ? "think" : st.equals("sweat") ? "shock" : st.equals("win") ? "win" : "boss");
        float h = bossMode || st.equals("furious") ? 440 : 380, w = h * t.getWidth() / t.getHeight(); hero.l.tex = t; hero.l.w = w; hero.l.h = h; hero.l.x = W / 2 - w / 2; hero.l.y = H - 470 - h + 20; hero.l.pop = 1;
    }
    public void sub() { g.snd.play("correct"); g.bg.bump(); Fx.burst(ui, W / 2, 640, 20, null); }

    // ---------------- power-ups ----------------
    void buildPu() {
        if (o.noPU) return; puRow.setSize(600, 150); put(puRow, W / 2, 1745);
        for (int i = 0; i < 3; i++) {
            final int k = i; Group b = new Group(); b.setSize(140, 140); Image pic = img("pu_" + puKeys[i], 140); b.addActor(pic); b.setPosition(i * 230 + 10, 5); puRow.addActor(b);
            final Image[] badge = {null}; Runnable refresh = () -> { if (badge[0] != null) badge[0].remove(); int n = count(k); Group bd = new Group(); Image bi = panelImg(n > 0 ? 54 : 100, 54, 27, 0xffa414ff, 0x1a0a3aff, 4); bd.addActor(bi); Image t = txt(n > 0 ? "" + n : "★" + puCost[k], 30, new Color(0x2a0f3eff), 0, 90); t.setPosition(bi.getWidth() / 2 - t.getWidth() / 2, 27 - t.getHeight() / 2); bd.addActor(t); bd.setPosition(100, 90); badge[0] = new Image(); bd.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.disabled); b.addActor(bd); badge[0] = new Image() { }; badge[0].setUserObject(bd); };
            refresh.run();
            press(b, () -> { if (over) return; if (count(k) <= 0) { if (g.s.stars < puCost[k]) { g.snd.play("wrong"); return; } g.s.stars -= puCost[k]; add(k, 1); } add(k, -1); g.s.save();
                if (k == 0) { frozen = 5; g.snd.play("combo"); } else if (k == 1) removeTwo(); else { armed = true; b.setColor(.6f, 1, .6f, 1); }
                for (Actor a : b.getChildren()) if (a instanceof Group) a.remove(); refresh.run(); });
        }
    }
    int count(int k) { return k == 0 ? g.s.puFreeze : k == 1 ? g.s.puFifty : g.s.puSecond; }
    void add(int k, int v) { if (k == 0) g.s.puFreeze += v; else if (k == 1) g.s.puFifty += v; else g.s.puSecond += v; }
    void removeTwo() { int n = 0; for (Actor a : ch.wrongBtns) { if (n++ >= 2) break; a.addAction(Actions.sequence(Actions.alpha(.12f, .2f))); a.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.disabled); } }

    // ---------------- loop ----------------
    @Override protected void update(float dt) {
        if (over) return; ch.update(dt);
        if (!noTimer) { if (frozen > 0) frozen -= dt; else left -= dt; }
        pct = Math.max(0, left / total); low = pct < .3f && !noTimer; updateDigits(false);
        if (low) { g.snd.musicTempo(1.5f); glitchT = Math.max(glitchT, .1f); } 
        if (glitchT > 0) { glitchT -= dt; hud.setPosition(hud.getX() + MathUtils.random(-2.5f, 2.5f), hud.getY() + MathUtils.random(-2, 2)); if (Math.abs(hud.getX() - (W / 2 - hud.getWidth() / 2)) > 8) hud.setX(W / 2 - hud.getWidth() / 2); }
        if (!bossMode && !noTimer) { if (pct < .6f && state.equals("calm")) react("worried"); if (pct < .3f && state.equals("worried")) react("sweat"); }
        tauntT -= dt; if (tauntT <= 0 && !noTimer) { tauntT = 2.5f; String[] ts = I18n.arr("taunts"); say(ts[MathUtils.random(ts.length - 1)]); }
        if (left <= 0) { if (ch.survive()) finish(true, false); else finish(false, false); }
    }
    void win() { finish(true, false); } void fail() { finish(false, false); }
    void finish(boolean win, boolean quit) {
        if (over) return;
        if (!win && armed && !quit) { armed = false; ch.dispose(); play.clearChildren(); play.clearActions(); ch.wrongBtns.clear(); left = Math.max(left, total * .5f); ch.build(); g.snd.play("combo"); return; }
        if (!win && o.tutorial != null && !quit) { ch.dispose(); play.clearChildren(); play.clearActions(); ch.wrongBtns.clear(); left = total; ch.build(); say("👍"); Fx.shake(play, 14, .3f); return; }
        over = true; ch.dispose(); g.snd.musicStop(); Result r = new Result(); r.quit = quit; r.win = win; r.left = Math.max(0, left); r.secs = total - left; r.boss = bossMode;
        if (quit) { Gdx.app.postRunnable(() -> cb.accept(r)); return; }
        react(win ? "win" : "furious"); Fx.burst(ui, W / 2, 640, win ? 36 : 24, win ? null : new int[]{0xff3b3bff, 0xff8a14ff, 0xffffffff});
        Fx.popText(this, ui, win ? (g.s.streak >= 1 ? I18n.t("combo") + " ×" + String.format(java.util.Locale.US, "%.1f", 1 + Math.min(g.s.streak + 1, 10) * .1) : I18n.t("correct")) : I18n.t("wrong"), !win);
        if (win) { g.snd.play("correct"); g.snd.vib(40); } else { g.snd.play("wrong"); g.snd.vib(160); g.bg.bump(); Fx.shake(ui, 16, .5f); }
        ui.addAction(Actions.delay(.9f, Actions.run(() -> cb.accept(r))));
    }
    @Override public void dispose() { super.dispose(); sr.dispose(); g.snd.musicStop(); }
}
