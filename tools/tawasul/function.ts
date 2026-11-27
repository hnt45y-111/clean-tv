// «تواصل»: relay between phones and screens. Every device has a public code and a private token (only its hash is stored).
// Messages and files live 24 hours, then they are deleted. Tables have row level security with no policies: only this function reads them.
// A phone that registered a Firebase token gets an instant push when a message arrives (secret FCM_SERVICE_ACCOUNT = the service account JSON).
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const CODE = /^[A-HJ-NP-Z2-9]{10}$/;
const MAX_FILE = 15 * 1024 * 1024;
const HOUR = 3600;

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// the device that signed the request, or null
async function auth(b: any) {
  if (!b || !CODE.test(String(b.code || "")) || String(b.token || "").length < 20) return null;
  const { data } = await db.from("tawasul_devices").select("code,token_hash,name,kind").eq("code", b.code).maybeSingle();
  if (!data || data.token_hash !== await sha(String(b.token))) return null;
  db.from("tawasul_devices").update({ last_seen: new Date().toISOString() }).eq("code", b.code).then(() => {});
  return data;
}
let lastPurge = 0;
async function purge(force = false) {
  const t = Date.now();
  if (!force && t - lastPurge < 60000) return 0;
  lastPurge = t;
  let n = 0;
  for (let i = 0; i < 5; i++) {
    const { data } = await db.from("tawasul_msgs").select("id,file_path").lt("expires_at", new Date().toISOString()).limit(200);
    if (!data || !data.length) break;
    const paths = data.map((x: any) => x.file_path).filter(Boolean);
    if (paths.length) await db.storage.from("tawasul").remove(paths);
    await db.from("tawasul_msgs").delete().in("id", data.map((x: any) => x.id));
    n += data.length;
  }
  return n;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);

