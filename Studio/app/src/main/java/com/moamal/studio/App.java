package com.moamal.studio;

import android.app.Application;
import android.content.Context;
import android.os.Build;

import org.conscrypt.Conscrypt;
import org.lsposed.hiddenapibypass.HiddenApiBypass;

import java.security.Security;

import io.github.muntashirakon.adb.PRNGFixes;

public class App extends Application {
    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try { HiddenApiBypass.addHiddenApiExemptions("L"); } catch (Throwable ignored) { }
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        try { PRNGFixes.apply(); } catch (Throwable ignored) { }
        try { Security.insertProviderAt(Conscrypt.newProvider(), 1); } catch (Throwable ignored) { }
    }
}
