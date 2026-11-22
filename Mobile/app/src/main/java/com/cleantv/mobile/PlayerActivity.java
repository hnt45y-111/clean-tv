package com.cleantv.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PictureInPictureParams;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Rational;
import android.view.Gravity;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;

/**
 * The player (2.0). Everything is shown on a tap and goes away after 4 seconds; a tap brings it back, every time:
 * back and title on top, rewind / pause / forward in the middle, and a card at the bottom with the poster, name, details, audio language,
 * quality, speed, picture size, info, the list and the seek bar. Live: swipe up/down (or the arrows) changes the channel and the list
 * button opens every channel with search and groups. Left side drag = brightness, right side drag = volume, double tap = ±10 s.
 */
public class PlayerActivity extends Activity {
    static volatile String PACK = null;
    private static final int ACCENT = 0xFFFA0023;
    private static final long HIDE_MS = 4000;
    private final List<String> names = new ArrayList<>(), urls = new ArrayList<>(), uas = new ArrayList<>(), refs = new ArrayList<>(), groups = new ArrayList<>(),
        imgs = new ArrayList<>(), descs = new ArrayList<>(), metas = new ArrayList<>();
    private ExoPlayer player;
    private PlayerView pv;
    private DefaultHttpDataSource.Factory http;
    private FrameLayout root, ctl;
    private LinearLayout top, card, drawer, chipRow, qPanel;
    private TextView title, state, hud, cTitle, cMeta, cDesc, tNow, tAll, audioChip, qualChip, speedChip, playBtn, liveBadge;
    private ImageView poster;
    private SeekBar seek;
    private ListView listView;
    private EditText search;
    private BaseAdapter adapter;
    private final List<Integer> shown = new ArrayList<>();
    private final Map<String, Bitmap> bmpCache = new HashMap<>();
    private String groupFilter = "", query = "";
    private int idx, failed, resize, mode;
    private boolean vod, ctlOn, seeking;
    private float speed = 1f, bright = -1f, volAcc;
    private long scrubTo;
    private SharedPreferences prefs;
    private AudioManager am;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable hideRun = new Runnable() { public void run() { hideCtl(); } };
    private final Runnable hideHud = new Runnable() { public void run() { hud.setVisibility(View.GONE); } };
    private final Runnable sleepRun = new Runnable() { public void run() { toast("انتهى مؤقت النوم"); finish(); } };
    private final Runnable tick = new Runnable() { public void run() { savePos(); applyQuiet(); updateTime(); h.postDelayed(this, 500); } };
    private int tickN;

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("mobile", MODE_PRIVATE);
        am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        try {
            JSONObject o = new JSONObject(PACK == null ? "{}" : PACK);
            vod = o.optInt("vod", 0) == 1;
            JSONArray a = o.optJSONArray("list");
            for (int i = 0; a != null && i < a.length(); i++) {
                JSONObject c = a.getJSONObject(i);
                names.add(c.optString("n")); urls.add(c.optString("u")); uas.add(c.optString("ua")); refs.add(c.optString("r")); groups.add(c.optString("g"));
                imgs.add(c.optString("img")); descs.add(c.optString("pl")); metas.add(c.optString("m"));
            }
        } catch (Throwable t) { finish(); return; }
        if (urls.isEmpty()) { finish(); return; }
        idx = Math.max(0, Math.min(urls.size() - 1, getIntent().getIntExtra("idx", 0)));

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        pv = new PlayerView(this);
        pv.setUseController(false);
        pv.setKeepContentOnPlayerReset(true);
        root.addView(pv, new FrameLayout.LayoutParams(-1, -1));

        /* the layer that takes every touch (the picture itself does not pass them on once the finger moves) */
        View touch = new View(this);
        root.addView(touch, new FrameLayout.LayoutParams(-1, -1));
        setupGestures(touch);

