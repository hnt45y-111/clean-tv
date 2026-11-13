package com.moamal.studio;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;

import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** Finds TVs on the Wi-Fi that announce wireless debugging, pairing, or our launcher. */
final class Discovery {
    interface Sink { void found(JSONObject o); }

    static final String[] TYPES = { "_adb-tls-connect._tcp.", "_adb-tls-pairing._tcp.", "_cleantv._tcp.", "_adb._tcp." };

    private final NsdManager nsd;
    private final WifiManager.MulticastLock lock;
    private final Sink sink;
    private final List<NsdManager.DiscoveryListener> listeners = new ArrayList<>();
    private final ArrayDeque<NsdServiceInfo> queue = new ArrayDeque<>();
    private boolean resolving;

    Discovery(Context c, Sink s) {
        nsd = (NsdManager) c.getSystemService(Context.NSD_SERVICE);
        WifiManager wm = (WifiManager) c.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        lock = wm.createMulticastLock("studio-mdns");
        lock.setReferenceCounted(false);
        sink = s;
    }

    private volatile boolean scanning;
    private Thread scanner;

    /** Android 8/9 head units and boxes don't announce anything: knock on every address of our own networks
     *  (Wi-Fi and the phone's hotspot) for an open ADB port (5555) or our launcher (8686). */
    private void startScan() {
        scanning = true;
        scanner = new Thread(() -> {
            while (scanning) {
                try { scanOnce(); } catch (Throwable ignored) { }
                for (int i = 0; i < 25 && scanning; i++) { try { Thread.sleep(1000); } catch (InterruptedException e) { return; } }
            }
        }, "studio-scan");
        scanner.setDaemon(true);
        scanner.start();
    }

    private void scanOnce() throws Exception {
        java.util.Set<String> mine = new java.util.HashSet<>(), nets = new java.util.LinkedHashSet<>();
        for (java.net.NetworkInterface ni : java.util.Collections.list(java.net.NetworkInterface.getNetworkInterfaces())) {
            if (!ni.isUp() || ni.isLoopback()) continue;
            String n = ni.getName() == null ? "" : ni.getName();
            if (n.startsWith("rmnet") || n.startsWith("ccmni") || n.startsWith("v4-") || n.startsWith("tun") || n.startsWith("dummy") || n.startsWith("ppp")) continue;
            for (java.net.InterfaceAddress ia : ni.getInterfaceAddresses()) {
                java.net.InetAddress a = ia.getAddress();
                if (!(a instanceof java.net.Inet4Address) || a.isLoopbackAddress() || !a.isSiteLocalAddress()) continue;
                String ip = a.getHostAddress(); mine.add(ip);
                nets.add(ip.substring(0, ip.lastIndexOf('.') + 1));
            }
        }
        java.util.concurrent.ExecutorService ex = java.util.concurrent.Executors.newFixedThreadPool(48);
        for (String base : nets) for (int h = 1; h < 255; h++) {
            final String host = base + h;
            if (mine.contains(host)) continue;
            ex.execute(() -> { probe(host, 8686, "launcher"); probe(host, 5555, "tcp"); });
        }
        ex.shutdown();
        ex.awaitTermination(40, java.util.concurrent.TimeUnit.SECONDS);
    }

    private void probe(String host, int port, String kind) {
        if (!scanning) return;
        try (java.net.Socket so = new java.net.Socket()) {
            so.connect(new java.net.InetSocketAddress(host, port), 350);
            JSONObject o = new JSONObject();
            o.put("kind", kind).put("name", "scan-" + host).put("host", host).put("port", port)
             .put("label", "launcher".equals(kind) ? "شاشة عليها واجهة مدير الشاشات" : "جهاز أندرويد (سيارة / بوكس)");
            sink.found(o);
        } catch (Throwable ignored) { }
    }

    synchronized void start() {
        stop();
        startScan();
        try { lock.acquire(); } catch (Throwable ignored) { }
        for (String t : TYPES) {
            NsdManager.DiscoveryListener l = new NsdManager.DiscoveryListener() {
                public void onStartDiscoveryFailed(String a, int b) { }
                public void onStopDiscoveryFailed(String a, int b) { }
                public void onDiscoveryStarted(String a) { }
                public void onDiscoveryStopped(String a) { }
                public void onServiceFound(NsdServiceInfo info) { enqueue(info); }
                public void onServiceLost(NsdServiceInfo info) { }
            };
            try {
                nsd.discoverServices(t, NsdManager.PROTOCOL_DNS_SD, l);
                listeners.add(l);
            } catch (Throwable ignored) { }
        }
    }

    synchronized void stop() {
        scanning = false;
        if (scanner != null) { scanner.interrupt(); scanner = null; }
        for (NsdManager.DiscoveryListener l : listeners) {
            try { nsd.stopServiceDiscovery(l); } catch (Throwable ignored) { }
        }
        listeners.clear();
        queue.clear();
        resolving = false;
        try { lock.release(); } catch (Throwable ignored) { }
    }

    private synchronized void enqueue(NsdServiceInfo info) {
        queue.add(info);
        next();
    }

    private synchronized void next() {
        if (resolving || queue.isEmpty()) return;
        resolving = true;
        NsdServiceInfo info = queue.poll();
        try {
            nsd.resolveService(info, new NsdManager.ResolveListener() {
                public void onResolveFailed(NsdServiceInfo i, int code) { done(); }
                public void onServiceResolved(NsdServiceInfo i) {
                    try {
                        if (i.getHost() != null) {
                            String type = i.getServiceType();
                            String kind = type.contains("pairing") ? "pair" : type.contains("cleantv") ? "launcher"
                                    : type.contains("tls-connect") ? "connect" : "tcp";
                            JSONObject o = new JSONObject();
                            o.put("kind", kind).put("name", i.getServiceName())
                                    .put("host", i.getHost().getHostAddress()).put("port", i.getPort());
                            try {
                                byte[] n = i.getAttributes().get("name");
                                if (n != null) o.put("label", new String(n, "UTF-8"));
                            } catch (Throwable ignored) { }
                            sink.found(o);
                        }
                    } catch (Throwable ignored) { }
                    done();
                }
            });
        } catch (Throwable t) { done(); }
    }

    private synchronized void done() {
        resolving = false;
        next();
    }
}
