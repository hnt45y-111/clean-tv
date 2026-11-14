package com.cleantv.launcher;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.media.tv.TvContract;
import android.media.tv.TvInputInfo;
import android.media.tv.TvInputManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

/** Shortcuts that only make sense on a real television: picture source, picture/sound settings, sleep timer, dimming. */
final class TvControls {
    private static final Handler H = new Handler(Looper.getMainLooper());
    private static Runnable sleepTask;
    private static long sleepAt;
    private static View dimView;

    private TvControls() { }

    private static List<TvInputInfo> inputs(Context c) {
        try {
            TvInputManager m = (TvInputManager) c.getSystemService(Context.TV_INPUT_SERVICE);
            return m == null ? null : m.getTvInputList();
        } catch (Throwable t) { return null; }
    }

    /** A television has hardware inputs (HDMI, tuner, AV); a TV box or stick has none. */
    static boolean isTv(Context c) {
        List<TvInputInfo> l = inputs(c);
        if (l == null) return false;
        for (TvInputInfo i : l) {
            int t = i.getType();
            if (t == TvInputInfo.TYPE_HDMI || t == TvInputInfo.TYPE_TUNER || t == TvInputInfo.TYPE_COMPOSITE
                    || t == TvInputInfo.TYPE_COMPONENT || t == TvInputInfo.TYPE_SCART || t == TvInputInfo.TYPE_SVIDEO
                    || t == TvInputInfo.TYPE_VGA || t == TvInputInfo.TYPE_DVI) return true;
        }
        return false;
    }

    static String list(Context c) {
        JSONArray a = new JSONArray();
        List<TvInputInfo> l = inputs(c);
        if (l == null) return "[]";
        int hdmi = 0;
        for (TvInputInfo i : l) {
            try {
                int t = i.getType();
                String label = null;
                try { CharSequence cs = i.loadCustomLabel(c); if (cs != null) label = cs.toString(); } catch (Throwable ignored) { }
                if (label == null || label.isEmpty()) try { label = i.loadLabel(c).toString(); } catch (Throwable ignored) { }
                String kind;
                switch (t) {
                    case TvInputInfo.TYPE_HDMI: kind = "hdmi"; hdmi++; if (label == null || label.matches("(?i).*hdmi.*")) label = "HDMI " + toAr(hdmi); break;
                    case TvInputInfo.TYPE_TUNER: kind = "tuner"; label = "قنوات التلفزيون"; break;
                    case TvInputInfo.TYPE_COMPOSITE: case TvInputInfo.TYPE_SVIDEO: case TvInputInfo.TYPE_SCART: kind = "av"; label = "مدخل AV"; break;
                    case TvInputInfo.TYPE_COMPONENT: kind = "av"; label = "مدخل الألوان"; break;
                    case TvInputInfo.TYPE_VGA: case TvInputInfo.TYPE_DVI: kind = "pc"; label = "الحاسبة"; break;
                    default: kind = "other";
                }
                if (label == null) label = "مدخل";
                a.put(new JSONObject().put("id", i.getId()).put("label", label).put("kind", kind).put("pass", i.isPassthroughInput()));
            } catch (Throwable ignored) { }
        }
        return a.toString();
    }

    private static String toAr(int n) { return String.valueOf((char) ('٠' + n)); }

    static boolean openInput(Context c, String id, boolean pass) {
        try {
            Uri u = pass ? TvContract.buildChannelUriForPassthroughInput(id) : TvContract.buildChannelsUriForInput(id);
            Intent i = new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            return true;
        } catch (Throwable t) {
            return start(c, new Intent(Intent.ACTION_VIEW, TvContract.Channels.CONTENT_URI));
        }
    }

    private static boolean start(Context c, Intent i) {
        try { c.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return true; } catch (Throwable t) { return false; }
    }

    /** Picture settings: try the TV's own picture page first, then the display page. */
    static boolean openPicture(Context c) {
        String[] actions = { "android.settings.PICTURE_SETTINGS", "com.android.tv.settings.PICTURE_SETTINGS", "android.settings.DISPLAY_SETTINGS" };
        for (String a : actions) if (start(c, new Intent(a))) return true;
        return start(c, new Intent(Settings.ACTION_SETTINGS));
    }

    static boolean openSound(Context c) {
        if (start(c, new Intent(Settings.ACTION_SOUND_SETTINGS))) return true;
        return start(c, new Intent(Settings.ACTION_SETTINGS));
    }

    /** Minutes until the screen goes to sleep; 0 cancels. */
    static void sleepIn(int minutes) {
        if (sleepTask != null) H.removeCallbacks(sleepTask);
        sleepTask = null;
        sleepAt = 0;
        if (minutes <= 0) return;
        sleepAt = System.currentTimeMillis() + minutes * 60000L;
        sleepTask = () -> { sleepAt = 0; PowerService.sleep(); };
        H.postDelayed(sleepTask, minutes * 60000L);
    }

    static long sleepLeftMs() { return sleepAt == 0 ? 0 : Math.max(0, sleepAt - System.currentTimeMillis()); }

    /** Darken the whole screen (also over other apps) by percent 0..80. */
    static void dim(Context ctx, int pct) {
        Context c = ctx.getApplicationContext();
        H.post(() -> {
            WindowManager wm = (WindowManager) c.getSystemService(Context.WINDOW_SERVICE);
            if (pct <= 0) {
                if (dimView != null) try { wm.removeView(dimView); } catch (Throwable ignored) { }
                dimView = null;
                return;
            }
            int alpha = Math.min(80, pct) * 255 / 100;
            if (dimView == null) {
                dimView = new View(c);
                int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
                WindowManager.LayoutParams lp = new WindowManager.LayoutParams(-1, -1, type,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.TRANSLUCENT);
                try { wm.addView(dimView, lp); } catch (Throwable t) { dimView = null; return; }
            }
            dimView.setBackgroundColor(Color.argb(alpha, 0, 0, 0));
        });
    }
}
