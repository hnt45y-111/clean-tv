import com.mafia.game.core.*;
import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;

/**
 * تشغيل خادم هاتف الراوي على الحاسوب للتطوير والاختبار (نفس الكود الموجود في التطبيق).
 * الاستعمال: java DevMain <client-dir> <port> <snapshot-file>
 */
public class DevMain {
    public static void main(String[] a) throws Exception {
        File client = new File(a.length > 0 ? a[0] : "../../client");
        int port = a.length > 1 ? Integer.parseInt(a[1]) : 8080;
        File snap = new File(a.length > 2 ? a[2] : "mafia-snapshot.json");
        Hub hub = new Hub(snap);
        String grace = System.getenv("LOBBY_GRACE_MS"); if (grace != null) hub.lobbyGraceMs = Long.parseLong(grace);
        int restored = hub.restore();
        Server srv = new Server(hub, p -> { try { File f = new File(client, p); return f.isFile() ? Files.readAllBytes(f.toPath()) : null; } catch (Exception e) { return null; } },
                () -> new ArrayList<>(Arrays.asList(System.getenv().getOrDefault("LAN_IP", "192.168.43.1"))),
                () -> Json.obj("wifi", Json.obj("ssid", "DIRECT-Mafia-TEST", "pass", "pa55word;x", "security", "WPA"), "error", null));
        srv.start(port, port);
        System.out.println("local server on " + srv.port + " restored=" + restored);
        Thread.currentThread().join();
    }
}
