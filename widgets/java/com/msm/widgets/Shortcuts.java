package com.msm.widgets;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Icon;
import android.os.Build;

import java.util.ArrayList;
import java.util.List;

/** The menu that opens when you press and hold the app icon: three shortcuts the user picked, and «customise». */
public final class Shortcuts {
    private Shortcuts() { }

    public static final int MAX = 3;

    static Icon icon(WApp app, String name) {
        int s = 192;
        Bitmap b = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        android.graphics.Paint p = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        p.setColor(0xFF15151C); c.drawCircle(s / 2f, s / 2f, s / 2f, p);
        p.setStyle(android.graphics.Paint.Style.STROKE); p.setStrokeWidth(8); p.setColor(app.accent()); c.drawCircle(s / 2f, s / 2f, s / 2f - 4, p);
        Icons.draw(c, name, s / 2f, s / 2f, s * .5f, 0xFFFFFFFF, 2.2f);
        return Icon.createWithBitmap(b);
    }

    /** publishes the user's choice (or the defaults) as dynamic shortcuts; safe to call as often as you like */
    public static void publish(Context ctx, WApp app, Class<?> actClass, Class<?> pickClass) {
        if (Build.VERSION.SDK_INT < 25) return;
        try {
            ShortcutManager sm = (ShortcutManager) ctx.getSystemService(Context.SHORTCUT_SERVICE);
            if (sm == null) return;
            List<ShortcutInfo> out = new ArrayList<>();
            String[] ids = WStore.icon(ctx, app.iconDefaults(ctx));
            int rank = 0;
            for (String id : ids) {
                if (out.size() >= MAX) break;
                Act a = Painter.find(ctx, app, id); if (a == null) continue;
                Intent i = new Intent(ctx, actClass).setAction(Intent.ACTION_VIEW).putExtra("a", a.id);
                out.add(new ShortcutInfo.Builder(ctx, "msm_" + a.id).setShortLabel(a.label).setLongLabel(a.label).setIcon(icon(app, a.icon)).setIntent(i).setRank(rank++).build());
            }
            Intent pick = new Intent(ctx, pickClass).setAction(Intent.ACTION_VIEW).putExtra("mode", "icon");
            out.add(new ShortcutInfo.Builder(ctx, "msm_pick").setShortLabel("تخصيص الاختصارات").setLongLabel("اختار اختصارات الأيقونة").setIcon(icon(app, "plus")).setIntent(pick).setRank(rank).build());
            sm.setDynamicShortcuts(out);
        } catch (Throwable ignored) { }
    }
}
