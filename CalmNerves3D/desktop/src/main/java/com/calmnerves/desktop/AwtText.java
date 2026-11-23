package com.calmnerves.desktop;

import com.badlogic.gdx.graphics.Pixmap;
import com.calmnerves.TextRenderer;
import java.awt.*;
import java.awt.font.*;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.text.AttributedString;
import java.util.ArrayList;
import java.util.List;

/** Desktop text: Java2D shapes Arabic correctly (joins + bidi) using the Cairo font. */
public class AwtText implements TextRenderer {
    private final Font base;
    public AwtText(File ttf) { try { base = Font.createFont(Font.TRUETYPE_FONT, ttf); } catch (Exception e) { throw new RuntimeException(e); } }
    public Pixmap render(String text, int size, int color, int outline, int outlineColor, int maxW, boolean center) {
        Font font = base.deriveFont((float) size);
        BufferedImage tmp = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB); Graphics2D g0 = tmp.createGraphics();
        FontRenderContext frc = new FontRenderContext(null, true, true); g0.dispose();
        List<TextLayout> lines = new ArrayList<>(); float wMax = 0, hTot = 0;
        for (String para : text.split("\n")) {
            if (para.isEmpty()) para = " ";
            AttributedString as = new AttributedString(para); as.addAttribute(TextAttribute.FONT, font);
            LineBreakMeasurer m = new LineBreakMeasurer(as.getIterator(), frc);
            while (m.getPosition() < para.length()) { TextLayout l = m.nextLayout(maxW > 0 ? maxW : 100000); lines.add(l); wMax = Math.max(wMax, l.getAdvance()); hTot += l.getAscent() + l.getDescent() + l.getLeading(); }
        }
        int pad = outline + 4, W = (int) Math.ceil(wMax) + pad * 2, H = (int) Math.ceil(hTot) + pad * 2;
        BufferedImage img = new BufferedImage(Math.max(W, 2), Math.max(H, 2), BufferedImage.TYPE_INT_ARGB); Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON); g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        float y = pad;
        for (TextLayout l : lines) {
            y += l.getAscent(); float x = center ? (W - l.getAdvance()) / 2f : (l.isLeftToRight() ? pad : W - pad - l.getAdvance());
            Shape s = l.getOutline(AffineTransform.getTranslateInstance(x, y));
            if (outline > 0) { g.setStroke(new BasicStroke(outline * 2f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND)); g.setColor(new Color(outlineColor >>> 8 | (outlineColor & 0xFF) << 24, true)); g.draw(s); }
            g.setColor(new Color(color >>> 8 | (color & 0xFF) << 24, true)); g.fill(s); y += l.getDescent() + l.getLeading();
        }
        g.dispose();
        Pixmap p = new Pixmap(img.getWidth(), img.getHeight(), Pixmap.Format.RGBA8888); java.nio.ByteBuffer bb = p.getPixels();
        for (int yy = 0; yy < img.getHeight(); yy++) for (int xx = 0; xx < img.getWidth(); xx++) { int a = img.getRGB(xx, yy); bb.put((byte) (a >> 16)).put((byte) (a >> 8)).put((byte) a).put((byte) (a >>> 24)); }
        bb.rewind(); return p;
    }
}
