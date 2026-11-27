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

// ---- v2 helpers ----
const NEVER = "2100-01-01T00:00:00Z";
const TTLS = [86400, 604800, 2592000, 0]; // 24 hours, a week, a month, never
const sig = (o: unknown) => { const t = JSON.stringify(o); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return String(h); };
// what a device must know besides new messages: pinned notes, delivery marks of what it sent, deleted ids, who is typing, a screenshot request
async function syncOf(me: any) {
  const now = Date.now(), iso = new Date(now).toISOString(), d3 = new Date(now - 3 * 86400000).toISOString(), t6 = new Date(now - 6000).toISOString(), s90 = new Date(now - 90000).toISOString();
  const [pins, rcpt, gone, ty, own] = await Promise.all([
    db.from("tawasul_msgs").select("id,from_code,body,created_at").eq("to_code", me.code).eq("pinned", true).is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
    db.from("tawasul_msgs").select("id,delivered_at,read_at").eq("from_code", me.code).is("deleted_at", null).gt("created_at", d3).order("created_at", { ascending: false }).limit(40),
    db.from("tawasul_msgs").select("id").eq("to_code", me.code).not("deleted_at", "is", null).gt("deleted_at", d3).limit(100),
    db.from("tawasul_devices").select("code").eq("typing_to", me.code).gt("typing_at", t6).limit(10),
    db.from("tawasul_devices").select("snap_from,snap_at").eq("code", me.code).maybeSingle(),
  ]);
  const pr = pins.data || [];
  const names: Record<string, string> = {};
  const froms = [...new Set(pr.map((r: any) => r.from_code))];
  if (froms.length) { const { data } = await db.from("tawasul_devices").select("code,name").in("code", froms); (data || []).forEach((x: any) => (names[x.code] = x.name)); }
  const o: any = {
    pins: pr.map((r: any) => ({ id: r.id, from: r.from_code, fromName: names[r.from_code] || "", text: r.body || "", ts: r.created_at })),
    rcpt: (rcpt.data || []).map((r: any) => [r.id, r.delivered_at ? 1 : 0, r.read_at ? 1 : 0]),
    gone: (gone.data || []).map((r: any) => r.id),
    typing: (ty.data || []).map((r: any) => r.code),
    snap: own.data && own.data.snap_from && own.data.snap_at && own.data.snap_at > s90 ? { from: own.data.snap_from, at: own.data.snap_at } : null,
  };
  o.sig = sig(o);
  return o;
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
      const { data } = await db.from("tawasul_devices").select("code,name,kind,status,pver").eq("code", other).maybeSingle();
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
      const ttl = TTLS.includes(Number(b.ttl)) ? Number(b.ttl) : 86400;
      const row: any = { from_code: me.code, to_code: to, kind, body: clean(b.text, 4000) || null, ttl, expires_at: ttl ? new Date(Date.now() + ttl * 1000).toISOString() : NEVER };
      if (b.reply && typeof b.reply === "object") row.meta = { reply: { id: clean(b.reply.id, 60), t: clean(b.reply.t, 100), n: clean(b.reply.n, 40) } };
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
      // created_at has microseconds but Date keeps milliseconds: without the +1 the same message matched "after since" again on every poll
      const since = b.since ? new Date(Date.parse(String(b.since)) + 1).toISOString() : new Date(Date.now() - 24 * HOUR * 1000).toISOString();
      const end = Date.now() + wait * 1000;
      let rows: any[] = [], sy: any = null;
      for (;;) {
        const { data } = await db.from("tawasul_msgs").select("id,from_code,kind,body,file_path,file_name,mime,size,created_at,expires_at,meta,pinned")
          .eq("to_code", me.code).is("deleted_at", null).gt("created_at", since).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(100);
        rows = data || [];
        sy = await syncOf(me);
        // new messages, a change in what the device already knows (marks, pins, typing…) or the end of the wait
        if (rows.length || Date.now() >= end || (b.sig !== undefined && b.sig !== null && String(b.sig) !== sy.sig)) break;
        await sleep(1500);
      }
      const names: Record<string, string> = {}, pv: Record<string, number> = {};
      const froms = [...new Set(rows.map((r) => r.from_code))];
      if (froms.length) {
        const { data } = await db.from("tawasul_devices").select("code,name,pver").in("code", froms);
        (data || []).forEach((d: any) => { names[d.code] = d.name; pv[d.code] = d.pver; });
      }
      const urls: Record<string, string> = {};
      const paths = rows.map((r) => r.file_path).filter(Boolean);
      if (paths.length) {
        const { data } = await db.storage.from("tawasul").createSignedUrls(paths, 24 * HOUR);
        (data || []).forEach((d: any) => { if (d.path && d.signedUrl) urls[d.path] = d.signedUrl; });
      }
      const msgs = rows.map((r) => ({
        id: r.id, from: r.from_code, fromName: names[r.from_code] || "", pv: pv[r.from_code] || 0, kind: r.kind, text: r.body || "",
        name: r.file_name || "", mime: r.mime || "", size: r.size || 0, url: r.file_path ? urls[r.file_path] || "" : "", ts: r.created_at, exp: r.expires_at,
        reply: r.meta && r.meta.reply ? r.meta.reply : null,
      }));
      if (rows.length) await db.from("tawasul_msgs").update({ delivered_at: new Date().toISOString() }).in("id", rows.map((r) => r.id)).is("delivered_at", null);
      return json({ ok: true, msgs, sync: sy, now: new Date().toISOString() });
    }

    // a fresh download link for files whose first link (24 hours) has run out
    if (route === "sign") {
      const ids = Array.isArray(b.ids) ? b.ids.map((x: unknown) => String(x)).filter((x: string) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 20) : [];
      if (!ids.length) return json({ ok: true, urls: {} });
      const { data } = await db.from("tawasul_msgs").select("id,file_path").in("id", ids).or(`from_code.eq.${me.code},to_code.eq.${me.code}`).is("deleted_at", null).not("file_path", "is", null);
      const rows = data || [], urls: Record<string, string> = {};
      if (rows.length) {
        const { data: sg } = await db.storage.from("tawasul").createSignedUrls(rows.map((r: any) => r.file_path), 24 * HOUR);
        const byPath: Record<string, string> = {}; (sg || []).forEach((d: any) => { if (d.path && d.signedUrl) byPath[d.path] = d.signedUrl; });
        rows.forEach((r: any) => { if (byPath[r.file_path]) urls[r.id] = byPath[r.file_path]; });
      }
      return json({ ok: true, urls });
    }

    // the recipient opened the chat: the sender's marks turn "read" (only when the recipient allows read receipts)
    if (route === "read") {
      const from = String(b.from || "").toUpperCase();
      if (!CODE.test(from)) return json({ error: "bad_code" }, 400);
      const { data: m } = await db.from("tawasul_devices").select("rr_on").eq("code", me.code).maybeSingle();
      const t = new Date().toISOString();
      if (!m || m.rr_on) await db.from("tawasul_msgs").update({ read_at: t, delivered_at: t }).eq("to_code", me.code).eq("from_code", from).is("read_at", null);
      return json({ ok: true });
    }

    // delete a message I sent, for both sides (a tombstone stays until it would have expired, so the other side learns about it)
    if (route === "del") {
      const id = String(b.id || "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "bad_id" }, 400);
      const { data } = await db.from("tawasul_msgs").select("id,file_path").eq("id", id).eq("from_code", me.code).is("deleted_at", null).maybeSingle();
      if (!data) return json({ error: "not_found" }, 404);
      if (data.file_path) await db.storage.from("tawasul").remove([data.file_path]);
      await db.from("tawasul_msgs").update({ deleted_at: new Date().toISOString(), body: null, file_path: null, file_name: null, pinned: false, expires_at: new Date(Date.now() + 3 * 86400000).toISOString() }).eq("id", id);
      return json({ ok: true });
    }

    // pin a text note on the recipient's screen (or take it down). The sender decides, any time.
    if (route === "pin") {
      const id = String(b.id || ""), on = !!b.on;
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "bad_id" }, 400);
      const { data } = await db.from("tawasul_msgs").select("id,to_code,kind,created_at,ttl,pinned").eq("id", id).eq("from_code", me.code).is("deleted_at", null).maybeSingle();
      if (!data) return json({ error: "not_found" }, 404);
      if (data.kind !== "text") return json({ error: "text_only" }, 400);
      if (on) {
        const { count } = await db.from("tawasul_msgs").select("id", { count: "exact", head: true }).eq("to_code", data.to_code).eq("pinned", true).is("deleted_at", null);
        if (!data.pinned && (count || 0) >= 5) return json({ error: "too_many_pins" }, 409);
        await db.from("tawasul_msgs").update({ pinned: true, expires_at: NEVER }).eq("id", id);
      } else {
        const keep = Math.max(Date.parse(data.created_at) + (data.ttl || 86400) * 1000, Date.now() + 86400000);
        await db.from("tawasul_msgs").update({ pinned: false, expires_at: data.ttl === 0 ? NEVER : new Date(keep).toISOString() }).eq("id", id);
      }
      return json({ ok: true });
    }

    // "typing…" for the person I am writing to (lasts a few seconds). Only when I allow it.
    if (route === "typing") {
      const to = String(b.to || "").toUpperCase();
      if (!CODE.test(to)) return json({ error: "bad_code" }, 400);
      const { data } = await db.from("tawasul_devices").select("ty_on").eq("code", me.code).maybeSingle();
      if (data && data.ty_on) await db.from("tawasul_devices").update({ typing_to: to, typing_at: new Date().toISOString() }).eq("code", me.code);
      return json({ ok: true });
    }

    // ask a screen for a picture of what it shows (the screen answers only if its owner allowed it, and only to known people)
    if (route === "snap") {
      const to = String(b.to || "").toUpperCase();
      if (!CODE.test(to)) return json({ error: "bad_code" }, 400);
      const { data: dst } = await db.from("tawasul_devices").select("kind,snap_at").eq("code", to).maybeSingle();
      if (!dst) return json({ error: "no_such_user" }, 404);
      if (dst.kind !== "tv") return json({ error: "not_a_screen" }, 400);
      await db.from("tawasul_devices").update({ snap_from: me.code, snap_at: new Date().toISOString() }).eq("code", to);
      return json({ ok: true });
    }

    // my profile: name, status line, photo (a small JPEG as a data link) and what others may see
    if (route === "profile-set") {
      const u: any = {};
      if (typeof b.name === "string") u.name = clean(b.name, 40);
      if (typeof b.status === "string") u.status = clean(b.status, 80);
      if (b.avatar === null || b.avatar === "") u.avatar = null;
      else if (typeof b.avatar === "string") {
        if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.avatar) || b.avatar.length > 70000) return json({ error: "bad_avatar" }, 400);
        u.avatar = b.avatar;
      }
      if (typeof b.ls_on === "boolean") u.ls_on = b.ls_on;
      if (typeof b.rr_on === "boolean") u.rr_on = b.rr_on;
      if (typeof b.ty_on === "boolean") u.ty_on = b.ty_on;
      if (!Object.keys(u).length) return json({ ok: true });
      const { data } = await db.from("tawasul_devices").select("pver").eq("code", me.code).maybeSingle();
      u.pver = ((data && data.pver) || 0) + 1;
      await db.from("tawasul_devices").update(u).eq("code", me.code);
      return json({ ok: true, pver: u.pver });
    }
    if (route === "profile-get") {
      const { data } = await db.from("tawasul_devices").select("name,status,avatar,pver,ls_on,rr_on,ty_on").eq("code", me.code).maybeSingle();
      return json({ ok: true, me: data });
    }
    // other people's profiles; the photo is sent only when my copy (have[code]) is older
    if (route === "profiles") {
      const codes = Array.isArray(b.codes) ? b.codes.map((x: unknown) => String(x).toUpperCase()).filter((x: string) => CODE.test(x)).slice(0, 40) : [];
      const have = b.have && typeof b.have === "object" ? b.have : {};
      if (!codes.length) return json({ ok: true, list: [] });
      const { data } = await db.from("tawasul_devices").select("code,name,kind,status,avatar,pver,ls_on,last_seen").in("code", codes);
      return json({ ok: true, now: new Date().toISOString(), list: (data || []).map((d: any) => ({ code: d.code, name: d.name, kind: d.kind, status: d.status || "", pv: d.pver || 0, seen: d.ls_on ? d.last_seen : null, avatar: d.avatar && have[d.code] !== d.pver ? d.avatar : undefined, hasAvatar: !!d.avatar })) });
    }

    if (route === "rename") {
      const { data: pv0 } = await db.from("tawasul_devices").select("pver").eq("code", me.code).maybeSingle();
      await db.from("tawasul_devices").update({ name: clean(b.name, 40), pver: ((pv0 && pv0.pver) || 0) + 1 }).eq("code", me.code);
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
