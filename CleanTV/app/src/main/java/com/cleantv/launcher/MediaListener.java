package com.cleantv.launcher;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.service.notification.NotificationListenerService;
import android.util.Base64;
import android.view.KeyEvent;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.List;

/** Lets the launcher read what is playing (song, artist, cover) and control it. Enabled over ADB by the phone app. */
public class MediaListener extends NotificationListenerService {

    /* ---- fallbacks for players that don't publish a media session (car Bluetooth music on many head units) ---- */
    private static volatile String fTitle = "", fArtist = "", fApp = "", fPkg = "";
    private static volatile long fAt = 0;
    private static volatile Boolean fPlaying = null;
    private static boolean metaReg;

    private static void fallback(String title, String artist, String app, String pkg, Boolean playing) {
        if (title == null || title.trim().isEmpty()) return;
        fTitle = title.trim(); fArtist = artist == null ? "" : artist.trim(); fApp = app == null ? "" : app; fPkg = pkg == null ? "" : pkg;
        fPlaying = playing; fAt = System.currentTimeMillis();
    }

    /** Old-style "metachanged" broadcasts that many players and Bluetooth apps still send. */
    static synchronized void registerMeta(Context c) {
        if (metaReg) return; metaReg = true;
        try {
            android.content.IntentFilter f = new android.content.IntentFilter();
            String[] acts = {"com.android.music.metachanged", "com.android.music.playstatechanged", "com.android.music.queuechanged",
                    "com.htc.music.metachanged", "com.sec.android.app.music.metachanged", "com.miui.player.metachanged", "com.real.IMP.metachanged",
                    "com.sonyericsson.music.metachanged", "com.andrew.apollo.metachanged", "com.amazon.mp3.metachanged", "fm.last.android.metachanged",
                    "com.spotify.music.metadatachanged", "com.spotify.music.playbackstatechanged", "com.maxmpz.audioplayer.TRACK_CHANGED",
                    "android.bluetooth.a2dp-sink.profile.action.PLAYING_STATE_CHANGED", "android.bluetooth.avrcp-controller.profile.action.TRACK_EVENT",
                    "com.syu.bt.music.info", "com.syu.music.info", "com.microntek.music.report", "com.fyt.bt.music"};
            for (String a : acts) f.addAction(a);
            android.content.BroadcastReceiver r = new android.content.BroadcastReceiver() {
                @Override public void onReceive(Context x, android.content.Intent i) {
                    try {
                        android.os.Bundle e = i.getExtras(); if (e == null) return;
                        String t = str(e, "track", "title", "name", "song", "android.media.metadata.TITLE");
                        String ar = str(e, "artist", "singer", "android.media.metadata.ARTIST");
                        Boolean pl = e.containsKey("playing") ? Boolean.valueOf(e.getBoolean("playing")) : e.containsKey("isPlaying") ? Boolean.valueOf(e.getBoolean("isPlaying")) : null;
                        Object md = e.get("android.bluetooth.avrcp-controller.profile.extra.METADATA");
                        if (md instanceof MediaMetadata) { t = ((MediaMetadata) md).getString(MediaMetadata.METADATA_KEY_TITLE); ar = ((MediaMetadata) md).getString(MediaMetadata.METADATA_KEY_ARTIST); }
                        boolean bt = i.getAction() != null && (i.getAction().contains("bluetooth") || i.getAction().contains(".bt"));
                        if (t != null && !t.isEmpty()) fallback(t, ar, bt ? "البلوتوث" : "", "", pl);
                        else if (pl != null && fAt > 0) fPlaying = pl;
                    } catch (Throwable ignored) { }
                }
            };
            if (android.os.Build.VERSION.SDK_INT >= 33) c.getApplicationContext().registerReceiver(r, f, Context.RECEIVER_EXPORTED);
            else c.getApplicationContext().registerReceiver(r, f);
        } catch (Throwable ignored) { }
    }

    private static String str(android.os.Bundle e, String... keys) {
        for (String k : keys) { Object v = e.get(k); if (v != null && !String.valueOf(v).trim().isEmpty()) return String.valueOf(v); }
        return null;
    }

    @Override public void onNotificationPosted(android.service.notification.StatusBarNotification sbn) {
        try {
            android.app.Notification n = sbn.getNotification(); if (n == null) return;
            android.os.Bundle e = n.extras; if (e == null) return;
            String pkg = sbn.getPackageName();
            boolean media = e.containsKey("android.mediaSession") || android.app.Notification.CATEGORY_TRANSPORT.equals(n.category)
                    || pkg.matches("(?i).*(music|\\.bt|bluetooth|audio|player|a2dp|btmusic).*");
            if (!media) return;
            CharSequence t = e.getCharSequence(android.app.Notification.EXTRA_TITLE), x = e.getCharSequence(android.app.Notification.EXTRA_TEXT);
            if (t == null) return;
            String app = pkg;
            try { PackageManager pm = getPackageManager(); app = pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString(); } catch (Throwable ignored) { }
            fallback(t.toString(), x == null ? "" : x.toString(), app, pkg, null);
        } catch (Throwable ignored) { }
    }

