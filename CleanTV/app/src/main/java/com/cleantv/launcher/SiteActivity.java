package com.cleantv.launcher;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.InputType;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * «قنواتي» ← مواقع: opens a website inside the app. The remote moves a pointer over the page (a TV remote cannot tap),
 * every stream (.m3u8) the page asks for is noticed, and «حفظ القناة» keeps it as a normal channel in the folder you choose.
 * Keys: arrows move the pointer (edges scroll the page) · OK taps · up from the top edge opens the tool bar · back goes back / closes.
 */
public class SiteActivity extends Activity {
    private static final int INK = Color.parseColor("#15181B"), IVORY = Color.parseColor("#EFE7D4"), COPPER = Color.parseColor("#D9822B"), CHROME = Color.parseColor("#B8BDC2"), SURF = Color.parseColor("#23282D");

    /* ---------------------------------------------------------------- saved channels (read by the launcher page through the bridge) */
    static JSONArray load(Context c) {
        try { return new JSONArray(Media.prefs(c).getString("siteCh", "[]")); } catch (Throwable t) { return new JSONArray(); }
    }
    private static void store(Context c, JSONArray a) { Media.prefs(c).edit().putString("siteCh", a.toString()).apply(); }
    static void remove(Context c, String key) {
        try {
            JSONArray a = load(c), o = new JSONArray();
            for (int i = 0; i < a.length(); i++) { JSONObject j = a.getJSONObject(i); if (!(j.optString("u") + "|" + j.optString("n")).equals(key)) o.put(j); }
            store(c, o);
        } catch (Throwable ignored) { }
    }
    static void save(Context c, JSONObject n) {
        try {
            JSONArray a = load(c), o = new JSONArray();
            for (int i = 0; i < a.length(); i++) { JSONObject j = a.getJSONObject(i); if (!j.optString("u").equals(n.optString("u"))) o.put(j); }
            o.put(n);
            store(c, o);
        } catch (Throwable ignored) { }
    }

    /* the folders a channel can be saved to: id, name, category (g), package (p), group (c) */
    private static final String[][] FOLDERS = {
            {"رياضة", "sport", "", "my"}, {"أفلام ومسلسلات", "movies", "", "my"}, {"أخبار", "news", "", "my"}, {"منوعات وترفيه", "ent", "", "my"},
            {"قنوات عراقية", "ent", "", "iq"}, {"باقة MBC", "ent", "mbc", "my"}, {"باقة قنوات كربلاء", "quran", "karbala", "my"},
            {"أطفال", "kids", "", "my"}, {"وثائقية", "docs", "", "my"}, {"قرآن ومرجعيات", "quran", "", "my"}};
    /** the name of the clicked thing: its title / alt text / short text, looking a few levels up */
    private static final String NAME_JS = "(function(x,y){try{var e=document.elementFromPoint(x,y);if(!e)return '';"
            + "function tx(n){var t=(n.getAttribute&&(n.getAttribute('title')||n.getAttribute('aria-label')||n.getAttribute('alt')))||'';"
            + "if(!t&&n.querySelector){var im=n.querySelector('img[alt]');if(im)t=im.getAttribute('alt')||'';}"
            + "if(!t)t=(n.innerText||n.textContent||'');return String(t).replace(/\\s+/g,' ').trim();}"
            + "for(var i=0;i<6&&e;i++,e=e.parentElement){var t=tx(e);if(t&&t.length>=2&&t.length<=40)return t;}return '';}catch(_){return '';}})";

    private final Handler h = new Handler(Looper.getMainLooper());
    private float d;
    private FrameLayout root;
    private WebView web;
    private View custom;
    private WebChromeClient.CustomViewCallback customCb;
    private CursorView cursor;
    private LinearLayout bar, dlg;
    private TextView banner, toast, saveBtn;
    private final List<TextView> barBtns = new ArrayList<>();
    private float cx, cy;
    private boolean toolMode;
    private int toolSel;
    private int speed = 1;                       // 0 slow, 1 normal, 2 fast
    private String lastName = "", startUrl = "", ua = "";
    private volatile String pageUrl = "";
    private final List<String[]> found = new ArrayList<>();   // url, referer, ua  (streams the page asked for, newest last)
    private final List<Long> foundT = new ArrayList<>();
    private Typeface kufi, plex;

    // dialog
    private boolean dlgOn;
    private int dRow, dFolder, dStream;
    private EditText dName;
    private TextView dFolderV, dStreamV, dSaveV, dCancelV;
    private boolean dOnCancel;

