package com.cleantv.mobile;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Rational;
import android.view.Gravity;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.PlayerView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The touch player. Live: tap shows the name and the buttons, swipe up or down changes the channel. A film or episode: the normal
 * controller with a seek bar, and it remembers where it stopped. After the user's quiet hour at night the sound drops and the
 * subtitles grow. Leaving the screen keeps the picture in a small window.
 */
public class PlayerActivity extends Activity {
    static volatile String PACK = null;
    private final List<String> names = new ArrayList<>(), urls = new ArrayList<>(), uas = new ArrayList<>(), refs = new ArrayList<>();
    private ExoPlayer player;
    private PlayerView pv;
    private DefaultHttpDataSource.Factory http;
    private TextView title, prev, next, state;
    private int idx, failed;
    private boolean vod;
    private SharedPreferences prefs;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable hideUi = new Runnable() { public void run() { setUi(false); } };
    private final Runnable tick = new Runnable() { public void run() { savePos(); applyQuiet(); h.postDelayed(this, 5000); } };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("mobile", MODE_PRIVATE);
        try {
            JSONObject o = new JSONObject(PACK == null ? "{}" : PACK);
            vod = o.optInt("vod", 0) == 1;
            JSONArray a = o.optJSONArray("list");
            for (int i = 0; a != null && i < a.length(); i++) {
                JSONObject c = a.getJSONObject(i);
                names.add(c.optString("n")); urls.add(c.optString("u")); uas.add(c.optString("ua")); refs.add(c.optString("r"));
            }
        } catch (Throwable t) { finish(); return; }
        if (urls.isEmpty()) { finish(); return; }
        idx = Math.max(0, Math.min(urls.size() - 1, getIntent().getIntExtra("idx", 0)));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        pv = new PlayerView(this);
        pv.setUseController(vod);
        pv.setControllerShowTimeoutMs(3500);
        pv.setKeepContentOnPlayerReset(true);
        root.addView(pv, new FrameLayout.LayoutParams(-1, -1));

