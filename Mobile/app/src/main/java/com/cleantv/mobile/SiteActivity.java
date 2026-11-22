package com.cleantv.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
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
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Opens a website inside the app. You tap the channel on the page like in any browser; every stream (.m3u8) the page asks for is
 * noticed, and a bar offers «play» (with the page's own headers) and «save» (kept in «قنواتي المضافة»).
 */
public class SiteActivity extends Activity {
    /** the name of the tapped thing: its title / alt text / short text, looking a few levels up */
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
    private LinearLayout panel, chips;
    private TextView panelTitle, title;
    private String startUrl = "", ua = "", lastName = "";
    private volatile String pageUrl = "";
    private float downX, downY;
    private int sel;
    private final List<String[]> found = new ArrayList<>();   // url, referer, ua, name (newest last)

    private int dp(int v) { return Math.round(v * d); }

    /** keeps the channel inside the app's own settings (the page reads them back when you return) */
    static void saveChannel(Context c, String n, String u, String ua, String r, String site) {
        SharedPreferences p = c.getSharedPreferences("mobile", Context.MODE_PRIVATE);
        try {
            JSONObject s = new JSONObject(p.getString("settings", "{}"));
            JSONArray a = s.optJSONArray("myCh"), o = new JSONArray();
            JSONObject item = new JSONObject().put("n", n).put("u", u);
            if (ua != null && ua.length() > 0) item.put("ua", ua);
            if (r != null && r.length() > 0) item.put("r", r);
            if (site != null && site.length() > 0) item.put("site", site);
            boolean done = false;
            if (a != null) for (int i = 0; i < a.length(); i++) {
                JSONObject x = a.getJSONObject(i);
                if (u.equals(x.optString("u"))) { o.put(item); done = true; } else o.put(x);
            }
            if (!done) o.put(item);
            JSONArray t = new JSONArray();
            for (int i = Math.max(0, o.length() - 500); i < o.length(); i++) t.put(o.get(i));
            s.put("myCh", t);
            p.edit().putString("settings", s.toString()).apply();
        } catch (Throwable ignored) { }
    }

    private TextView btn(String t, int bg, int fg) {
        TextView v = new TextView(this);
        v.setText(t); v.setTextColor(fg); v.setTextSize(16); v.setTypeface(Typeface.DEFAULT_BOLD); v.setGravity(Gravity.CENTER);
        v.setPadding(dp(18), dp(12), dp(18), dp(12));
        GradientDrawable g = new GradientDrawable(); g.setColor(bg); g.setCornerRadius(dp(26)); v.setBackground(g);
        return v;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        d = getResources().getDisplayMetrics().density;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.BLACK); getWindow().setNavigationBarColor(Color.BLACK);
        startUrl = getIntent().getStringExtra("url");
        if (startUrl == null || !startUrl.startsWith("http") || !Acct.active(this)) { finish(); return; }

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK); root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setJavaScriptCanOpenWindowsAutomatically(false); s.setSupportMultipleWindows(false);
        s.setUseWideViewPort(true); s.setLoadWithOverviewMode(true); s.setBuiltInZoomControls(true); s.setDisplayZoomControls(false);
        ua = s.getUserAgentString();
        CookieManager.getInstance().setAcceptCookie(true);
        try { CookieManager.getInstance().setAcceptThirdPartyCookies(web, true); } catch (Throwable ignored) { }
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return false; }
            @Override public void onPageStarted(WebView v, String u, android.graphics.Bitmap f) { pageUrl = u == null ? "" : u; }
            @Override public void onPageFinished(WebView v, String u) { title.setText(v.getTitle() == null || v.getTitle().length() == 0 ? Uri_host(u) : v.getTitle()); }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                try {
                    String u = r.getUrl().toString();
                    if (u.toLowerCase(Locale.ROOT).contains(".m3u8")) {
                        Map<String, String> hd = r.getRequestHeaders();
                        String ref = hd == null ? null : hd.get("Referer");
                        String agent = hd == null ? null : hd.get("User-Agent");
                        final String[] it = {u, ref != null && ref.length() > 0 ? ref : pageUrl, agent != null && agent.length() > 0 ? agent : ua, lastName};
                        h.post(new Runnable() { public void run() { onStream(it); } });
                    }
                } catch (Throwable ignored) { }
                return null;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View v, CustomViewCallback cb) {
                if (custom != null) { cb.onCustomViewHidden(); return; }
                custom = v; customCb = cb; root.addView(v, new FrameLayout.LayoutParams(-1, -1)); web.setVisibility(View.GONE);
            }
            @Override public void onHideCustomView() { hideCustom(); }
        });
        /* a tap on the page remembers the name of what was tapped, so the channel gets its name */
        web.setOnTouchListener(new View.OnTouchListener() {
            @Override public boolean onTouch(View v, MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_DOWN) { downX = e.getX(); downY = e.getY(); }
                else if (e.getAction() == MotionEvent.ACTION_UP && Math.abs(e.getX() - downX) < dp(10) && Math.abs(e.getY() - downY) < dp(10)) {
                    float sc = web.getScale() <= 0 ? d : web.getScale();
                    web.evaluateJavascript(NAME_JS + "(" + (e.getX() / sc) + "," + (e.getY() / sc) + ")", new ValueCallback<String>() {
                        @Override public void onReceiveValue(String val) {
                            try { String n = new JSONArray("[" + val + "]").getString(0); if (n.length() > 0) lastName = n; } catch (Throwable ignored) { }
                        }
                    });
                }
                return false;
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        web.setPadding(0, dp(48), 0, 0);

        /* top bar: close · back · title */
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL); bar.setGravity(Gravity.CENTER_VERTICAL); bar.setBackgroundColor(0xEE111111);
        bar.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); bar.setPadding(dp(8), 0, dp(8), 0);
        TextView x = btn("✕", 0x00000000, Color.WHITE); x.setTextSize(20);
        TextView bk = btn("›", 0x00000000, Color.WHITE); bk.setTextSize(26);
        title = new TextView(this); title.setTextColor(0xFFB8B8C6); title.setTextSize(13); title.setSingleLine(true); title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        title.setText(Uri_host(startUrl));
        bar.addView(x); bar.addView(title, new LinearLayout.LayoutParams(0, -2, 1)); bar.addView(bk);
        root.addView(bar, new FrameLayout.LayoutParams(-1, dp(48), Gravity.TOP));
        x.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { finish(); } });
        bk.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { if (web.canGoBack()) web.goBack(); else finish(); } });

        /* the bar that appears when a stream is found */
        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL); panel.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); panel.setPadding(dp(16), dp(14), dp(16), dp(16));
        GradientDrawable pg = new GradientDrawable(); pg.setColor(0xF2121212); pg.setCornerRadii(new float[]{dp(28), dp(28), dp(28), dp(28), 0, 0, 0, 0}); pg.setStroke(dp(1), 0x33FFFFFF);
        panel.setBackground(pg); panel.setVisibility(View.GONE);
        panelTitle = new TextView(this); panelTitle.setTextColor(Color.WHITE); panelTitle.setTextSize(16); panelTitle.setTypeface(Typeface.DEFAULT_BOLD); panelTitle.setPadding(0, 0, 0, dp(8));
        panel.addView(panelTitle);
        chips = new LinearLayout(this); chips.setOrientation(LinearLayout.HORIZONTAL); chips.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        panel.addView(chips);
        LinearLayout row = new LinearLayout(this); row.setOrientation(LinearLayout.HORIZONTAL); row.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); row.setPadding(0, dp(10), 0, 0);
        TextView play = btn("▶  شغّل", 0xFF2A2A2A, Color.WHITE), save = btn("حفظ القناة", 0xFFFA0023, Color.WHITE);
        LinearLayout.LayoutParams lp1 = new LinearLayout.LayoutParams(0, -2, 1); lp1.setMargins(dp(4), 0, dp(4), 0);
        row.addView(save, lp1); row.addView(play, lp1);
        panel.addView(row);
        FrameLayout.LayoutParams pl = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM);
        root.addView(panel, pl);
        play.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { playSel(); } });
        save.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { askSave(); } });

        setContentView(root);
        web.loadUrl(startUrl);
        Toast.makeText(this, "افتح القناة بالصفحة، وإذا لقيت البث يطلع شريط الحفظ", Toast.LENGTH_LONG).show();
    }

    private static String Uri_host(String u) { try { return android.net.Uri.parse(u).getHost(); } catch (Throwable t) { return u; } }

    private String nameOf(String[] st) {
        if (st[3] != null && st[3].length() > 0) return st[3];
        if (lastName.length() > 0) return lastName;
        String t = web.getTitle();
        return t == null ? "" : t.trim();
    }

    private void onStream(String[] it) {
        String key = it[0].replaceAll("\\?.*$", "");
        for (int i = 0; i < found.size(); i++) if (found.get(i)[0].replaceAll("\\?.*$", "").equals(key)) { found.get(i)[0] = it[0]; paint(); return; }
        found.add(it);
        while (found.size() > 8) found.remove(0);
        sel = found.size() - 1;
        paint();
    }

    private void paint() {
        if (found.isEmpty()) { panel.setVisibility(View.GONE); return; }
        panel.setVisibility(View.VISIBLE);
        String[] st = found.get(Math.min(sel, found.size() - 1));
        String n = nameOf(st);
        panelTitle.setText("لقيت بث" + (n.length() > 0 ? " «" + n + "»" : "") + (found.size() > 1 ? "  (" + found.size() + ")" : ""));
        chips.removeAllViews();
        if (found.size() > 1) for (int i = found.size() - 1; i >= 0; i--) {
            final int k = i;
            TextView c = btn("بث " + (i + 1), i == sel ? 0xFFFA0023 : 0xFF2A2A2A, Color.WHITE); c.setTextSize(13); c.setPadding(dp(14), dp(7), dp(14), dp(7));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.setMargins(0, 0, dp(6), 0);
            c.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { sel = k; paint(); } });
            chips.addView(c, lp);
        }
    }

    private void playSel() {
        if (found.isEmpty()) return;
        String[] st = found.get(Math.min(sel, found.size() - 1));
        try {
            JSONObject c = new JSONObject().put("n", nameOf(st).length() > 0 ? nameOf(st) : "بث").put("u", st[0]).put("ua", st[2] == null ? "" : st[2]).put("r", st[1] == null ? "" : st[1]);
            PlayerActivity.PACK = new JSONObject().put("vod", 0).put("list", new JSONArray().put(c)).toString();
            startActivity(new Intent(this, PlayerActivity.class).putExtra("idx", 0));
        } catch (Throwable t) { Toast.makeText(this, "ما اشتغل البث", Toast.LENGTH_SHORT).show(); }
    }

    private void askSave() {
        if (found.isEmpty()) return;
        final String[] st = found.get(Math.min(sel, found.size() - 1));
        final EditText in = new EditText(this);
        in.setText(nameOf(st)); in.setSelectAllOnFocus(true); in.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); in.setHint("اسم القناة");
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle("حفظ القناة").setView(in)
            .setPositiveButton("حفظ", new DialogInterface.OnClickListener() { public void onClick(DialogInterface dlg, int w) {
                String n = in.getText().toString().trim();
                if (n.length() == 0) n = "قناة جديدة";
                saveChannel(SiteActivity.this, n, st[0], st[2], st[1], startUrl);
                Toast.makeText(SiteActivity.this, "انحفظت «" + n + "» بقسم قنواتي المضافة", Toast.LENGTH_LONG).show();
            } })
            .setNegativeButton("إلغاء", null).show();
    }

    private void hideCustom() {
        if (custom == null) return;
        root.removeView(custom); custom = null; web.setVisibility(View.VISIBLE);
        try { if (customCb != null) customCb.onCustomViewHidden(); } catch (Throwable ignored) { }
    }

    @Override
    public void onBackPressed() {
        if (custom != null) { hideCustom(); return; }
        if (web != null && web.canGoBack()) { web.goBack(); return; }
        finish();
    }

    @Override protected void onPause() { super.onPause(); try { web.onPause(); } catch (Throwable ignored) { } }
    @Override protected void onResume() { super.onResume(); try { web.onResume(); } catch (Throwable ignored) { } }
    @Override
    protected void onDestroy() {
        h.removeCallbacksAndMessages(null);
        try { ((ViewGroup) web.getParent()).removeView(web); web.destroy(); } catch (Throwable ignored) { }
        super.onDestroy();
    }
}
