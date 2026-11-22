package com.cleantv.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PictureInPictureParams;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
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
import android.widget.LinearLayout;
import android.widget.ListView;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The player. Live: swipe up or down (or the arrows) changes the channel, and the list button opens every channel with search and groups,
 * so you never leave the picture. A film or episode: the normal controller, double-tap to jump 10 seconds, drag sideways to scrub, speed,
 * and it remembers where it stopped. Everywhere: the left side of the screen (drag up/down) is brightness, the right side is volume;
 * the menu has picture size, audio and subtitle tracks, a sleep timer and a small window. After the user's quiet hour at night the sound drops.
 */
public class PlayerActivity extends Activity {
    static volatile String PACK = null;
    private static final int ACCENT = 0xFFFA0023;
    private final List<String> names = new ArrayList<>(), urls = new ArrayList<>(), uas = new ArrayList<>(), refs = new ArrayList<>(), groups = new ArrayList<>();
    private ExoPlayer player;
    private PlayerView pv;
    private DefaultHttpDataSource.Factory http;
    private FrameLayout root;
    private LinearLayout top, drawer, chipRow;
    private TextView title, prev, next, state, hud, listBtn;
    private ListView listView;
    private EditText search;
    private BaseAdapter adapter;
    private final List<Integer> shown = new ArrayList<>();
    private String groupFilter = "", query = "";
    private int idx, failed, resize;
    private boolean vod;
    private float speed = 1f, bright = -1f;
    private SharedPreferences prefs;
    private AudioManager am;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable hideUi = new Runnable() { public void run() { setUi(false); } };
    private final Runnable hideHud = new Runnable() { public void run() { hud.setVisibility(View.GONE); } };
    private final Runnable sleepRun = new Runnable() { public void run() { Toast.makeText(PlayerActivity.this, "انتهى مؤقت النوم", Toast.LENGTH_SHORT).show(); finish(); } };
    private final Runnable tick = new Runnable() { public void run() { savePos(); applyQuiet(); h.postDelayed(this, 5000); } };

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
            }
        } catch (Throwable t) { finish(); return; }
        if (urls.isEmpty()) { finish(); return; }
        idx = Math.max(0, Math.min(urls.size() - 1, getIntent().getIntExtra("idx", 0)));

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        pv = new PlayerView(this);
        pv.setUseController(vod);
        pv.setControllerShowTimeoutMs(3500);
        pv.setKeepContentOnPlayerReset(true);
        root.addView(pv, new FrameLayout.LayoutParams(-1, -1));

        state = label(22, false); state.setGravity(Gravity.CENTER);
        root.addView(state, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER));
        hud = label(26, true); hud.setGravity(Gravity.CENTER); hud.setPadding(dp(22), dp(14), dp(22), dp(14)); hud.setVisibility(View.GONE);
        hud.setBackground(round(0xCC000000, 26));
        root.addView(hud, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER));

        /* top bar: close · name · list · picture size · menu */
        top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL); top.setGravity(Gravity.CENTER_VERTICAL); top.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        top.setBackgroundColor(0x99000000); top.setPadding(dp(6), dp(6), dp(6), dp(6));
        TextView close = icon("✕"), menu = icon("⋮"), fit = icon("⛶");
        listBtn = icon("☰");
        title = label(18, true); title.setSingleLine(true); title.setEllipsize(android.text.TextUtils.TruncateAt.END); title.setPadding(dp(8), 0, dp(8), 0);
        top.addView(close); top.addView(title, new LinearLayout.LayoutParams(0, -2, 1)); top.addView(listBtn); top.addView(fit); top.addView(menu);
        root.addView(top, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
        close.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { finish(); } });
        menu.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { openMenu(); } });
        fit.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { cycleResize(); } });
        listBtn.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { toggleDrawer(); } });
        if (urls.size() < 2) listBtn.setVisibility(View.GONE);

        if (!vod) {
            prev = label(46, true); prev.setText("‹"); next = label(46, true); next.setText("›");
            for (TextView t : new TextView[]{ prev, next }) { t.setPadding(dp(22), dp(10), dp(22), dp(14)); t.setBackgroundColor(0x66000000); }
            root.addView(prev, new FrameLayout.LayoutParams(-2, -2, Gravity.START | Gravity.CENTER_VERTICAL));
            root.addView(next, new FrameLayout.LayoutParams(-2, -2, Gravity.END | Gravity.CENTER_VERTICAL));
            prev.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { zap(-1); showUi(); } });
            next.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { zap(1); showUi(); } });
            if (urls.size() < 2) { prev.setVisibility(View.GONE); next.setVisibility(View.GONE); }
        } else {
            pv.setControllerVisibilityListener(new PlayerView.ControllerVisibilityListener() {
                @Override public void onVisibilityChanged(int visibility) { top.setVisibility(visibility == View.VISIBLE ? View.VISIBLE : View.GONE); }
            });
        }
        buildDrawer();
        setupGestures();
        setContentView(root);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);

        http = new DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true).setConnectTimeoutMs(12000).setReadTimeoutMs(15000);
        player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(this).setDataSourceFactory(http)).build();
        pv.setPlayer(player);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int s) {
                if (s == Player.STATE_BUFFERING) state.setText("جاري التحميل…");
                else if (s == Player.STATE_READY) { state.setText(""); failed = 0; h.removeCallbacks(hideUi); h.postDelayed(hideUi, 3500); }
                else if (s == Player.STATE_ENDED && vod && idx + 1 < urls.size()) { toast("الحلقة التالية…"); play(idx + 1); }
            }
            @Override public void onPlayerError(PlaybackException e) {
                failed++;
                state.setText("ما اشتغلت هذي (" + (e.getMessage() == null ? "خطأ" : e.getMessage().replaceAll("\\s+", " ")) + ")" + (vod || urls.size() < 2 ? "" : " · اسحب لقناة ثانية أو افتح القائمة"));
                setUi(true);
                if (failed < 2) h.postDelayed(new Runnable() { public void run() { play(idx); } }, 2500);
            }
        });
        play(idx);
        h.postDelayed(tick, 5000);
    }

    /* ------------------------------------------------------------------ small helpers */
    private GradientDrawable round(int color, int r) { GradientDrawable g = new GradientDrawable(); g.setColor(color); g.setCornerRadius(dp(r)); return g; }
    private TextView label(int sp, boolean bold) {
        TextView t = new TextView(this);
        t.setTextSize(sp); t.setTextColor(Color.WHITE); t.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        t.setShadowLayer(6, 0, 2, Color.BLACK);
        return t;
    }
    private TextView icon(String s) {
        TextView t = label(22, true); t.setText(s); t.setGravity(Gravity.CENTER); t.setPadding(dp(14), dp(8), dp(14), dp(8)); t.setShadowLayer(0, 0, 0, 0);
        return t;
    }
    private void toast(String s) { Toast.makeText(this, s, Toast.LENGTH_SHORT).show(); }
    private void hud(String s) { hud.setText(s); hud.setVisibility(View.VISIBLE); h.removeCallbacks(hideHud); h.postDelayed(hideHud, 900); }

    private void setUi(boolean on) {
        if (!vod) top.setVisibility(on ? View.VISIBLE : View.GONE);
        if (prev != null && urls.size() > 1) { prev.setVisibility(on ? View.VISIBLE : View.GONE); next.setVisibility(on ? View.VISIBLE : View.GONE); }
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
    private int mode;            // 0 none, 1 brightness, 2 volume, 3 scrub, 4 zap
    private long scrubTo;
    private float volAcc;

    private void setupGestures() {
        final GestureDetector gd = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent e) { mode = 0; return true; }
            @Override public boolean onSingleTapConfirmed(MotionEvent e) { if (drawer.getVisibility() == View.VISIBLE) { hideDrawer(); return true; } if (!vod) showUi(); return false; }
            @Override public boolean onDoubleTap(MotionEvent e) {
                if (!vod || player == null) return false;
                boolean right = e.getX() > root.getWidth() / 2f;
                long p = Math.max(0, player.getCurrentPosition() + (right ? 10000 : -10000));
                player.seekTo(p); hud(right ? "⏩ ١٠ ثواني" : "⏪ ١٠ ثواني");
                return true;
            }
            @Override public boolean onScroll(MotionEvent a, MotionEvent c, float dx, float dy) {
                if (a == null || c == null || player == null) return false;
                float w = root.getWidth(), hgt = root.getHeight();
                if (mode == 0) {
                    boolean horiz = Math.abs(c.getX() - a.getX()) > Math.abs(c.getY() - a.getY()) * 1.2f;
                    float xr = a.getX() / w;
                    if (horiz) mode = vod ? 3 : 4;
                    else if (xr < .33f) mode = 1;
                    else if (xr > .67f) mode = 2;
                    else mode = 4;
                    if (mode == 3) scrubTo = player.getCurrentPosition();
                }
                if (mode == 1) {
                    if (bright < 0) { try { bright = android.provider.Settings.System.getInt(getContentResolver(), android.provider.Settings.System.SCREEN_BRIGHTNESS) / 255f; } catch (Throwable t) { bright = .5f; } }
                    bright = Math.max(.02f, Math.min(1f, bright + dy / hgt * 1.4f));
                    WindowManager.LayoutParams lp = getWindow().getAttributes(); lp.screenBrightness = bright; getWindow().setAttributes(lp);
                    hud("☀ " + Math.round(bright * 100) + "٪");
                    return true;
                }
                if (mode == 2) {
                    int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    volAcc += dy / hgt * max * 1.6f;
                    int cur = am.getStreamVolume(AudioManager.STREAM_MUSIC), step = (int) volAcc;
                    if (step != 0) { volAcc -= step; cur = Math.max(0, Math.min(max, cur + step)); am.setStreamVolume(AudioManager.STREAM_MUSIC, cur, 0); }
                    hud("🔊 " + Math.round(am.getStreamVolume(AudioManager.STREAM_MUSIC) * 100f / max) + "٪");
                    return true;
                }
                if (mode == 3) {
                    long dur = Math.max(1, player.getDuration());
                    scrubTo = Math.max(0, Math.min(dur, scrubTo - (long) (dx * 120)));
                    hud(clock(scrubTo) + " / " + clock(dur));
                    return true;
                }
                return false;
            }
            @Override public boolean onFling(MotionEvent a, MotionEvent c, float vx, float vy) {
                if (vod || a == null || c == null || mode != 4) return false;
                float dy = c.getY() - a.getY();
                if (Math.abs(dy) > dp(90) && Math.abs(dy) > Math.abs(c.getX() - a.getX()) * 1.3f) { zap(dy < 0 ? 1 : -1); showUi(); return true; }
                return false;
            }
        });
        gd.setIsLongpressEnabled(false);
        pv.setOnTouchListener(new View.OnTouchListener() {
            @Override public boolean onTouch(View v, MotionEvent e) {
                gd.onTouchEvent(e);
                if (e.getAction() == MotionEvent.ACTION_UP || e.getAction() == MotionEvent.ACTION_CANCEL) {
                    if (mode == 3 && player != null) player.seekTo(scrubTo);
                    mode = 0; volAcc = 0;
                }
                return false;
            }
        });
    }

    private String clock(long ms) {
        long s = ms / 1000, hh = s / 3600, mm = (s % 3600) / 60, ss = s % 60;
        return hh > 0 ? String.format(Locale.US, "%d:%02d:%02d", hh, mm, ss) : String.format(Locale.US, "%02d:%02d", mm, ss);
    }

    /* ------------------------------------------------------------------ channel / episode list */
    private void buildDrawer() {
        drawer = new LinearLayout(this);
        drawer.setOrientation(LinearLayout.VERTICAL); drawer.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        drawer.setBackgroundColor(0xF2101014); drawer.setPadding(dp(10), dp(52), dp(10), dp(10)); drawer.setVisibility(View.GONE);
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
        int w = Math.min(dp(340), (int) (getResources().getDisplayMetrics().widthPixels * .85f));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(w, -1, Gravity.END);
        root.addView(drawer, lp);

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
        /* the groups (news, sport…) as chips, built once */
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
        drawer.setVisibility(View.VISIBLE);
        int at = shown.indexOf(idx); if (at >= 0) listView.setSelection(Math.max(0, at - 3));
        h.removeCallbacks(hideUi);
    }
    private void hideDrawer() {
        drawer.setVisibility(View.GONE);
        try { ((android.view.inputmethod.InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(search.getWindowToken(), 0); } catch (Throwable ignored) { }
        getWindow().getDecorView().setSystemUiVisibility(getWindow().getDecorView().getSystemUiVisibility());
    }

    /* ------------------------------------------------------------------ menu: picture size, speed, audio, subtitles, sleep timer, small window */
    private static final String[] RESIZE_NAMES = {"ملاءمة", "ملء الشاشة", "تكبير"};
    private static final int[] RESIZE_MODES = {AspectRatioFrameLayout.RESIZE_MODE_FIT, AspectRatioFrameLayout.RESIZE_MODE_FILL, AspectRatioFrameLayout.RESIZE_MODE_ZOOM};

    private void cycleResize() { resize = (resize + 1) % 3; pv.setResizeMode(RESIZE_MODES[resize]); hud("حجم الصورة: " + RESIZE_NAMES[resize]); }

    private AlertDialog.Builder dlg(String t) { return new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(t); }

    private void openMenu() {
        final List<String> items = new ArrayList<>(); final List<Integer> ids = new ArrayList<>();
        items.add("حجم الصورة: " + RESIZE_NAMES[resize]); ids.add(0);
        if (vod) { items.add("سرعة التشغيل: " + (speed == (int) speed ? String.valueOf((int) speed) : String.valueOf(speed)) + "×"); ids.add(1); }
        items.add("لغة الصوت"); ids.add(2);
        items.add("الترجمة"); ids.add(3);
        items.add("مؤقت النوم"); ids.add(4);
        if (android.os.Build.VERSION.SDK_INT >= 26) { items.add("نافذة صغيرة"); ids.add(5); }
        items.add("نسخ رابط البث"); ids.add(6);
        dlg("خيارات المشغّل").setItems(items.toArray(new String[0]), new android.content.DialogInterface.OnClickListener() {
            public void onClick(android.content.DialogInterface d, int w) {
                switch (ids.get(w)) {
                    case 0: cycleResize(); break;
                    case 1: speedDialog(); break;
                    case 2: trackDialog(C.TRACK_TYPE_AUDIO, "لغة الصوت"); break;
                    case 3: trackDialog(C.TRACK_TYPE_TEXT, "الترجمة"); break;
                    case 4: sleepDialog(); break;
                    case 5: enterPip(); break;
                    default: copyUrl(); break;
                }
            }
        }).show();
    }

    private void speedDialog() {
        final float[] v = {.5f, .75f, 1f, 1.25f, 1.5f, 2f};
        String[] n = {"٠٫٥×", "٠٫٧٥×", "عادية ١×", "١٫٢٥×", "١٫٥×", "٢×"};
        dlg("سرعة التشغيل").setItems(n, new android.content.DialogInterface.OnClickListener() {
            public void onClick(android.content.DialogInterface d, int w) { speed = v[w]; if (player != null) player.setPlaybackParameters(new PlaybackParameters(speed)); hud("السرعة " + n_(speed)); }
        }).show();
    }
    private String n_(float s) { return (s == (int) s ? String.valueOf((int) s) : String.valueOf(s)) + "×"; }

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
                    hud("تم");
                } catch (Throwable t) { toast("ما تبدّل المسار"); }
            }
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
    public void onBackPressed() { if (drawer != null && drawer.getVisibility() == View.VISIBLE) { hideDrawer(); return; } super.onBackPressed(); }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, android.content.res.Configuration c) {
        super.onPictureInPictureModeChanged(inPip, c);
        if (inPip) { top.setVisibility(View.GONE); hideDrawer(); if (prev != null) { prev.setVisibility(View.GONE); next.setVisibility(View.GONE); } }
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
