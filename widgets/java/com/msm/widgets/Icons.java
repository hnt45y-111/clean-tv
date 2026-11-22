package com.msm.widgets;

import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;

import java.util.HashMap;
import java.util.Map;

/**
 * Outline icons (24×24 grid, round caps), drawn straight onto the widget bitmap.
 * A tiny drawing language: c cx,cy,r · C filled circle · l x1,y1,x2,y2 · p polyline · g closed polygon · G filled polygon ·
 * r x,y,w,h,radius · a cx,cy,r,startDeg,sweepDeg (arc, 0° = right, clockwise).
 */
public final class Icons {
    private Icons() { }

    private static final Map<String, String> D = new HashMap<>();
    static {
        D.put("phone", "r 7,2,10,20,2.5;l 10.5,18.5,13.5,18.5");
        D.put("tv", "r 2,5,20,13,2;l 8,21,16,21;l 12,18,12,21");
        D.put("devices", "r 2,6,13,10,2;r 17,9,5,10,1.5;l 6,19,11,19");
        D.put("broom", "l 15,3,11,11;g 6,11,16,14,13,21,4,21;l 8,16,10,19");
        D.put("sparkle", "g 12,2,14,10,22,12,14,14,12,22,10,14,2,12,10,10");
        D.put("rocket", "g 12,2,16,6,16,13,8,13,8,6;c 12,8,1.6;g 8,13,5,17,8,16;g 16,13,19,17,16,16;l 12,15,12,20");
        D.put("shield", "g 12,2,20,5,20,12,12,22,4,12,4,5;p 8.5,12,11,15,16,9");
        D.put("trash", "l 4,7,20,7;p 7,7,8,21,16,21,17,7;l 9,4,15,4;l 9,4,9,7;l 15,4,15,7;l 10,11,10,17;l 14,11,14,17");
        D.put("undo", "p 9,6,4,11,9,16;l 4,11,14,11;a 14,15.5,4.5,-90,180;l 14,20,8,20");
        D.put("layers", "g 12,3,22,8,12,13,2,8;p 2,12,12,17,22,12;p 2,16,12,21,22,16");
        D.put("remote", "r 7,2,10,20,3;c 12,9,2.2;l 9,15,15,15;l 9,18,15,18");
        D.put("more", "r 3,3,7,7,2;r 14,3,7,7,2;r 3,14,7,7,2;r 14,14,7,7,2");
        D.put("link", "r 2,9,11,6,3;r 11,9,11,6,3");
        D.put("car", "g 3,13,5,7,19,7,21,13;r 3,13,18,5,1.5;c 7.5,18.5,1.8;c 16.5,18.5,1.8");
        D.put("volup", "g 4,9,8,9,13,5,13,19,8,15,4,15;a 15,12,3,-50,100;a 15,12,6.5,-50,100");
        D.put("voldn", "g 4,9,8,9,13,5,13,19,8,15,4,15;a 15,12,3.5,-50,100");
        D.put("mute", "g 4,9,8,9,13,5,13,19,8,15,4,15;l 16,9,22,15;l 22,9,16,15");
        D.put("power", "a 12,13,8,-60,300;l 12,3,12,12");
        D.put("home", "p 3,11,12,3,21,11;p 5,10,5,21,19,21,19,10;l 10,21,10,15;l 14,21,14,15;l 10,15,14,15");
        D.put("back", "p 10,6,4,12,10,18;l 4,12,20,12");
        D.put("ok", "c 12,12,8.5;p 8,12,11,15,16,9");
        D.put("play", "g 7,4,19,12,7,20");
        D.put("pause", "r 6,5,4,14,1;r 14,5,4,14,1");
        D.put("next", "g 5,5,15,12,5,19;l 18,5,18,19");
        D.put("prev", "g 19,5,9,12,19,19;l 6,5,6,19");
        D.put("settings", "c 12,12,3;c 12,12,7;l 12,2,12,5;l 12,19,12,22;l 2,12,5,12;l 19,12,22,12;l 5,5,7,7;l 17,17,19,19;l 19,5,17,7;l 5,19,7,17");
        D.put("search", "c 10.5,10.5,6.5;l 15.5,15.5,21,21");
        D.put("star", "g 12,3,14.6,9,21,9.6,16.2,13.8,17.6,20,12,16.8,6.4,20,7.8,13.8,3,9.6,9.4,9");
        D.put("film", "r 3,4,18,16,2;l 7,4,7,20;l 17,4,17,20;l 3,9,7,9;l 3,15,7,15;l 17,9,21,9;l 17,15,21,15");
        D.put("live", "C 12,12,1.6;a 12,12,5.5,-45,90;a 12,12,5.5,135,90;a 12,12,9.5,-45,90;a 12,12,9.5,135,90");
        D.put("clock", "c 12,12,9;p 12,7,12,12,16,14");
        D.put("wifi", "C 12,19,1.4;a 12,19,5,-135,90;a 12,19,9,-135,90;a 12,19,13,-135,90");
        D.put("up", "p 6,15,12,8,18,15");
        D.put("down", "p 6,9,12,16,18,9");
        D.put("left", "p 15,6,8,12,15,18");
        D.put("right", "p 9,6,16,12,9,18");
        D.put("shuffle", "p 3,7,8,7,16,17,21,17;p 14,10,16,7,21,7;p 18,4,21,7,18,10;p 18,14,21,17,18,20;p 3,17,8,17,10,14");
        D.put("plus", "l 12,5,12,19;l 5,12,19,12");
        D.put("check", "p 5,13,10,18,19,7");
        D.put("key", "c 8,12,4;l 12,12,21,12;l 18,12,18,16;l 21,12,21,15");
        D.put("list", "l 8,6,20,6;l 8,12,20,12;l 8,18,20,18;C 4,6,1.1;C 4,12,1.1;C 4,18,1.1");
        D.put("chart", "l 5,20,5,12;l 12,20,12,5;l 19,20,19,9");
        D.put("paste", "r 6,4,12,17,2;r 9,2,6,4,1;l 9,10,15,10;l 9,14,15,14");
        D.put("user", "c 12,8,4;a 12,21,8,180,180");
        D.put("moon", "a 12,12,9,100,260;a 15.5,9,7.2,100,-200");
        D.put("cloud", "p 7,18,17,18;a 17,13.5,4.5,-90,180;a 11,11,6,160,200;a 7,15,3,90,180");
    }

