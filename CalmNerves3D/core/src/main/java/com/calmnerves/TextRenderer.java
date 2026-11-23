package com.calmnerves;

import com.badlogic.gdx.graphics.Pixmap;

/** Platform text shaping (Arabic joins + RTL) lives behind this interface: Java2D on desktop, Canvas on Android. */
public interface TextRenderer {
    /** @param maxW wrap width in px (0 = no wrap). Returned pixmap is RGBA8888; the caller disposes it. */
    Pixmap render(String text, int sizePx, int color, int outlinePx, int outlineColor, int maxW, boolean center);
}
