import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BrickPattern, C, F, FPS, Nail, S, TAN9, ar, easeIn, easeInOut, easeOut, mix, prog, slantClip } from "../brand";
import { IconClock, IconDoctor, IconFile, IconLab, IconPharmacy, IconPill, IconTicket, Logo, SlantButton, Wordmark } from "../components";
import featuresJson from "./features.json";
import timeline from "./timeline.json";
import { FEATURE_ICONS, SCREENS } from "./screens";
import { ClockCtx, SH, SW } from "./ui";

type W = { w: string; s: number; e: number };
const SEG = Object.fromEntries(timeline.segments.map((s) => [s.id, s])) as Record<string, (typeof timeline.segments)[number]>;
const FEATS = featuresJson.features;
const TL = timeline.features;
const DROP = timeline.drop;
const W_ = 1080;

const sec = (f: number) => f / FPS;
const pad2 = (n: number) => ar(String(n).padStart(2, "0"));
const col = (k: string) => (C as Record<string, string>)[k];

// ───────────────────────────────────────── captions: phrase-level karaoke
const phrasesOf = (words: W[], maxWords = 4) => {
  const out: W[][] = [];
  let cur: W[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const brk = /[،.:؟…]$/.test(w.w) || cur.length >= maxWords;
    if (brk || i === words.length - 1) {
      out.push(cur);
      cur = [];
    }
  });
  return out;
};

