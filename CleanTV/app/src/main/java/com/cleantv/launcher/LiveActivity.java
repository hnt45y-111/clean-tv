package com.cleantv.launcher;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.SurfaceView;
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

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * «قنواتي»: full-screen live player. Up / down (or channel up / down) switches the channel, OK shows the name,
 * Back returns to the launcher. Uses ExoPlayer so HLS streams play the same on every TV box.
 */
public class LiveActivity extends Activity {
    private final List<String> names = new ArrayList<>();
    private final List<String> urls = new ArrayList<>();
    private int idx;
    private ExoPlayer player;
    private TextView label, state;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable hide = new Runnable() { public void run() { label.setVisibility(View.GONE); } };
    private int failed;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        try {
            JSONArray a = new JSONArray(getIntent().getStringExtra("list"));
            for (int i = 0; i < a.length(); i++) { JSONObject o = a.getJSONObject(i); names.add(o.optString("n")); urls.add(o.optString("u")); }
        } catch (Throwable t) { finish(); return; }
        idx = Math.max(0, Math.min(urls.size() - 1, getIntent().getIntExtra("idx", 0)));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        SurfaceView sv = new SurfaceView(this);
        root.addView(sv, new FrameLayout.LayoutParams(-1, -1));
        label = new TextView(this);
        label.setTextColor(Color.parseColor("#EFE7D4"));
        label.setTextSize(28);
        label.setTypeface(Typeface.DEFAULT_BOLD);
        label.setPadding(48, 22, 48, 22);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#E615181B"));
        bg.setCornerRadius(16);
        bg.setStroke(3, Color.parseColor("#D9822B"));
        label.setBackground(bg);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.RIGHT);
        lp.setMargins(48, 48, 48, 0);
        root.addView(label, lp);
        state = new TextView(this);
        state.setTextColor(Color.parseColor("#EFE7D4"));
        state.setTextSize(26);
        state.setGravity(Gravity.CENTER);
        root.addView(state, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER));
        setContentView(root);

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setAllowCrossProtocolRedirects(true).setConnectTimeoutMs(12000).setReadTimeoutMs(12000)
                .setUserAgent("Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Safari/537.36");
        player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(this).setDataSourceFactory(http)).build();
        player.setVideoSurfaceView(sv);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int s) {
                if (s == Player.STATE_BUFFERING) state.setText("جاري التحميل…");
                else if (s == Player.STATE_READY) { state.setText(""); failed = 0; }
            }
            @Override public void onPlayerError(PlaybackException e) {
                failed++;
                state.setText("هذي القناة ما اشتغلت الآن. جرّب قناة ثانية بالأسهم");
                if (failed < 2) h.postDelayed(new Runnable() { public void run() { play(idx); } }, 2500);
            }
        });
        play(idx);
    }

    private void play(int i) {
        if (urls.isEmpty()) return;
        idx = (i + urls.size()) % urls.size();
        label.setText(names.get(idx));
        label.setVisibility(View.VISIBLE);
        h.removeCallbacks(hide);
        h.postDelayed(hide, 4000);
        state.setText("جاري التحميل…");
        player.setMediaItem(MediaItem.fromUri(urls.get(idx)));
        player.prepare();
        player.setPlayWhenReady(true);
    }

    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP: case KeyEvent.KEYCODE_CHANNEL_UP: case KeyEvent.KEYCODE_PAGE_UP: failed = 0; play(idx - 1); return true;
            case KeyEvent.KEYCODE_DPAD_DOWN: case KeyEvent.KEYCODE_CHANNEL_DOWN: case KeyEvent.KEYCODE_PAGE_DOWN: failed = 0; play(idx + 1); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER:
                label.setVisibility(View.VISIBLE); h.removeCallbacks(hide); h.postDelayed(hide, 4000); return true;
            case KeyEvent.KEYCODE_BACK: finish(); return true;
            default: return super.onKeyDown(code, e);
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) { player.release(); player = null; }
        h.removeCallbacksAndMessages(null);
        finish();
    }
}