    private int dp(int v) { return Math.round(v * d); }

    private Typeface font(String f, Typeface fb) { try { return Typeface.createFromAsset(getAssets(), "fonts/" + f); } catch (Throwable t) { return fb; } }

    private TextView tx(float sp, int color, Typeface tf) {
        TextView t = new TextView(this);
        t.setTextSize(sp); t.setTextColor(color); t.setIncludeFontPadding(false); t.setTypeface(tf);
        return t;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        d = getResources().getDisplayMetrics().density;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        kufi = font("ReemKufi.ttf", Typeface.DEFAULT_BOLD);
        plex = font("PlexArabic-SemiBold.ttf", Typeface.DEFAULT_BOLD);
        startUrl = getIntent().getStringExtra("url");
        if (startUrl == null || !startUrl.startsWith("http")) { finish(); return; }

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setFocusable(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        ua = s.getUserAgentString();
        CookieManager.getInstance().setAcceptCookie(true);
        try { CookieManager.getInstance().setAcceptThirdPartyCookies(web, true); } catch (Throwable ignored) { }
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return false; }
            @Override public void onPageStarted(WebView v, String u, android.graphics.Bitmap f) { pageUrl = u == null ? "" : u; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                try {
                    String u = r.getUrl().toString();
                    if (u.toLowerCase(Locale.ROOT).contains(".m3u8")) {
                        Map<String, String> hd = r.getRequestHeaders();
                        String ref = hd == null ? null : hd.get("Referer");
                        String agent = hd == null ? null : hd.get("User-Agent");
                        final String[] it = {u, ref != null && ref.length() > 0 ? ref : pageUrl, agent != null && agent.length() > 0 ? agent : ua};
                        h.post(new Runnable() { public void run() { onStream(it); } });
                    }
                } catch (Throwable ignored) { }
                return null;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View v, CustomViewCallback cb) {
                if (custom != null) { cb.onCustomViewHidden(); return; }
                custom = v; customCb = cb;
                root.addView(v, 1, new FrameLayout.LayoutParams(-1, -1));
            }
            @Override public void onHideCustomView() { hideCustom(); }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        cursor = new CursorView(this);
        root.addView(cursor, new FrameLayout.LayoutParams(-1, -1));

        buildBar();
        buildBanner();
        buildDialog();
        toast = tx(18, INK, plex);
        toast.setPadding(dp(22), dp(12), dp(22), dp(12));
        GradientDrawable tb = new GradientDrawable(); tb.setColor(IVORY); tb.setCornerRadius(dp(24)); toast.setBackground(tb);
        toast.setVisibility(View.GONE);
        FrameLayout.LayoutParams tl = new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER_HORIZONTAL | Gravity.TOP); tl.topMargin = dp(90);
        root.addView(toast, tl);
        setContentView(root);

