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
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

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
    private int curFolder, selFolder, chSel, focusCol, downHandled = -1;
    private boolean panelOpen;
    private FrameLayout root;
    private SurfaceView sv;
    private WebView yt;
    private LinearLayout listPanel;
    private ListView fList, cList;
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
            if (raw.startsWith("{")) { JSONObject ob = new JSONObject(raw); a = ob.getJSONArray("list"); fo = ob.optJSONArray("folders"); curFolder = ob.optInt("fold", 0); }
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
        idx = (i + urls.size()) % urls.size();
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
        player.setPlayWhenReady(true);
    }

    private static int posIn(int[] a, int ch) { for (int i = 0; i < a.length; i++) if (a[i] == ch) return i; return -1; }

    private void zap(int dir) {
        int[] a = fIdx.get(curFolder);
        int p = posIn(a, idx); if (p < 0) p = 0;
        failed = 0;
        play(a[(p + dir + a.length) % a.length]);
    }

    // ---------------------------------------------------------------- the channel list (OK on a channel)
    private GradientDrawable rowBg(boolean focused, boolean selected) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(focused ? Color.parseColor("#2A3036") : selected ? Color.parseColor("#23282D") : Color.TRANSPARENT);
        g.setCornerRadius(dp(8));
        if (focused) g.setStroke(dp(2), COPPER);
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

    private ListView newList() {
        ListView lv = new ListView(this);
        lv.setDivider(null); lv.setSelector(new ColorDrawable(Color.TRANSPARENT)); lv.setFocusable(false);
        lv.setVerticalScrollBarEnabled(false); lv.setOverScrollMode(View.OVER_SCROLL_NEVER); lv.setCacheColorHint(0);
        return lv;
    }

    private void buildListPanel() {
        int pw = Math.round(getResources().getDisplayMetrics().widthPixels * 0.34f);
        listPanel = new LinearLayout(this);
        listPanel.setOrientation(LinearLayout.VERTICAL);
        listPanel.setBackgroundColor(Color.parseColor("#F415181B"));
        View top = new View(this); top.setBackgroundColor(COPPER);
        listPanel.addView(top, new LinearLayout.LayoutParams(-1, dp(5)));
        View top2 = new View(this); top2.setBackgroundColor(CHROME);
        listPanel.addView(top2, new LinearLayout.LayoutParams(-1, dp(1)));
        TextView title = tv(22, IVORY, true); title.setText("قنواتي");
        title.setPadding(dp(18), dp(14), dp(18), dp(10));
        listPanel.addView(title, new LinearLayout.LayoutParams(-2, -2));
        LinearLayout cols = new LinearLayout(this);
        cols.setOrientation(LinearLayout.HORIZONTAL);
        fList = newList(); cList = newList();
        cols.addView(fList, new LinearLayout.LayoutParams(0, -1, 0.36f));
        View vl = new View(this); vl.setBackgroundColor(Color.parseColor("#3A4046"));
        cols.addView(vl, new LinearLayout.LayoutParams(dp(1), -1));
        cols.addView(cList, new LinearLayout.LayoutParams(0, -1, 0.64f));
        listPanel.addView(cols, new LinearLayout.LayoutParams(-1, 0, 1f));
        listPanel.setVisibility(View.GONE);
        root.addView(listPanel, new FrameLayout.LayoutParams(pw, -1, Gravity.START));

        fAd = new BaseAdapter() {
            public int getCount() { return fNames.size(); }
            public Object getItem(int p) { return null; }
            public long getItemId(int p) { return p; }
            public View getView(int p, View v, ViewGroup g) {
                LinearLayout r;
                if (v == null) {
                    r = new LinearLayout(LiveActivity.this); r.setGravity(Gravity.CENTER_VERTICAL); r.setPadding(dp(6), dp(3), dp(6), dp(3));
                    View bar = new View(LiveActivity.this); r.addView(bar, new LinearLayout.LayoutParams(dp(4), dp(24)));
                    TextView t = tv(16, IVORY, true); t.setPadding(dp(10), dp(12), dp(6), dp(12)); r.addView(t, new LinearLayout.LayoutParams(0, -2, 1f));
                } else r = (LinearLayout) v;
                View bar = r.getChildAt(0); TextView t = (TextView) r.getChildAt(1);
                boolean sel = p == selFolder, foc = sel && focusCol == 0;
                t.setText(fNames.get(p)); t.setTextColor(sel ? IVORY : CHROME);
                bar.setBackgroundColor(sel ? COPPER : Color.TRANSPARENT);
                r.setBackground(rowBg(foc, sel));
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
                    r = new LinearLayout(LiveActivity.this); r.setGravity(Gravity.CENTER_VERTICAL); r.setPadding(dp(8), dp(6), dp(8), dp(6));
                    FrameLayout box = new FrameLayout(LiveActivity.this);
                    GradientDrawable bb = new GradientDrawable(); bb.setColor(IVORY); bb.setCornerRadius(dp(8)); box.setBackground(bb);
                    TextView m = tv(16, INK, true); m.setGravity(Gravity.CENTER); box.addView(m, new FrameLayout.LayoutParams(-1, -1));
                    ImageView im = new ImageView(LiveActivity.this); im.setScaleType(ImageView.ScaleType.FIT_CENTER); im.setPadding(dp(5), dp(5), dp(5), dp(5)); box.addView(im, new FrameLayout.LayoutParams(-1, -1));
                    LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(dp(46), dp(46)); bl.setMarginEnd(dp(10)); r.addView(box, bl);
                    LinearLayout col = new LinearLayout(LiveActivity.this); col.setOrientation(LinearLayout.VERTICAL);
                    TextView n = tv(16, IVORY, true); n.setSingleLine(true); n.setEllipsize(android.text.TextUtils.TruncateAt.END);
                    TextView sb = tv(12, CHROME, false); sb.setSingleLine(true); sb.setEllipsize(android.text.TextUtils.TruncateAt.END);
                    col.addView(n); col.addView(sb);
                    r.addView(col, new LinearLayout.LayoutParams(0, -2, 1f));
                    View dot = new View(LiveActivity.this); GradientDrawable dd = new GradientDrawable(); dd.setShape(GradientDrawable.OVAL); dd.setColor(COPPER); dot.setBackground(dd);
                    r.addView(dot, new LinearLayout.LayoutParams(dp(10), dp(10)));
                } else r = (LinearLayout) v;
                int ch = fIdx.get(selFolder)[p];
                FrameLayout box = (FrameLayout) r.getChildAt(0);
                TextView m = (TextView) box.getChildAt(0); ImageView im = (ImageView) box.getChildAt(1);
                LinearLayout col = (LinearLayout) r.getChildAt(1);
                String nm = names.get(ch);
                String ini = nm.replaceFirst("^ال", "").replace(" ", "");
                m.setText(ini.substring(0, Math.min(2, ini.length())));
                im.setImageBitmap(logoFor(ids.get(ch)));
                ((TextView) col.getChildAt(0)).setText(nm);
                ((TextView) col.getChildAt(1)).setText(subs.get(ch));
                r.getChildAt(2).setVisibility(ch == idx ? View.VISIBLE : View.INVISIBLE);
                r.setBackground(rowBg(focusCol == 1 && p == chSel, p == chSel));
                return r;
            }
        };
        cList.setAdapter(cAd);
    }

    private void scrollList(final ListView lv, final int pos) {
        lv.post(new Runnable() { public void run() { lv.setSelectionFromTop(Math.max(0, pos), Math.max(0, lv.getHeight() / 3)); } });
    }

    private void refreshPanel() { fAd.notifyDataSetChanged(); cAd.notifyDataSetChanged(); }

    private void openPanel() {
        panelOpen = true; selFolder = curFolder; focusCol = 1;
        chSel = Math.max(0, posIn(fIdx.get(selFolder), idx));
        h.removeCallbacks(hide); panel.setVisibility(View.GONE);
        listPanel.setVisibility(View.VISIBLE);
        refreshPanel(); scrollList(fList, selFolder); scrollList(cList, chSel);
    }

    private void closePanel() { panelOpen = false; listPanel.setVisibility(View.GONE); }

    private boolean panelKey(int code) {
        int[] cur = fIdx.get(selFolder);
        switch (code) {
            case KeyEvent.KEYCODE_BACK: closePanel(); return true;
            case KeyEvent.KEYCODE_DPAD_UP: case KeyEvent.KEYCODE_DPAD_DOWN: {
                int dir = code == KeyEvent.KEYCODE_DPAD_DOWN ? 1 : -1;
                if (focusCol == 0) {
                    int n = Math.max(0, Math.min(fNames.size() - 1, selFolder + dir));
                    if (n != selFolder) { selFolder = n; chSel = Math.max(0, posIn(fIdx.get(n), idx)); refreshPanel(); scrollList(fList, selFolder); scrollList(cList, chSel); }
                } else {
                    chSel = Math.max(0, Math.min(cur.length - 1, chSel + dir)); refreshPanel(); scrollList(cList, chSel);
                }
                return true;
            }
            case KeyEvent.KEYCODE_DPAD_RIGHT: focusCol = 0; refreshPanel(); return true;
            case KeyEvent.KEYCODE_DPAD_LEFT: if (cur.length > 0) { focusCol = 1; refreshPanel(); } return true;
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER:
                if (focusCol == 0) { if (cur.length > 0) { focusCol = 1; refreshPanel(); } }
                else if (cur.length > 0) { curFolder = selFolder; failed = 0; int target = cur[Math.min(chSel, cur.length - 1)]; closePanel(); play(target); }
                return true;
            default: return false;
        }
    }

    private boolean handleKey(int code) {
        if (panelOpen) return panelKey(code);
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP: case KeyEvent.KEYCODE_CHANNEL_UP: case KeyEvent.KEYCODE_PAGE_UP: zap(1); return true;
            case KeyEvent.KEYCODE_DPAD_DOWN: case KeyEvent.KEYCODE_CHANNEL_DOWN: case KeyEvent.KEYCODE_PAGE_DOWN: zap(-1); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER: openPanel(); return true;
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
        yt.setWebViewClient(new WebViewClient());
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

    private void playYT(final String url, final int forIdx) {
        if (player != null) player.stop();
        qualV.setText("YouTube");
        new Thread(new Runnable() { public void run() {
            final String src = ytEmbed(url);
            h.post(new Runnable() { public void run() {
                if (isFinishing() || idx != forIdx) return;
                if (src == null) { state.setText("ما گدرت أشغّل رابط يوتيوب هذا داخل البرنامج"); showPanel(8000); return; }
                ensureYT();
                yt.setVisibility(View.VISIBLE);
                String html = "<!doctype html><html><body style=\"margin:0;background:#000\"><iframe src=\"" + src + "\" allow=\"autoplay; encrypted-media; fullscreen\" allowfullscreen frameborder=\"0\" style=\"position:fixed;left:0;top:0;width:100%;height:100%;border:0\"></iframe></body></html>";
                yt.loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "utf-8", null);
                state.setText("");
                h.removeCallbacks(hide); h.postDelayed(hide, 5000);
            } });
        } }).start();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) { player.release(); player = null; }
        if (yt != null) { try { yt.destroy(); } catch (Throwable ignored) { } yt = null; }
        h.removeCallbacksAndMessages(null);
        finish();
    }
}