    @Override public void onNotificationRemoved(android.service.notification.StatusBarNotification sbn) {
        try { if (sbn.getPackageName().equals(fPkg)) { fAt = 0; } } catch (Throwable ignored) { }
    }

    private static boolean musicActive(Context c) {
        try { return ((android.media.AudioManager) c.getSystemService(Context.AUDIO_SERVICE)).isMusicActive(); } catch (Throwable t) { return false; }
    }

    private static String fallbackInfo(Context c) {
        JSONObject o = new JSONObject();
        try {
            boolean active = musicActive(c);
            if (fAt > 0 && System.currentTimeMillis() - fAt < 3 * 3600000L) {
                o.put("ok", true).put("title", fTitle).put("artist", fArtist).put("app", fApp).put("pkg", fPkg)
                 .put("playing", fPlaying != null ? fPlaying.booleanValue() : active).put("art", "").put("fb", true);
            } else if (active) {
                o.put("ok", true).put("title", "في صوت شغّال").put("artist", "").put("app", "البلوتوث أو تطبيق ثاني").put("playing", true).put("art", "").put("fb", true);
            } else o.put("ok", false);
        } catch (Throwable ignored) { }
        return o.toString();
    }

    private static MediaController current(Context c) {
        try {
            MediaSessionManager m = (MediaSessionManager) c.getSystemService(Context.MEDIA_SESSION_SERVICE);
            List<MediaController> l = m.getActiveSessions(new ComponentName(c, MediaListener.class));
            MediaController best = null;
            for (MediaController mc : l) {
                PlaybackState st = mc.getPlaybackState();
                if (st != null && st.getState() == PlaybackState.STATE_PLAYING) return mc;
                if (best == null) best = mc;
            }
            return best;
        } catch (Throwable t) { return null; }
    }

    private static String lastArtKey;
    private static String lastArt;

    static String info(Context c) {
        JSONObject o = new JSONObject();
        try {
            MediaController mc = current(c);
            if (mc == null) return fallbackInfo(c);
            MediaMetadata md = mc.getMetadata();
            if (md == null || md.getString(MediaMetadata.METADATA_KEY_TITLE) == null) {
                String fb = fallbackInfo(c);
                if (fb.contains("\"ok\":true")) return fb;
            }
            PlaybackState st = mc.getPlaybackState();
            String app = mc.getPackageName();
            try {
                PackageManager pm = c.getPackageManager();
                app = pm.getApplicationLabel(pm.getApplicationInfo(mc.getPackageName(), 0)).toString();
            } catch (Throwable ignored) { }
            o.put("ok", true).put("pkg", mc.getPackageName()).put("app", app)
                    .put("playing", st != null && st.getState() == PlaybackState.STATE_PLAYING);
            if (md != null) {
                o.put("title", nz(md.getString(MediaMetadata.METADATA_KEY_TITLE)))
                        .put("artist", nz(md.getString(MediaMetadata.METADATA_KEY_ARTIST)))
                        .put("album", nz(md.getString(MediaMetadata.METADATA_KEY_ALBUM)))
                        .put("dur", md.getLong(MediaMetadata.METADATA_KEY_DURATION));
                String key = md.getString(MediaMetadata.METADATA_KEY_TITLE) + "|" + md.getString(MediaMetadata.METADATA_KEY_ALBUM);
                if (!key.equals(lastArtKey)) {
                    lastArtKey = key;
                    lastArt = "";
                    Bitmap b = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
                    if (b == null) b = md.getBitmap(MediaMetadata.METADATA_KEY_ART);
                    if (b != null) {
                        Bitmap s = Bitmap.createScaledBitmap(b, 240, Math.max(1, 240 * b.getHeight() / Math.max(1, b.getWidth())), true);
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        s.compress(Bitmap.CompressFormat.JPEG, 80, out);
                        lastArt = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                    }
                }
                o.put("art", lastArt == null ? "" : lastArt);
            }
            if (st != null) o.put("pos", st.getPosition());
        } catch (Throwable ignored) { }
        return o.toString();
    }

    private static String nz(String s) { return s == null ? "" : s; }

    /** play, pause, toggle, next, prev, stop */
    static boolean control(Context c, String cmd) {
        MediaController mc = current(c);
        if (mc == null) {
            int code = "next".equals(cmd) ? KeyEvent.KEYCODE_MEDIA_NEXT : "prev".equals(cmd) ? KeyEvent.KEYCODE_MEDIA_PREVIOUS
                    : "stop".equals(cmd) ? KeyEvent.KEYCODE_MEDIA_STOP : KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;
            try {
                android.media.AudioManager am = (android.media.AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
                am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));
                am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, code));
                return true;
            } catch (Throwable t) { return false; }
        }
        MediaController.TransportControls t = mc.getTransportControls();
        PlaybackState st = mc.getPlaybackState();
        boolean playing = st != null && st.getState() == PlaybackState.STATE_PLAYING;
        switch (cmd) {
            case "play": t.play(); break;
            case "pause": t.pause(); break;
            case "next": t.skipToNext(); break;
            case "prev": t.skipToPrevious(); break;
            case "stop": t.stop(); break;
            default: if (playing) t.pause(); else t.play();
        }
        return true;
    }
}