        state = label(22, false); state.setGravity(Gravity.CENTER);
        root.addView(state, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER));
        title = label(20, true); title.setPadding(dp(18), dp(14), dp(18), dp(14)); title.setBackgroundColor(Color.parseColor("#99000000"));
        root.addView(title, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
        if (!vod) {
            prev = label(46, true); prev.setText("‹"); next = label(46, true); next.setText("›");
            for (TextView t : new TextView[]{ prev, next }) { t.setPadding(dp(22), dp(10), dp(22), dp(14)); t.setBackgroundColor(Color.parseColor("#66000000")); }
            root.addView(prev, new FrameLayout.LayoutParams(-2, -2, Gravity.START | Gravity.CENTER_VERTICAL));
            root.addView(next, new FrameLayout.LayoutParams(-2, -2, Gravity.END | Gravity.CENTER_VERTICAL));
            prev.setOnClickListener(v -> { zap(-1); showUi(); });
            next.setOnClickListener(v -> { zap(1); showUi(); });
        }
        title.setOnClickListener(v -> finish());
        final GestureDetector gd = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onSingleTapUp(MotionEvent e) { if (!vod) showUi(); return false; }
            @Override public boolean onFling(MotionEvent a, MotionEvent c, float vx, float vy) {
                if (vod || a == null || c == null) return false;
                float dy = c.getY() - a.getY();
                if (Math.abs(dy) > dp(90) && Math.abs(dy) > Math.abs(c.getX() - a.getX()) * 1.3f) { zap(dy < 0 ? 1 : -1); showUi(); return true; }
                return false;
            }
        });
        pv.setOnTouchListener((v, e) -> { gd.onTouchEvent(e); return false; });
        setContentView(root);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);

        http = new DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true).setConnectTimeoutMs(12000).setReadTimeoutMs(15000);
        player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(this).setDataSourceFactory(http)).build();
        pv.setPlayer(player);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int s) {
                if (s == Player.STATE_BUFFERING) state.setText("جاري التحميل…");
                else if (s == Player.STATE_READY) { state.setText(""); failed = 0; h.removeCallbacks(hideUi); h.postDelayed(hideUi, 3500); }
            }
            @Override public void onPlayerError(PlaybackException e) {
                failed++;
                state.setText("ما اشتغلت هذي (" + (e.getMessage() == null ? "خطأ" : e.getMessage().replaceAll("\\s+", " ")) + ")" + (vod ? "" : " · اسحب لقناة ثانية"));
                setUi(true);
                if (failed < 2) h.postDelayed(() -> play(idx), 2500);
            }
        });
        play(idx);
        h.postDelayed(tick, 5000);
    }

    private TextView label(int sp, boolean bold) {
        TextView t = new TextView(this);
        t.setTextSize(sp); t.setTextColor(Color.parseColor("#EFE7D4")); t.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        t.setShadowLayer(6, 0, 2, Color.BLACK);
        return t;
    }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private void setUi(boolean on) {
        int vis = on ? View.VISIBLE : View.GONE;
        title.setVisibility(vod && !on ? View.GONE : vis);
        if (prev != null) { prev.setVisibility(vis); next.setVisibility(vis); }
    }
    private void showUi() { setUi(true); h.removeCallbacks(hideUi); h.postDelayed(hideUi, 3500); }

    private void zap(int d) { failed = 0; play((idx + d + urls.size()) % urls.size()); }

    private String vodKey(String u) { return "vodPos|" + u.hashCode(); }
    private void savePos() {
        if (!vod || player == null || idx >= urls.size()) return;
        try {
            long pos = player.getCurrentPosition(), dur = player.getDuration();
            String k = vodKey(urls.get(idx));
            if (pos > 4000 && (dur <= 0 || pos < dur - 15000)) prefs.edit().putString(k, String.valueOf(pos)).apply();
            else prefs.edit().remove(k).apply();
        } catch (Throwable ignored) { }
    }

    private void play(int i) {
        savePos();
        idx = i;
        title.setText(names.get(idx));
        Map<String, String> hd = new HashMap<>();
        if (refs.get(idx).length() > 0) hd.put("Referer", refs.get(idx));
        http.setDefaultRequestProperties(hd);
        http.setUserAgent(uas.get(idx).length() > 0 ? uas.get(idx) : "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
        state.setText("جاري التحميل…"); setUi(true);
        player.setMediaItem(MediaItem.fromUri(urls.get(idx)));
        player.prepare();
        if (vod) {
            try { long saved = Long.parseLong(prefs.getString(vodKey(urls.get(idx)), "0")); if (saved > 4000) { player.seekTo(saved); state.setText("إكمال من حيث وقفت…"); } } catch (Throwable ignored) { }
        }
        player.setPlayWhenReady(true);
        applyQuiet();
    }

    /** after the user's quiet hour at night the sound drops by itself */
    private void applyQuiet() {
        try {
            boolean on = "1".equals(prefs.getString("quietOn", "0"));
            int from = Integer.parseInt(prefs.getString("quietHour", "23")), to = Integer.parseInt(prefs.getString("quietEndHour", "7"));
            int hr = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
            boolean quiet = on && (from <= to ? (hr >= from && hr < to) : (hr >= from || hr < to));
            if (player != null) player.setVolume(quiet ? 0.45f : 1f);
            if (pv != null && pv.getSubtitleView() != null) pv.getSubtitleView().setFractionalTextSize(quiet ? 0.0533f * 1.6f : 0.0533f);
        } catch (Throwable ignored) { }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (android.os.Build.VERSION.SDK_INT >= 26) { try { enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9)).build()); } catch (Throwable ignored) { } }
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (android.os.Build.VERSION.SDK_INT >= 24 && isInPictureInPictureMode()) return;
        stopAll();
    }
    @Override
    protected void onDestroy() { super.onDestroy(); stopAll(); }
    private void stopAll() {
        savePos(); h.removeCallbacksAndMessages(null);
        if (player != null) { player.release(); player = null; }
        if (!isFinishing()) finish();
    }
}
