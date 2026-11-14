#!/usr/bin/env python3
"""Writes the Android vector icons of the identity (one mark, a different background per app).
Run from the repo root:  python3 tools/brand/make_icons.py"""
import math, os

INK, IVORY, COPPER, TEAL, CHROME = '#15181B', '#EFE7D4', '#D9822B', '#1F6F6B', '#B8BDC2'

def bar(x0, y0, x1, y1, w):
    dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); nx, ny = -dy / L * w / 2, dx / L * w / 2
    pts = [(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)]
    return 'M' + ' L'.join('%.2f,%.2f' % p for p in pts) + ' Z'

def rrect(x, y, w, h, r):
    return 'M%g,%g H%g A%g,%g 0 0 1 %g,%g V%g A%g,%g 0 0 1 %g,%g H%g A%g,%g 0 0 1 %g,%g V%g A%g,%g 0 0 1 %g,%g Z' % (
        x + r, y, x + w - r, r, r, x + w, y + r, y + h - r, r, r, x + w - r, y + h, x + r, r, r, x, y + h - r, y + r, r, r, x + r, y)

def ring(cx, cy, r, gate=16):
    out = []
    for k in range(4):
        a0, a1 = k * 90 + gate / 2, (k + 1) * 90 - gate / 2
        p = lambda a: (cx + r * math.sin(math.radians(a)), cy - r * math.cos(math.radians(a)))
        (x0, y0), (x1, y1) = p(a0), p(a1)
        out.append('M%.2f,%.2f A%g,%g 0 0 1 %.2f,%.2f' % (x0, y0, r, r, x1, y1))
    return ' '.join(out)

def mark(body, screen, accent):
    s = ''
    s += '<path android:fillColor="%s" android:pathData="%s"/>\n' % (body, bar(50, 34, 28, 10, 4.5))
    s += '<path android:fillColor="%s" android:pathData="%s"/>\n' % (body, bar(50, 34, 72, 10, 4.5))
    s += '<path android:fillColor="%s" android:pathData="%s"/>\n' % (body, rrect(8, 34, 84, 58, 12))
    s += '<path android:fillColor="%s" android:pathData="%s"/>\n' % (screen, rrect(15, 41, 70, 44, 5))
    for r in (17, 11.5, 6):
        s += '<path android:strokeColor="%s" android:strokeWidth="2.6" android:strokeLineCap="butt" android:pathData="%s"/>\n' % (body, ring(50, 63, r))
    s += '<path android:fillColor="%s" android:pathData="M50,60.8 a2.2,2.2 0 1 0 0.01,0 Z"/>\n' % accent
    for x in (20, 72):
        s += '<path android:fillColor="%s" android:pathData="M%d,92 h8 v4 h-8 Z"/>\n' % (body, x)
    return s

def icon(bg, body, screen, accent, scale=.6):
    t = (108 - 100 * scale) / 2
    return ('<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
            '    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n'
            '<path android:fillColor="%s" android:pathData="M0,0h108v108h-108z"/>\n<group android:scaleX="%g" android:scaleY="%g" android:translateX="%g" android:translateY="%g">\n%s</group>\n</vector>\n'
            % (bg, scale, scale, t, t, mark(body, screen, accent)))

def banner():
    # 320x180: ink, the mark at 96, copper strip and chrome line at the bottom
    sc = .96; tx, ty = (320 - 100 * sc) / 2, 18
    return ('<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
            '    android:width="320dp" android:height="180dp" android:viewportWidth="320" android:viewportHeight="180">\n'
            '<path android:fillColor="%s" android:pathData="M0,0h320v180h-320z"/>\n'
            '<group android:scaleX="%g" android:scaleY="%g" android:translateX="%g" android:translateY="%g">\n%s</group>\n'
            '<path android:fillColor="%s" android:pathData="M0,164h320v2h-320z"/><path android:fillColor="%s" android:pathData="M0,168h320v12h-320z"/>\n</vector>\n'
            % (INK, sc, sc, tx, ty, mark(IVORY, INK, COPPER), CHROME, COPPER))

OUT = {
    'CleanTV/app/src/main/res/drawable/ic_launcher.xml': icon(INK, IVORY, INK, COPPER),
    'CleanTV/app/src/main/res/drawable/banner.xml': banner(),
    'Studio/app/src/main/res/drawable/ic_app.xml': icon(IVORY, INK, IVORY, COPPER),
    'AutoApp/app/src/main/res/drawable/ic_app.xml': icon(TEAL, IVORY, TEAL, COPPER),
    'Remote/app/src/main/res/drawable/ic_app.xml': icon(INK, COPPER, INK, IVORY),
}
if __name__ == '__main__':
    for p, x in OUT.items():
        os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w').write(x); print('wrote', p)