        int w = getResources().getDisplayMetrics().widthPixels, hh = getResources().getDisplayMetrics().heightPixels;
        cx = w / 2f; cy = hh / 2f; cursor.invalidate();
        web.loadUrl(startUrl);
        say("حرّك المؤشر بالأسهم · OK يضغط · اطلع لفوق للأدوات");
    }

    /* ---------------------------------------------------------------- views */
    private final class CursorView extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        CursorView(Context c) { super(c); setWillNotDraw(false); setFocusable(false); }
        @Override public boolean onTouchEvent(MotionEvent e) { return false; }
        @Override protected void onDraw(Canvas c) {
            if (dlgOn) return;
            p.setStyle(Paint.Style.FILL); p.setColor(Color.argb(70, 217, 130, 43)); c.drawCircle(cx, cy, dp(26), p);
            p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(dp(3)); p.setColor(COPPER); c.drawCircle(cx, cy, dp(26), p);
            p.setStyle(Paint.Style.FILL); p.setColor(IVORY); c.drawCircle(cx, cy, dp(6), p);
        }
    }

    private void buildBar() {
        bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(dp(16), dp(10), dp(16), dp(10));
        bar.setBackgroundColor(Color.parseColor("#F015181B"));
        String[] names = {"رجوع", "تحديث", "الصفحة الأولى", "تكبير", "تصغير", "المؤشر: عادي", "حفظ القناة", "إغلاق"};
        for (String n : names) {
            TextView t = tx(17, IVORY, plex);
            t.setPadding(dp(16), dp(10), dp(16), dp(10));
            t.setText(n);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.setMargins(dp(5), 0, dp(5), 0);
            bar.addView(t, lp); barBtns.add(t);
            if (n.equals("حفظ القناة")) saveBtn = t;
        }
        bar.setVisibility(View.GONE);
        root.addView(bar, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
        paintBar();
    }

    private void paintBar() {
        for (int i = 0; i < barBtns.size(); i++) {
            TextView t = barBtns.get(i);
            boolean on = toolMode && i == toolSel;
            GradientDrawable g = new GradientDrawable();
            g.setCornerRadius(dp(10));
            g.setColor(on ? COPPER : SURF);
            g.setStroke(dp(2), on ? IVORY : Color.parseColor("#3A4046"));
            t.setBackground(g);
            t.setTextColor(on ? INK : IVORY);
        }
        if (saveBtn != null) saveBtn.setText(found.isEmpty() ? "حفظ القناة" : "حفظ القناة (" + found.size() + ")");
        barBtns.get(5).setText("المؤشر: " + (speed == 0 ? "بطيء" : speed == 1 ? "عادي" : "سريع"));
    }

    private void buildBanner() {
        banner = tx(19, INK, plex);
        banner.setPadding(dp(24), dp(14), dp(24), dp(14));
        GradientDrawable g = new GradientDrawable(); g.setColor(COPPER); g.setCornerRadius(dp(14)); banner.setBackground(g);
        banner.setVisibility(View.GONE);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL); lp.bottomMargin = dp(36);
        root.addView(banner, lp);
    }

    private TextView row(float sp) {
        TextView t = tx(sp, IVORY, plex);
        t.setPadding(dp(18), dp(12), dp(18), dp(12));
        return t;
    }

    private void buildDialog() {
        dlg = new LinearLayout(this);
        dlg.setOrientation(LinearLayout.VERTICAL);
        dlg.setPadding(dp(30), dp(24), dp(30), dp(24));
        GradientDrawable g = new GradientDrawable(); g.setColor(Color.parseColor("#F81B2025")); g.setCornerRadius(dp(18)); g.setStroke(dp(2), COPPER);
        dlg.setBackground(g);
        TextView title = tx(30, IVORY, kufi); title.setText("حفظ القناة");
        dlg.addView(title);
        TextView hint = tx(14, CHROME, plex); hint.setText("الأسهم: فوق وتحت بين الحقول · يمين ويسار تغيّر الاختيار · OK على الاسم يفتح الكيبورد");
        LinearLayout.LayoutParams hl = new LinearLayout.LayoutParams(-2, -2); hl.topMargin = dp(6); hl.bottomMargin = dp(12);
        dlg.addView(hint, hl);
        dName = new EditText(this);
        dName.setTextColor(IVORY); dName.setTextSize(20); dName.setTypeface(plex); dName.setSingleLine(true);
        dName.setInputType(InputType.TYPE_CLASS_TEXT); dName.setHintTextColor(CHROME); dName.setHint("اسم القناة");
        dName.setFocusable(false); dName.setFocusableInTouchMode(false);
        dName.setPadding(dp(18), dp(12), dp(18), dp(12));
        dlg.addView(dName, new LinearLayout.LayoutParams(-1, -2));
        dFolderV = row(20); dStreamV = row(16);
        LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(-1, -2); rl.topMargin = dp(8);
        dlg.addView(dFolderV, rl); dlg.addView(dStreamV, rl);
        LinearLayout btns = new LinearLayout(this);
        btns.setOrientation(LinearLayout.HORIZONTAL);
        dSaveV = row(22); dSaveV.setText("حفظ"); dSaveV.setGravity(Gravity.CENTER);
        dCancelV = row(22); dCancelV.setText("إلغاء"); dCancelV.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams b1 = new LinearLayout.LayoutParams(0, -2, 1f); b1.setMargins(0, 0, dp(8), 0);
        LinearLayout.LayoutParams b2 = new LinearLayout.LayoutParams(0, -2, 1f);
        btns.addView(dSaveV, b1); btns.addView(dCancelV, b2);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(-1, -2); bl.topMargin = dp(14);
        dlg.addView(btns, bl);
        dlg.setVisibility(View.GONE);
        int w = Math.min(getResources().getDisplayMetrics().widthPixels - dp(80), dp(720));
        root.addView(dlg, new FrameLayout.LayoutParams(w, -2, Gravity.CENTER));
    }

    private void paintDialog() {
        TextView[] rows = {null, dFolderV, dStreamV};
        GradientDrawable gn = new GradientDrawable(); gn.setCornerRadius(dp(10)); gn.setColor(SURF); gn.setStroke(dp(3), dRow == 0 ? COPPER : Color.parseColor("#3A4046"));
        dName.setBackground(gn);
        String[] f = FOLDERS[dFolder];
        dFolderV.setText("المجلد:   ◄  " + f[0] + "  ►");
        String[] st = found.isEmpty() ? new String[]{"", "", ""} : found.get(dStream);
        String u = st[0]; String shortU = u.length() > 58 ? u.substring(0, 28) + "…" + u.substring(u.length() - 26) : u;
        dStreamV.setText("البث " + (dStream + 1) + "/" + Math.max(1, found.size()) + ":   " + shortU);
        for (int i = 1; i <= 2; i++) {
            GradientDrawable g = new GradientDrawable(); g.setCornerRadius(dp(10)); g.setColor(SURF); g.setStroke(dp(3), dRow == i ? COPPER : Color.parseColor("#3A4046"));
            rows[i].setBackground(g);
        }
        GradientDrawable a = new GradientDrawable(); a.setCornerRadius(dp(10)); a.setColor(dRow == 3 && !dOnCancel ? COPPER : SURF); a.setStroke(dp(3), dRow == 3 && !dOnCancel ? IVORY : Color.parseColor("#3A4046"));
        dSaveV.setBackground(a); dSaveV.setTextColor(dRow == 3 && !dOnCancel ? INK : IVORY);
        GradientDrawable c = new GradientDrawable(); c.setCornerRadius(dp(10)); c.setColor(dRow == 3 && dOnCancel ? COPPER : SURF); c.setStroke(dp(3), dRow == 3 && dOnCancel ? IVORY : Color.parseColor("#3A4046"));
        dCancelV.setBackground(c); dCancelV.setTextColor(dRow == 3 && dOnCancel ? INK : IVORY);
    }

    /* ---------------------------------------------------------------- messages / streams */
    private final Runnable hideToast = new Runnable() { public void run() { toast.setVisibility(View.GONE); } };
    private void say(String m) {
        toast.setText(m); toast.setVisibility(View.VISIBLE);
        h.removeCallbacks(hideToast); h.postDelayed(hideToast, 3500);
    }

    private final Runnable hideBanner = new Runnable() { public void run() { banner.setVisibility(View.GONE); } };
    private void onStream(String[] it) {
        String key = it[0].replaceAll("\\?.*$", "");
        for (int i = 0; i < found.size(); i++) if (found.get(i)[0].replaceAll("\\?.*$", "").equals(key)) { found.get(i)[0] = it[0]; foundT.set(i, SystemClock.uptimeMillis()); return; }
        found.add(it); foundT.add(SystemClock.uptimeMillis());
        while (found.size() > 12) { found.remove(0); foundT.remove(0); }
        paintBar();
        String nm = lastName.length() > 0 ? lastName : (web.getTitle() == null ? "" : web.getTitle());
        banner.setText("لقيت بث" + (nm.length() > 0 ? " «" + nm + "»" : "") + " · اطلع لفوق ← حفظ القناة");
        banner.setVisibility(View.VISIBLE);
        h.removeCallbacks(hideBanner); h.postDelayed(hideBanner, 9000);
    }

    /* ---------------------------------------------------------------- pointer */
    private void move(int dx, int dy, int repeat) {
        int step = dp(speed == 0 ? 7 : speed == 1 ? 13 : 24) + Math.min(repeat, 24) * dp(speed == 0 ? 1 : 2);
        int w = web.getWidth(), hh = web.getHeight();
        float nx = cx + dx * step, ny = cy + dy * step;
        int edge = dp(56);
        if (dy > 0 && ny > hh - edge) { web.scrollBy(0, step * 2); ny = hh - edge; }
        else if (dy < 0 && ny < edge) {
            if (web.getScrollY() > 0) { web.scrollBy(0, -step * 2); ny = edge; }
            else { setTool(true); return; }
        }
        if (dx > 0 && nx > w - edge) { web.scrollBy(step * 2, 0); nx = w - edge; }
        else if (dx < 0 && nx < edge) { web.scrollBy(-step * 2, 0); nx = edge; }
        cx = Math.max(0, Math.min(w, nx)); cy = Math.max(0, Math.min(hh, ny));
        cursor.invalidate();
    }

    private void tap() {
        final float x = cx, y = cy;
        float sc = web.getScale(); if (sc <= 0) sc = 1f;
        try {
            web.evaluateJavascript(NAME_JS + "(" + (x / sc) + "," + (y / sc) + ")", new ValueCallback<String>() {
                @Override public void onReceiveValue(String v) {
                    if (v == null) return;
                    try { v = new JSONArray("[" + v + "]").getString(0); } catch (Throwable t) { return; }
                    if (v.length() > 1 && v.length() <= 40) lastName = v.trim();
                }
            });
        } catch (Throwable ignored) { }
        long t = SystemClock.uptimeMillis();
        MotionEvent dn = MotionEvent.obtain(t, t, MotionEvent.ACTION_DOWN, x, y, 0);
        dn.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        web.dispatchTouchEvent(dn); dn.recycle();
        h.postDelayed(new Runnable() { public void run() {
            long t2 = SystemClock.uptimeMillis();
            MotionEvent up = MotionEvent.obtain(t2, t2, MotionEvent.ACTION_UP, x, y, 0);
            up.setSource(InputDevice.SOURCE_TOUCHSCREEN);
            web.dispatchTouchEvent(up); up.recycle();
        } }, 70);
    }

    private void hideCustom() {
        if (custom == null) return;
        root.removeView(custom); custom = null;
        if (customCb != null) { try { customCb.onCustomViewHidden(); } catch (Throwable ignored) { } customCb = null; }
    }

    /* ---------------------------------------------------------------- tool bar */
    private void setTool(boolean on) {
        toolMode = on; bar.setVisibility(on ? View.VISIBLE : View.GONE);
        if (on) { toolSel = found.isEmpty() ? 0 : 6; }
        paintBar(); cursor.invalidate();
    }

    private void toolOk() {
        switch (toolSel) {
            case 0: setTool(false); if (web.canGoBack()) web.goBack(); else say("ما في صفحة قبل هذي"); break;
            case 1: setTool(false); web.reload(); break;
            case 2: setTool(false); web.loadUrl(startUrl); break;
            case 3: web.zoomIn(); break;
            case 4: web.zoomOut(); break;
            case 5: speed = (speed + 1) % 3; paintBar(); break;
            case 6: openSave(); break;
            default: finish();
        }
    }

    /* ---------------------------------------------------------------- save dialog */
    private void openSave() {
        if (found.isEmpty()) { say("ما لقيت بث بعد. شغّل قناة بالموقع (OK عليها) وبعدين ارجع هنا"); return; }
        setTool(false);
        dlgOn = true; dRow = 3; dOnCancel = false; dFolder = 0;
        // the stream to keep: the first one of the newest burst (the main playlist is asked for before its qualities)
        long newest = foundT.get(foundT.size() - 1); dStream = foundT.size() - 1;
        for (int i = 0; i < foundT.size(); i++) if (newest - foundT.get(i) <= 15000) { dStream = i; break; }
        String nm = lastName.length() > 0 ? lastName : (web.getTitle() == null ? "" : web.getTitle().trim());
        dName.setText(nm.length() > 40 ? nm.substring(0, 40) : nm);
        dlg.setVisibility(View.VISIBLE);
        paintDialog(); cursor.invalidate();
    }

    private void closeSave() {
        dlgOn = false; dlg.setVisibility(View.GONE);
        hideKeyboard(); dName.clearFocus(); dName.setFocusable(false); dName.setFocusableInTouchMode(false);
        cursor.invalidate();
    }

    private void hideKeyboard() {
        try { ((InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(dName.getWindowToken(), 0); } catch (Throwable ignored) { }
    }

    private void doSave() {
        if (found.isEmpty()) { closeSave(); return; }
        String name = dName.getText().toString().trim();
        if (name.length() == 0) { say("اكتب اسم للقناة"); dRow = 0; paintDialog(); return; }
        String[] f = FOLDERS[dFolder], st = found.get(Math.min(dStream, found.size() - 1));
        try {
            JSONObject o = new JSONObject();
            o.put("n", name); o.put("u", st[0]); o.put("g", f[1]); o.put("p", f[2]); o.put("c", f[3]);
            o.put("r", st[1] == null ? "" : st[1]); o.put("ua", st[2] == null ? "" : st[2]); o.put("site", startUrl);
            save(this, o);
            say("انحفظت «" + name + "» بمجلد " + f[0]);
        } catch (Throwable t) { say("ما انحفظت القناة"); }
        closeSave();
    }

    private boolean dialogKey(int code) {
        if (dName.hasFocus()) {
            if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_DPAD_DOWN) {
                hideKeyboard(); dName.clearFocus(); dName.setFocusable(false); dName.setFocusableInTouchMode(false); paintDialog(); return true;
            }
            return false;
        }
        switch (code) {
            case KeyEvent.KEYCODE_BACK: closeSave(); return true;
            case KeyEvent.KEYCODE_DPAD_UP: dRow = Math.max(0, dRow - 1); break;
            case KeyEvent.KEYCODE_DPAD_DOWN: dRow = Math.min(3, dRow + 1); break;
            case KeyEvent.KEYCODE_DPAD_LEFT:
                if (dRow == 1) dFolder = (dFolder + 1) % FOLDERS.length;
                else if (dRow == 2 && found.size() > 0) dStream = (dStream + 1) % found.size();
                else if (dRow == 3) dOnCancel = !dOnCancel;
                break;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                if (dRow == 1) dFolder = (dFolder + FOLDERS.length - 1) % FOLDERS.length;
                else if (dRow == 2 && found.size() > 0) dStream = (dStream + found.size() - 1) % found.size();
                else if (dRow == 3) dOnCancel = !dOnCancel;
                break;
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER:
                if (dRow == 0) {
                    dName.setFocusable(true); dName.setFocusableInTouchMode(true); dName.requestFocus();
                    dName.setSelection(dName.getText().length());
                    try { ((InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE)).showSoftInput(dName, InputMethodManager.SHOW_IMPLICIT); } catch (Throwable ignored) { }
                } else if (dRow == 3) { if (dOnCancel) closeSave(); else doSave(); return true; }
                else if (dRow == 1) dFolder = (dFolder + 1) % FOLDERS.length;
                else if (dRow == 2 && found.size() > 0) dStream = (dStream + 1) % found.size();
                break;
            default: return false;
        }
        paintDialog();
        return true;
    }

    /* ---------------------------------------------------------------- keys */
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode();
        if (e.getAction() == KeyEvent.ACTION_UP) return super.dispatchKeyEvent(e);
        if (dlgOn) { if (dialogKey(code)) return true; return super.dispatchKeyEvent(e); }
        if (toolMode) {
            switch (code) {
                case KeyEvent.KEYCODE_DPAD_RIGHT: toolSel = (toolSel + barBtns.size() - 1) % barBtns.size(); paintBar(); return true;
                case KeyEvent.KEYCODE_DPAD_LEFT: toolSel = (toolSel + 1) % barBtns.size(); paintBar(); return true;
                case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER: if (e.getRepeatCount() == 0) toolOk(); return true;
                case KeyEvent.KEYCODE_DPAD_DOWN: case KeyEvent.KEYCODE_BACK: case KeyEvent.KEYCODE_MENU: setTool(false); return true;
                default: return true;
            }
        }
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP: move(0, -1, e.getRepeatCount()); return true;
            case KeyEvent.KEYCODE_DPAD_DOWN: move(0, 1, e.getRepeatCount()); return true;
            case KeyEvent.KEYCODE_DPAD_LEFT: move(-1, 0, e.getRepeatCount()); return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT: move(1, 0, e.getRepeatCount()); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER: if (e.getRepeatCount() == 0) tap(); return true;
            case KeyEvent.KEYCODE_CHANNEL_UP: case KeyEvent.KEYCODE_PAGE_UP: web.scrollBy(0, -web.getHeight() * 3 / 4); return true;
            case KeyEvent.KEYCODE_CHANNEL_DOWN: case KeyEvent.KEYCODE_PAGE_DOWN: web.scrollBy(0, web.getHeight() * 3 / 4); return true;
            case KeyEvent.KEYCODE_MENU: case KeyEvent.KEYCODE_INFO: setTool(true); return true;
            case KeyEvent.KEYCODE_BACK:
                if (custom != null) { hideCustom(); return true; }
                if (web.canGoBack()) { web.goBack(); return true; }
                finish(); return true;
            default: return super.dispatchKeyEvent(e);
        }
    }

    @Override
    protected void onPause() { super.onPause(); try { web.onPause(); } catch (Throwable ignored) { } }

    @Override
    protected void onResume() { super.onResume(); try { web.onResume(); } catch (Throwable ignored) { } }

    @Override
    protected void onDestroy() {
        h.removeCallbacksAndMessages(null);
        try { if (web != null) { web.loadUrl("about:blank"); ((ViewGroup) web.getParent()).removeView(web); web.destroy(); } } catch (Throwable ignored) { }
        super.onDestroy();
    }
}
