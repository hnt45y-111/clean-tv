package com.cleantv.launcher;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.VideoSize;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * «قنواتي»: full-screen live player. Up / down (or channel up / down) switches the channel, OK shows the info bar again,
 * Back returns to the launcher. The info bar (logo, name, quality) runs edge to edge along the bottom and hides 4 seconds
 * after the channel starts playing. ExoPlayer plays every kind of HLS stream the same on every TV box.
 */
public class LiveActivity extends Activity {
    private static final int INK = Color.parseColor("#15181B"), IVORY = Color.parseColor("#EFE7D4"), COPPER = Color.parseColor("#D9822B"), CHROME = Color.parseColor("#B8BDC2");
    private final List<String> names = new ArrayList<>(), urls = new ArrayList<>(), ids = new ArrayList<>(), subs = new ArrayList<>();
    private int idx, failed;
    private ExoPlayer player;
    private LinearLayout panel;
    private FrameLayout logoBox;
    private ImageView logo;
    private TextView mono, nameV, subV, qualV, numV, state;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable hide = new Runnable() { public void run() { panel.animate().alpha(0f).setDuration(350).withEndAction(new Runnable() { public void run() { panel.setVisibility(View.GONE); } }).start(); } };
    private float d;

    private int dp(int v) { return Math.round(v * d); }

    private TextView tv(float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setTextSize(sp); t.setTextColor(color); t.setIncludeFontPadding(false);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        d = getResources().getDisplayMetrics().density;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        try {
            JSONArray a = new JSONArray(getIntent().getStringExtra("list"));
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                names.add(o.optString("n")); urls.add(o.optString("u")); ids.add(o.optString("i")); subs.add(o.optString("s"));
            }
        } catch (Throwable t) { finish(); return; }
        idx = Math.max(0, Math.min(urls.size() - 1, getIntent().getIntExtra("idx", 0)));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        SurfaceView sv = new SurfaceView(this);
        root.addView(sv, new FrameLayout.LayoutParams(-1, -1));

        state = tv(24, IVORY, false);
        state.setGravity(Gravity.CENTER);
        root.addView(state, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER));

        // the info bar: a copper line on top, then ink; right edge to left edge
        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        View line = new View(this); line.setBackgroundColor(COPPER);
        panel.addView(line, new LinearLayout.LayoutParams(-1, dp(5)));
        View line2 = new View(this); line2.setBackgroundColor(CHROME);
        panel.addView(line2, new LinearLayout.LayoutParams(-1, dp(1)));
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setBackgroundColor(Color.parseColor("#F215181B"));
        row.setPadding(dp(32), dp(18), dp(32), dp(22));
        panel.addView(row, new LinearLayout.LayoutParams(-1, -2));

        logoBox = new FrameLayout(this);
        GradientDrawable lb = new GradientDrawable(); lb.setColor(IVORY); lb.setCornerRadius(dp(10));
        logoBox.setBackground(lb);
        mono = tv(30, INK, true); mono.setGravity(Gravity.CENTER);
        logoBox.addView(mono, new FrameLayout.LayoutParams(-1, -1));
        logo = new ImageView(this); logo.setScaleType(ImageView.ScaleType.FIT_CENTER); logo.setPadding(dp(8), dp(8), dp(8), dp(8));
        logoBox.addView(logo, new FrameLayout.LayoutParams(-1, -1));
        LinearLayout.LayoutParams llp = new LinearLayout.LayoutParams(dp(96), dp(96));
        llp.setMarginEnd(dp(24));
        row.addView(logoBox, llp);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        nameV = tv(34, IVORY, true);
        subV = tv(18, CHROME, false);
        col.addView(nameV);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(-2, -2); sp.topMargin = dp(6);
        col.addView(subV, sp);
        row.addView(col, new LinearLayout.LayoutParams(0, -2, 1f));

        qualV = tv(20, INK, true);
        GradientDrawable qb = new GradientDrawable(); qb.setColor(COPPER); qb.setCornerRadius(dp(6));
        qualV.setBackground(qb); qualV.setPadding(dp(16), dp(8), dp(16), dp(8)); qualV.setText("…");
        LinearLayout.LayoutParams ql = new LinearLayout.LayoutParams(-2, -2); ql.setMarginStart(dp(20));
        row.addView(qualV, ql);
        numV = tv(30, IVORY, true);
        LinearLayout.LayoutParams nl = new LinearLayout.LayoutParams(-2, -2); nl.setMarginStart(dp(28));
        row.addView(numV, nl);

        FrameLayout.LayoutParams pl = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM);
        root.addView(panel, pl);
        setContentView(root);

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setAllowCrossProtocolRedirects(true).setConnectTimeoutMs(12000).setReadTimeoutMs(12000)
                .setUserAgent("Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Safari/537.36");
        player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(this).setDataSourceFactory(http)).build();
        player.setVideoSurfaceView(sv);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int s) {
                if (s == Player.STATE_BUFFERING) state.setText("جاري التحميل…");
                else if (s == Player.STATE_READY) {
                    state.setText(""); failed = 0;
                    // the bar stays 4 seconds after the picture starts, then goes away
                    h.removeCallbacks(hide); h.postDelayed(hide, 4000);
                }
            }
            @Override public void onVideoSizeChanged(VideoSize v) {
                int hgt = v.height;
                if (hgt <= 0) return;
                qualV.setText(hgt >= 2000 ? "4K · " + hgt + "p" : hgt >= 1000 ? "FHD · " + hgt + "p" : hgt >= 700 ? "HD · " + hgt + "p" : "SD · " + hgt + "p");
            }
            @Override public void onPlayerError(PlaybackException e) {
                failed++;
                state.setText("هذي القناة ما اشتغلت الآن. جرّب قناة ثانية بالأسهم");
                showPanel(8000);
                if (failed < 2) h.postDelayed(new Runnable() { public void run() { play(idx); } }, 2500);
            }
        });
        play(idx);
    }

    private void showPanel(long ms) {
        h.removeCallbacks(hide);
        panel.animate().cancel();
        panel.setAlpha(1f);
        panel.setVisibility(View.VISIBLE);
        if (ms > 0) h.postDelayed(hide, ms);
    }

    private void play(int i) {
        if (urls.isEmpty()) return;
        idx = (i + urls.size()) % urls.size();
        String n = names.get(idx);
        nameV.setText(n);
        subV.setText(subs.get(idx));
        qualV.setText("…");
        numV.setText((idx + 1) + " / " + urls.size());
        mono.setText(n.replaceFirst("^ال", "").replace(" ", "").substring(0, Math.min(2, n.replaceFirst("^ال", "").replace(" ", "").length())));
        logo.setImageBitmap(null);
        String id = ids.get(idx);
        if (id != null && id.length() > 0) {
            try (InputStream in = getAssets().open("logos/" + id + ".png")) { logo.setImageBitmap(BitmapFactory.decodeStream(in)); } catch (Throwable ignored) { }
        }
        showPanel(0);          // stays until the picture is playing, then 4 more seconds
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
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER: showPanel(4000); return true;
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
