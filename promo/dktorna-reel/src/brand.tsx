import React from "react";
import { Easing, interpolate, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";

// ── Colours (from the brand guide: materials of Iraq)
export const C = {
  lazurd: "#1B3A7A",
  lazurdDeep: "#14306A",
  tabuq: "#C9A063",
  teen: "#F1E8D8",
  jiss: "#FBF6EC",
  qeer: "#1F1B17",
  ramad: "#6B6258",
  nakheel: "#2E6B4E",
  kashi: "#1F8A8A",
  ajur: "#B24A2C",
  line: "#E3D6BF",
};

export const FPS = 30;
export const S = (sec: number) => Math.round(sec * FPS);
export const TAN9 = Math.tan((9 * Math.PI) / 180);

// ── Fonts (the four OFL families named in the guide)
const fonts: [string, string, string][] = [
  ["Reem Kufi", "fonts/ReemKufi-700.woff2", "700"],
  ["Noto Kufi Arabic", "fonts/noto-kufi-arabic-arabic-500-normal.woff2", "500"],
  ["Noto Kufi Arabic", "fonts/noto-kufi-arabic-arabic-700-normal.woff2", "700"],
  ["Noto Kufi Arabic", "fonts/noto-kufi-arabic-arabic-800-normal.woff2", "800"],
  ["IBM Plex Sans Arabic", "fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", "400"],
  ["IBM Plex Sans Arabic", "fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2", "500"],
  ["IBM Plex Sans Arabic", "fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2", "600"],
  ["IBM Plex Sans Arabic", "fonts/ibm-plex-sans-arabic-latin-400-normal.woff2", "400"],
  ["IBM Plex Sans Arabic", "fonts/ibm-plex-sans-arabic-latin-600-normal.woff2", "600"],
];
fonts.forEach(([family, url, weight]) => {
  loadFont({ family, url: staticFile(url), weight });
});

export const F = {
  logo: "'Reem Kufi', sans-serif",
  kufi: "'Noto Kufi Arabic', sans-serif",
  plex: "'IBM Plex Sans Arabic', sans-serif",
};

// ── Motion: "like a door opening, no jump" → strong ease-out, no overshoot
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.5, 0, 0.75, 0);

/** 0→1 progress of an animation starting at `start` (seconds) lasting `dur` seconds. */
export const prog = (frame: number, start: number, dur: number, easing = easeOut) =>
  interpolate(frame, [S(start), S(start) + Math.max(1, dur * FPS)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const mix = (p: number, a: number, b: number) => a + (b - a) * p;

/** Arabic-Indic digits, as the guide asks for anything the patient sees. */
export const ar = (n: number | string) =>
  String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

// ── Logo geometry, taken verbatim from the vector logo file
export const LOGO_VB = { x: 196.109, y: 197.59, w: 203.391, h: 294.035 };
export const ARCH_D =
  "M 209.375 480.570312 L 209.375 330.238281 C 209.375 268.339844 249.167969 228.542969 297.804688 197.59375 C 346.441406 228.542969 386.238281 268.339844 386.238281 330.238281 L 386.238281 480.570312 Z";
export const NAILS = [
  // top, right, bottom, left (each one a cuneiform stroke)
  { d: "M 282.730469 288.988281 L 312.882812 288.988281 L 302.191406 306.804688 L 300 338.332031 L 295.613281 338.332031 L 293.421875 306.804688 Z", dx: 0, dy: -1 },
  { d: "M 356.746094 332.847656 L 356.746094 363.003906 L 338.925781 352.3125 L 307.402344 350.117188 L 307.402344 345.734375 L 338.925781 343.539062 Z", dx: 1, dy: 0 },
  { d: "M 312.882812 406.863281 L 282.730469 406.863281 L 293.421875 389.046875 L 295.613281 357.519531 L 300 357.519531 L 302.191406 389.046875 Z", dx: 0, dy: 1 },
  { d: "M 238.867188 363.003906 L 238.867188 332.847656 L 256.6875 343.539062 L 288.210938 345.734375 L 288.210938 350.117188 L 256.6875 352.3125 Z", dx: -1, dy: 0 },
];
export const THRESH = { x: 196.109, y: 480.57, w: 203.391, h: 11.055 };
export const ARCH_LEN = 820; // approximate perimeter in viewBox units

/** A single nail (مسمار) pointing down, in a 30×50 box. */
export const Nail: React.FC<{ size: number; color: string; style?: React.CSSProperties }> = ({ size, color, style }) => (
  <svg width={size * 0.6} height={size} viewBox="282.73 288.99 30.15 49.34" style={style}>
    <path d={NAILS[0].d} fill={color} />
  </svg>
);

/** Brick bond pattern (رصف الطابوق) – used at 8–15% as the guide allows. */
export const BrickPattern: React.FC<{ color: string; opacity: number; offset?: number; id: string }> = ({
  color,
  opacity,
  offset = 0,
  id,
}) => (
  <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity }}>
    <defs>
      <pattern id={id} width="96" height="48" patternUnits="userSpaceOnUse" patternTransform={`translate(${offset} 0)`}>
        <path d="M0 0.5 H96 M0 24.5 H96 M0.5 0 V24 M48.5 24 V48" stroke={color} strokeWidth="2" fill="none" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

/** Row of nails (سطور المسمار) used as a divider. */
export const NailRow: React.FC<{ count: number; size: number; color: string; reveal?: number; gap?: number }> = ({
  count,
  size,
  color,
  reveal = 1,
  gap = 22,
}) => (
  <div style={{ display: "flex", gap, justifyContent: "center", direction: "rtl" }}>
    {Array.from({ length: count }).map((_, i) => {
      const local = Math.min(1, Math.max(0, reveal * (count + 4) - i) / 4);
      return (
        <div key={i} style={{ opacity: local, transform: `translateY(${(1 - local) * -18}px)` }}>
          <Nail size={size} color={color} />
        </div>
      );
    })}
  </div>
);

/** Slanted (9°) wipe used for text and panels: progress 0..1, reveals right→left (RTL). */
export const slantClip = (p: number, hPx: number, dir: "rtl" | "ltr" = "rtl") => {
  const o = TAN9 * hPx;
  const big = 400;
  if (dir === "rtl") {
    const xb = `calc(${mix(p, 100, 0)}% - ${p * o}px)`;
    const xt = `calc(${mix(p, 100, 0)}% - ${p * o - o}px)`;
    return `polygon(${xt} 0%, calc(100% + ${big}px) 0%, calc(100% + ${big}px) 100%, ${xb} 100%)`;
  }
  const xb = `calc(${mix(p, 0, 100)}% + ${p * o}px)`;
  const xt = `calc(${mix(p, 0, 100)}% + ${p * o - o}px)`;
  return `polygon(-${big}px 0%, ${xt} 0%, ${xb} 100%, 0% 100%)`;
};
