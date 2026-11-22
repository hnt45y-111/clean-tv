package com.msm.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;
import android.widget.Toast;

import java.util.Map;

/** One home-screen widget. Each app subclasses it seven times (one per widget) and says what it is. */
public abstract class BaseProvider extends AppWidgetProvider {
    protected abstract WApp app();
    protected abstract Wd def();

    static final String ACT = "com.msm.widgets.ACT";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) { for (int id : ids) render(ctx, m, id); }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager m, int id, Bundle o) { render(ctx, m, id); }

    @Override
    public void onDeleted(Context ctx, int[] ids) { for (int id : ids) WStore.drop(ctx, id); }

    @Override
    public void onReceive(final Context ctx, Intent in) {
        if (in != null && ACT.equals(in.getAction())) {
            final String id = in.getStringExtra("a");
            final PendingResult pr = goAsync();
            new Thread(new Runnable() {
                public void run() {
                    boolean ok = false;
                    try {
                        Act a = Painter.find(ctx, app(), id);
                        if (a != null) ok = app().send(ctx.getApplicationContext(), a);
                    } catch (Throwable ignored) { }
                    if (!ok) new Handler(Looper.getMainLooper()).post(new Runnable() { public void run() { Toast.makeText(ctx.getApplicationContext(), "ما وصل الأمر. افتح التطبيق واربطه بالتلفاز أول", Toast.LENGTH_SHORT).show(); } });
                    pr.finish();
                }
            }).start();
            return;
        }
        super.onReceive(ctx, in);
    }

    /** widget size in dp for the current orientation */
    int[] size(Context ctx, AppWidgetManager m, int id) {
        Bundle o = m.getAppWidgetOptions(id);
        boolean land = ctx.getResources().getConfiguration().orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        int w = o == null ? 0 : o.getInt(land ? AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = o == null ? 0 : o.getInt(land ? AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        Wd d = def();
        return new int[]{w > 40 ? w : d.defW, h > 40 ? h : d.defH};
    }

    static int idOf(Context c, String name, String type) { return c.getResources().getIdentifier(name, type, c.getPackageName()); }

    void render(Context ctx, AppWidgetManager m, int id) {
        try {
            Wd d = def(); WApp app = app();
            int[] sz = size(ctx, m, id);
            Painter.Frame f = Painter.draw(ctx, app, d, sz[0], sz[1], id);
            boolean clock = d.type == Wd.CLOCK;
            RemoteViews rv = new RemoteViews(ctx.getPackageName(), idOf(ctx, clock ? "msm_clock" : "msm_widget", "layout"));
            rv.setImageViewBitmap(idOf(ctx, "msm_bg", "id"), f.bmp);
            if (clock) {
                Map<String, String> data = app.data(ctx);
                rv.setTextViewText(idOf(ctx, "msm_greet", "id"), data.get("greet") == null ? "" : data.get("greet"));
                click(ctx, rv, idOf(ctx, "msm_z", "id"), f.zones[0], id, 0);
            } else {
                for (int r = 0; r < 4; r++) {
                    rv.setViewVisibility(idOf(ctx, "msm_r" + r, "id"), r < f.rows ? android.view.View.VISIBLE : android.view.View.GONE);
                    for (int c = 0; c < 5; c++) {
                        int zid = idOf(ctx, "msm_z" + r + c, "id");
                        boolean on = r < f.rows && c < f.cols;
                        rv.setViewVisibility(zid, on ? android.view.View.VISIBLE : android.view.View.GONE);
                        if (on) click(ctx, rv, zid, f.zones[r * f.cols + c], id, r * 5 + c);
                    }
                }
            }
            m.updateAppWidget(id, rv);
        } catch (Throwable t) { /* a widget that fails to draw must never crash the app */ }
    }

    private void click(Context ctx, RemoteViews rv, int viewId, Act a, int widgetId, int zone) {
        if (a == null) return;
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        Uri u = Uri.parse("msm://w/" + widgetId + "/" + zone + "/" + a.id);
        PendingIntent pi;
        if (a.kind == Act.ROUTE) {
            Intent i = app().open(ctx, a.arg);
            i.setData(u);
            pi = PendingIntent.getActivity(ctx, widgetId * 32 + zone, i, flags);
        } else {
            Intent b = new Intent(ctx, getClass()).setAction(ACT).putExtra("a", a.id).setData(u);
            pi = PendingIntent.getBroadcast(ctx, widgetId * 32 + zone, b, flags);
        }
        rv.setOnClickPendingIntent(viewId, pi);
    }
}
