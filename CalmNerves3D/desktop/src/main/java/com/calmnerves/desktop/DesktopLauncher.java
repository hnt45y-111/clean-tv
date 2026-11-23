package com.calmnerves.desktop;

import com.badlogic.gdx.backends.lwjgl3.*;
import com.calmnerves.CalmGame;
import com.calmnerves.Platform;
import java.io.File;

public class DesktopLauncher {
    public static void main(String[] a) {
        Lwjgl3ApplicationConfiguration c = new Lwjgl3ApplicationConfiguration(); c.setTitle("Calm Your Nerves"); c.setWindowedMode(540, 1170); c.useVsync(true); c.setForegroundFPS(60); c.setBackBufferConfig(8, 8, 8, 8, 16, 0, 0);
        Platform p = t -> System.out.println("SHARE: " + t);
        AwtText tr = new AwtText(new File("fonts/cairo.ttf"));
        new Lwjgl3Application(System.getProperty("calm.shots") != null ? new ShotGame(tr, p) : new CalmGame(tr, p), c);
    }
}
