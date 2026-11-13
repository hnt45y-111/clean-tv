package com.cleantv.launcher;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Small banners drawn above other apps (adhan, match alerts, live score). */
public class Overlay {
    private static final Handler H = new Handler(Looper.getMainLooper());
    private static View banner, corner;
    private static TextView cornerText;

    static boolean allowed(Context c) {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c);
    }

    private static int dp(Context c, float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics());
    }

    private static WindowManager.LayoutParams params(int gravity, int y) {
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams p = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
        p.gravity = gravity;
        p.y = y;
        return p;
    }

    private static TextView text(Context c, String s, float sp, int color, boolean bold) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(t.getTypeface(), android.graphics.Typeface.BOLD);
        return t;
    }

    static void showBanner(final Context ctx, final String title, final String sub, final long ms) {
        final Context c = ctx.getApplicationContext();
        if (!allowed(c)) return;
        H.post(new Runnable() {
            @Override
            public void run() {
                try {
                    hideBannerNow(c);
                    LinearLayout box = new LinearLayout(c);
                    box.setOrientation(LinearLayout.VERTICAL);
                    box.setGravity(Gravity.CENTER);
                    int pad = dp(c, 14);
                    box.setPadding(pad * 2, pad, pad * 2, pad);
                    GradientDrawable bg = new GradientDrawable();
                    bg.setColor(Color.argb(235, 12, 14, 20));
                    bg.setCornerRadius(dp(c, 18));
                    bg.setStroke(dp(c, 1.5f), Color.rgb(233, 196, 106));
                    box.setBackground(bg);
                    box.addView(text(c, title, 22, Color.rgb(246, 220, 155), true));
                    if (sub != null && sub.length() > 0) box.addView(text(c, sub, 15, Color.argb(220, 255, 255, 255), false));
                    WindowManager wm = (WindowManager) c.getSystemService(Context.WINDOW_SERVICE);
                    wm.addView(box, params(Gravity.TOP | Gravity.CENTER_HORIZONTAL, dp(c, 24)));
                    banner = box;
                    H.postDelayed(new Runnable() { @Override public void run() { hideBannerNow(c); } }, ms);
                } catch (Throwable ignored) { }
            }
        });
    }

    static void hideBanner(final Context ctx) {
        H.post(new Runnable() { @Override public void run() { hideBannerNow(ctx.getApplicationContext()); } });
    }

    private static void hideBannerNow(Context c) {
        if (banner == null) return;
        try { ((WindowManager) c.getSystemService(Context.WINDOW_SERVICE)).removeView(banner); } catch (Throwable ignored) { }
        banner = null;
    }

    static void showCorner(final Context ctx, final String s) {
        final Context c = ctx.getApplicationContext();
        if (!allowed(c)) return;
        H.post(new Runnable() {
            @Override
            public void run() {
                try {
                    if (corner != null && cornerText != null) { cornerText.setText(s); return; }
                    TextView t = text(c, s, 15, Color.WHITE, true);
                    int pad = dp(c, 8);
                    t.setPadding(pad * 2, pad, pad * 2, pad);
                    GradientDrawable bg = new GradientDrawable();
                    bg.setColor(Color.argb(200, 10, 12, 18));
                    bg.setCornerRadius(dp(c, 12));
                    t.setBackground(bg);
                    WindowManager.LayoutParams p = params(Gravity.BOTTOM | Gravity.LEFT, dp(c, 20));
                    p.x = dp(c, 20);
                    ((WindowManager) c.getSystemService(Context.WINDOW_SERVICE)).addView(t, p);
                    corner = t;
                    cornerText = t;
                } catch (Throwable ignored) { }
            }
        });
    }

    static void hideCorner(final Context ctx) {
        final Context c = ctx.getApplicationContext();
        H.post(new Runnable() {
            @Override
            public void run() {
                if (corner == null) return;
                try { ((WindowManager) c.getSystemService(Context.WINDOW_SERVICE)).removeView(corner); } catch (Throwable ignored) { }
                corner = null;
                cornerText = null;
            }
        });
    }
}
