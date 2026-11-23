package com.calmnerves.android;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.badlogic.gdx.backends.android.AndroidApplication;
import com.badlogic.gdx.backends.android.AndroidApplicationConfiguration;
import com.calmnerves.CalmGame;
import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.io.StringWriter;

public class AndroidLauncher extends AndroidApplication {
    private File crashFile() { return new File(getFilesDir(), "crash.txt"); }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (android.os.Build.VERSION.SDK_INT >= 28) getWindow().getAttributes().layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        File cf = crashFile();
        File sf = new File(getFilesDir(), "stage.txt");
        String stage = sf.exists() ? read(sf).trim() : "";
        if (cf.exists() || (!stage.isEmpty() && !stage.equals("OK"))) { showCrash("last stage: " + stage + "\n\n" + (cf.exists() ? read(cf) : "(no Java exception: native crash)")); return; }   // last run crashed: show the reason instead of closing silently
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> { save("thread " + t.getName() + "\n" + trace(e)); android.os.Process.killProcess(android.os.Process.myPid()); System.exit(10); });
        try {
            AndroidApplicationConfiguration c = new AndroidApplicationConfiguration();
            c.useAccelerometer = true; c.useCompass = false; c.useImmersiveMode = true; c.useGL30 = false; c.numSamples = 0;
            initialize(new CalmGame(new AndroidText(getAssets()), text -> runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, text); startActivity(Intent.createChooser(i, null));
            })), c);
        } catch (Throwable e) { save("onCreate\n" + trace(e)); showCrash(trace(e)); }
    }
    private static String trace(Throwable e) { StringWriter sw = new StringWriter(); e.printStackTrace(new PrintWriter(sw)); return sw.toString(); }
    private void save(String s) { try (FileWriter w = new FileWriter(crashFile())) { w.write(s); } catch (Exception ignored) { } }
    private static String read(File f) { try (java.io.BufferedReader r = new java.io.BufferedReader(new java.io.FileReader(f))) { StringBuilder sb = new StringBuilder(); String l; while ((l = r.readLine()) != null) sb.append(l).append('\n'); return sb.toString(); } catch (Exception e) { return "?"; } }
    private void showCrash(String text) {
        LinearLayout ll = new LinearLayout(this); ll.setOrientation(LinearLayout.VERTICAL); ll.setBackgroundColor(Color.parseColor("#1b1250")); ll.setPadding(24, 60, 24, 24);
        TextView h = new TextView(this); h.setText("CRASH REPORT - screenshot this"); h.setTextColor(Color.YELLOW); h.setTextSize(18); ll.addView(h);
        ScrollView sv = new ScrollView(this); TextView t = new TextView(this); t.setText(text.length() > 4000 ? text.substring(0, 4000) : text); t.setTextColor(Color.WHITE); t.setTextSize(10); t.setTextIsSelectable(true); sv.addView(t); ll.addView(sv, new LinearLayout.LayoutParams(-1, 0, 1f));
        Button bt = new Button(this); bt.setText("Clear & retry"); bt.setOnClickListener(v -> { crashFile().delete(); new File(getFilesDir(), "stage.txt").delete(); recreate(); }); ll.addView(bt);
        setContentView(ll);
    }
}
