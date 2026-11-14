package com.cleantv.launcher;

import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Looper;

/** GPS speed, heading and altitude for the car screen widgets. */
final class CarSensors {
    private static LocationListener listener;
    private static Location last;
    private static float distanceM;
    private static long startedAt;

    private CarSensors() { }

    static synchronized void start(Context ctx) {
        if (listener != null) return;
        Context c = ctx.getApplicationContext();
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return;
        if (android.os.Build.VERSION.SDK_INT >= 23 && c.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED
                && c.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) return;
        startedAt = System.currentTimeMillis();
        listener = new LocationListener() {
            @Override public void onLocationChanged(Location l) {
                if (last != null && l.getAccuracy() < 40 && l.hasSpeed() && l.getSpeed() > 1) distanceM += last.distanceTo(l);
                last = l;
                MainActivity.js("window.onLoc&&onLoc(" + state() + ")");
            }
            @Override public void onStatusChanged(String p, int s, Bundle b) { }
            @Override public void onProviderEnabled(String p) { }
            @Override public void onProviderDisabled(String p) { }
        };
        try { lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, listener, Looper.getMainLooper()); } catch (Throwable ignored) { }
        try { lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000, 0, listener, Looper.getMainLooper()); } catch (Throwable ignored) { }
    }

    static String state() {
        Location l = last;
        StringBuilder b = new StringBuilder("{");
        b.append("\"ok\":").append(l != null);
        if (l != null) {
            b.append(",\"kmh\":").append(l.hasSpeed() ? Math.round(l.getSpeed() * 3.6f) : 0)
             .append(",\"bearing\":").append(l.hasBearing() ? Math.round(l.getBearing()) : -1)
             .append(",\"alt\":").append(l.hasAltitude() ? Math.round(l.getAltitude()) : -9999)
             .append(",\"lat\":").append(l.getLatitude()).append(",\"lng\":").append(l.getLongitude())
             .append(",\"acc\":").append(Math.round(l.getAccuracy()))
             .append(",\"gps\":").append(LocationManager.GPS_PROVIDER.equals(l.getProvider()));
        }
        b.append(",\"km\":").append(Math.round(distanceM / 100f) / 10f)
         .append(",\"mins\":").append(startedAt == 0 ? 0 : (System.currentTimeMillis() - startedAt) / 60000)
         .append("}");
        return b.toString();
    }
}
