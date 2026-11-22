package com.msm.widgets;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * Where the user picks ready shortcuts: for a placed widget (configure screen), or for the app icon's press-and-hold menu.
 * The list is the app's own catalogue, so nothing here is typed by hand.
 */
public class PickActivity extends Activity {
    private WApp app;
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private boolean iconMode;
    private final List<String> picked = new ArrayList<>();
    private TextView count;
    private final List<View> rows = new ArrayList<>();
    private Act[] cat;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setResult(RESULT_CANCELED);
        app = AppLoader.of(this);
        if (app == null) { finish(); return; }
        Intent in = getIntent();
        iconMode = in != null && "icon".equals(in.getStringExtra("mode"));
        if (!iconMode) {
            widgetId = in == null ? AppWidgetManager.INVALID_APPWIDGET_ID : in.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }
        }
        cat = app.catalog(this);
        String[] cur = iconMode ? WStore.icon(this, app.iconDefaults(this)) : WStore.get(this, widgetId, app.defaults(this, "grid"));
        for (String s : cur) picked.add(s);
        getWindow().setStatusBarColor(0xFF0A0A0F); getWindow().setNavigationBarColor(0xFF0A0A0F);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(0xFF0A0A0F); root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        int pad = dp(18);
        TextView t = tv(iconMode ? "اختصارات الأيقونة" : "اختار الاختصارات", 24, true, Color.WHITE); t.setPadding(pad, pad + dp(8), pad, dp(4)); root.addView(t);
        count = tv("", 14, false, 0xFFB8B8C6); count.setPadding(pad, 0, pad, dp(10)); root.addView(count);
        ScrollView sv = new ScrollView(this);
        LinearLayout list = new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL); list.setPadding(dp(12), 0, dp(12), dp(12));
        for (int i = 0; i < cat.length; i++) { View r = row(cat[i]); rows.add(r); list.addView(r); }
        sv.addView(list);
        root.addView(sv, new LinearLayout.LayoutParams(-1, 0, 1));
        Button ok = new Button(this); ok.setText("حفظ"); ok.setTextColor(Color.WHITE); ok.setTextSize(18); ok.setTypeface(Typeface.DEFAULT_BOLD); ok.setAllCaps(false);
        GradientDrawable g = new GradientDrawable(); g.setColor(app.accent()); g.setCornerRadius(dp(26)); ok.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(54)); lp.setMargins(pad, dp(8), pad, pad); root.addView(ok, lp);
        ok.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { save(); } });
        setContentView(root);
        refresh();
    }

    private int limit() { return iconMode ? Shortcuts.MAX : 20; }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
    private TextView tv(String s, int sp, boolean bold, int color) { TextView t = new TextView(this); t.setText(s); t.setTextSize(sp); t.setTextColor(color); if (bold) t.setTypeface(Typeface.DEFAULT_BOLD); return t; }

    private View row(final Act a) {
        TextView t = tv(a.label, 17, true, Color.WHITE);
        t.setGravity(Gravity.CENTER_VERTICAL); t.setPadding(dp(16), 0, dp(16), 0); t.setTag(a.id);
        t.setOnClickListener(new View.OnClickListener() { public void onClick(View v) {
            if (picked.contains(a.id)) picked.remove(a.id); else if (picked.size() < limit()) picked.add(a.id); else android.widget.Toast.makeText(PickActivity.this, "وصلت للحد الأقصى (" + limit() + ")", android.widget.Toast.LENGTH_SHORT).show();
            refresh();
        } });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(56)); lp.setMargins(0, dp(4), 0, dp(4)); t.setLayoutParams(lp);
        return t;
    }

    private void refresh() {
        for (int i = 0; i < rows.size(); i++) {
            TextView t = (TextView) rows.get(i); String id = (String) t.getTag(); boolean on = picked.contains(id);
            GradientDrawable g = new GradientDrawable(); g.setCornerRadius(dp(16));
            g.setColor(on ? (app.accent() & 0x00FFFFFF) | 0x44000000 : 0x14FFFFFF); g.setStroke(dp(1), on ? app.accent() : 0x28FFFFFF);
            t.setBackground(g);
            t.setText((on ? "✓  " : "      ") + cat[i].label);
        }
        count.setText(iconMode ? "اختار لحد " + limit() + " اختصارات تطلع لما تضغط مطوّلاً على الأيقونة (" + picked.size() + ")" : "المختار: " + picked.size() + " · الويدجت الأكبر يعرض أكثر، والباقي اقتراحات جاهزة");
    }

    private void save() {
        String[] ids = picked.toArray(new String[0]);
        if (iconMode) {
            WStore.setIcon(this, ids);
            try { Shortcuts.publish(this, app, ActActivity.class, PickActivity.class); } catch (Throwable ignored) { }
            finish();
            return;
        }
        WStore.set(this, widgetId, ids);
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(this);
            AppWidgetProviderInfo info = m.getAppWidgetInfo(widgetId);
            if (info != null) {
                ComponentName cn = info.provider;
                sendBroadcast(new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(cn).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, new int[]{widgetId}));
            }
        } catch (Throwable ignored) { }
        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
        finish();
    }
}