    public static boolean has(String n) { return D.containsKey(n); }

    /** draws icon {@code name} centred at (cx, cy), {@code size} pixels wide, with the given paint (stroke colour is taken from it) */
    public static void draw(Canvas c, String name, float cx, float cy, float size, int color, float stroke) {
        String d = D.get(name);
        if (d == null) d = D.get("more");
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(color); p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(stroke); p.setStrokeCap(Paint.Cap.ROUND); p.setStrokeJoin(Paint.Join.ROUND);
        c.save();
        c.translate(cx - size / 2f, cy - size / 2f);
        float s = size / 24f;
        c.scale(s, s);
        p.setStrokeWidth(stroke / s);
        for (String op : d.split(";")) {
            op = op.trim();
            if (op.length() < 3) continue;
            char k = op.charAt(0);
            String[] t = op.substring(2).split(",");
            float[] v = new float[t.length];
            for (int i = 0; i < t.length; i++) v[i] = Float.parseFloat(t[i].trim());
            switch (k) {
                case 'c': p.setStyle(Paint.Style.STROKE); c.drawCircle(v[0], v[1], v[2], p); break;
                case 'C': p.setStyle(Paint.Style.FILL); c.drawCircle(v[0], v[1], v[2], p); p.setStyle(Paint.Style.STROKE); break;
                case 'l': c.drawLine(v[0], v[1], v[2], v[3], p); break;
                case 'r': p.setStyle(Paint.Style.STROKE); c.drawRoundRect(new RectF(v[0], v[1], v[0] + v[2], v[1] + v[3]), v[4], v[4], p); break;
                case 'a': { p.setStyle(Paint.Style.STROKE); c.drawArc(new RectF(v[0] - v[2], v[1] - v[2], v[0] + v[2], v[1] + v[2]), v[3], v[4], false, p); break; }
                case 'p': case 'g': case 'G': {
                    Path path = new Path();
                    path.moveTo(v[0], v[1]);
                    for (int i = 2; i + 1 < v.length; i += 2) path.lineTo(v[i], v[i + 1]);
                    if (k != 'p') path.close();
                    p.setStyle(k == 'G' ? Paint.Style.FILL_AND_STROKE : Paint.Style.STROKE);
                    c.drawPath(path, p); p.setStyle(Paint.Style.STROKE);
                    break;
                }
                default: break;
            }
        }
        c.restore();
    }
}
