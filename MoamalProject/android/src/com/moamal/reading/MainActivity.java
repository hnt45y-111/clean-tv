package com.moamal.reading;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.content.Intent;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import android.content.res.AssetFileDescriptor;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView wv;
    private TextToSpeech tts;
    private volatile boolean ttsOk = false;
    private PermissionRequest pending;
    private SpeechRecognizer sr;
    private String srPendingLang = null;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        wv = new WebView(this);
        setContentView(wv);
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            public void onInit(int st) {
                if (st == TextToSpeech.SUCCESS) {
                    int r = tts.setLanguage(new Locale("ar"));
                    ttsOk = r >= 0;
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        public void onStart(String id) {}
                        public void onDone(String id) { done(id); }
                        public void onError(String id) { done(id); }
                    });
                }
            }
        });
        wv.addJavascriptInterface(new Bridge(), "AndroidTTS");
        wv.addJavascriptInterface(new SR(), "AndroidSR");
        wv.setFocusable(true);
        wv.setFocusableInTouchMode(true);
        wv.requestFocus();
        wv.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!"app.local".equals(u.getHost())) return null;
                String p = u.getPath();
                if (p == null || p.equals("/")) p = "/index.html";
                try {
                    String path = "www" + p;
                    String mt = mime(p);
                    String enc = mt.startsWith("text") || p.endsWith(".js") ? "UTF-8" : null;
                    long len = -1;
                    try { AssetFileDescriptor fd = getAssets().openFd(path); len = fd.getLength(); fd.close(); } catch (IOException ex) { len = -1; }
                    Map<String, String> h = new HashMap<String, String>();
                    h.put("Access-Control-Allow-Origin", "*");
                    String range = null;
                    Map<String, String> rq = req.getRequestHeaders();
                    if (rq != null) for (Map.Entry<String, String> en : rq.entrySet()) if ("range".equalsIgnoreCase(en.getKey())) range = en.getValue();
                    if (range != null && len > 0 && range.startsWith("bytes=")) {
                        String[] se = range.substring(6).split("-", -1);
                        long st = se[0].trim().length() > 0 ? Long.parseLong(se[0].trim()) : 0;
                        long end = se.length > 1 && se[1].trim().length() > 0 ? Long.parseLong(se[1].trim()) : len - 1;
                        if (end >= len) end = len - 1;
                        if (st > end) st = end;
                        int n = (int) (end - st + 1);
                        InputStream in = getAssets().open(path);
                        long sk = 0; while (sk < st) { long k = in.skip(st - sk); if (k <= 0) break; sk += k; }
                        byte[] buf = new byte[n]; int off = 0;
                        while (off < n) { int k = in.read(buf, off, n - off); if (k < 0) break; off += k; }
                        in.close();
                        h.put("Accept-Ranges", "bytes");
                        h.put("Content-Range", "bytes " + st + "-" + end + "/" + len);
                        h.put("Content-Length", String.valueOf(off));
                        return new WebResourceResponse(mt, enc, 206, "Partial Content", h, new ByteArrayInputStream(buf, 0, off));
                    }
                    if (len > 0) { h.put("Accept-Ranges", "bytes"); h.put("Content-Length", String.valueOf(len)); }
                    return new WebResourceResponse(mt, enc, 200, "OK", h, getAssets().open(path));
                } catch (IOException e) {
                    WebResourceResponse r = new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                    r.setStatusCodeAndReasonPhrase(404, "Not Found");
                    return r;
                }
            }
        });
        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(new Runnable() { public void run() {
                    if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        pending = r;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 7);
                    } else r.grant(r.getResources());
                }});
            }
        });
        wv.loadUrl("https://app.local/index.html");
    }

    static String mime(String p) {
        p = p.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg")) return "image/jpeg";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private void done(final String id) {
        runOnUiThread(new Runnable() { public void run() {
            wv.evaluateJavascript("window.__ttsDone&&__ttsDone('" + id + "')", null);
        }});
    }

    class Bridge {
        @JavascriptInterface public boolean ok() { return ttsOk; }
        @JavascriptInterface public void speak(String id, String text, float rate) {
            if (!ttsOk) { done(id); return; }
            tts.setSpeechRate(Math.max(0.5f, Math.min(1.5f, rate)));
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), id);
        }
        @JavascriptInterface public void stop() { if (tts != null) tts.stop(); }
    }

    private void js(final String code) {
        runOnUiThread(new Runnable() { public void run() { wv.evaluateJavascript(code, null); }});
    }

    private void startListening(String lang) {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            srPendingLang = lang;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 8);
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { js("window.__srError&&__srError(5)"); return; }
        if (sr == null) {
            sr = SpeechRecognizer.createSpeechRecognizer(this);
            sr.setRecognitionListener(new RecognitionListener() {
                public void onReadyForSpeech(Bundle p) {}
                public void onBeginningOfSpeech() {}
                public void onRmsChanged(float v) {}
                public void onBufferReceived(byte[] b) {}
                public void onEndOfSpeech() {}
                public void onError(int e) { js("window.__srError&&__srError(" + e + ")"); }
                public void onResults(Bundle r) {
                    ArrayList<String> l = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    JSONArray a = new JSONArray();
                    if (l != null) for (String x : l) a.put(x);
                    js("window.__srResult&&__srResult(" + JSONObject.quote(a.toString()) + ")");
                }
                public void onPartialResults(Bundle r) {
                    ArrayList<String> l = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (l != null && l.size() > 0) js("window.__srPartial&&__srPartial(" + JSONObject.quote(l.get(0)) + ")");
                }
                public void onEvent(int t, Bundle b) {}
            });
        }
        Intent it = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        it.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        it.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        it.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
        it.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        it.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        it.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000);
        it.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500);
        it.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 2000);
        try { sr.startListening(it); } catch (Exception ex) { js("window.__srError&&__srError(5)"); }
    }

    class SR {
        @JavascriptInterface public boolean ok() { return SpeechRecognizer.isRecognitionAvailable(MainActivity.this); }
        @JavascriptInterface public void start(final String lang) {
            runOnUiThread(new Runnable() { public void run() { startListening(lang == null || lang.length() == 0 ? "ar-SA" : lang); }});
        }
        @JavascriptInterface public void stop() {
            runOnUiThread(new Runnable() { public void run() { if (sr != null) sr.stopListening(); }});
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        if (code == 8) {
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED && srPendingLang != null) startListening(srPendingLang);
            else js("window.__srError&&__srError(9)");
            srPendingLang = null;
            return;
        }
        if (pending != null) {
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) pending.grant(pending.getResources());
            else pending.deny();
            pending = null;
        }
    }

    @Override
    public void onBackPressed() {
        wv.evaluateJavascript("window.appBack?appBack():'exit'", new ValueCallback<String>() {
            public void onReceiveValue(String v) { if (v == null || v.contains("exit")) finish(); }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean f) {
        super.onWindowFocusChanged(f);
        if (f) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override protected void onPause() { super.onPause(); if (tts != null) tts.stop(); }
    @Override protected void onDestroy() { if (tts != null) tts.shutdown(); if (sr != null) sr.destroy(); super.onDestroy(); }
}
