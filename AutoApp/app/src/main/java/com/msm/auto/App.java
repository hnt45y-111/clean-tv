package com.msm.auto;

import android.content.Context;
import android.content.SharedPreferences;

final class App {
    private App() { }
    static SharedPreferences kv(Context c) { return c.getApplicationContext().getSharedPreferences("auto", 0); }
    static String cfg(Context c) { return kv(c).getString("cfg", "{}"); }
}
