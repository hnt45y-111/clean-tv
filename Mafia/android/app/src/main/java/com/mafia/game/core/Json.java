package com.mafia.game.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** JSON صغير بلا مكتبات: Map / List / String / Long / Double / Boolean / null. سلوك واحد على أندرويد والـ JVM. */
public final class Json {
    private Json() {}

    // ---------- تحويل إلى نص ----------
    public static String stringify(Object o) { StringBuilder sb = new StringBuilder(); write(sb, o); return sb.toString(); }

    @SuppressWarnings("unchecked")
    private static void write(StringBuilder sb, Object o) {
        if (o == null) sb.append("null");
        else if (o instanceof String) str(sb, (String) o);
        else if (o instanceof Boolean) sb.append(o.toString());
        else if (o instanceof Double || o instanceof Float) {
            double d = ((Number) o).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) sb.append("null");
            else if (d == Math.rint(d) && Math.abs(d) < 1e15) sb.append((long) d);
            else sb.append(d);
        } else if (o instanceof Number) sb.append(((Number) o).longValue());
        else if (o instanceof Map) {
            sb.append('{'); boolean first = true;
            for (Map.Entry<String, Object> e : ((Map<String, Object>) o).entrySet()) {
                if (!first) sb.append(','); first = false;
                str(sb, e.getKey()); sb.append(':'); write(sb, e.getValue());
            }
            sb.append('}');
        } else if (o instanceof Iterable) {
            sb.append('['); boolean first = true;
            for (Object x : (Iterable<Object>) o) { if (!first) sb.append(','); first = false; write(sb, x); }
            sb.append(']');
        } else str(sb, o.toString());
    }

    private static void str(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                case ' ': sb.append("\\u2028"); break;
                case ' ': sb.append("\\u2029"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c)); else sb.append(c);
            }
        }
        sb.append('"');
    }

    // ---------- قراءة ----------
    public static Object parse(String s) {
        P p = new P(s); p.ws(); Object v = p.value(); p.ws();
        if (p.i != s.length()) throw new IllegalArgumentException("trailing");
        return v;
    }

    private static final class P {
        final String s; int i;
        P(String s) { this.s = s; }
        void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
        char peek() { if (i >= s.length()) throw new IllegalArgumentException("eof"); return s.charAt(i); }
        Object value() {
            char c = peek();
            if (c == '{') return obj();
            if (c == '[') return arr();
            if (c == '"') return string();
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return null; }
            return number();
        }
        Map<String, Object> obj() {
            Map<String, Object> m = new LinkedHashMap<>(); i++; ws();
            if (peek() == '}') { i++; return m; }
            while (true) {
                ws(); String k = string(); ws();
                if (peek() != ':') throw new IllegalArgumentException("colon"); i++; ws();
                m.put(k, value()); ws();
                char c = peek(); i++;
                if (c == '}') return m;
                if (c != ',') throw new IllegalArgumentException("comma");
            }
        }
        List<Object> arr() {
            List<Object> l = new ArrayList<>(); i++; ws();
            if (peek() == ']') { i++; return l; }
            while (true) {
                ws(); l.add(value()); ws();
                char c = peek(); i++;
                if (c == ']') return l;
                if (c != ',') throw new IllegalArgumentException("comma");
            }
        }
        String string() {
            if (peek() != '"') throw new IllegalArgumentException("string");
            i++; StringBuilder sb = new StringBuilder();
            while (true) {
                char c = s.charAt(i++);
                if (c == '"') return sb.toString();
                if (c == '\\') {
                    char e = s.charAt(i++);
                    switch (e) {
                        case 'n': sb.append('\n'); break;
                        case 'r': sb.append('\r'); break;
                        case 't': sb.append('\t'); break;
                        case 'b': sb.append('\b'); break;
                        case 'f': sb.append('\f'); break;
                        case 'u': sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
                        default: sb.append(e);
                    }
                } else sb.append(c);
            }
        }
        Object number() {
            int st = i; boolean frac = false;
            while (i < s.length()) {
                char c = s.charAt(i);
                if ((c >= '0' && c <= '9') || c == '-' || c == '+') i++;
                else if (c == '.' || c == 'e' || c == 'E') { frac = true; i++; }
                else break;
            }
            String n = s.substring(st, i);
            if (n.isEmpty()) throw new IllegalArgumentException("value");
            if (!frac) { try { return Long.parseLong(n); } catch (NumberFormatException ignored) { } }
            return Double.parseDouble(n);
        }
    }

    // ---------- أدوات قراءة آمنة ----------
    @SuppressWarnings("unchecked")
    public static Map<String, Object> map(Object o) { return o instanceof Map ? (Map<String, Object>) o : new LinkedHashMap<>(); }
    @SuppressWarnings("unchecked")
    public static List<Object> list(Object o) { return o instanceof List ? (List<Object>) o : new ArrayList<>(); }
    public static String str(Object o) { return o == null ? null : String.valueOf(o instanceof Double && ((Double) o) == Math.rint((Double) o) ? (Object) ((Double) o).longValue() : o); }
    public static boolean truthy(Object o) {
        if (o == null) return false;
        if (o instanceof Boolean) return (Boolean) o;
        if (o instanceof Number) return ((Number) o).doubleValue() != 0;
        if (o instanceof String) return !((String) o).isEmpty();
        return true;
    }
    /** مثل Number(x) في JS: يعيد null إن لم يكن رقماً صالحاً */
    public static Double num(Object o) {
        if (o instanceof Number) return ((Number) o).doubleValue();
        if (o instanceof String) { try { return Double.parseDouble(((String) o).trim()); } catch (NumberFormatException e) { return null; } }
        if (o instanceof Boolean) return (Boolean) o ? 1.0 : 0.0;
        return null;
    }
    public static Map<String, Object> obj(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int k = 0; k < kv.length; k += 2) m.put((String) kv[k], kv[k + 1]);
        return m;
    }
}
