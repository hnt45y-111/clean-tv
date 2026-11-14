package com.cleantv.launcher;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

/** Power actions, remote D-pad, idle tracking for the screensaver over other apps. */
public class PowerService extends AccessibilityService {
    static volatile PowerService instance;
    static volatile long lastInput = System.currentTimeMillis();
    static volatile String foregroundPkg = "";
    private final Handler h = new Handler(Looper.getMainLooper());

    private final Runnable watcher = new Runnable() {
        @Override
        public void run() {
            try { checkIdle(); } catch (Throwable ignored) { }
            try { DeviceTools.usageTick(PowerService.this, null); } catch (Throwable ignored) { }
            h.postDelayed(this, 20000);
        }
    };

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        lastInput = System.currentTimeMillis();
        h.removeCallbacks(watcher);
        h.postDelayed(watcher, 20000);
    }

    @Override
    public void onDestroy() {
        h.removeCallbacks(watcher);
        instance = null;
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && event.getPackageName() != null) {
            String p = event.getPackageName().toString();
            if (!p.equals("android") && !p.startsWith("com.android.systemui")) {
                foregroundPkg = p;
                DeviceTools.usageTick(this, p);
                DeviceTools.guard(this, p);
            }
        }
    }

    @Override
    protected boolean onKeyEvent(KeyEvent event) {
        lastInput = System.currentTimeMillis();
        // Some TVs send the Home button straight to their own launcher; catch it and open ours instead.
        if (event.getKeyCode() == KeyEvent.KEYCODE_HOME && !"0".equals(Media.prefs(this).getString("homeGuard", "1"))) {
            if (event.getAction() == KeyEvent.ACTION_UP) {
                try {
                    Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).setPackage(getPackageName())
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(i);
                } catch (Throwable t) {
                    try { startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)); } catch (Throwable ignored) { }
                }
            }
            return true;
        }
        return false;
    }

    @Override
    public void onInterrupt() { }

    private void checkIdle() {
        if (!"1".equals(Media.prefs(this).getString("saverApps", "1"))) return;
        int mins = 10;
        try { mins = Integer.parseInt(Media.prefs(this).getString("saverMin", "10")); } catch (Throwable ignored) { }
        long idle = System.currentTimeMillis() - lastInput;
        if (idle < mins * 60000L) return;
        if (SaverActivity.showing || MainActivity.foreground) return;
        if (getPackageName().equals(foregroundPkg)) return;
        if (mediaPlaying(this, foregroundPkg)) { lastInput = System.currentTimeMillis() - mins * 60000L + 60000L; return; }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null && !pm.isInteractive()) return;
        try {
            Intent i = new Intent(this, SaverActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Throwable ignored) { }
    }

    /* never cover a film or video: Netflix/YouTube on TVs often send sound in a way isMusicActive() does not see,
       so also check the playing media sessions, the active players, and whether a video app is on screen */
    private static final String[] VIDEO_PKGS = { "netflix", "youtube", "shahid", "osn", "starz", "disney", "primevideo", "amazon.avod", "hulu", "hbo",
            "kodi", "xbmc", "vlc", "mxtech", "mx.player", "videoplayer", "video", "player", "iptv", "smarters", "tivimate", "perfectplayer", "ott",
            "stream", "movie", "cinema", "tv.player", "livetv", "anghami", "spotify", "plex", "jellyfin", "emby", "twitch", "tiktok", "weyyak", "tod", "bein",
            "android.tv.settings.hdmi", "tvinput", "hdmi", "atv", "dtv", "livechannels" };

    static boolean mediaPlaying(Context c, String fg) {
        try {
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            if (am != null && am.isMusicActive()) return true;
            if (am != null && Build.VERSION.SDK_INT >= 26) {
                for (android.media.AudioPlaybackConfiguration pc : am.getActivePlaybackConfigurations()) {
                    int u = pc.getAudioAttributes().getUsage();
                    if (u == android.media.AudioAttributes.USAGE_MEDIA || u == android.media.AudioAttributes.USAGE_GAME || u == android.media.AudioAttributes.USAGE_UNKNOWN) return true;
                }
            }
        } catch (Throwable ignored) { }
        try {
            android.media.session.MediaSessionManager msm = (android.media.session.MediaSessionManager) c.getSystemService(Context.MEDIA_SESSION_SERVICE);
            if (msm != null) {
                for (android.media.session.MediaController mc : msm.getActiveSessions(new android.content.ComponentName(c, MediaListener.class))) {
                    android.media.session.PlaybackState ps = mc.getPlaybackState();
                    if (ps != null && (ps.getState() == android.media.session.PlaybackState.STATE_PLAYING || ps.getState() == android.media.session.PlaybackState.STATE_BUFFERING)) return true;
                }
            }
        } catch (Throwable ignored) { } // needs «معلومات الموسيقى» allowed; without it the other checks still work
        String p = fg == null ? "" : fg.toLowerCase(java.util.Locale.ROOT);
        if (!p.isEmpty()) for (String v : VIDEO_PKGS) if (p.contains(v)) return true;
        return false;
    }

    static boolean sleep() {
        PowerService s = instance;
        if (s == null) return false;
        if (Build.VERSION.SDK_INT >= 28) return s.performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN);
        return s.performGlobalAction(GLOBAL_ACTION_POWER_DIALOG);
    }

    static boolean powerDialog() {
        PowerService s = instance;
        if (s == null) return false;
        return s.performGlobalAction(GLOBAL_ACTION_POWER_DIALOG);
    }

    /** Remote keys: up/down/left/right/ok/back/home. */
    static boolean key(String k) {
        PowerService s = instance;
        if (s == null) return false;
        lastInput = System.currentTimeMillis();
        int a;
        if ("back".equals(k)) a = GLOBAL_ACTION_BACK;
        else if ("home".equals(k)) a = GLOBAL_ACTION_HOME;
        else if (Build.VERSION.SDK_INT >= 33) {
            if ("up".equals(k)) a = GLOBAL_ACTION_DPAD_UP;
            else if ("down".equals(k)) a = GLOBAL_ACTION_DPAD_DOWN;
            else if ("left".equals(k)) a = GLOBAL_ACTION_DPAD_LEFT;
            else if ("right".equals(k)) a = GLOBAL_ACTION_DPAD_RIGHT;
            else if ("ok".equals(k)) a = GLOBAL_ACTION_DPAD_CENTER;
            else return false;
        } else return s.focusMove(k);
        return s.performGlobalAction(a);
    }

    /** Before Android 13 there is no D-pad global action: move the focus through the window's views instead. */
    private boolean focusMove(String k) {
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return false;
            AccessibilityNodeInfo f = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            if (f == null) f = root.findFocus(AccessibilityNodeInfo.FOCUS_ACCESSIBILITY);
            if ("ok".equals(k)) {
                AccessibilityNodeInfo n = f;
                while (n != null && !n.isClickable()) n = n.getParent();
                return n != null && n.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            }
            int dir = "up".equals(k) ? android.view.View.FOCUS_UP : "down".equals(k) ? android.view.View.FOCUS_DOWN : "left".equals(k) ? android.view.View.FOCUS_LEFT : android.view.View.FOCUS_RIGHT;
            if (f == null) {
                AccessibilityNodeInfo first = firstFocusable(root);
                return first != null && first.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
            }
            AccessibilityNodeInfo next = f.focusSearch(dir);
            return next != null && next.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
        } catch (Throwable t) { return false; }
    }

    private static AccessibilityNodeInfo firstFocusable(AccessibilityNodeInfo n) {
        if (n == null) return null;
        if (n.isFocusable() && n.isVisibleToUser()) return n;
        for (int i = 0; i < n.getChildCount(); i++) { AccessibilityNodeInfo r = firstFocusable(n.getChild(i)); if (r != null) return r; }
        return null;
    }

    /** Type text into the focused field of whatever app is on screen. */
    static boolean setText(String text, boolean submit) {
        PowerService s = instance;
        if (s == null) return false;
        try {
            AccessibilityNodeInfo root = s.getRootInActiveWindow();
            if (root == null) return false;
            AccessibilityNodeInfo f = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            if (f == null || !f.isEditable()) return false;
            Bundle b = new Bundle();
            b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
            boolean ok = f.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b);
            if (submit && Build.VERSION.SDK_INT >= 30) f.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.getId());
            return ok;
        } catch (Throwable t) {
            return false;
        }
    }
}
