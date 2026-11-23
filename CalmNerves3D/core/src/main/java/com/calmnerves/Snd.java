package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.audio.Sound;
import com.badlogic.gdx.utils.ObjectMap;

/** Sound effects + looping music (pitch-shifted faster when time is low) + vibration. */
public class Snd {
    private final Store s; private final ObjectMap<String, Sound> fx = new ObjectMap<>(); private Sound music; private long musicId = -1;
    public Snd(Store s) { this.s = s; for (String n : new String[]{"tap", "correct", "wrong", "combo", "boss", "win", "glitch", "tick", "pop"}) fx.put(n, Gdx.audio.newSound(Gdx.files.internal("snd/" + n + ".wav"))); }
    public void play(String n) { if (s.sound && fx.containsKey(n)) fx.get(n).play(.8f); }
    public void vib(int ms) { if (s.vib) try { Gdx.input.vibrate(ms); } catch (Exception ignored) { } }
    public void musicStart(int world) {
        musicStop(); if (!s.music) return;
        music = Gdx.audio.newSound(Gdx.files.internal("snd/music" + (((world - 1) % 5) + 1) + ".wav")); musicId = music.loop(.45f);
    }
    public void musicTempo(float p) { if (music != null && musicId != -1) music.setPitch(musicId, p); }
    public void musicStop() { if (music != null) { music.stop(); music.dispose(); music = null; musicId = -1; } }
    public void dispose() { musicStop(); for (Sound x : fx.values()) x.dispose(); }
}
