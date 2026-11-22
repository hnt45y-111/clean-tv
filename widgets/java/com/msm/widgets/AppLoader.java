package com.msm.widgets;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;

/** Finds the app's {@link WApp} from the activity's meta-data («msm.app» = class name). */
final class AppLoader {
    private AppLoader() { }

    static WApp of(Activity a) {
        try {
            ActivityInfo ai = a.getPackageManager().getActivityInfo(a.getComponentName(), PackageManager.GET_META_DATA);
            Bundle b = ai.metaData;
            String cn = b == null ? null : b.getString("msm.app");
            return (WApp) Class.forName(cn).getDeclaredConstructor().newInstance();
        } catch (Throwable t) { return null; }
    }
}