/** Reels-safe caption: one line, big, sits above Instagram's bottom UI; the word being spoken is highlighted. */
const Caption: React.FC<{ words: W[]; t: number; color: string; dim: string; top: number; size?: number }> = ({ words, t, color, dim, top, size = 58 }) => {
  const ph = phrasesOf(words);
  const idx = ph.findIndex((p, i) => t < (ph[i + 1]?.[0].s ?? 1e9) - 0.05);
  const p = ph[Math.max(0, idx)];
  if (!p || t < p[0].s - 0.25) return null;
  const inP = interpolate(t, [p[0].s - 0.25, p[0].s], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  const chars = p.reduce((a, w) => a + w.w.length, 0);
  const est = chars * size * 0.7 + (p.length - 1) * size * 0.3;
  const fs = Math.min(size, size * (960 / Math.max(960, est)));
  const cur = p.reduce((a, w, i) => (t >= w.s - 0.03 ? i : a), -1);
  return (
    <div style={{ position: "absolute", top, left: 30, right: 30, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          whiteSpace: "nowrap",
          columnGap: fs * 0.2,
          direction: "rtl",
          fontFamily: F.kufi,
          fontWeight: 800,
          fontSize: fs,
          lineHeight: 1.45,
          opacity: inP,
          transform: `translateY(${(1 - inP) * 24}px)`,
        }}
      >
        {p.map((w, i) => {
          const isCur = i === cur;
          const k = interpolate(t, [w.s - 0.03, w.s + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: isCur ? C.lazurd : i < cur ? color : dim,
                background: isCur ? C.tabuq : "transparent",
                borderRadius: 4,
                padding: `0 ${fs * 0.2}px`,
                transform: `translateY(${(1 - k) * 6}px) scale(${isCur ? mix(k, 1, 1.06) : 1})`,
              }}
            >
              {w.w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ───────────────────────────────────────── shared bits
const Arches: React.FC<{ color: string; opacity: number; t: number }> = ({ color, opacity, t }) => (
  <svg width={W_} height={1920} style={{ position: "absolute", inset: 0, opacity }} viewBox="0 0 1080 1920">
    {[1.0, 1.35, 1.75].map((k, i) => (
      <g key={i} transform={`translate(540 1010) scale(${k * 4.2 + Math.sin(t * 0.6 + i) * 0.04}) translate(-297.8 -339)`}>
        <path
          d="M 209.375 480.570312 L 209.375 330.238281 C 209.375 268.339844 249.167969 228.542969 297.804688 197.59375 C 346.441406 228.542969 386.238281 268.339844 386.238281 330.238281 L 386.238281 480.570312"
          fill="none"
          stroke={color}
          strokeWidth={0.5}
        />
      </g>
    ))}
  </svg>
);

const Lattice: React.FC<{ id: string; opacity: number; color: string }> = ({ id, opacity, color }) => (
  <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity }}>
    <defs>
      <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
        <path d="M0 28 L28 0 L56 28 L28 56 Z" fill="none" stroke={color} strokeWidth="2" />
        <rect x="24" y="24" width="8" height="8" transform="rotate(45 28 28)" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

/** The device: 3D entrance, idle sway, push-in. */
const Device: React.FC<{ t: number; dur: number; width: number; children: React.ReactNode; dark: boolean }> = ({ t, dur, width, children, dark }) => {
  const enter = interpolate(t, [0.15, 1.0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  const ry = mix(enter, -38, -7) + Math.sin(t * 0.9) * 3;
  const rx = mix(enter, 14, 4) + Math.cos(t * 0.7) * 1.5;
  const push = interpolate(t, [0, dur], [1, 1.045]);
  const height = width * 2.05;
  const pad = width * 0.032;
  const inner = width - pad * 2;
  const scale = inner / SW;
  return (
    <div style={{ perspective: 2200, perspectiveOrigin: "50% 40%" }}>
      <div
        style={{
          transform: `translateY(${(1 - enter) * 420}px) translateX(${(1 - enter) * -120}px) rotateY(${ry}deg) rotateX(${rx}deg) scale(${push})`,
          transformStyle: "preserve-3d",
          opacity: Math.min(1, enter * 2.5),
        }}
      >
        <div
          style={{
            width,
            height,
            borderRadius: width * 0.13,
            background: C.qeer,
            padding: pad,
            boxShadow: dark ? "0 40px 90px rgba(0,0,0,0.35)" : "0 40px 90px rgba(27,58,122,0.25)",
            position: "relative",
          }}
        >
          <div style={{ width: inner, height: height - pad * 2, borderRadius: width * 0.105, overflow: "hidden", position: "relative", background: C.teen }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", position: "absolute", top: 0, right: 0, width: SW, height: SH }}>{children}</div>
            {/* dynamic island */}
            <div style={{ position: "absolute", top: 10, left: "50%", width: inner * 0.28, height: 26, marginLeft: -inner * 0.14, background: C.qeer, borderRadius: 14 }} />
            {/* glass sheen that slides with the turn */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0) 60%)",
                transform: `translateX(${mix(enter, -60, 30) + Math.sin(t * 0.9) * 10}%)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const Callout: React.FC<{ label: string; at: number; t: number; side: "l" | "r"; top: number; accent: string; dark: boolean; i: number }> = ({ label, at, t, side, top, accent, dark, i }) => {
  const p = interpolate(t, [at - 0.12, at + 0.38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  if (p <= 0) return null;
  const float = Math.sin(t * 1.4 + i * 1.7) * 6;
  return (
    <div
      style={{
        position: "absolute",
        top: top + float,
        [side === "l" ? "left" : "right"]: 34,
        opacity: Math.min(1, p * 2),
        transform: `translateX(${(1 - p) * (side === "l" ? -160 : 160)}px) scale(${mix(p, 0.8, 1)})`,
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: dark ? C.jiss : C.lazurd,
          color: dark ? C.lazurd : C.jiss,
          borderRadius: 6,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: F.kufi,
          fontWeight: 800,
          fontSize: 38,
          boxShadow: "0 2px 0 rgba(0,0,0,0.08)",
          borderInlineStart: `8px solid ${accent === C.lazurd ? C.tabuq : accent}`,
          whiteSpace: "nowrap",
          direction: "rtl",
        }}
      >
        <Nail size={30} color={C.tabuq} />
        {label}
      </div>
    </div>
  );
};

const Progress: React.FC<{ n: number; dark: boolean; t: number }> = ({ n, dark, t }) => (
  <div style={{ display: "flex", gap: 14, justifyContent: "center", direction: "rtl" }}>
    {Array.from({ length: 16 }).map((_, i) => {
      const cur = i === n - 1;
      const done = i < n - 1;
      const p = cur ? interpolate(t, [0.4, 0.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
      return (
        <div key={i} style={{ transform: `translateY(${cur ? (1 - p) * -20 : 0}px) scale(${cur ? mix(p, 1.6, 1.25) : 1})`, opacity: done ? 0.9 : cur ? 1 : 0.28 }}>
          <Nail size={30} color={cur ? C.tabuq : dark ? C.teen : C.lazurd} />
        </div>
      );
    })}
  </div>
);

// ───────────────────────────────────────── one feature
const FeatureScene: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const meta = FEATS[i];
  const tl = TL[i];
  const t = sec(frame); // local seconds (scene starts at tl.start)
  const dur = tl.end - tl.start;
  const dark = meta.bg === "lazurd";
  const bg = dark ? C.lazurd : C.teen;
  const fg = dark ? C.teen : C.lazurd;
  const accent = col(meta.accent);
  const Scr = SCREENS[meta.key];
  const Icon = FEATURE_ICONS[meta.key];
  const words = SEG[`f${meta.n}`].words.map((w) => ({ ...w, s: w.s - tl.start, e: w.e - tl.start }));
  // never show a callout under the tile transition / before the phone has landed:
  // keep each cue at its spoken moment, but not earlier than 0.9s, and spaced by >=0.35s
  let prevCue = 0.55;
  const cues = tl.cues.map((c) => {
    const e = Math.max(c.t - tl.start, prevCue + 0.35);
    prevCue = e;
    return e;
  });
  const numP = interpolate(t, [0.25, 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeIn });
  const titleP = interpolate(t, [0.4, 0.95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  const sides: ("l" | "r")[] = ["r", "l", "r", "l"];
  const tops = [560, 790, 1010, 1230];
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden", direction: "rtl" }}>
      {dark ? <BrickPattern id={`fb${i}`} color={C.teen} opacity={0.06} offset={-t * 18} /> : <Lattice id={`fl${i}`} opacity={0.045} color={C.lazurd} />}
      <Arches color={dark ? C.tabuq : C.lazurd} opacity={dark ? 0.25 : 0.12} t={t} />
      {/* header */}
      <div style={{ position: "absolute", top: 118, right: 80, left: 80, display: "flex", alignItems: "center", gap: 34 }}>
        <div
          style={{
            fontFamily: F.logo,
            fontSize: 210,
            lineHeight: 1,
            color: C.tabuq,
            transform: `scale(${mix(numP, 2.4, 1)})`,
            opacity: numP,
            transformOrigin: "center",
            minWidth: 230,
            textAlign: "center",
          }}
        >
          {ar(meta.n)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ clipPath: slantClip(titleP, 60), display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                background: accent === C.qeer ? C.lazurd : dark && accent === C.lazurd ? C.tabuq : accent,
                color: dark && accent === C.lazurd ? C.lazurd : C.jiss,
                fontFamily: F.plex,
                fontWeight: 600,
                fontSize: 28,
                padding: "6px 22px",
                clipPath: `polygon(0 0, 100% 0, calc(100% - ${TAN9 * 50}px) 100%, 0 100%)`,
              }}
            >
              ميزة {ar(meta.n)} من ١٦
            </div>
            <Icon size={52} color={fg} accent={C.tabuq} draw={titleP} />
          </div>
          <div style={{ clipPath: slantClip(interpolate(t, [0.5, 1.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut }), 120), marginTop: 10 }}>
            <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: meta.title.length > 14 ? 58 : 70, color: fg, lineHeight: 1.35 }}>{meta.title}</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 372, left: 0, right: 0 }}>
        <Progress n={meta.n} dark={dark} t={t} />
      </div>
      {/* phone */}
      <div style={{ position: "absolute", top: 424, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Device t={t} dur={dur} width={460} dark={dark}>
          <ClockCtx.Provider value={{ t, c: cues, vo: tl.voAt - tl.start, dur }}>
            <Scr />
          </ClockCtx.Provider>
        </Device>
      </div>
      {tl.cues.map((c, k) => (
        <Callout key={k} i={k} label={c.label} at={cues[k]} t={t} side={sides[k]} top={tops[k]} accent={accent} dark={dark} />
      ))}
      <Caption words={words} t={t} color={fg} dim={dark ? "rgba(241,232,216,0.5)" : "rgba(27,58,122,0.42)"} top={1408} size={58} />
    </AbsoluteFill>
  );
};

// ───────────────────────────────────────── brick-tile transition
const TileWipe: React.FC<{ at: number; color: string; frame: number }> = ({ at, color, frame }) => {
  const t = sec(frame);
  if (t < at - 0.42 || t > at + 0.5) return null;
  const cols = 6;
  const rows = 11;
  const tw = W_ / cols;
  const th = 1920 / rows;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 50 }}>
      {Array.from({ length: rows * (cols + 1) }).map((_, k) => {
        const r = Math.floor(k / (cols + 1));
        const c = k % (cols + 1);
        const d = (r + (cols - 1 - c) * 0.9) / (rows + cols); // diagonal from top-right (RTL)
        const inP = interpolate(t, [at - 0.4 + d * 0.22, at - 0.18 + d * 0.22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
        const outP = interpolate(t, [at + 0.02 + d * 0.24, at + 0.24 + d * 0.24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
        const s = inP * (1 - outP);
        if (s <= 0.001) return null;
        const offset = r % 2 ? tw / 2 : 0; // brick bond
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: c * tw - offset - 2,
              top: r * th - 2,
              width: tw + 4,
              height: th + 4,
              background: (r + c) % 7 === 3 ? C.tabuq : color,
              transform: `scale(${s})`,
              outline: `2px solid ${C.tabuq}`,
              outlineOffset: -2,
            }}
          />
        );
      })}
      {/* extra column to fill the brick offset gap */}
    </AbsoluteFill>
  );
};

// ───────────────────────────────────────── intro
const IntroHook: React.FC = () => {
  const fr = useCurrentFrame();
  const t = sec(fr);
  const ws = SEG.intro1.words;
  const dim = interpolate(t, [ws[ws.length - 1].s, ws[ws.length - 1].e], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.lazurd, overflow: "hidden" }}>
      <BrickPattern id="ib" color={C.teen} opacity={0.07} offset={-t * 20} />
      <div style={{ position: "absolute", top: 430, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 70 }}>
        {[0, 1, 2].map((i) => {
          const d = prog(fr, 0.1 + i * 0.22, 0.9);
          const q = prog(fr, ws[3].s + i * 0.1, 0.4);
          const search = Math.floor(interpolate(t, [ws[5].s, ws[ws.length - 1].e], [0, 3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
          const lit = t > ws[5].s && search === i;
          return (
            <div key={i} style={{ position: "relative", width: 230, transform: `translateY(${(1 - d) * 60}px)`, opacity: Math.min(1, d * 2) * mix(dim, 1, 0.5) }}>
              <Logo id={`ih${i}`} width={230} state={{ draw: d, fill: 0, nails: [0, 0, 0, 0], thresh: d, outline: lit ? C.teen : C.tabuq }} />
              <div style={{ position: "absolute", top: 95, left: 0, right: 0, textAlign: "center", fontFamily: F.kufi, fontWeight: 800, fontSize: 120, color: lit ? C.teen : C.tabuq, opacity: q, transform: `translateY(${(1 - q) * 30}px)` }}>
                ؟
              </div>
            </div>
          );
        })}
      </div>
      <Caption words={ws} t={t} color={C.teen} dim="rgba(241,232,216,0.5)" top={980} size={92} />
    </AbsoluteFill>
  );
};

const IntroReveal: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame() + S(from);
  const t = sec(frame);
  const ws = SEG.intro2.words;
  const khalli = ws.find((w) => w.w.startsWith("خلّي"))!.s;
  const fill = prog(frame, DROP, 0.38);
  const nails = [0, 1, 2, 3].map((i) => prog(frame, DROP + 0.24 + i * 0.13 - 0.12, 0.2, easeIn));
  const thresh = prog(frame, DROP + 0.75, 0.25);
  const up = prog(frame, khalli - 0.2, 0.8, easeInOut);
  const flash = t < DROP ? 0 : interpolate(t, [DROP, DROP + 0.25], [0.35, 0], { extrapolateRight: "clamp" });
  const archOpen = prog(frame, SEG.intro2.at - 0.6, 0.75, easeInOut);
  const ring = prog(frame, DROP, 1.1);
  const tagWords = ws.filter((w) => w.s > DROP + 0.3 && w.s < khalli);
  const gridWords = ws.filter((w) => w.s >= khalli);
  const keys = FEATS.map((f) => f.key);
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <clipPath id="introArch" clipPathUnits="userSpaceOnUse">
            <path
              transform={`translate(540 1010) scale(${mix(archOpen, 0.02, 16)}) translate(-297.8 -339)`}
              d="M 209.375 480.570312 L 209.375 330.238281 C 209.375 268.339844 249.167969 228.542969 297.804688 197.59375 C 346.441406 228.542969 386.238281 268.339844 386.238281 330.238281 L 386.238281 480.570312 Z"
            />
          </clipPath>
        </defs>
      </svg>
      <AbsoluteFill style={{ background: C.lazurd, clipPath: "url(#introArch)", overflow: "hidden" }}>
        <BrickPattern id="ir" color={C.teen} opacity={0.06} />
        <Arches color={C.tabuq} opacity={0.22 * ring} t={t} />
        {ring > 0 && ring < 1 && (
          <div style={{ position: "absolute", left: 540 - mix(ring, 60, 1000), top: 700 - mix(ring, 60, 1000), width: mix(ring, 120, 2000), height: mix(ring, 120, 2000), borderRadius: "50%", border: `${mix(ring, 12, 1)}px solid ${C.tabuq}`, opacity: 1 - ring }} />
        )}
        <div style={{ position: "absolute", top: 230, left: 0, right: 0, textAlign: "center", fontFamily: F.kufi, fontWeight: 700, fontSize: 70, color: C.tabuq, opacity: 1 - prog(frame, DROP - 0.1, 0.3) }}>
          <span style={{ opacity: prog(frame, ws[0].s, 0.3) }}>من اليوم…</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: mix(up, 400, 200), display: "flex", justifyContent: "center", transform: `scale(${mix(up, 1, 0.62)})`, transformOrigin: "50% 0%" }}>
          <Logo id="introLogo" width={400} state={{ draw: prog(frame, SEG.intro2.at - 0.2, DROP - SEG.intro2.at, easeInOut), fill, nails, thresh }} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: mix(up, 1010, 545), display: "flex", justifyContent: "center", transform: `scale(${mix(up, 1, 0.58)})`, transformOrigin: "50% 0%" }}>
          <div style={{ clipPath: slantClip(prog(frame, DROP + 0.02, 0.55), 260) }}>
            <Wordmark size={230} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 80, right: 80, top: 1300, display: "flex", justifyContent: "center", gap: 18, fontFamily: F.kufi, fontWeight: 500, fontSize: 70, color: C.tabuq, opacity: 1 - up, direction: "rtl" }}>
          {tagWords.map((w, i) => (
            <span key={i} style={{ opacity: prog(frame, w.s - 0.05, 0.35), transform: `translateY(${(1 - prog(frame, w.s - 0.05, 0.4)) * 40}px)`, color: i === tagWords.length - 1 ? C.teen : C.tabuq }}>
              {w.w}
            </span>
          ))}
        </div>
        {/* 16-tile preview grid: «ميزة، ميزة» */}
        <div style={{ position: "absolute", top: 720, left: 200, right: 200, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, direction: "rtl" }}>
          {keys.map((k, i) => {
            const Ic = FEATURE_ICONS[k];
            const d = prog(frame, khalli + 0.1 + ((i % 4) + Math.floor(i / 4)) * 0.11, 0.45);
            return (
              <div
                key={k}
                style={{
                  aspectRatio: "1",
                  background: i % 5 === 0 ? C.tabuq : C.teen,
                  borderRadius: 6,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  transform: `perspective(800px) rotateY(${mix(d, 90, 0)}deg) scale(${mix(d, 0.6, 1)})`,
                  opacity: d,
                }}
              >
                <Ic size={58} color={C.lazurd} accent={i % 5 === 0 ? C.jiss : C.tabuq} />
                <div style={{ fontFamily: F.logo, fontSize: 30, color: C.lazurd, lineHeight: 1 }}>{pad2(i + 1)}</div>
              </div>
            );
          })}
        </div>
        <Caption words={gridWords} t={t} color={C.teen} dim="rgba(241,232,216,0.5)" top={1405} size={58} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.teen, opacity: flash }} />
    </AbsoluteFill>
  );
};

// ───────────────────────────────────────── outro
const Outro: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame() + S(from);
  const t = sec(frame);
  const ws = SEG.outro.words;
  const FIN = ws[0].s;
  const hk = ws.find((w) => w.w.startsWith("الحكيم"))!.s;
  const nz = ws.find((w) => w.w.startsWith("نزّله"))!.s;
  const hit = prog(frame, FIN, 0.4);
  const gather = prog(frame, from + 0.1, FIN - from - 0.05, easeInOut);
  const btn = prog(frame, nz + 0.1, 0.5);
  const press = interpolate(t, [hk + 1.2, hk + 1.3, hk + 1.5], [1, 0.95, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shine = interpolate(t, [hk + 1.25, hk + 1.95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const keys = FEATS.map((f) => f.key);
  const rot = t * 14;
  const radius = interpolate(t, [from, Math.max(from + 0.02, FIN - 0.28), FIN], [380, 380, 60], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  return (
    <AbsoluteFill style={{ background: C.lazurd, overflow: "hidden" }}>
      <BrickPattern id="ob" color={C.teen} opacity={0.07} offset={-t * 14} />
      <Arches color={C.tabuq} opacity={0.25} t={t} />
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 36 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{ opacity: prog(frame, FIN + 0.1 + i * 0.05, 0.3) }}>
            <Nail size={34} color={C.tabuq} />
          </div>
        ))}
      </div>
      {/* the 16 features orbit and gather into the door */}
      {keys.map((k, i) => {
        const Ic = FEATURE_ICONS[k];
        const a = ((i / 16) * 360 + rot) * (Math.PI / 180);
        const x = 540 + Math.cos(a) * radius;
        const y = 600 + Math.sin(a) * radius * 0.92;
        const vis = interpolate(t, [FIN - 0.25, FIN + 0.05], [1, 0.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={k} style={{ position: "absolute", left: x - 48, top: y - 48, width: 96, height: 96, background: C.teen, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", opacity: vis * Math.min(1, gather * 3), transform: `scale(${mix(hit, 1, 0.75)})` }}>
            <Ic size={58} color={C.lazurd} accent={C.tabuq} />
          </div>
        );
      })}
      {hit > 0 && hit < 1 && <div style={{ position: "absolute", left: 540 - mix(hit, 60, 1000), top: 600 - mix(hit, 60, 1000), width: mix(hit, 120, 2000), height: mix(hit, 120, 2000), borderRadius: "50%", border: `${mix(hit, 12, 1)}px solid ${C.tabuq}`, opacity: 1 - hit }} />}
      <div style={{ position: "absolute", top: 380, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: hit, transform: `scale(${mix(hit, 1.4, 1)})` }}>
        <Logo id="outLogo" width={290} />
      </div>
      <div style={{ position: "absolute", top: 830, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ clipPath: slantClip(prog(frame, FIN + 0.1, 0.5), 220) }}>
          <Wordmark size={190} />
        </div>
      </div>
      <Caption words={ws.slice(1)} t={t} color={C.teen} dim="rgba(241,232,216,0.5)" top={1080} size={62} />
      <div style={{ position: "absolute", top: 1260, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ opacity: btn, transform: `translateY(${(1 - btn) * 80}px) scale(${press})` }}>
          <SlantButton w={720} h={130} bg={C.tabuq} color={C.lazurd} size={52} shine={shine}>
            نزّل التطبيق مجاناً
          </SlantButton>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1430, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: prog(frame, nz + 0.6, 0.5) }}>
        <div style={{ fontFamily: F.plex, fontWeight: 500, fontSize: 34, color: C.teen, display: "flex", gap: 18, alignItems: "center" }}>
          <span>متوفر على</span>
          <span style={{ fontWeight: 600, direction: "ltr" }}>App Store</span>
          <Nail size={22} color={C.tabuq} />
          <span style={{ fontWeight: 600, direction: "ltr" }}>Google Play</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────────────────────── film
export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const introRevealFrom = SEG.intro2.at - 0.65;
  return (
    <AbsoluteFill style={{ background: C.lazurd }}>
      <Sequence name="Intro · hook" from={0} durationInFrames={S(SEG.intro2.at + 0.2)}>
        <IntroHook />
      </Sequence>
      <Sequence name="Intro · reveal" from={S(introRevealFrom)} durationInFrames={S(timeline.introEnd - introRevealFrom)}>
        <IntroReveal from={introRevealFrom} />
      </Sequence>
      {TL.map((f, i) => (
        <Sequence key={f.n} name={`${String(f.n).padStart(2, "0")} · ${FEATS[i].title}`} from={S(f.start)} durationInFrames={S(f.end) - S(f.start)}>
          <FeatureScene i={i} />
        </Sequence>
      ))}
      <Sequence name="Outro" from={S(timeline.outroStart)} durationInFrames={S(timeline.total) - S(timeline.outroStart)}>
        <Outro from={timeline.outroStart} />
      </Sequence>
      {TL.map((f, i) => (
        <TileWipe key={f.n} at={f.start} frame={frame} color={FEATS[i].bg === "lazurd" ? C.lazurd : C.teen} />
      ))}
      <TileWipe at={timeline.outroStart} frame={frame} color={C.lazurd} />
      <Audio src={staticFile("audio/mix_v2.wav")} />
    </AbsoluteFill>
  );
};

export const FILM_FRAMES = S(timeline.total);
// keep tree-shaking honest for icons referenced only via maps
void [IconClock, IconDoctor, IconFile, IconLab, IconPharmacy, IconPill, IconTicket, easeOut];
