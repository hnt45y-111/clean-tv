import com.mafia.game.core.*;
import java.util.*;

/** اختبارات قواعد الأدوار (وضع الراوي) بأدوار محددة سلفاً. التشغيل عبر run-tests.sh */
public class RulesTest {
    static int pass = 0, fail = 0;
    static void check(boolean c, String name) { if (c) pass++; else { fail++; System.out.println("✖ " + name); } }
    static void throwsCode(Runnable r, String code, String name) {
        try { r.run(); check(false, name + " (no error)"); } catch (GameError e) { check(e.code.equals(code), name + " got " + e.code); }
    }

    /** مباراة بأدوار مرتبة كما هي: p0..pn */
    static Match game(String... roles) {
        Map<String, Object> st = new LinkedHashMap<>(); st.put("players", (long) roles.length); st.put("mafia", 1L);
        Settings s = Settings.validate(st).settings; s.players = roles.length;
        List<String[]> ps = new ArrayList<>(); for (int i = 0; i < roles.length; i++) ps.add(new String[] { "p" + i, "P" + i });
        Match m = Match.create(ps, s, new Random(1), 0);
        for (int i = 0; i < roles.length; i++) { m.players.get(i).role = roles[i]; m.players.get(i).shield = roles[i].equals("super_citizen"); }
        m.narratorDriven = true; m.beginNight(0); return m;
    }
    @SuppressWarnings("unchecked") static List<Map<String, Object>> deaths(Map<String, Object> ln) { return (List<Map<String, Object>>) ln.get("deaths"); }
    static boolean dead(Match m, String id) { return !m.p(id).alive; }

