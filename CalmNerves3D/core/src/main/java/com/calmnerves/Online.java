package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.net.HttpRequestBuilder;
import com.badlogic.gdx.utils.JsonReader;
import com.badlogic.gdx.utils.JsonValue;
import java.util.function.Consumer;

/** Tournament calls: two Supabase RPC functions (calm_submit, calm_top). */
public class Online {
    public static class Row { public String pid, name; public int score; }
    private static void rpc(String fn, String body, Consumer<String> ok, Runnable fail) {
        com.badlogic.gdx.Net.HttpRequest rq = new HttpRequestBuilder().newRequest().method(com.badlogic.gdx.Net.HttpMethods.POST).url(Config.SUPABASE_URL + "/rest/v1/rpc/" + fn)
            .header("apikey", Config.SUPABASE_KEY).header("Authorization", "Bearer " + Config.SUPABASE_KEY).header("Content-Type", "application/json").content(body).build();
        rq.setTimeOut(8000);
        Gdx.net.sendHttpRequest(rq, new com.badlogic.gdx.Net.HttpResponseListener() {
            public void handleHttpResponse(com.badlogic.gdx.Net.HttpResponse r) { String s = r.getResultAsString(); int c = r.getStatus().getStatusCode(); Gdx.app.postRunnable(() -> { if (c >= 200 && c < 300) ok.accept(s); else fail.run(); }); }
            public void failed(Throwable t) { Gdx.app.postRunnable(fail); }
            public void cancelled() { Gdx.app.postRunnable(fail); }
        });
    }
    public static void submit(int tid, String pid, String name, int score, Runnable ok, Runnable fail) {
        if (!Config.online()) { fail.run(); return; }
        rpc("calm_submit", "{\"p_tid\":" + tid + ",\"p_pid\":" + q(pid) + ",\"p_name\":" + q(name) + ",\"p_score\":" + score + "}", s -> ok.run(), fail);
    }
    public static void top(int tid, Consumer<java.util.List<Row>> ok, Runnable fail) {
        if (!Config.online()) { fail.run(); return; }
        rpc("calm_top", "{\"p_tid\":" + tid + "}", s -> {
            java.util.List<Row> out = new java.util.ArrayList<>();
            try { for (JsonValue v = new JsonReader().parse(s).child; v != null; v = v.next) { Row r = new Row(); r.pid = v.getString("pid", ""); r.name = v.getString("name", "?"); r.score = v.getInt("score", 0); out.add(r); } } catch (Exception e) { fail.run(); return; }
            ok.accept(out);
        }, fail);
    }
    private static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
}
