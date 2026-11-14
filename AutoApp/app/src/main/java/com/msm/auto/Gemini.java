package com.msm.auto;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * AI UI generator: sends the user's words plus a hidden system prompt to the Gemini REST API and returns
 * the JSON text it answers with. The page (ai.js) turns that JSON into a live design.
 */
final class Gemini {
    /* The key is not in the code: it ships as its own file inside the app (assets/ai.dat, masked so it is not plain text),
       and the admin can replace it on his phone without a new version (kv «geminiKey»). */
    private static String keyCache;

    static String key(android.content.Context c) {
        String k = App.kv(c).getString("geminiKey", null);
        if (k != null && k.length() > 10) return k.replace("\"", "").trim();
        if (keyCache != null) return keyCache;
        try (InputStream in = c.getAssets().open("ai.dat")) {
            byte[] d = android.util.Base64.decode(new String(Gemini.readAll(in), StandardCharsets.UTF_8).trim(), android.util.Base64.DEFAULT);
            byte[] m = "msm-ai-2026".getBytes(StandardCharsets.UTF_8);
            for (int i = 0; i < d.length; i++) d[i] = (byte) (d[i] ^ m[i % m.length]);
            keyCache = new String(d, StandardCharsets.UTF_8).trim();
        } catch (Exception e) { keyCache = ""; }
        return keyCache;
    }

    /* fastest first; thinking is turned off on the 2.5 models so the answer comes in a few seconds */
    private static final String[] MODELS = { "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest" };

    private Gemini() { }

    static String generate(android.content.Context ctx, String system, String prompt) throws Exception {
        String GEMINI_API_KEY = key(ctx);
        if (GEMINI_API_KEY.isEmpty()) throw new Exception("مفتاح الذكاء الاصطناعي مو موجود");
        JSONObject base = new JSONObject()
                .put("systemInstruction", new JSONObject().put("parts", new JSONArray().put(new JSONObject().put("text", system))))
                .put("contents", new JSONArray().put(new JSONObject().put("role", "user")
                        .put("parts", new JSONArray().put(new JSONObject().put("text", prompt)))))
                ;
        Exception last = null;
        for (String m : MODELS) {
            JSONObject gc = new JSONObject().put("responseMimeType", "application/json").put("temperature", 0.8).put("maxOutputTokens", 1400);
            if (m.startsWith("gemini-2.5")) gc.put("thinkingConfig", new JSONObject().put("thinkingBudget", 0));
            JSONObject body = new JSONObject(base.toString()).put("generationConfig", gc);
            byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
            HttpURLConnection c = (HttpURLConnection) new URL("https://generativelanguage.googleapis.com/v1beta/models/" + m
                    + ":generateContent?key=" + java.net.URLEncoder.encode(GEMINI_API_KEY, "UTF-8")).openConnection();
            c.setRequestMethod("POST");
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("x-goog-api-key", GEMINI_API_KEY);
            c.setConnectTimeout(10000);
            c.setReadTimeout(35000);
            c.setDoOutput(true);
            c.setFixedLengthStreamingMode(data.length);
            try (OutputStream o = c.getOutputStream()) { o.write(data); }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            String txt = in == null ? "" : new String(Gemini.readAll(in), StandardCharsets.UTF_8);
            if (code == 404 || code >= 500) { last = new Exception(code == 404 ? "النموذج " + m + " مو متوفر" : "خادم Gemini مشغول"); continue; }
            if (code == 429) throw new Exception("الذكاء الاصطناعي مشغول هسه، جرّب بعد دقيقة");
            if (code == 401 || code == 403) throw new Exception("مفتاح Gemini مرفوض أو موقوف");
            if (code >= 400) {
                String msg = "";
                try { msg = new JSONObject(txt).getJSONObject("error").optString("message"); } catch (Throwable ignored) { }
                String lm = msg.toLowerCase(java.util.Locale.ROOT);
                if (code == 400 && (lm.contains("model") || lm.contains("thinking"))) { last = new Exception(msg); continue; }
                if (code == 400 && (lm.contains("api key") || lm.contains("api_key"))) throw new Exception("مفتاح Gemini مرفوض أو موقوف");
                throw new Exception("خطأ من Gemini " + code + (msg.isEmpty() ? "" : ": " + msg));
            }
            JSONObject r = new JSONObject(txt);
            JSONArray cands = r.optJSONArray("candidates");
            if (cands == null || cands.length() == 0) throw new Exception("Gemini ما رجّع تصميم، غيّر الوصف شوية وجرّب");
            JSONArray parts = cands.getJSONObject(0).getJSONObject("content").getJSONArray("parts");
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < parts.length(); i++) b.append(parts.getJSONObject(i).optString("text"));
            return b.toString();
        }
        throw last != null ? last : new Exception("ما گدرت أوصل لـ Gemini");
    }

    static byte[] readAll(InputStream in) throws java.io.IOException {
        java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream(); byte[] b = new byte[8192]; int n;
        while ((n = in.read(b)) > 0) o.write(b, 0, n);
        return o.toByteArray();
    }
}