    public static void main(String[] a) {
        // 1) طبيب المافيا ينقذ المافيا من القناص فقط
        { Match m = game("mafia", "mafia_doctor", "sniper", "citizen", "citizen", "citizen");
          m.recordNight("kill", "p3"); m.recordNight("mdsave", "p0"); m.recordNight("shoot", "p0");
          Map<String, Object> ln = m.resolveNight();
          check(!dead(m, "p0"), "mafia doctor blocks sniper"); check(!dead(m, "p2"), "sniper survives a blocked correct shot"); check(m.sniperUsed, "bullet consumed");
          check("p0".equals(ln.get("sniperBlocked")), "sniperBlocked reported"); check(dead(m, "p3"), "mafia kill still happens");
          throwsCode(() -> { Match g = game("mafia", "mafia_doctor", "citizen", "citizen", "citizen"); g.recordNight("mdsave", "p2"); }, "bad_target", "mafia doctor cannot save town"); }
        { Match m = game("mafia", "mafia_doctor", "sniper", "citizen", "citizen", "citizen");
          m.recordNight("mdsave", "p1"); m.recordNight("shoot", "p0"); m.resolveNight();
          check(dead(m, "p0"), "sniper kills unprotected mafia"); }
        // 2) المواطن سوبر ينجو من أول اغتيال فقط
        { Match m = game("mafia", "super_citizen", "citizen", "citizen", "citizen", "citizen");
          m.recordNight("kill", "p1"); Map<String, Object> ln = m.resolveNight();
          check(!dead(m, "p1") && deaths(ln).isEmpty() && "p1".equals(ln.get("shielded")), "super citizen survives first attack");
          m.beginDay(); m.recordVote(null); m.beginNight(0); m.recordNight("kill", "p1"); m.resolveNight();
          check(dead(m, "p1"), "super citizen dies on second attack"); }
        { Match m = game("mafia", "super_citizen", "doctor", "citizen", "citizen", "citizen");
          m.recordNight("kill", "p1"); m.recordNight("save", "p1"); m.resolveNight();
          check(m.p("p1").shield, "doctor save keeps the extra life"); }
        // 3) المفاوض: يبقى مع المدينة أو يتحول مافيا
        { Match m = game("mafia", "negotiator", "detective", "citizen", "citizen", "citizen", "citizen");
          throwsCode(() -> m.recordNight("negotiate", null, "maybe"), "bad_choice", "negotiate needs a choice");
          m.recordNight("negotiate", null, "mafia"); m.recordNight("kill", "p3"); m.recordNight("investigate", "p1"); m.resolveNight();
          check(Match.team(m.p("p1")).equals("mafia"), "negotiator converted"); check(m.negotiatorDecided, "decision final");
          Map<String, Object> v = m.view("p1", 0); check("mafia".equals(((Map<?, ?>) v.get("me")).get("team")), "converted sees team mafia");
          check(((List<?>) ((Map<?, ?>) v.get("me")).get("mates")).contains("p0"), "converted knows mafia mates");
          Map<String, Object> vm = m.view("p0", 0); boolean sees = false; for (Object o : (List<?>) vm.get("players")) { Map<?, ?> pm = (Map<?, ?>) o; if ("p1".equals(pm.get("id")) && "negotiator".equals(pm.get("role"))) sees = true; }
          check(sees, "mafia sees converted negotiator");
          m.beginDay(); m.recordVote(null); m.beginNight(0);
          check(!m.activeNightRoles().contains("negotiator"), "negotiator not called again");
          throwsCode(() -> m.recordNight("kill", "p1"), "bad_target", "mafia cannot kill converted negotiator");
          m.recordNight("investigate", "p1"); check(Boolean.TRUE.equals(((Map<?, ?>) ((Map<?, ?>) m.view("narrator", 0).get("narrator")).get("night")).get("investigateIsMafia")), "detective sees converted as mafia"); }
        { Match m = game("mafia", "negotiator", "detective", "citizen", "citizen", "citizen");
          m.recordNight("negotiate", null, "town"); m.recordNight("investigate", "p1");
          check(Boolean.FALSE.equals(((Map<?, ?>) ((Map<?, ?>) m.view("narrator", 0).get("narrator")).get("night")).get("investigateIsMafia")), "loyal negotiator is not mafia");
          m.recordNight("kill", "p3"); m.resolveNight(); check(Match.team(m.p("p1")).equals("town") && m.negotiatorDecided, "negotiator stays town"); }
        // 4) الحارس يموت بدل المحروس
        { Match m = game("mafia", "bodyguard", "citizen", "citizen", "citizen", "citizen", "citizen");
          throwsCode(() -> m.recordNight("guard", "p1"), "bad_target", "bodyguard cannot guard himself");
          m.recordNight("guard", "p2"); m.recordNight("kill", "p2"); Map<String, Object> ln = m.resolveNight();
          check(!dead(m, "p2") && dead(m, "p1") && "bodyguard".equals(m.p("p1").diedBy), "bodyguard dies instead"); }
        { Match m = game("mafia", "bodyguard", "doctor", "citizen", "citizen", "citizen", "citizen");
          m.recordNight("guard", "p3"); m.recordNight("save", "p3"); m.recordNight("kill", "p3"); m.resolveNight();
          check(!dead(m, "p1") && !dead(m, "p3"), "doctor save comes before the bodyguard"); }
        // 5) الساحرة: جرعة حياة وجرعة موت، كل منهما مرة واحدة
        { Match m = game("mafia", "witch", "citizen", "citizen", "citizen", "citizen", "citizen");
          m.recordNight("kill", "p2"); m.recordNight("witch_life", null, "use"); m.recordNight("witch_kill", "p0");
          Map<String, Object> ln = m.resolveNight();
          check(!dead(m, "p2") && "p2".equals(ln.get("witchSaved")), "life potion saves the victim");
          check(dead(m, "p0") && "witch".equals(m.p("p0").diedBy), "death potion kills"); check(m.witchLifeUsed && m.witchDeathUsed, "potions consumed"); }
        { Match m = game("mafia", "mafia", "witch", "citizen", "citizen", "citizen", "citizen", "citizen");
          m.recordNight("kill", "p3"); m.recordNight("witch_life", null, "skip"); m.recordNight("witch_kill", null); m.resolveNight();
          check(dead(m, "p3") && !m.witchLifeUsed && !m.witchDeathUsed, "skipping keeps both potions");
          m.beginDay(); m.recordVote(null); m.beginNight(0);
          check(m.activeNightRoles().contains("witch"), "witch called again while potions remain");
          m.recordNight("witch_life", null, "use"); m.recordNight("kill", "p4"); m.resolveNight(); m.beginDay(); m.recordVote(null); m.beginNight(0);
          throwsCode(() -> m.recordNight("witch_life", null, "use"), "forbidden", "life potion only once"); }
        // 6) العمدة: صوته بصوتين (التصويت من الهواتف)
        { Match m = game("mafia", "mayor", "citizen", "citizen", "citizen", "citizen"); m.narratorDriven = false;
          throwsCode(() -> m.recordNight("kill", "p5"), "forbidden", "record only in narrator mode"); }
        { Map<String, Object> st = new LinkedHashMap<>(); st.put("players", 6L); st.put("mafia", 1L); st.put("doctor", false); st.put("detective", false); st.put("sniper", false); st.put("mayor", true);
          Settings s = Settings.validate(st).settings; List<String[]> ps = new ArrayList<>(); for (int i = 0; i < 6; i++) ps.add(new String[] { "p" + i, "P" + i });
          Match m = Match.create(ps, s, new Random(2), 0); String[] roles = { "mafia", "mayor", "citizen", "citizen", "citizen", "citizen" };
          for (int i = 0; i < 6; i++) m.players.get(i).role = roles[i];
          m.beginNight(0); m.resolveNight(); m.beginDay(); m.beginVote(0);
          m.castVote("p1", "p2"); m.castVote("p3", "p4"); m.castVote("p0", "p4"); m.castVote("p2", null); m.castVote("p4", null); m.castVote("p5", null);
          Map<String, Object> lv = m.closeVote(); check(Long.valueOf(2).equals(((Map<?, ?>) lv.get("tally")).get("p2")), "mayor counts twice"); }
        // الإعدادات: الأدوار اختيارية ومعطّلة افتراضياً، وفريق المافيا يُحسب بطبيب المافيا
        { Settings d = Settings.validate(new LinkedHashMap<>()).settings;
          check(!d.mafiaDoctor && !d.superCitizen && !d.negotiator && !d.bodyguard && !d.witch && !d.mayor, "extra roles off by default");
          Map<String, Object> st = new LinkedHashMap<>(); st.put("players", 4L); st.put("mafia", 1L); st.put("mafiaDoctor", true);
          check(Settings.validate(st).errors.contains("mafia_too_many"), "mafia doctor counts toward mafia team");
          Map<String, Object> st2 = new LinkedHashMap<>(); st2.put("players", 12L); st2.put("mafia", 2L);
          for (String k : Settings.EXTRA) st2.put(k, true);
          Settings all = Settings.validate(st2).settings; List<String> l = all.roleList(12);
          check(Settings.validate(st2).ok && l.containsAll(Arrays.asList("mafia_doctor", "super_citizen", "negotiator", "bodyguard", "witch", "mayor")), "all 12 roles dealt"); }
        // الفوز: فريق المافيا يشمل طبيب المافيا والمفاوض المتحوّل
        { Match m = game("mafia", "mafia_doctor", "citizen", "citizen", "citizen");
          m.recordNight("kill", "p2"); m.resolveNight(); check("mafia".equals(m.winner), "mafia team (with doctor) wins at parity"); }
        // الحفظ والاسترجاع يحفظ حالة الأدوار الجديدة
        { Match m = game("mafia", "negotiator", "witch", "super_citizen", "citizen", "citizen", "citizen");
          m.recordNight("negotiate", null, "mafia"); m.recordNight("kill", "p3"); m.recordNight("witch_life", null, "skip"); m.recordNight("witch_kill", null); m.resolveNight();
          Match r = Match.fromMap((Map<String, Object>) Json.parse(Json.stringify(m.toMap())), new Random(3));
          check(r.p("p1").converted && !r.p("p3").shield && r.negotiatorDecided, "snapshot keeps converted/shield/decision"); }
        System.out.println("rules: " + pass + " passed, " + fail + " failed");
        if (fail > 0) System.exit(1);
    }
}
