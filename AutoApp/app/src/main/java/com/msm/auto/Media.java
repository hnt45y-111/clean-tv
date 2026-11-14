package com.msm.auto;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.media.MediaMetadata;
import android.media.browse.MediaBrowser;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.provider.Settings;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.List;

/** The music playing on the phone (any app): what it is, and play / pause / next / previous. */
final class Media {
    private static String artKey = "", artData = "";
    private static MediaBrowser browser;

    private Media() { }

    static boolean allowed(Context c) {
        String s = Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
        return s != null && s.contains(c.getPackageName());
    }

    private static List<MediaController> sessions(Context c) {
        MediaSessionManager m = c.getSystemService(MediaSessionManager.class);
        return m.getActiveSessions(new ComponentName(c, MediaListener.class));
    }

    static MediaController current(Context c) {
        try {
            List<MediaController> l = sessions(c);
            for (MediaController m : l) {
                PlaybackState st = m.getPlaybackState();
                if (st != null && st.getState() == PlaybackState.STATE_PLAYING) return m;
            }
            return l.isEmpty() ? null : l.get(0);
        } catch (Throwable e) { return null; }
    }

    static String label(Context c, String pkg) {
        try { PackageManager pm = c.getPackageManager(); return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString(); }
        catch (Throwable e) { return pkg; }
    }

    static String png(Bitmap b, int size, boolean jpg) {
        if (b == null) return "";
        Bitmap s = Bitmap.createScaledBitmap(b, size, size * b.getHeight() / Math.max(1, b.getWidth()), true);
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        s.compress(jpg ? Bitmap.CompressFormat.JPEG : Bitmap.CompressFormat.PNG, 82, o);
        return "data:image/" + (jpg ? "jpeg" : "png") + ";base64," + Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP);
    }

    static String icon(Context c, String pkg) {
        try {
            Drawable d = c.getPackageManager().getApplicationIcon(pkg);
            Bitmap b = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888);
            Canvas cv = new Canvas(b); d.setBounds(0, 0, 96, 96); d.draw(cv);
            return png(b, 96, false);
        } catch (Throwable e) { return ""; }
    }

    static JSONObject now(Context c) {
        JSONObject r = new JSONObject();
        try {
            if (!allowed(c)) return r.put("perm", false);
            MediaController m = current(c);
            if (m == null) return r.put("perm", true).put("none", true);
            MediaMetadata md = m.getMetadata();
            PlaybackState st = m.getPlaybackState();
            String t = md == null ? "" : String.valueOf(md.getText(MediaMetadata.METADATA_KEY_TITLE));
            String a = md == null ? "" : String.valueOf(md.getText(MediaMetadata.METADATA_KEY_ARTIST));
            if ("null".equals(t)) t = ""; if ("null".equals(a)) a = "";
            String key = m.getPackageName() + "|" + t + "|" + a;
            if (!key.equals(artKey)) {
                artKey = key; artData = "";
                if (md != null) {
                    Bitmap art = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
                    if (art == null) art = md.getBitmap(MediaMetadata.METADATA_KEY_ART);
                    if (art == null) art = md.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
                    artData = png(art, 320, true);
                }
            }
            long pos = st == null ? 0 : st.getPosition(), dur = md == null ? 0 : md.getLong(MediaMetadata.METADATA_KEY_DURATION);
            return r.put("perm", true).put("title", t).put("artist", a).put("app", label(c, m.getPackageName()))
                    .put("pkg", m.getPackageName()).put("art", artData).put("pos", pos).put("dur", dur)
                    .put("playing", st != null && st.getState() == PlaybackState.STATE_PLAYING);
        } catch (Throwable e) { try { r.put("perm", true).put("none", true); } catch (Exception ignored) { } return r; }
    }

    static void cmd(Context c, String k) {
        MediaController m = current(c);
        if (m == null) return;
        MediaController.TransportControls t = m.getTransportControls();
        PlaybackState st = m.getPlaybackState();
        switch (k) {
            case "prev": t.skipToPrevious(); break;
            case "next": t.skipToNext(); break;
            default:
                if (st != null && st.getState() == PlaybackState.STATE_PLAYING) t.pause(); else t.play();
        }
    }

    /** start a music app: if it already has a session press play, otherwise connect to its media service and play */
    static void playApp(Context c, String pkg) {
        try {
            for (MediaController m : sessions(c)) if (pkg.equals(m.getPackageName())) { m.getTransportControls().play(); return; }
        } catch (Throwable ignored) { }
        List<ResolveInfo> l = c.getPackageManager().queryIntentServices(new Intent("android.media.browse.MediaBrowserService").setPackage(pkg), 0);
        if (l.isEmpty()) return;
        if (browser != null) try { browser.disconnect(); } catch (Throwable ignored) { }
        final Context ac = c.getApplicationContext();
        final MediaBrowser[] holder = new MediaBrowser[1];
        holder[0] = new MediaBrowser(ac, new ComponentName(pkg, l.get(0).serviceInfo.name), new MediaBrowser.ConnectionCallback() {
            @Override public void onConnected() {
                try { new MediaController(ac, holder[0].getSessionToken()).getTransportControls().play(); } catch (Throwable ignored) { }
            }
        }, null);
        browser = holder[0];
        browser.connect();
    }

    static JSONArray apps(Context c) {
        JSONArray a = new JSONArray();
        java.util.HashSet<String> seen = new java.util.HashSet<>();
        for (ResolveInfo ri : c.getPackageManager().queryIntentServices(new Intent("android.media.browse.MediaBrowserService"), 0)) {
            String p = ri.serviceInfo.packageName;
            if (!seen.add(p) || p.equals(c.getPackageName())) continue;
            try { a.put(new JSONObject().put("pkg", p).put("label", label(c, p)).put("icon", icon(c, p))); } catch (Exception ignored) { }
        }
        return a;
    }
}
