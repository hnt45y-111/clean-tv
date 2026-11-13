package com.cleantv.launcher;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;

/** Adhan playback (with audio focus so other apps pause or duck) and Quran streaming. */
public class Media {

    // ---------------- Adhan ----------------
    private static MediaPlayer adhan;
    private static AudioFocusRequest adhanFocus;
    static Runnable onAdhanEnd;

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences("cleantv", Context.MODE_PRIVATE);
    }

    static void playAdhan(Context ctx) {
        final Context c = ctx.getApplicationContext();
        SharedPreferences p = prefs(c);
        String mode = p.getString("adhanMode", "sound");      // sound | banner | off
        String focus = p.getString("adhanFocus", "pause");     // pause | duck
        String file = p.getString("adhanFile", "");
        if (!"sound".equals(mode)) return;
        stopAdhan(c);
        try {
            final AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
            int gain = "duck".equals(focus) ? AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK : AudioManager.AUDIOFOCUS_GAIN_TRANSIENT;
            if (Build.VERSION.SDK_INT >= 26) {
                adhanFocus = new AudioFocusRequest.Builder(gain).setAudioAttributes(attrs).build();
                am.requestAudioFocus(adhanFocus);
            } else {
                am.requestAudioFocus(null, AudioManager.STREAM_ALARM, gain);
            }
            MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(attrs);
            if (file != null && file.length() > 0 && new java.io.File(file).exists()) {
                mp.setDataSource(file);
            } else {
                android.net.Uri u = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
                if (u == null) u = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM);
                mp.setDataSource(c, u);
            }
            mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer m) { stopAdhan(c); Runnable r = onAdhanEnd; if (r != null) r.run(); }
            });
            mp.prepare();
            mp.start();
            adhan = mp;
        } catch (Throwable t) {
            stopAdhan(c);
        }
    }

    static void stopAdhan(Context ctx) {
        Context c = ctx.getApplicationContext();
        if (adhan != null) {
            try { adhan.stop(); } catch (Throwable ignored) { }
            try { adhan.release(); } catch (Throwable ignored) { }
            adhan = null;
        }
        try {
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            if (Build.VERSION.SDK_INT >= 26 && adhanFocus != null) am.abandonAudioFocusRequest(adhanFocus);
            else am.abandonAudioFocus(null);
        } catch (Throwable ignored) { }
        adhanFocus = null;
        Overlay.hideBanner(c);
    }

    static boolean adhanPlaying() { return adhan != null; }

    // ---------------- Quran ----------------
    private static MediaPlayer quran;
    static volatile String quranTitle = "";
    static volatile String quranState = "stopped"; // stopped | loading | playing | paused | ended | error
    static Runnable onQuranEnd;

    static void quranPlay(Context ctx, String url, String title) {
        quranStop();
        quranTitle = title;
        quranState = "loading";
        try {
            MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            mp.setDataSource(url);
            mp.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override
                public void onPrepared(MediaPlayer m) { m.start(); quranState = "playing"; }
            });
            mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer m) {
                    quranState = "ended";
                    if (onQuranEnd != null) onQuranEnd.run();
                }
            });
            mp.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override
                public boolean onError(MediaPlayer m, int what, int extra) { quranState = "error"; return true; }
            });
            mp.prepareAsync();
            quran = mp;
        } catch (Throwable t) {
            quranState = "error";
        }
    }

    static void quranToggle() {
        if (quran == null) return;
        try {
            if (quran.isPlaying()) { quran.pause(); quranState = "paused"; }
            else { quran.start(); quranState = "playing"; }
        } catch (Throwable ignored) { }
    }

    static void quranStop() {
        if (quran != null) {
            try { quran.stop(); } catch (Throwable ignored) { }
            try { quran.release(); } catch (Throwable ignored) { }
            quran = null;
        }
        quranState = "stopped";
        quranTitle = "";
    }
}
