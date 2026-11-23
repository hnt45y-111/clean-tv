package com.calmnerves.android;

import android.content.Intent;
import android.os.Bundle;
import com.badlogic.gdx.backends.android.AndroidApplication;
import com.badlogic.gdx.backends.android.AndroidApplicationConfiguration;
import com.calmnerves.CalmGame;

public class AndroidLauncher extends AndroidApplication {
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        AndroidApplicationConfiguration c = new AndroidApplicationConfiguration();
        c.useAccelerometer = true; c.useCompass = false; c.useImmersiveMode = true; c.useGL30 = true; c.numSamples = 2;
        initialize(new CalmGame(new AndroidText(getAssets()), text -> runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, text); startActivity(Intent.createChooser(i, null));
        })), c);
    }
}
