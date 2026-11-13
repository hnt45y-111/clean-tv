package com.msm.auto;

import android.annotation.SuppressLint;
import android.app.Presentation;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Rect;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.car.app.AppManager;
import androidx.car.app.CarAppService;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.car.app.validation.HostValidator;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Android Auto entry. It is registered as a navigation app only because that is the one kind of Android Auto app that may
 * draw its own picture on the car screen. The picture is our dashboard page (car.html) shown on a private virtual display
 * that renders straight into the car's surface; the car's touches are passed to the page.
 */
public final class CarService extends CarAppService {
    @NonNull @Override public HostValidator createHostValidator() { return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR; }

    @NonNull @Override public Session onCreateSession() {
        return new Session() {
            @NonNull @Override public Screen onCreateScreen(@NonNull Intent intent) { return new Dash(getCarContext()); }
        };
    }

    static final class Dash extends Screen implements SurfaceCallback, DefaultLifecycleObserver {
        private final Handler ui = new Handler(Looper.getMainLooper());
        private VirtualDisplay vd;
        private Presentation pres;
        private WebView wv;
        private int w = 1, h = 1;
        private float speed = -1; private double lat, lng; private boolean hasLoc;
        private String weather = ""; private long weatherAt;
        private LocationManager lm;
        private final LocationListener ll = new LocationListener() {
            @Override public void onLocationChanged(@NonNull Location l) {
                speed = l.hasSpeed() ? l.getSpeed() * 3.6f : 0; lat = l.getLatitude(); lng = l.getLongitude(); hasLoc = true;
                if (System.currentTimeMillis() - weatherAt > 30 * 60000L) fetchWeather();
            }
            @Override public void onStatusChanged(String p, int s, Bundle e) { }
            @Override public void onProviderEnabled(@NonNull String p) { }
            @Override public void onProviderDisabled(@NonNull String p) { }
        };
        private final SharedPreferences.OnSharedPreferenceChangeListener pl = (sp, k) -> {
            if ("cfg".equals(k) || "wallAt".equals(k) || "act".equals(k)) js("window.__reload&&__reload()");
        };

        Dash(@NonNull CarContext cc) {
            super(cc);
            cc.getCarService(AppManager.class).setSurfaceCallback(this);
            getLifecycle().addObserver(this);
            App.kv(cc).registerOnSharedPreferenceChangeListener(pl);
        }

        @NonNull @Override public Template onGetTemplate() {
            ActionStrip as = new ActionStrip.Builder()
                    .addAction(new Action.Builder().setTitle("↻").setOnClickListener(() -> js("location.reload()")).build())
                    .build();
            return new NavigationTemplate.Builder().setActionStrip(as).build();
        }

        @Override public void onDestroy(@NonNull LifecycleOwner owner) {
            App.kv(getCarContext()).unregisterOnSharedPreferenceChangeListener(pl);
            stopAll();
        }

        // ------------------------------------------------------------ surface
        @SuppressLint("SetJavaScriptEnabled")
        @Override public void onSurfaceAvailable(@NonNull SurfaceContainer sc) {
            if (sc.getSurface() == null) return;
            stopAll();
            CarContext cc = getCarContext();
            w = Math.max(1, sc.getWidth()); h = Math.max(1, sc.getHeight());
            App.kv(cc).edit().putString("car", "{\"w\":" + w + ",\"h\":" + h + ",\"dpi\":" + sc.getDpi() + "}").apply();
            DisplayManager dm = cc.getSystemService(DisplayManager.class);
            vd = dm.createVirtualDisplay("msm-auto", w, h, Math.max(120, sc.getDpi()), sc.getSurface(), 0);
            pres = new Presentation(cc, vd.getDisplay());
            wv = new WebView(pres.getContext());
            wv.setBackgroundColor(Color.BLACK);
            WebSettings s = wv.getSettings();
            s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setAllowFileAccess(true);
            s.setMediaPlaybackRequiresUserGesture(false);
            wv.setWebViewClient(new WebViewClient());
            wv.addJavascriptInterface(new Bridge(), "CarB");
            wv.loadUrl("file:///android_asset/car.html");
            pres.setContentView(wv);
            try { pres.show(); } catch (Throwable e) { CarToast.makeText(cc, "ما گدرت أعرض الواجهة على هالشاشة", CarToast.LENGTH_LONG).show(); }
            startSensors();
        }

        @Override public void onVisibleAreaChanged(@NonNull Rect r) {
            js("window.__area&&__area(" + (float) r.left / w + "," + (float) r.top / h + "," + (float) (w - r.right) / w + "," + (float) (h - r.bottom) / h + ")");
        }

        @Override public void onStableAreaChanged(@NonNull Rect r) { }

        @Override public void onSurfaceDestroyed(@NonNull SurfaceContainer sc) { stopAll(); }

        @Override public void onClick(float x, float y) { js("window.__tap&&__tap(" + x / w + "," + y / h + ")"); }