// ---- push (Firebase Cloud Messaging, HTTP v1) ----
const b64u = (x: ArrayBuffer | string) => {
  const bytes = typeof x === "string" ? new TextEncoder().encode(x) : new Uint8Array(x);
  let s = ""; bytes.forEach((c) => (s += String.fromCharCode(c)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
let cachedTok: { v: string; exp: number } | null = null;
function serviceAccount(): any | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) return null;
  try { const j = JSON.parse(raw); return j.private_key && j.client_email && j.project_id ? j : null; } catch { return null; }
}
async function accessToken(sa: any): Promise<string | null> {
  if (cachedTok && cachedTok.exp > Date.now() + 60000) return cachedTok.v;
  const iat = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 }));
  const pem = String(sa.private_key).replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + head + "." + claim + "." + b64u(sig),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) return null;
  cachedTok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cachedTok.v;
}
// best effort: a failed push never fails the message
async function push(toCode: string, token: string, d: Record<string, string>) {
  try {
    const sa = serviceAccount(); if (!sa) return;
    const at = await accessToken(sa); if (!at) return;
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST", headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token, data: d, android: { priority: "HIGH", ttl: "86400s" } } }),
    });
    if (r.status === 404 || r.status === 400) {
      const t = await r.text();
      if (/UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/.test(t)) await db.from("tawasul_devices").update({ fcm: null }).eq("code", toCode).eq("fcm", token);
    }
  } catch { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  const route = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  let b: any = {};
  try { b = await req.json(); } catch { b = {}; }
  try {
    purge().catch(() => {});
    if (route === "purge") return json({ ok: true, removed: await purge(true) });

    if (route === "register") {
      if (!CODE.test(String(b.code || "")) || String(b.token || "").length < 20) return json({ error: "bad_request" }, 400);
      const name = clean(b.name, 40), kind = b.kind === "tv" ? "tv" : "phone";
      const hash = await sha(String(b.token));
      const { data } = await db.from("tawasul_devices").select("token_hash").eq("code", b.code).maybeSingle();
      if (data) {
        if (data.token_hash !== hash) return json({ error: "code_taken" }, 409);
        await db.from("tawasul_devices").update({ name, kind, last_seen: new Date().toISOString() }).eq("code", b.code);
        return json({ ok: true });
      }
      const { error } = await db.from("tawasul_devices").insert({ code: b.code, token_hash: hash, name, kind });
      if (error) return json({ error: "code_taken" }, 409);
      return json({ ok: true });
    }

    const me = await auth(b);
    if (!me) return json({ error: "unauthorized" }, 401);

    if (route === "push-token") {
      const t = b.fcm ? clean(b.fcm, 400) : null;
      await db.from("tawasul_devices").update({ fcm: t }).eq("code", me.code);
      return json({ ok: true, push: !!serviceAccount() });
    }

    if (route === "lookup") {
      const other = String(b.other || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!CODE.test(other)) return json({ error: "bad_code" }, 400);
      const { data } = await db.from("tawasul_devices").select("code,name,kind").eq("code", other).maybeSingle();
      if (!data) return json({ error: "no_such_user" }, 404);
      return json({ ok: true, user: data });
    }

    if (route === "upload") {
      const size = Number(b.size || 0);
      if (size > MAX_FILE) return json({ error: "too_big", max: MAX_FILE }, 413);
      const path = `${me.code}/${crypto.randomUUID()}`;
      const { data, error } = await db.storage.from("tawasul").createSignedUploadUrl(path);
      if (error || !data) return json({ error: "upload_failed" }, 500);
      return json({ ok: true, path, url: data.signedUrl, token: data.token });
    }

    if (route === "send") {
      const to = String(b.to || "").toUpperCase();
      const kind = String(b.kind || "text");
      if (!["text", "image", "audio", "file"].includes(kind)) return json({ error: "bad_kind" }, 400);
      const { data: dst } = await db.from("tawasul_devices").select("code,fcm").eq("code", to).maybeSingle();
      if (!dst) return json({ error: "no_such_user" }, 404);
      const since = new Date(Date.now() - 60000).toISOString();
      const { count } = await db.from("tawasul_msgs").select("id", { count: "exact", head: true }).eq("from_code", me.code).gt("created_at", since);
      if ((count || 0) >= 60) return json({ error: "slow_down" }, 429);
      const row: any = { from_code: me.code, to_code: to, kind, body: clean(b.text, 4000) || null };
      if (kind !== "text") {
        const path = String(b.path || "");
        if (!path.startsWith(me.code + "/") || path.includes("..")) return json({ error: "bad_path" }, 400);
        row.file_path = path; row.file_name = clean(b.name, 120) || null; row.mime = clean(b.mime, 80) || null; row.size = Math.max(0, Math.min(MAX_FILE, Number(b.size || 0)));
      } else if (!row.body) return json({ error: "empty" }, 400);
      const { data, error } = await db.from("tawasul_msgs").insert(row).select("id,created_at,expires_at").single();
      if (error || !data) return json({ error: "send_failed" }, 500);
      if (dst.fcm) {
        await push(to, dst.fcm, { id: data.id, from: me.code, fromName: me.name || "", kind, text: kind === "text" ? String(row.body).slice(0, 120) : "", name: row.file_name || "" });
      }
      return json({ ok: true, id: data.id, ts: data.created_at, exp: data.expires_at });
    }

    if (route === "inbox") {
      const wait = Math.max(0, Math.min(25, Number(b.wait || 0)));
      const since = b.since ? new Date(Date.parse(String(b.since)) + 1).toISOString() : new Date(Date.now() - 24 * HOUR * 1000).toISOString();
      const end = Date.now() + wait * 1000;
      let rows: any[] = [];
      for (;;) {
        const { data } = await db.from("tawasul_msgs").select("id,from_code,kind,body,file_path,file_name,mime,size,created_at")
          .eq("to_code", me.code).gt("created_at", since).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(100);
        rows = data || [];
        if (rows.length || Date.now() >= end) break;
        await sleep(1500);
      }
      const names: Record<string, string> = {};
      const froms = [...new Set(rows.map((r) => r.from_code))];
      if (froms.length) {
        const { data } = await db.from("tawasul_devices").select("code,name").in("code", froms);
        (data || []).forEach((d: any) => (names[d.code] = d.name));
      }
      const urls: Record<string, string> = {};
      const paths = rows.map((r) => r.file_path).filter(Boolean);
      if (paths.length) {
        const { data } = await db.storage.from("tawasul").createSignedUrls(paths, 24 * HOUR);
        (data || []).forEach((d: any) => { if (d.path && d.signedUrl) urls[d.path] = d.signedUrl; });
      }
      const msgs = rows.map((r) => ({
        id: r.id, from: r.from_code, fromName: names[r.from_code] || "", kind: r.kind, text: r.body || "",
        name: r.file_name || "", mime: r.mime || "", size: r.size || 0, url: r.file_path ? urls[r.file_path] || "" : "", ts: r.created_at,
      }));
      return json({ ok: true, msgs, now: new Date().toISOString() });
    }

    if (route === "rename") {
      await db.from("tawasul_devices").update({ name: clean(b.name, 40) }).eq("code", me.code);
      return json({ ok: true });
    }

    if (route === "leave") {
      const { data } = await db.from("tawasul_msgs").select("file_path").eq("from_code", me.code).not("file_path", "is", null);
      const paths = (data || []).map((x: any) => x.file_path);
      if (paths.length) await db.storage.from("tawasul").remove(paths);
      await db.from("tawasul_devices").delete().eq("code", me.code);
      return json({ ok: true });
    }

    return json({ error: "not_found" }, 404);
  } catch (e) {
    return json({ error: "server_error", detail: String((e as Error).message || e).slice(0, 120) }, 500);
  }
});
