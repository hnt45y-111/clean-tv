package com.cleantv.launcher;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.BaseAdapter;
import android.widget.ListView;
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
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.common.text.CueGroup;
import androidx.media3.ui.SubtitleView;
import androidx.media3.ui.CaptionStyleCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.ArrayList;
import java.util.List;

/**
 * «قنواتي»: full-screen live player. Up / down (or channel up / down) switches the channel, OK shows the info bar again,
 * Back returns to the launcher. The info bar (logo, name, quality) runs edge to edge along the bottom and hides 4 seconds
 * after the channel starts playing. ExoPlayer plays every kind of HLS stream the same on every TV box.
 */
public class LiveActivity extends Activity {
    /** the channel pack handed over by the page (a static field: big lists do not fit an Intent) */
    static volatile String PACK = null;
    private static final int INK = Color.parseColor("#15181B"), IVORY = Color.parseColor("#EFE7D4"), COPPER = Color.parseColor("#D9822B"), CHROME = Color.parseColor("#B8BDC2");
    private final List<String> names = new ArrayList<>(), urls = new ArrayList<>(), ids = new ArrayList<>(), subs = new ArrayList<>(), refs = new ArrayList<>(), uas = new ArrayList<>(), logos = new ArrayList<>();
    private DefaultHttpDataSource.Factory httpFactory;
    private int idx, failed;
    private ExoPlayer player;
    private LinearLayout panel;
    private FrameLayout logoBox;
    private ImageView logo;
    private TextView mono, nameV, subV, qualV, numV, state;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable hide = new Runnable() { public void run() { panel.animate().alpha(0f).setDuration(350).withEndAction(new Runnable() { public void run() { panel.setVisibility(View.GONE); } }).start(); } };
    private float d;
    private final List<Boolean> yts = new ArrayList<>();
    private final List<String> fNames = new ArrayList<>();
    private final List<int[]> fIdx = new ArrayList<>();
    private boolean vod;      // a film or episode: seek and pause instead of zapping
    private int curFolder, selFolder, chSel, focusCol, downHandled = -1;
    private boolean panelOpen;
    private FrameLayout root;
    private SurfaceView sv;
    private SubtitleView ccView;
    private WebView yt;
    private String ytWatch;
    private boolean ytFell;
    private LinearLayout listPanel;
    private ListView fList, cList;
    private View vDiv;
    private TextView listTitle, listHint;
    private int mode;                 // 0 no list, 1 channels (right arrow), 2 folders (left arrow)
    private boolean foChOpen;         // in the folders list: a folder was chosen and its channels are showing
    private BaseAdapter fAd, cAd;
    private final android.util.LruCache<String, Bitmap> logoCache = new android.util.LruCache<>(120);

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
            String raw = PACK != null ? PACK : getIntent().getStringExtra("list");
            raw = raw == null ? "[]" : raw.trim();
            JSONArray a, fo = null;
            if (raw.startsWith("{")) { JSONObject ob = new JSONObject(raw); a = ob.getJSONArray("list"); fo = ob.optJSONArray("folders"); curFolder = ob.optInt("fold", 0); vod = ob.optInt("vod", 0) == 1; }
            else a = new JSONArray(raw);
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                names.add(o.optString("n")); urls.add(o.optString("u")); ids.add(o.optString("i")); subs.add(o.optString("s")); refs.add(o.optString("r")); uas.add(o.optString("ua")); logos.add(o.optString("l")); yts.add(o.optBoolean("yt"));
            }
            if (fo != null) for (int k = 0; k < fo.length(); k++) {
                JSONObject f = fo.getJSONObject(k); JSONArray ix = f.optJSONArray("idx"); if (ix == null) continue;
                int[] tmp = new int[ix.length()]; int c = 0;
                for (int q = 0; q < ix.length(); q++) { int v = ix.optInt(q, -1); if (v >= 0 && v < urls.size()) tmp[c++] = v; }
                if (c == 0) continue;
                fNames.add(f.optString("n")); fIdx.add(java.util.Arrays.copyOf(tmp, c));
            }
            if (fNames.isEmpty()) { int[] all = new int[urls.size()]; for (int i = 0; i < all.length; i++) all[i] = i; fNames.add("كل القنوات"); fIdx.add(all); curFolder = 0; }
            curFolder = Math.max(0, Math.min(fNames.size() - 1, curFolder));
        } catch (Throwable t) { finish(); return; }
        if (urls.isEmpty()) { finish(); return; }
        idx = Math.max(0, Math.min(urls.size() - 1, getIntent().getIntExtra("idx", 0)));

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        sv = new SurfaceView(this);
        root.addView(sv, new FrameLayout.LayoutParams(-1, -1));
        ccView = new SubtitleView(this);
        ccView.setApplyEmbeddedStyles(false);
        ccView.setStyle(new CaptionStyleCompat(IVORY, Color.parseColor("#AA000000"), Color.TRANSPARENT, CaptionStyleCompat.EDGE_TYPE_OUTLINE, Color.BLACK, null));
        root.addView(ccView, new FrameLayout.LayoutParams(-1, -1));
        applyQuietMode();

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
        buildListPanel();
        setContentView(root);

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setAllowCrossProtocolRedirects(true).setConnectTimeoutMs(12000).setReadTimeoutMs(12000)
                .setUserAgent("Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Safari/537.36");
        httpFactory = http;
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
            @Override public void onCues(CueGroup cueGroup) { ccView.setCues(cueGroup.cues); }
            @Override public void onVideoSizeChanged(VideoSize v) {
                int hgt = v.height;
                if (hgt <= 0) return;
                qualV.setText(hgt >= 2000 ? "4K · " + hgt + "p" : hgt >= 1000 ? "FHD · " + hgt + "p" : hgt >= 700 ? "HD · " + hgt + "p" : "SD · " + hgt + "p");
            }
            @Override public void onPlayerError(PlaybackException e) {
                failed++;
                state.setText("هذي القناة ما اشتغلت الآن (" + why(e) + "). جرّب قناة ثانية بالأسهم");
                showPanel(8000);
                if (failed < 2) h.postDelayed(new Runnable() { public void run() { play(idx); } }, 2500);
            }
        });
        applyQuietMode();
        h.postDelayed(quietTick, 5 * 60000);
        play(idx);
    }

    private final Runnable quietTick = new Runnable() { public void run() { applyQuietMode(); h.postDelayed(this, 5 * 60000); } };
    /** after the user's chosen hour at night, the sound drops on its own and subtitles grow — quiet, on by default off unless the phone app turned it on */
    private void applyQuietMode() {
        try {
            android.content.SharedPreferences p = Media.prefs(this);
            boolean on = p.getString("quietOn", "0").equals("1");
            int from = Integer.parseInt(p.getString("quietHour", "23")), to = Integer.parseInt(p.getString("quietEndHour", "7"));
            int hr = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
            boolean quiet = on && (from <= to ? (hr >= from && hr < to) : (hr >= from || hr < to));
            ccView.setFractionalTextSize(quiet ? SubtitleView.DEFAULT_TEXT_SIZE_FRACTION * 1.6f : SubtitleView.DEFAULT_TEXT_SIZE_FRACTION);
            if (quiet && player != null) player.setVolume(0.45f);
            else if (player != null) player.setVolume(1f);
        } catch (Throwable ignored) { }
    }

    /** the reason in a few words, so that a channel that does not play can be told apart: blocked, gone, no internet... */
    private static String why(PlaybackException e) {
        Throwable c = e.getCause();
        while (c != null) {
            if (c instanceof HttpDataSource.InvalidResponseCodeException) {
                int code = ((HttpDataSource.InvalidResponseCodeException) c).responseCode;
                return code == 403 || code == 451 ? "الخادم رفض الطلب " + code + "، غالباً محجوبة خارج بلدها" : code == 404 || code == 410 ? "الرابط ما عاد موجود " + code : "رد الخادم " + code;
            }
            if (c instanceof java.net.UnknownHostException) return "ما لگيت عنوان الخادم";
            if (c instanceof java.net.SocketTimeoutException) return "الخادم تأخر بالرد";
            if (c instanceof javax.net.ssl.SSLException) return "مشكلة شهادة الأمان";
            c = c.getCause();
        }
        return e.getErrorCodeName();
    }

    private void loadRemoteLogo(final String url, final int forIdx) {
        new Thread(new Runnable() { public void run() {
            try (InputStream in = new java.net.URL(url).openStream()) {
                final Bitmap bm = BitmapFactory.decodeStream(in);
                if (bm != null) h.post(new Runnable() { public void run() { if (idx == forIdx) logo.setImageBitmap(bm); } });
            } catch (Throwable ignored) { }
        } }).start();
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
        if (vod) saveVodPos();    // a film or episode: keep exactly where this one stopped before switching away
        idx = (i + urls.size()) % urls.size();
        // the last folder and channel are kept, so the next start opens on them
        try { Media.prefs(this).edit().putString("liveLast", new JSONObject().put("f", fNames.get(curFolder)).put("k", urls.get(idx) + "|" + names.get(idx)).toString()).apply(); } catch (Throwable ignored) { }
        String n = names.get(idx);
        nameV.setText(n);
        subV.setText(subs.get(idx));
        qualV.setText("…");
        int[] zo = fIdx.get(curFolder); int zp = posIn(zo, idx);
        numV.setText((zp < 0 ? 1 : zp + 1) + " / " + zo.length);
        mono.setText(n.replaceFirst("^ال", "").replace(" ", "").substring(0, Math.min(2, n.replaceFirst("^ال", "").replace(" ", "").length())));
        logo.setImageBitmap(null);
        String id = ids.get(idx);
        if (id != null && id.length() > 0) {
            try (InputStream in = getAssets().open("logos/" + id + ".png")) { logo.setImageBitmap(BitmapFactory.decodeStream(in)); } catch (Throwable ignored) { }
        }
        String lu = logos.get(idx);
        if ((id == null || id.length() == 0) && lu != null && lu.startsWith("http")) loadRemoteLogo(lu, idx);
        // some free streams only play with the broadcaster's own referrer / user agent
        java.util.Map<String, String> hd = new java.util.HashMap<>();
        if (refs.get(idx).length() > 0) hd.put("Referer", refs.get(idx));
        httpFactory.setDefaultRequestProperties(hd);
        httpFactory.setUserAgent(uas.get(idx).length() > 0 ? uas.get(idx) : "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Safari/537.36");
        showPanel(0);          // stays until the picture is playing, then 4 more seconds
        state.setText("جاري التحميل…");
        if (yts.get(idx)) { playYT(urls.get(idx), idx); return; }
        hideYT();
        player.setMediaItem(MediaItem.fromUri(urls.get(idx)));
        player.prepare();
        if (vod) {
            long saved = Media.prefs(this).getLong(vodKey(urls.get(idx)), 0);
            if (saved > 4000) { player.seekTo(saved); state.setText("إكمال من حيث وقفت…"); }
        }
        player.setPlayWhenReady(true);
        if (vod) { h.removeCallbacks(vodPosTick); h.postDelayed(vodPosTick, 5000); }
    }

    private String vodKey(String url) { return "vodPos|" + url.hashCode(); }
    /** every film/episode remembers exactly where it stopped, so the next open picks up there — even after the TV was off for hours */
    private void saveVodPos() {
        try {
            if (player == null || idx < 0 || idx >= urls.size()) return;
            long pos = player.getCurrentPosition(), dur = player.getDuration();
            String k = vodKey(urls.get(idx));
            if (pos > 4000 && (dur <= 0 || pos < dur - 15000)) Media.prefs(this).edit().putLong(k, pos).apply();
            else Media.prefs(this).edit().remove(k).apply();   // finished (or barely started): nothing to resume
        } catch (Throwable ignored) { }
    }
    private final Runnable vodPosTick = new Runnable() { public void run() { if (vod) { saveVodPos(); h.postDelayed(this, 5000); } } };

    private static int posIn(int[] a, int ch) { for (int i = 0; i < a.length; i++) if (a[i] == ch) return i; return -1; }

    private void zap(int dir) {
        int[] a = fIdx.get(curFolder);
        int p = posIn(a, idx); if (p < 0) p = 0;
        failed = 0;
        play(a[(p + dir + a.length) % a.length]);
    }

    // ---------------------------------------------------------------- the channel list (OK on a channel)
    private Typeface kufi, plexB, plexR;
    private Typeface font(String file, Typeface fallback) {
        try { return Typeface.createFromAsset(getAssets(), "fonts/" + file); } catch (Throwable t) { return fallback; }
    }
    private TextView ptv(float sp, int color, Typeface tf) {
        TextView t = new TextView(this);
        t.setTextSize(sp); t.setTextColor(color); t.setIncludeFontPadding(false); t.setTypeface(tf);
        return t;
    }
    /** the same flat cards as the page: surf fill, thin chrome border, copper ring on focus */
    private GradientDrawable cardBg(boolean focused, boolean selected, int radiusDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(focused ? Color.parseColor("#2A3036") : selected ? Color.parseColor("#23282D") : Color.parseColor("#1D2125"));
        g.setCornerRadius(dp(radiusDp));
        if (focused) g.setStroke(dp(3), COPPER); else g.setStroke(1, Color.parseColor("#3A4046"));
        return g;
    }

    private Bitmap logoFor(String id) {
        if (id == null || id.length() == 0) return null;
        Bitmap b = logoCache.get(id);
        if (b != null) return b;
        try (InputStream in = getAssets().open("logos/" + id + ".png")) {
            BitmapFactory.Options o = new BitmapFactory.Options(); o.inSampleSize = 2;
            b = BitmapFactory.decodeStream(in, null, o);
            if (b != null) logoCache.put(id, b);
        } catch (Throwable ignored) { }
        return b;
    }

    private static int tintOf(String s) {
        int h = 7; for (int i = 0; i < s.length(); i++) h = (h * 31 + s.charAt(i)) % 360;
        return Color.HSVToColor(new float[] { h, 0.30f, 0.30f });
    }

    private ListView newList() {
        ListView lv = new ListView(this);
        lv.setDivider(null); lv.setSelector(new ColorDrawable(Color.TRANSPARENT)); lv.setFocusable(false);
        lv.setVerticalScrollBarEnabled(false); lv.setOverScrollMode(View.OVER_SCROLL_NEVER); lv.setCacheColorHint(0);
        return lv;
    }

    private TextView listCount;

    private void buildListPanel() {
        kufi = font("ReemKufi.ttf", Typeface.DEFAULT_BOLD);
        plexB = font("PlexArabic-SemiBold.ttf", Typeface.DEFAULT_BOLD);
        plexR = font("PlexArabic-Regular.ttf", Typeface.DEFAULT);
        int pw = Math.round(getResources().getDisplayMetrics().widthPixels * 0.36f);
        listPanel = new LinearLayout(this);
        listPanel.setOrientation(LinearLayout.VERTICAL);
        listPanel.setBackgroundColor(Color.parseColor("#F815181B"));
        View top = new View(this); top.setBackgroundColor(COPPER);
        listPanel.addView(top, new LinearLayout.LayoutParams(-1, dp(6)));
        View top2 = new View(this); top2.setBackgroundColor(CHROME);
        listPanel.addView(top2, new LinearLayout.LayoutParams(-1, dp(1)));
        LinearLayout head = new LinearLayout(this);
        head.setOrientation(LinearLayout.VERTICAL);
        head.setPadding(dp(26), dp(18), dp(26), dp(12));
        TextView title = ptv(34, IVORY, kufi); title.setText("قنواتي"); listTitle = title;
        listCount = ptv(14, CHROME, plexR);
        LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(-2, -2); cl.topMargin = dp(6);
        head.addView(title); head.addView(listCount, cl);
        listPanel.addView(head, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout cols = new LinearLayout(this);
        cols.setOrientation(LinearLayout.HORIZONTAL);
        cols.setPadding(dp(14), 0, dp(14), 0);
        fList = newList(); cList = newList();
        // right to left: the channels first (towards the middle of the screen), then the divider, then the folders (at the edge)
        cols.addView(cList, new LinearLayout.LayoutParams(0, -1, 0.6f));
        vDiv = new View(this); vDiv.setBackgroundColor(Color.parseColor("#3A4046"));
        LinearLayout.LayoutParams vp = new LinearLayout.LayoutParams(dp(1), -1); vp.setMargins(dp(8), dp(4), dp(8), dp(4));
        cols.addView(vDiv, vp);
        cols.addView(fList, new LinearLayout.LayoutParams(0, -1, 0.4f));
        listPanel.addView(cols, new LinearLayout.LayoutParams(-1, 0, 1f));
        listHint = ptv(13, CHROME, plexR);
        listHint.setPadding(dp(26), dp(10), dp(26), dp(14));
        listPanel.addView(listHint, new LinearLayout.LayoutParams(-1, -2));
        listPanel.setVisibility(View.GONE);
        root.addView(listPanel, new FrameLayout.LayoutParams(pw, -1, Gravity.START));

        fAd = new BaseAdapter() {
            public int getCount() { return fNames.size(); }
            public Object getItem(int p) { return null; }
            public long getItemId(int p) { return p; }
            public View getView(int p, View v, ViewGroup g) {
                LinearLayout r;
                if (v == null) {
                    r = new LinearLayout(LiveActivity.this); r.setGravity(Gravity.CENTER_VERTICAL);
                    r.setPadding(dp(4), dp(2), dp(4), dp(2));
                    LinearLayout card = new LinearLayout(LiveActivity.this); card.setGravity(Gravity.CENTER_VERTICAL);
                    View bar = new View(LiveActivity.this); card.addView(bar, new LinearLayout.LayoutParams(dp(5), dp(26)));
                    TextView t = ptv(17, IVORY, plexB); t.setPadding(dp(12), dp(13), dp(8), dp(13));
                    card.addView(t, new LinearLayout.LayoutParams(0, -2, 1f));
                    r.addView(card, new LinearLayout.LayoutParams(-1, -2));
                } else r = (LinearLayout) v;
                LinearLayout card = (LinearLayout) r.getChildAt(0);
                View bar = card.getChildAt(0); TextView t = (TextView) card.getChildAt(1);
                boolean sel = p == selFolder, foc = sel && focusCol == 0;
                t.setText(fNames.get(p)); t.setTextColor(sel ? IVORY : Color.parseColor("#CFC8B8"));
                bar.setBackgroundColor(sel ? COPPER : Color.TRANSPARENT);
                GradientDrawable bg = cardBg(foc, sel, 8);
                if (!sel) { bg.setColor(Color.TRANSPARENT); bg.setStroke(0, Color.TRANSPARENT); }
                card.setBackground(bg);
                return r;
            }
        };
        fList.setAdapter(fAd);

        cAd = new BaseAdapter() {
            public int getCount() { return fIdx.get(selFolder).length; }
            public Object getItem(int p) { return null; }
            public long getItemId(int p) { return p; }
            public View getView(int p, View v, ViewGroup g) {
                LinearLayout r;
                if (v == null) {
                    r = new LinearLayout(LiveActivity.this); r.setPadding(dp(5), dp(4), dp(5), dp(4));
                    LinearLayout card = new LinearLayout(LiveActivity.this); card.setGravity(Gravity.CENTER_VERTICAL); card.setPadding(dp(12), dp(10), dp(14), dp(10));
                    FrameLayout box = new FrameLayout(LiveActivity.this);
                    TextView m = ptv(19, IVORY, kufi); m.setGravity(Gravity.CENTER); box.addView(m, new FrameLayout.LayoutParams(-1, -1));
                    ImageView im = new ImageView(LiveActivity.this); im.setScaleType(ImageView.ScaleType.FIT_CENTER); im.setPadding(dp(6), dp(6), dp(6), dp(6)); box.addView(im, new FrameLayout.LayoutParams(-1, -1));
                    LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(dp(58), dp(58)); bl.setMarginEnd(dp(14)); card.addView(box, bl);
                    LinearLayout col = new LinearLayout(LiveActivity.this); col.setOrientation(LinearLayout.VERTICAL);
                    TextView n = ptv(19, IVORY, plexB); n.setSingleLine(true); n.setEllipsize(android.text.TextUtils.TruncateAt.END);
                    TextView sb = ptv(13, CHROME, plexR); sb.setSingleLine(true); sb.setEllipsize(android.text.TextUtils.TruncateAt.END);
                    LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(-2, -2); sl.topMargin = dp(4);
                    col.addView(n); col.addView(sb, sl);
                    card.addView(col, new LinearLayout.LayoutParams(0, -2, 1f));
                    TextView live = ptv(12, INK, kufi); live.setText("يعرض الآن"); live.setPadding(dp(10), dp(4), dp(10), dp(4));
                    GradientDrawable lb = new GradientDrawable(); lb.setColor(COPPER); lb.setCornerRadius(dp(4)); live.setBackground(lb);
                    card.addView(live);
                    r.addView(card, new LinearLayout.LayoutParams(-1, -2));
                } else r = (LinearLayout) v;
                int ch = fIdx.get(selFolder)[p];
                LinearLayout card = (LinearLayout) r.getChildAt(0);
                FrameLayout box = (FrameLayout) card.getChildAt(0);
                TextView m = (TextView) box.getChildAt(0); ImageView im = (ImageView) box.getChildAt(1);
                LinearLayout col = (LinearLayout) card.getChildAt(1);
                String nm = names.get(ch);
                String ini = nm.replaceFirst("^ال", "").replace(" ", "");
                m.setText(ini.substring(0, Math.min(2, ini.length())));
                Bitmap lg = logoFor(ids.get(ch));
                GradientDrawable bb = new GradientDrawable(); bb.setCornerRadius(dp(8)); bb.setColor(lg != null ? IVORY : tintOf(nm)); box.setBackground(bb);
                im.setImageBitmap(lg);
                ((TextView) col.getChildAt(0)).setText(nm);
                ((TextView) col.getChildAt(1)).setText(subs.get(ch));
                card.getChildAt(2).setVisibility(ch == idx ? View.VISIBLE : View.GONE);
                card.setBackground(cardBg(focusCol == 1 && p == chSel, p == chSel, 12));
                return r;
            }
        };
        cList.setAdapter(cAd);
    }

    private void scrollList(final ListView lv, final int pos) {
        lv.post(new Runnable() { public void run() { lv.setSelectionFromTop(Math.max(0, pos), Math.max(0, lv.getHeight() / 3)); } });
    }

    private void refreshPanel() {
        listCount.setText(mode == 2 && !foChOpen ? fNames.size() + " مجلد" : fNames.get(selFolder) + " · " + fIdx.get(selFolder).length + " قناة");
        fAd.notifyDataSetChanged(); cAd.notifyDataSetChanged();
    }

    /* right arrow: the channels of the folder that is playing, as a list on the right.
       left arrow: all the folders on the left; choosing one shows its channels next to it. OK only chooses. */
    private void layoutPanel() {
        int w = getResources().getDisplayMetrics().widthPixels;
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) listPanel.getLayoutParams();
        LinearLayout.LayoutParams fl = (LinearLayout.LayoutParams) fList.getLayoutParams(), cl = (LinearLayout.LayoutParams) cList.getLayoutParams();
        if (mode == 1) {
            lp.gravity = Gravity.START; lp.width = Math.round(w * 0.34f);
            fList.setVisibility(View.GONE); vDiv.setVisibility(View.GONE); cList.setVisibility(View.VISIBLE); cl.weight = 1f;
            listTitle.setText("القنوات"); listHint.setText("▲ ▼ تنقل · OK تشغيل القناة · رجوع للإغلاق");
        } else {
            lp.gravity = Gravity.END; lp.width = Math.round(w * (foChOpen ? 0.62f : 0.27f));
            fList.setVisibility(View.VISIBLE); vDiv.setVisibility(foChOpen ? View.VISIBLE : View.GONE); cList.setVisibility(foChOpen ? View.VISIBLE : View.GONE);
            fl.weight = foChOpen ? 0.4f : 1f; cl.weight = 0.6f;
            listTitle.setText("المجلدات"); listHint.setText(foChOpen ? "▲ ▼ تنقل · OK تشغيل · ► القنوات ◄ المجلدات · رجوع" : "▲ ▼ تنقل · OK اختيار المجلد · رجوع للإغلاق");
        }
        listPanel.setLayoutParams(lp); fList.setLayoutParams(fl); cList.setLayoutParams(cl);
    }

    private void openChannels() {
        mode = 1; panelOpen = true; selFolder = curFolder; focusCol = 1; foChOpen = false;
        chSel = Math.max(0, posIn(fIdx.get(selFolder), idx));
        h.removeCallbacks(hide); panel.setVisibility(View.GONE);
        layoutPanel(); listPanel.setVisibility(View.VISIBLE);
        refreshPanel(); scrollList(cList, chSel);
    }

    private void openFolders() {
        mode = 2; panelOpen = true; selFolder = curFolder; focusCol = 0; foChOpen = false;
        chSel = Math.max(0, posIn(fIdx.get(selFolder), idx));
        h.removeCallbacks(hide); panel.setVisibility(View.GONE);
        layoutPanel(); listPanel.setVisibility(View.VISIBLE);
        refreshPanel(); scrollList(fList, selFolder);
    }

    private void closePanel() { panelOpen = false; mode = 0; foChOpen = false; listPanel.setVisibility(View.GONE); }

    private boolean panelKey(int code) {
        int[] cur = fIdx.get(selFolder);
        switch (code) {
            case KeyEvent.KEYCODE_BACK:
                if (mode == 2 && foChOpen) { foChOpen = false; focusCol = 0; layoutPanel(); refreshPanel(); scrollList(fList, selFolder); }
                else closePanel();
                return true;
            case KeyEvent.KEYCODE_DPAD_UP: case KeyEvent.KEYCODE_DPAD_DOWN: {
                int dir = code == KeyEvent.KEYCODE_DPAD_DOWN ? 1 : -1;
                if (focusCol == 0) {
                    int n = Math.max(0, Math.min(fNames.size() - 1, selFolder + dir));
                    if (n != selFolder) { selFolder = n; chSel = Math.max(0, posIn(fIdx.get(n), idx)); refreshPanel(); scrollList(fList, selFolder); if (foChOpen) scrollList(cList, chSel); }
                } else {
                    chSel = Math.max(0, Math.min(cur.length - 1, chSel + dir)); refreshPanel(); scrollList(cList, chSel);
                }
                return true;
            }
            case KeyEvent.KEYCODE_DPAD_RIGHT:      // folders sit on the left, their channels on the right of them
                if (mode == 2 && foChOpen && focusCol == 0 && cur.length > 0) { focusCol = 1; refreshPanel(); }
                return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
                if (mode == 2 && foChOpen && focusCol == 1) { focusCol = 0; refreshPanel(); }
                return true;
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER:
                if (mode == 2 && focusCol == 0) {          // OK on a folder: show its channels
                    foChOpen = true; focusCol = 1; chSel = Math.max(0, posIn(fIdx.get(selFolder), idx)); layoutPanel(); refreshPanel(); scrollList(cList, chSel);
                } else if (cur.length > 0) {              // OK on a channel: play it
                    curFolder = selFolder; failed = 0; int target = cur[Math.min(chSel, cur.length - 1)]; closePanel(); play(target);
                }
                return true;
            default: return false;
        }
    }

    private boolean handleKey(int code) {
        if (panelOpen) return panelKey(code);
        if (vod && player != null) {
            switch (code) {
                case KeyEvent.KEYCODE_DPAD_RIGHT: player.seekTo(Math.max(0, player.getCurrentPosition() - 15000)); return true;
                case KeyEvent.KEYCODE_DPAD_LEFT: player.seekTo(player.getCurrentPosition() + 15000); return true;
                case KeyEvent.KEYCODE_DPAD_UP: case KeyEvent.KEYCODE_DPAD_DOWN: return true;
                case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER: case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: player.setPlayWhenReady(!player.getPlayWhenReady()); return true;
                case KeyEvent.KEYCODE_BACK: finish(); return true;
                default: break;
            }
        }
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP: case KeyEvent.KEYCODE_CHANNEL_UP: case KeyEvent.KEYCODE_PAGE_UP: zap(1); return true;
            case KeyEvent.KEYCODE_DPAD_DOWN: case KeyEvent.KEYCODE_CHANNEL_DOWN: case KeyEvent.KEYCODE_PAGE_DOWN: zap(-1); return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT: openChannels(); return true;
            case KeyEvent.KEYCODE_DPAD_LEFT: openFolders(); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER: return true;      // OK only chooses inside the lists
            case KeyEvent.KEYCODE_BACK: finish(); return true;
            default: return false;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode();
        if (e.getAction() == KeyEvent.ACTION_DOWN) { if (handleKey(code)) { downHandled = code; return true; } }
        else if (e.getAction() == KeyEvent.ACTION_UP && downHandled == code) { downHandled = -1; return true; }
        return super.dispatchKeyEvent(e);
    }

    // ---------------------------------------------------------------- YouTube links play inside the app (embedded player)
    private void ensureYT() {
        if (yt != null) return;
        yt = new WebView(this);
        yt.setBackgroundColor(Color.BLACK); yt.setFocusable(false);
        WebSettings ws = yt.getSettings();
        ws.setJavaScriptEnabled(true); ws.setDomStorageEnabled(true); ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setUserAgentString("Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36");
        yt.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView v, String url) {
                if (ytFell) { for (int i = 1; i <= 4; i++) h.postDelayed(new Runnable() { public void run() { if (yt != null) yt.evaluateJavascript("var v=document.querySelector('video');if(v){v.muted=false;v.play();}", null); } }, i * 1800L); }
            }
        });
        yt.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface public void fail() { h.post(new Runnable() { public void run() { ytFallback(); } }); }
        }, "YtB");
        root.addView(yt, 1, new FrameLayout.LayoutParams(-1, -1));
    }

    private void hideYT() {
        if (yt == null) return;
        yt.loadUrl("about:blank"); yt.setVisibility(View.GONE);
    }

    private static String ytEmbed(String url) {
        Matcher m = Pattern.compile("(?:[?&]v=|youtu\\.be/|/live/|/embed/|/shorts/)([\\w-]{11})").matcher(url);
        String tail = "?autoplay=1&rel=0&playsinline=1&controls=0&modestbranding=1";
        if (m.find()) return "https://www.youtube.com/embed/" + m.group(1) + tail;
        m = Pattern.compile("/channel/(UC[\\w-]{22})").matcher(url);
        if (m.find()) return "https://www.youtube.com/embed/live_stream" + tail + "&channel=" + m.group(1);
        // a channel page (@name/live): ask YouTube which video is live there
        try {
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
            c.setConnectTimeout(10000); c.setReadTimeout(15000);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Safari/537.36");
            c.setRequestProperty("Accept-Language", "en");
            java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
            try (InputStream in = c.getInputStream()) { byte[] buf = new byte[16384]; int n, tot = 0; while ((n = in.read(buf)) > 0 && tot < 900000) { bo.write(buf, 0, n); tot += n; } }
            String page = bo.toString("UTF-8");
            Matcher k = Pattern.compile("rel=\"canonical\" href=\"https://www\\.youtube\\.com/watch\\?v=([\\w-]{11})").matcher(page);
            if (k.find()) return "https://www.youtube.com/embed/" + k.group(1) + tail;
            k = Pattern.compile("\"videoId\":\"([\\w-]{11})\"").matcher(page);
            if (k.find()) return "https://www.youtube.com/embed/" + k.group(1) + tail;
        } catch (Throwable ignored) { }
        return null;
    }

    /** the normal YouTube page of the same video / live channel: used when the owner does not allow the embedded player (error 152) */
    private static String ytWatchOf(String url) {
        Matcher m = Pattern.compile("(?:[?&]v=|youtu\\.be/|/live/|/embed/|/shorts/)([\\w-]{11})").matcher(url);
        if (m.find()) return "https://m.youtube.com/watch?v=" + m.group(1);
        m = Pattern.compile("/channel/(UC[\\w-]{22})").matcher(url);
        if (m.find()) return "https://m.youtube.com/channel/" + m.group(1) + "/live";
        return url.replace("://www.youtube.com", "://m.youtube.com");
    }

    private void ytFallback() {
        if (yt == null || ytWatch == null || ytFell) return;
        ytFell = true;
        yt.getSettings().setUserAgentString("Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
        yt.loadUrl(ytWatch);
    }

    private void playYT(final String url, final int forIdx) {
        ytWatch = ytWatchOf(url); ytFell = false;
        if (player != null) player.stop();
        qualV.setText("YouTube");
        new Thread(new Runnable() { public void run() {
            final String src = ytEmbed(url);
            h.post(new Runnable() { public void run() {
                if (isFinishing() || idx != forIdx) return;
                if (src == null) { state.setText("ما گدرت أشغّل رابط يوتيوب هذا داخل البرنامج"); showPanel(8000); return; }
                ensureYT();
                yt.setVisibility(View.VISIBLE);
                String api = src + (src.contains("?") ? "&" : "?") + "enablejsapi=1&origin=https://www.youtube.com";
                String html = "<!doctype html><html><body style=\"margin:0;background:#000\"><iframe id=\"f\" src=\"" + api + "\" allow=\"autoplay; encrypted-media; fullscreen\" allowfullscreen frameborder=\"0\" style=\"position:fixed;left:0;top:0;width:100%;height:100%;border:0\"></iframe>"
                        + "<script>var f=document.getElementById('f');function L(){try{f.contentWindow.postMessage(JSON.stringify({event:'listening',id:1,channel:'widget'}),'*');f.contentWindow.postMessage(JSON.stringify({event:'command',func:'addEventListener',args:['onError']}),'*');}catch(e){}}"
                        + "f.onload=function(){L();setTimeout(L,1200);setTimeout(L,3000);};"
                        + "window.addEventListener('message',function(e){try{var d=typeof e.data==='string'?JSON.parse(e.data):e.data;if(d&&(d.event==='onError'||(d.info&&d.info.errorCode)||(d.event==='infoDelivery'&&d.info&&d.info.playerState===-1&&false))){YtB.fail();}}catch(x){}});"
                        + "setTimeout(function(){L();},800);</script></body></html>";
                yt.loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "utf-8", null);
                state.setText("");
                h.removeCallbacks(hide); h.postDelayed(hide, 5000);
            } });
        } }).start();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (vod) saveVodPos();
        if (player != null) { player.release(); player = null; }
        if (yt != null) { try { yt.destroy(); } catch (Throwable ignored) { } yt = null; }
        h.removeCallbacksAndMessages(null);
        finish();
    }
}