        @Override public void onScroll(float dx, float dy) { js("window.__scroll&&__scroll(" + dx / w + "," + dy / h + ")"); }

        @Override public void onFling(float vx, float vy) { js("window.__fling&&__fling(" + vx / w + "," + vy / h + ")"); }

        @Override public void onScale(float fx, float fy, float f) { }

        private void js(String code) { ui.post(() -> { if (wv != null) wv.evaluateJavascript(code, null); }); }

        private void stopAll() {
            if (lm != null) try { lm.removeUpdates(ll); } catch (Throwable ignored) { }
            lm = null;
            if (pres != null) try { pres.dismiss(); } catch (Throwable ignored) { }
            if (wv != null) try { wv.destroy(); } catch (Throwable ignored) { }
            if (vd != null) vd.release();
            pres = null; wv = null; vd = null;
        }

        // ------------------------------------------------------------ speed, battery, weather
        @SuppressLint("MissingPermission")
        private void startSensors() {
            CarContext cc = getCarContext();
            if (cc.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
            lm = cc.getSystemService(LocationManager.class);
            try { lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, ll, Looper.getMainLooper()); } catch (Throwable ignored) { }
            try {
                Location l = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (l == null) l = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (l != null) { lat = l.getLatitude(); lng = l.getLongitude(); hasLoc = true; fetchWeather(); }
            } catch (Throwable ignored) { }
        }

        private void fetchWeather() {
            if (!hasLoc) return;
            weatherAt = System.currentTimeMillis();
            final double la = lat, lo = lng;
            new Thread(() -> {
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL("https://api.open-meteo.com/v1/forecast?latitude=" + la + "&longitude=" + lo
                            + "&current=temperature_2m,weather_code,is_day").openConnection();
                    c.setConnectTimeout(8000); c.setReadTimeout(8000);
                    try (InputStream in = c.getInputStream()) {
                        JSONObject cur = new JSONObject(new String(Gemini.readAll(in), StandardCharsets.UTF_8)).getJSONObject("current");
                        weather = new JSONObject().put("t", Math.round(cur.getDouble("temperature_2m"))).put("c", cur.optInt("weather_code"))
                                .put("day", cur.optInt("is_day", 1)).toString();
                    }
                } catch (Throwable e) { weatherAt = System.currentTimeMillis() - 25 * 60000L; }
            }).start();
        }

        // ------------------------------------------------------------ what the page can ask for
        final class Bridge {
            @JavascriptInterface public boolean active() { return Acct.active(getCarContext()); }
            @JavascriptInterface public String cfg() { return App.cfg(getCarContext()); }
            @JavascriptInterface public String now() { return Media.now(getCarContext()).toString(); }
            @JavascriptInterface public String wall() {
                File f = new File(getCarContext().getFilesDir(), "wall.jpg");
                if (!f.exists()) return "";
                try (InputStream in = new FileInputStream(f)) {
                    return "data:image/jpeg;base64," + android.util.Base64.encodeToString(Gemini.readAll(in), android.util.Base64.NO_WRAP);
                } catch (Throwable e) { return ""; }
            }
            @JavascriptInterface public String info() {
                try {
                    Intent b = getCarContext().getApplicationContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                    int lv = b == null ? -1 : b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) * 100 / Math.max(1, b.getIntExtra(BatteryManager.EXTRA_SCALE, 100));
                    boolean ch = b != null && b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0;
                    return new JSONObject().put("speed", Math.round(speed)).put("bat", lv).put("charging", ch)
                            .put("loc", getCarContext().checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED)
                            .put("weather", weather.isEmpty() ? null : new JSONObject(weather)).toString();
                } catch (Throwable e) { return "{}"; }
            }
            @JavascriptInterface public void media(String k) { ui.post(() -> Media.cmd(getCarContext(), k)); }
            @JavascriptInterface public void tile(int i) { ui.post(() -> openTile(i)); }
        }

        private void openTile(int i) {
            CarContext cc = getCarContext();
            try {
                JSONArray t = new JSONObject(App.cfg(cc)).optJSONArray("tiles");
                if (t == null || i < 0 || i >= t.length()) return;
                JSONObject o = t.getJSONObject(i);
                String k = o.optString("t");
                if ("media".equals(k)) {
                    Media.playApp(cc, o.optString("pkg"));
                    CarToast.makeText(cc, "يشتغل " + o.optString("label") + "، تلگاه بشاشة الموسيقى", CarToast.LENGTH_SHORT).show();
                } else if ("nav".equals(k)) {
                    cc.startCarApp(new Intent(CarContext.ACTION_NAVIGATE, Uri.parse("geo:0,0?q=" + Uri.encode(o.optString("q")))));
                } else if ("call".equals(k)) {
                    cc.startCarApp(new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + o.optString("tel").replaceAll("[^0-9+]", ""))));
                }
            } catch (Throwable e) {
                CarToast.makeText(cc, "ما گدرت أفتحها من هنا", CarToast.LENGTH_LONG).show();
            }
        }
    }
}