        state = label(20, false); state.setGravity(Gravity.CENTER); state.setPadding(dp(40), 0, dp(40), 0);
        root.addView(state, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER));
        hud = label(24, true); hud.setGravity(Gravity.CENTER); hud.setPadding(dp(22), dp(14), dp(22), dp(14)); hud.setVisibility(View.GONE); hud.setBackground(round(0xCC000000, 26));
        root.addView(hud, new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.CENTER_HORIZONTAL));
        ((FrameLayout.LayoutParams) hud.getLayoutParams()).topMargin = dp(70);

        buildControls();
        buildDrawer();
        buildQuality();
        setContentView(root);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);

        http = new DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true).setConnectTimeoutMs(12000).setReadTimeoutMs(15000);
        player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(this).setDataSourceFactory(http)).build();
        pv.setPlayer(player);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int s) {
                if (s == Player.STATE_BUFFERING) state.setText("جاري التحميل…");
                else if (s == Player.STATE_READY) { state.setText(""); failed = 0; refreshChips(); }
                else if (s == Player.STATE_ENDED && vod && idx + 1 < urls.size()) { toast("الحلقة التالية…"); play(idx + 1); }
                updatePlayIcon();
            }
            @Override public void onIsPlayingChanged(boolean p) { updatePlayIcon(); }
            @Override public void onTracksChanged(Tracks t) { refreshChips(); }
            @Override public void onPlayerError(PlaybackException e) {
                failed++;
                state.setText("ما اشتغلت هذي (" + (e.getMessage() == null ? "خطأ" : e.getMessage().replaceAll("\\s+", " ")) + ")" + (vod || urls.size() < 2 ? "" : "\nاسحب لقناة ثانية أو افتح القائمة"));
                showCtl();
                if (failed < 2) h.postDelayed(new Runnable() { public void run() { play(idx); } }, 2500);
            }
        });
        play(idx);
        h.postDelayed(tick, 500);
    }

    /* ------------------------------------------------------------------ helpers */
    private GradientDrawable round(int color, int r) { GradientDrawable g = new GradientDrawable(); g.setColor(color); g.setCornerRadius(dp(r)); return g; }
    private TextView label(int sp, boolean bold) {
        TextView t = new TextView(this);
        t.setTextSize(sp); t.setTextColor(Color.WHITE); t.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        t.setShadowLayer(6, 0, 2, Color.BLACK);
        return t;
    }
    private TextView chip(String s) {
        TextView t = label(14, true); t.setText(s); t.setShadowLayer(0, 0, 0, 0); t.setGravity(Gravity.CENTER); t.setSingleLine(true);
        t.setPadding(dp(14), dp(9), dp(14), dp(9)); t.setBackground(round(0x33FFFFFF, 20));
        return t;
    }
    private TextView circle(String s, int sizeDp, int sp) {
        TextView t = label(sp, true); t.setText(s); t.setGravity(Gravity.CENTER); t.setShadowLayer(0, 0, 0, 0);
        t.setBackground(round(0x55000000, sizeDp / 2)); t.setLayoutParams(new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp)));
        return t;
    }
    private void toast(String s) { Toast.makeText(this, s, Toast.LENGTH_SHORT).show(); }
    private void hud(String s) { hud.setText(s); hud.setVisibility(View.VISIBLE); h.removeCallbacks(hideHud); h.postDelayed(hideHud, 900); }
    private String clock(long ms) {
        if (ms < 0) ms = 0;
        long s = ms / 1000, hh = s / 3600, mm = (s % 3600) / 60, ss = s % 60;
        return hh > 0 ? String.format(Locale.US, "%d:%02d:%02d", hh, mm, ss) : String.format(Locale.US, "%02d:%02d", mm, ss);
    }
    private static String arDigits(String s) { StringBuilder b = new StringBuilder(); for (char c : s.toCharArray()) b.append(c >= '0' && c <= '9' ? (char) ('٠' + (c - '0')) : c); return b.toString(); }

    /** a picture from the net, kept in memory (small, only the poster of what is playing) */
    private void loadImg(final String url, final ImageView into) {
        into.setImageDrawable(null);
        if (url == null || !url.startsWith("http")) return;
        Bitmap c = bmpCache.get(url);
        if (c != null) { into.setImageBitmap(c); return; }
        new Thread(new Runnable() { public void run() {
            try {
                HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection(); con.setConnectTimeout(6000); con.setReadTimeout(8000);
                InputStream in = con.getInputStream();
                BitmapFactory.Options o = new BitmapFactory.Options(); o.inSampleSize = 2;
                final Bitmap bm = BitmapFactory.decodeStream(in, null, o); in.close();
                if (bm != null) { bmpCache.put(url, bm); h.post(new Runnable() { public void run() { if (url.equals(imgs.get(idx))) into.setImageBitmap(bm); } }); }
            } catch (Throwable ignored) { }
        } }).start();
    }

    /* ------------------------------------------------------------------ the controls: top bar, middle buttons, bottom card */
    private void buildControls() {
        ctl = new FrameLayout(this);
        ctl.setAlpha(0f); ctl.setVisibility(View.GONE);
        View scrimT = new View(this); scrimT.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{0xCC000000, 0x00000000}));
        ctl.addView(scrimT, new FrameLayout.LayoutParams(-1, dp(120), Gravity.TOP));
        View scrimB = new View(this); scrimB.setBackground(new GradientDrawable(GradientDrawable.Orientation.BOTTOM_TOP, new int[]{0xEE000000, 0x00000000}));
        ctl.addView(scrimB, new FrameLayout.LayoutParams(-1, dp(260), Gravity.BOTTOM));

        /* top: back + name */
        top = new LinearLayout(this); top.setOrientation(LinearLayout.HORIZONTAL); top.setGravity(Gravity.CENTER_VERTICAL); top.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        top.setPadding(dp(14), dp(10), dp(14), dp(6));
        TextView back = circle("→", 44, 22);
        title = label(19, true); title.setSingleLine(true); title.setEllipsize(android.text.TextUtils.TruncateAt.END); title.setPadding(dp(14), 0, dp(10), 0);
        top.addView(back); top.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        TextView lst = circle("☰", 44, 20); top.addView(lst, new LinearLayout.LayoutParams(dp(44), dp(44)));
        if (urls.size() < 2) lst.setVisibility(View.GONE);
        ctl.addView(top, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
        back.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { finish(); } });
        lst.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { toggleDrawer(); } });

        /* middle: rewind · play/pause · forward  (live: previous channel · pause · next channel) */
        LinearLayout mid = new LinearLayout(this); mid.setOrientation(LinearLayout.HORIZONTAL); mid.setGravity(Gravity.CENTER); mid.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        TextView rw = circle(vod ? "⟲" : "‹", 58, 30), fw = circle(vod ? "⟳" : "›", 58, 30);
        playBtn = circle("❚❚", 76, 28); playBtn.setBackground(round(0x66000000, 38));
        LinearLayout.LayoutParams ml = new LinearLayout.LayoutParams(dp(58), dp(58)); ml.setMargins(dp(26), 0, dp(26), 0);
        mid.addView(rw, ml); mid.addView(playBtn, new LinearLayout.LayoutParams(dp(76), dp(76))); mid.addView(fw, ml);
        if (!vod && urls.size() < 2) { rw.setVisibility(View.GONE); fw.setVisibility(View.GONE); }
        ctl.addView(mid, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER));
        playBtn.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { if (player == null) return; if (player.getPlayWhenReady() && player.getPlaybackState() != Player.STATE_ENDED) player.pause(); else player.play(); updatePlayIcon(); showCtl(); } });
        rw.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { if (vod) skip(-10000); else zap(-1); showCtl(); } });
        fw.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { if (vod) skip(10000); else zap(1); showCtl(); } });

        /* bottom card */
        card = new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        card.setBackground(round(0xD9121216, 26)); card.setPadding(dp(18), dp(14), dp(18), dp(10));
        LinearLayout info = new LinearLayout(this); info.setOrientation(LinearLayout.HORIZONTAL); info.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        poster = new ImageView(this); poster.setScaleType(ImageView.ScaleType.CENTER_CROP); poster.setBackground(round(0xFF22222A, 14));
        poster.setClipToOutline(true); poster.setOutlineProvider(new android.view.ViewOutlineProvider() { public void getOutline(View v, android.graphics.Outline o) { o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), dp(14)); } });
        LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(dp(58), dp(86)); pl.setMargins(0, 0, 0, 0);
        info.addView(poster, pl);
        LinearLayout tx = new LinearLayout(this); tx.setOrientation(LinearLayout.VERTICAL);
        cTitle = label(18, true); cTitle.setShadowLayer(0, 0, 0, 0); cTitle.setSingleLine(true); cTitle.setEllipsize(android.text.TextUtils.TruncateAt.END);
        cMeta = label(13, false); cMeta.setShadowLayer(0, 0, 0, 0); cMeta.setTextColor(0xFFCFCFD6); cMeta.setPadding(0, dp(3), 0, dp(3));
        cDesc = label(13, false); cDesc.setShadowLayer(0, 0, 0, 0); cDesc.setTextColor(0xFFB8B8C0); cDesc.setMaxLines(2); cDesc.setEllipsize(android.text.TextUtils.TruncateAt.END);
        tx.addView(cTitle); tx.addView(cMeta); tx.addView(cDesc);
        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(0, -2, 1); tl.setMargins(dp(14), 0, 0, 0);
        info.addView(tx, tl);
        liveBadge = label(12, true); liveBadge.setText("● مباشر"); liveBadge.setTextColor(0xFFFF5A6A); liveBadge.setShadowLayer(0, 0, 0, 0); liveBadge.setVisibility(vod ? View.GONE : View.VISIBLE);
        card.addView(info);

        HorizontalScrollView hs = new HorizontalScrollView(this); hs.setHorizontalScrollBarEnabled(false); hs.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        LinearLayout chips = new LinearLayout(this); chips.setOrientation(LinearLayout.HORIZONTAL); chips.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); chips.setPadding(0, dp(10), 0, dp(4));
        audioChip = chip("🔊 الصوت"); qualChip = chip("الجودة ▾"); speedChip = chip("×1"); TextView fit = chip("⛶ الحجم"), inf = chip("ⓘ معلومات"), pip = chip("▭ نافذة");
        TextView[] cs = vod ? new TextView[]{audioChip, qualChip, speedChip, fit, inf, pip} : new TextView[]{audioChip, qualChip, fit, inf, pip};
        for (TextView c : cs) { LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(-2, -2); cl.setMargins(0, 0, dp(8), 0); chips.addView(c, cl); }
        if (!vod) chips.addView(liveBadge);
        hs.addView(chips);
        card.addView(hs);
        audioChip.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { trackDialog(C.TRACK_TYPE_AUDIO, "لغة الصوت"); } });
        qualChip.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { toggleQuality(); } });
        speedChip.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { speedDialog(); } });
        fit.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { cycleResize(); showCtl(); } });
        inf.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { infoDialog(); } });
        pip.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { enterPip(); } });

        /* seek bar (films) */
        LinearLayout sk = new LinearLayout(this); sk.setOrientation(LinearLayout.HORIZONTAL); sk.setGravity(Gravity.CENTER_VERTICAL); sk.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        tNow = label(12, false); tNow.setShadowLayer(0, 0, 0, 0); tNow.setText("00:00"); tAll = label(12, false); tAll.setShadowLayer(0, 0, 0, 0); tAll.setText("00:00");
        seek = new SeekBar(this); seek.setMax(1000);
        try {
            seek.getProgressDrawable().setColorFilter(ACCENT, android.graphics.PorterDuff.Mode.SRC_ATOP);
            seek.getThumb().setColorFilter(Color.WHITE, android.graphics.PorterDuff.Mode.SRC_ATOP);
        } catch (Throwable ignored) { }
        sk.addView(tNow); sk.addView(seek, new LinearLayout.LayoutParams(0, dp(30), 1)); sk.addView(tAll);
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(-1, -2); sl.setMargins(0, dp(2), 0, 0);
        if (vod) card.addView(sk, sl);
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            public void onProgressChanged(SeekBar s, int p, boolean user) { if (user && player != null && player.getDuration() > 0) tNow.setText(clock(player.getDuration() * p / 1000)); }
            public void onStartTrackingTouch(SeekBar s) { seeking = true; h.removeCallbacks(hideRun); }
            public void onStopTrackingTouch(SeekBar s) { seeking = false; if (player != null && player.getDuration() > 0) player.seekTo(player.getDuration() * s.getProgress() / 1000); showCtl(); }
        });
        FrameLayout.LayoutParams cp = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM); cp.setMargins(dp(14), 0, dp(14), dp(12));
        ctl.addView(card, cp);
        root.addView(ctl, new FrameLayout.LayoutParams(-1, -1));
    }

    private void updatePlayIcon() { if (playBtn != null && player != null) playBtn.setText(player.getPlayWhenReady() && player.getPlaybackState() != Player.STATE_ENDED ? "❚❚" : "▶"); }

    private void updateTime() {
        if (player == null || !vod || seeking || !ctlOn) return;
        long d = player.getDuration(), p = player.getCurrentPosition();
        if (d > 0) { seek.setProgress((int) (p * 1000 / d)); tNow.setText(clock(p)); tAll.setText(clock(d)); }
        tickN++;
    }

    private void refreshChips() {
        if (player == null) return;
        try {
            String a = null;
            for (Tracks.Group g : player.getCurrentTracks().getGroups()) {
                if (g.getType() != C.TRACK_TYPE_AUDIO) continue;
                for (int i = 0; i < g.length; i++) if (g.isTrackSelected(i)) { Format f = g.getTrackFormat(i); a = f.label != null ? f.label : f.language != null && !"und".equals(f.language) ? new Locale(f.language).getDisplayName(new Locale("ar")) : null; }
            }
            audioChip.setText("🔊 " + (a != null ? a : "الصوت"));
            int hgt = player.getVideoSize().height;
            qualChip.setText((hgt > 0 ? qLabel(hgt) : "الجودة") + " ▾");
        } catch (Throwable ignored) { }
    }
    private String qLabel(int h) { return h >= 2000 ? "4K" : h >= 1400 ? "2K" : h + "P"; }

    private void fillInfo() {
        title.setText(names.get(idx)); cTitle.setText(names.get(idx));
        String m = metas.get(idx).length() > 0 ? metas.get(idx) : (groups.get(idx).length() > 0 ? groups.get(idx) : "");
        cMeta.setText(m); cMeta.setVisibility(m.length() > 0 ? View.VISIBLE : View.GONE);
        cDesc.setText(descs.get(idx)); cDesc.setVisibility(descs.get(idx).length() > 0 ? View.VISIBLE : View.GONE);
        loadImg(imgs.get(idx), poster); poster.setVisibility(imgs.get(idx).startsWith("http") ? View.VISIBLE : View.GONE);
    }

    private boolean anyPopup() { return qPanel.getVisibility() == View.VISIBLE || drawer.getVisibility() == View.VISIBLE; }

    private void showCtl() {
        h.removeCallbacks(hideRun);
        if (!ctlOn) {
            ctlOn = true; ctl.setVisibility(View.VISIBLE);
            ctl.animate().alpha(1f).setDuration(200).start();
            card.setTranslationY(dp(30)); card.animate().translationY(0).setDuration(260).setInterpolator(new android.view.animation.DecelerateInterpolator()).start();
        }
        updateTime(); updatePlayIcon();
        h.postDelayed(hideRun, HIDE_MS);
    }
    private void hideCtl() {
        if (!ctlOn || seeking) return;
        if (anyPopup()) { h.postDelayed(hideRun, HIDE_MS); return; }
        ctlOn = false;
        ctl.animate().alpha(0f).setDuration(220).withEndAction(new Runnable() { public void run() { if (!ctlOn) ctl.setVisibility(View.GONE); } }).start();
    }
    private void toggleCtl() { if (ctlOn) { if (anyPopup()) { hidePopups(); showCtl(); } else { h.removeCallbacks(hideRun); hideCtl(); } } else showCtl(); }
    private void hidePopups() { qPanel.setVisibility(View.GONE); hideDrawer(); }

    private void skip(long ms) { if (player == null) return; player.seekTo(Math.max(0, player.getCurrentPosition() + ms)); hud(ms > 0 ? "⏩ ١٠ ثواني" : "⏪ ١٠ ثواني"); }
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
        fillInfo();
        Map<String, String> hd = new HashMap<>();
        if (refs.get(idx).length() > 0) hd.put("Referer", refs.get(idx));
        http.setDefaultRequestProperties(hd);
        http.setUserAgent(uas.get(idx).length() > 0 ? uas.get(idx) : "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
        state.setText("جاري التحميل…"); showCtl();
        player.setMediaItem(MediaItem.fromUri(urls.get(idx)));
        player.prepare();
        if (vod) {
            try { long saved = Long.parseLong(prefs.getString(vodKey(urls.get(idx)), "0")); if (saved > 4000) { player.seekTo(saved); state.setText("إكمال من حيث وقفت…"); } } catch (Throwable ignored) { }
        }
        player.setPlayWhenReady(true);
        applyQuiet();
        if (adapter != null) adapter.notifyDataSetChanged();
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

    /* ------------------------------------------------------------------ gestures */
    private void setupGestures(View touch) {
        final GestureDetector gd = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent e) { mode = 0; return true; }
            @Override public boolean onSingleTapConfirmed(MotionEvent e) { toggleCtl(); return true; }
            @Override public boolean onDoubleTap(MotionEvent e) {
                if (!vod || player == null) return false;
                skip(e.getX() > root.getWidth() / 2f ? 10000 : -10000); return true;
            }
            @Override public boolean onScroll(MotionEvent a, MotionEvent c, float dx, float dy) {
                if (a == null || c == null || player == null) return false;
                float w = root.getWidth(), hgt = root.getHeight();
                if (mode == 0) {
                    boolean horiz = Math.abs(c.getX() - a.getX()) > Math.abs(c.getY() - a.getY()) * 1.2f;
                    float xr = a.getX() / w;
                    if (horiz) mode = vod ? 3 : 4; else if (xr < .33f) mode = 1; else if (xr > .67f) mode = 2; else mode = 4;
                    if (mode == 3) scrubTo = player.getCurrentPosition();
                }
                if (mode == 1) {
                    if (bright < 0) { try { bright = android.provider.Settings.System.getInt(getContentResolver(), android.provider.Settings.System.SCREEN_BRIGHTNESS) / 255f; } catch (Throwable t) { bright = .5f; } }
                    bright = Math.max(.02f, Math.min(1f, bright + dy / hgt * 1.4f));
                    WindowManager.LayoutParams lp = getWindow().getAttributes(); lp.screenBrightness = bright; getWindow().setAttributes(lp);
                    hud("☀ " + arDigits(String.valueOf(Math.round(bright * 100))) + "٪"); return true;
                }
                if (mode == 2) {
                    int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    volAcc += dy / hgt * max * 1.6f;
                    int cur = am.getStreamVolume(AudioManager.STREAM_MUSIC), step = (int) volAcc;
                    if (step != 0) { volAcc -= step; cur = Math.max(0, Math.min(max, cur + step)); am.setStreamVolume(AudioManager.STREAM_MUSIC, cur, 0); }
                    hud("🔊 " + arDigits(String.valueOf(Math.round(am.getStreamVolume(AudioManager.STREAM_MUSIC) * 100f / max))) + "٪"); return true;
                }
                if (mode == 3) {
                    long dur = Math.max(1, player.getDuration());
                    scrubTo = Math.max(0, Math.min(dur, scrubTo - (long) (dx * 120)));
                    hud(clock(scrubTo) + " / " + clock(dur)); return true;
                }
                return false;
            }
            @Override public boolean onFling(MotionEvent a, MotionEvent c, float vx, float vy) {
                if (vod || a == null || c == null || mode != 4) return false;
                float dy = c.getY() - a.getY();
                if (Math.abs(dy) > dp(90) && Math.abs(dy) > Math.abs(c.getX() - a.getX()) * 1.3f && urls.size() > 1) { zap(dy < 0 ? 1 : -1); return true; }
                return false;
            }
        });
        gd.setIsLongpressEnabled(false);
        touch.setOnTouchListener(new View.OnTouchListener() {
            @Override public boolean onTouch(View v, MotionEvent e) {
                gd.onTouchEvent(e);
                if (e.getAction() == MotionEvent.ACTION_UP || e.getAction() == MotionEvent.ACTION_CANCEL) {
                    if (mode == 3 && player != null) player.seekTo(scrubTo);
                    mode = 0; volAcc = 0;
                }
                return true;
            }
        });
    }

    /* ------------------------------------------------------------------ channel / episode list */
    private void buildDrawer() {
        drawer = new LinearLayout(this);
        drawer.setOrientation(LinearLayout.VERTICAL); drawer.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        drawer.setBackgroundColor(0xF2101014); drawer.setPadding(dp(10), dp(60), dp(10), dp(10)); drawer.setVisibility(View.GONE);
        search = new EditText(this);
        search.setHint(vod ? "ابحث بالحلقات…" : "ابحث عن قناة…"); search.setHintTextColor(0xFF888888); search.setTextColor(Color.WHITE); search.setSingleLine(true);
        search.setPadding(dp(16), dp(10), dp(16), dp(10)); search.setBackground(round(0xFF22222A, 22)); search.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        drawer.addView(search, new LinearLayout.LayoutParams(-1, dp(46)));
        HorizontalScrollView hs = new HorizontalScrollView(this); hs.setHorizontalScrollBarEnabled(false); hs.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        chipRow = new LinearLayout(this); chipRow.setOrientation(LinearLayout.HORIZONTAL); chipRow.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); chipRow.setPadding(0, dp(8), 0, dp(8));
        hs.addView(chipRow);
        drawer.addView(hs, new LinearLayout.LayoutParams(-1, -2));
        listView = new ListView(this); listView.setDividerHeight(0); listView.setBackgroundColor(Color.TRANSPARENT);
        drawer.addView(listView, new LinearLayout.LayoutParams(-1, 0, 1));
        int w = Math.min(dp(340), (int) (getResources().getDisplayMetrics().widthPixels * .6f));
        root.addView(drawer, new FrameLayout.LayoutParams(w, -1, Gravity.END));

        adapter = new BaseAdapter() {
            public int getCount() { return shown.size(); }
            public Object getItem(int p) { return shown.get(p); }
            public long getItemId(int p) { return p; }
            public View getView(int p, View v, ViewGroup parent) {
                TextView t = v instanceof TextView ? (TextView) v : new TextView(PlayerActivity.this);
                int real = shown.get(p); boolean cur = real == idx;
                t.setText((cur ? "▶  " : "") + names.get(real));
                t.setTextColor(cur ? Color.WHITE : 0xFFCCCCCC); t.setTextSize(16); t.setTypeface(cur ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
                t.setPadding(dp(14), dp(12), dp(14), dp(12)); t.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
                t.setBackground(cur ? round((ACCENT & 0x00FFFFFF) | 0x55000000, 16) : null);
                return t;
            }
        };
        listView.setAdapter(adapter);
        listView.setOnItemClickListener(new android.widget.AdapterView.OnItemClickListener() {
            public void onItemClick(android.widget.AdapterView<?> p, View v, int pos, long id) { failed = 0; play(shown.get(pos)); hideDrawer(); }
        });
        search.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int a, int b, int c) { }
            public void onTextChanged(CharSequence s, int a, int b, int c) { query = s.toString().trim().toLowerCase(Locale.ROOT); refilter(); }
            public void afterTextChanged(Editable s) { }
        });
        Map<String, Integer> gs = new LinkedHashMap<>();
        for (String g : groups) if (g.length() > 0 && gs.size() < 60) gs.put(g, 1);
        addChip("الكل", "");
        for (String g : gs.keySet()) addChip(g, g);
        refilter();
    }

    private void addChip(final String label, final String value) {
        TextView c = label(14, true); c.setText(label); c.setShadowLayer(0, 0, 0, 0); c.setPadding(dp(14), dp(7), dp(14), dp(7)); c.setTag(value);
        c.setBackground(round(0xFF2A2A32, 18));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.setMargins(0, 0, dp(6), 0);
        c.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { groupFilter = value; refilter(); } });
        chipRow.addView(c, lp);
    }

    private void refilter() {
        shown.clear();
        for (int i = 0; i < names.size(); i++) {
            if (groupFilter.length() > 0 && !groupFilter.equals(groups.get(i))) continue;
            if (query.length() > 0 && !names.get(i).toLowerCase(Locale.ROOT).contains(query)) continue;
            shown.add(i);
        }
        for (int i = 0; i < chipRow.getChildCount(); i++) {
            TextView c = (TextView) chipRow.getChildAt(i);
            c.setBackground(round(groupFilter.equals(c.getTag()) ? ACCENT : 0xFF2A2A32, 18));
        }
        if (adapter != null) adapter.notifyDataSetChanged();
    }

    private void toggleDrawer() {
        if (drawer.getVisibility() == View.VISIBLE) { hideDrawer(); return; }
        qPanel.setVisibility(View.GONE);
        drawer.setVisibility(View.VISIBLE); drawer.setTranslationX(dp(60)); drawer.setAlpha(0f); drawer.animate().translationX(0).alpha(1f).setDuration(240).start();
        int at = shown.indexOf(idx); if (at >= 0) listView.setSelection(Math.max(0, at - 3));
        h.removeCallbacks(hideRun);
    }
    private void hideDrawer() {
        if (drawer.getVisibility() != View.VISIBLE) return;
        drawer.setVisibility(View.GONE);
        try { ((android.view.inputmethod.InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(search.getWindowToken(), 0); } catch (Throwable ignored) { }
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        showCtl();
    }

    /* ------------------------------------------------------------------ quality panel (the sizes this stream really has) */
    private void buildQuality() {
        qPanel = new LinearLayout(this);
        qPanel.setOrientation(LinearLayout.VERTICAL); qPanel.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        qPanel.setBackground(round(0xF2161619, 22)); qPanel.setPadding(dp(16), dp(14), dp(16), dp(14)); qPanel.setVisibility(View.GONE);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(Math.min(dp(420), (int) (getResources().getDisplayMetrics().widthPixels * .8f)), -2, Gravity.BOTTOM | Gravity.END);
        lp.setMargins(0, 0, dp(16), dp(150));
        root.addView(qPanel, lp);
    }
    private void toggleQuality() {
        if (qPanel.getVisibility() == View.VISIBLE) { qPanel.setVisibility(View.GONE); return; }
        hideDrawer();
        qPanel.removeAllViews();
        LinearLayout head = new LinearLayout(this); head.setOrientation(LinearLayout.HORIZONTAL); head.setGravity(Gravity.CENTER_VERTICAL); head.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        TextView t = label(18, true); t.setText("الجودة"); t.setShadowLayer(0, 0, 0, 0); head.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
        TextView x = label(18, true); x.setText("✕"); x.setShadowLayer(0, 0, 0, 0); x.setPadding(dp(10), 0, dp(4), 0); head.addView(x);
        qPanel.addView(head);
        int cur = player == null ? 0 : player.getVideoSize().height;
        TextView sub = label(12, false); sub.setShadowLayer(0, 0, 0, 0); sub.setTextColor(0xFFA0A0A8); sub.setText(cur > 0 ? "يعرض بجودة " + qLabel(cur) : "جاري التحديد…"); sub.setPadding(0, dp(2), 0, dp(10));
        qPanel.addView(sub);
        TreeSet<Integer> hs = new TreeSet<>();
        try { for (Tracks.Group g : player.getCurrentTracks().getGroups()) if (g.getType() == C.TRACK_TYPE_VIDEO) for (int i = 0; i < g.length; i++) { int hh = g.getTrackFormat(i).height; if (hh > 0) hs.add(hh); } } catch (Throwable ignored) { }
        final List<Integer> opts = new ArrayList<>(); opts.add(0);
        for (Integer hh : hs.descendingSet()) opts.add(hh);
        LinearLayout row = null;
        for (int i = 0; i < opts.size(); i++) {
            if (i % 3 == 0) { row = new LinearLayout(this); row.setOrientation(LinearLayout.HORIZONTAL); row.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(-1, -2); rl.setMargins(0, 0, 0, dp(8)); qPanel.addView(row, rl); }
            final int hv = opts.get(i);
            TextView c = chip(hv == 0 ? "تلقائي" : qLabel(hv)); c.setPadding(dp(8), dp(11), dp(8), dp(11));
            boolean on = hv == 0 ? !capped : capped && capH == hv; if (on) { c.setText("✓ " + c.getText()); c.setBackground(round(0x66FFFFFF, 20)); }
            LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(0, -2, 1); cl.setMargins(dp(4), 0, dp(4), 0);
            c.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { setQuality(hv); } });
            row.addView(c, cl);
        }
        TextView refresh = chip("↻ تحديث البث"); refresh.setPadding(dp(8), dp(11), dp(8), dp(11));
        qPanel.addView(refresh, new LinearLayout.LayoutParams(-1, -2));
        refresh.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { qPanel.setVisibility(View.GONE); failed = 0; play(idx); } });
        x.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { qPanel.setVisibility(View.GONE); } });
        qPanel.setVisibility(View.VISIBLE); qPanel.setAlpha(0f); qPanel.setTranslationY(dp(14)); qPanel.animate().alpha(1f).translationY(0).setDuration(200).start();
        h.removeCallbacks(hideRun);
    }
    private boolean capped; private int capH;
    private void setQuality(int hv) {
        if (player == null) return;
        try {
            if (hv == 0) { capped = false; player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().clearVideoSizeConstraints().build()); hud("الجودة: تلقائي"); }
            else { capped = true; capH = hv; player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().setMaxVideoSize(Integer.MAX_VALUE, hv).build()); hud("الجودة: " + qLabel(hv)); }
        } catch (Throwable t) { toast("ما تبدّلت الجودة"); }
        qPanel.setVisibility(View.GONE); showCtl();
    }

    /* ------------------------------------------------------------------ dialogs: picture size, speed, audio, subtitles, sleep timer, info */
    private static final String[] RESIZE_NAMES = {"ملاءمة", "ملء الشاشة", "تكبير"};
    private static final int[] RESIZE_MODES = {AspectRatioFrameLayout.RESIZE_MODE_FIT, AspectRatioFrameLayout.RESIZE_MODE_FILL, AspectRatioFrameLayout.RESIZE_MODE_ZOOM};
    private void cycleResize() { resize = (resize + 1) % 3; pv.setResizeMode(RESIZE_MODES[resize]); hud("حجم الصورة: " + RESIZE_NAMES[resize]); }

    private AlertDialog.Builder dlg(String t) { return new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(t); }

    private void speedDialog() {
        final float[] v = {.5f, .75f, 1f, 1.25f, 1.5f, 2f};
        dlg("سرعة التشغيل").setItems(new String[]{"٠٫٥×", "٠٫٧٥×", "عادية ١×", "١٫٢٥×", "١٫٥×", "٢×"}, new android.content.DialogInterface.OnClickListener() {
            public void onClick(android.content.DialogInterface d, int w) {
                speed = v[w]; if (player != null) player.setPlaybackParameters(new PlaybackParameters(speed));
                speedChip.setText("×" + (speed == (int) speed ? String.valueOf((int) speed) : String.valueOf(speed))); hud("السرعة " + speedChip.getText()); showCtl();
            }
        }).show();
    }

    private void trackDialog(final int type, String name) {
        if (player == null) return;
        final List<Tracks.Group> gl = new ArrayList<>(); final List<Integer> ti = new ArrayList<>(); final List<String> labels = new ArrayList<>();
        int n = 0;
        for (Tracks.Group g : player.getCurrentTracks().getGroups()) {
            if (g.getType() != type) continue;
            for (int i = 0; i < g.length; i++) {
                Format f = g.getTrackFormat(i);
                String l = f.label != null ? f.label : f.language != null && !"und".equals(f.language) ? new Locale(f.language).getDisplayName(new Locale("ar")) : "مسار " + (n + 1);
                labels.add((g.isTrackSelected(i) ? "✓ " : "") + l); gl.add(g); ti.add(i); n++;
            }
        }
        final boolean text = type == C.TRACK_TYPE_TEXT;
        if (text) labels.add("إيقاف الترجمة");
        if (labels.isEmpty()) { toast("ماكو " + name + " بهذا البث"); return; }
        dlg(name).setItems(labels.toArray(new String[0]), new android.content.DialogInterface.OnClickListener() {
            public void onClick(android.content.DialogInterface d, int w) {
                try {
                    if (text && w == gl.size()) { player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true).build()); hud("الترجمة متوقفة"); return; }
                    TrackSelectionOverride o = new TrackSelectionOverride(gl.get(w).getMediaTrackGroup(), ti.get(w));
                    player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().setTrackTypeDisabled(type, false).setOverrideForType(o).build());
                    hud("تم"); refreshChips();
                } catch (Throwable t) { toast("ما تبدّل المسار"); }
            }
        }).show();
    }

    private void infoDialog() {
        String[] it = {"الاسم: " + names.get(idx), "القسم: " + (groups.get(idx).length() > 0 ? groups.get(idx) : "—"), "الدقة: " + (player != null && player.getVideoSize().height > 0 ? player.getVideoSize().width + "×" + player.getVideoSize().height : "—"),
            "السيرفر: " + android.net.Uri.parse(urls.get(idx)).getHost(), "مؤقت النوم…", "الترجمة…", "نسخ رابط البث"};
        dlg("معلومات وخيارات").setItems(it, new android.content.DialogInterface.OnClickListener() {
            public void onClick(android.content.DialogInterface d, int w) { if (w == 4) sleepDialog(); else if (w == 5) trackDialog(C.TRACK_TYPE_TEXT, "الترجمة"); else if (w == 6) copyUrl(); }
        }).show();
    }

    private void sleepDialog() {
        final int[] m = {15, 30, 60, 90, 0};
        dlg("مؤقت النوم").setItems(new String[]{"بعد ١٥ دقيقة", "بعد ٣٠ دقيقة", "بعد ساعة", "بعد ساعة ونص", "إلغاء المؤقت"}, new android.content.DialogInterface.OnClickListener() {
            public void onClick(android.content.DialogInterface d, int w) {
                h.removeCallbacks(sleepRun);
                if (m[w] > 0) { h.postDelayed(sleepRun, m[w] * 60000L); hud("يطفّي بعد " + m[w] + " دقيقة"); } else hud("انلغى المؤقت");
            }
        }).show();
    }

    private void copyUrl() {
        try { ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE); cm.setPrimaryClip(ClipData.newPlainText("u", urls.get(idx))); toast("اننسخ رابط البث"); } catch (Throwable t) { toast("ما اننسخ"); }
    }

    private void enterPip() {
        if (android.os.Build.VERSION.SDK_INT >= 26) { try { enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9)).build()); } catch (Throwable ignored) { } }
    }

    @Override
    public void onBackPressed() { if (anyPopup()) { hidePopups(); return; } super.onBackPressed(); }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, android.content.res.Configuration c) {
        super.onPictureInPictureModeChanged(inPip, c);
        if (inPip) { hidePopups(); ctlOn = false; ctl.setVisibility(View.GONE); }
    }

    @Override
    protected void onUserLeaveHint() { super.onUserLeaveHint(); enterPip(); }

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
