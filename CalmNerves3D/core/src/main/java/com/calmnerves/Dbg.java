package com.calmnerves;

import com.badlogic.gdx.Gdx;

/** Startup stage marker: survives native crashes, so the next launch can say where the app died. */
public class Dbg {
    public static void mark(String s) { try { if (Gdx.files != null) Gdx.files.local("stage.txt").writeString(s, false); } catch (Throwable ignored) { } }
}
