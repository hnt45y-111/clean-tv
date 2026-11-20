// App UI kit — every screen is designed at a real phone size (390 × 828 logical px)
// and scaled into the device, so proportions match the guide's mock screens.
import React, { createContext, useContext } from "react";
import { Easing, interpolate } from "remotion";
import { C, F, TAN9, ar, mix } from "../brand";
import { Logo, Seal } from "../components";

export const SW = 390;
export const SH = 828;

// ── local clock for a feature: t = seconds since the feature started
/** t: local seconds; c: callout cue times (local); vo: when the narration starts (local). */
export type Clock = { t: number; c: number[]; vo: number; dur: number };
export const ClockCtx = createContext<Clock>({ t: 0, c: [], vo: 0, dur: 1 });
export const useClock = () => useContext(ClockCtx);

const outE = Easing.bezier(0.16, 1, 0.3, 1);
export const lp = (t: number, at: number, dur = 0.45, easing = outE) =>
  interpolate(t, [at, at + Math.max(0.01, dur)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

/** Fades + rises an element in at local second `at`. */
export const Pop: React.FC<{ at: number; dx?: number; dy?: number; s?: number; dur?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  at,
  dx = 0,
  dy = 18,
  s = 1,
  dur = 0.4,
  children,
  style,
}) => {
  const { t } = useClock();
  const p = lp(t, at, dur);
  return (
    <div style={{ opacity: Math.min(1, p * 1.7), transform: `translate(${(1 - p) * dx}px, ${(1 - p) * dy}px) scale(${mix(p, s, 1)})`, ...style }}>
      {children}
    </div>
  );
};

export const Screen: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = C.teen }) => (
  <div style={{ width: SW, height: SH, background: bg, position: "relative", overflow: "hidden", direction: "rtl", fontFamily: F.plex, color: C.qeer }}>
    <StatusBar />
    {children}
  </div>
);

const StatusBar: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 34,
      zIndex: 5,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 26px",
      fontSize: 13,
      fontWeight: 600,
      color: C.jiss,
      direction: "ltr",
      fontFamily: F.plex,
    }}
  >
    <span>9:41</span>
    <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
      <span style={{ width: 16, height: 9, display: "flex", gap: 2, alignItems: "flex-end" }}>
        {[4, 6, 8, 9].map((h, i) => (
          <span key={i} style={{ width: 3, height: h, background: C.jiss }} />
        ))}
      </span>
      <span style={{ width: 22, height: 10, border: `1.5px solid ${C.jiss}`, borderRadius: 3, padding: 1 }}>
        <span style={{ display: "block", width: "75%", height: "100%", background: C.jiss }} />
      </span>
    </span>
  </div>
);

/** Lazurd header with the 9° lower edge. */
export const AppHeader: React.FC<{ kicker?: string; title: string; h?: number; back?: boolean; color?: string; children?: React.ReactNode }> = ({
  kicker,
  title,
  h = 132,
  back,
  color = C.lazurd,
  children,
}) => {
  const o = SW * 0.06;
  return (
    <div style={{ position: "relative", height: h + o }}>
      <svg width={SW} height={h + o} style={{ position: "absolute", inset: 0 }}>
        <path d={`M0 0 H${SW} V${h + o} L0 ${h} Z`} fill={color} />
      </svg>
      <div style={{ position: "relative", height: h, padding: "0 22px 14px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        {back && <div style={{ position: "absolute", top: 44, right: 20, color: C.jiss, fontSize: 22 }}>→</div>}
        {kicker && <div style={{ fontSize: 13, color: C.tabuq, fontWeight: 500 }}>{kicker}</div>}
        <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 23, color: C.jiss, lineHeight: 1.45 }}>{title}</div>
        {children}
      </div>
    </div>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; accent?: string }> = ({ children, style, accent }) => (
  <div
    style={{
      background: C.jiss,
      border: `1px solid ${C.line}`,
      borderRadius: 4,
      padding: 12,
      borderInlineStart: accent ? `4px solid ${accent}` : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Chip: React.FC<{ children: React.ReactNode; bg?: string; color?: string; outline?: boolean; size?: number }> = ({
  children,
  bg = C.lazurd,
  color = C.jiss,
  outline,
  size = 12,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      background: outline ? "transparent" : bg,
      color: outline ? bg : color,
      border: outline ? `1.5px solid ${bg}` : undefined,
      fontSize: size,
      fontWeight: 600,
      padding: "3px 9px",
      borderRadius: 4,
      whiteSpace: "nowrap",
      fontFamily: F.plex,
    }}
  >
    {children}
  </span>
);

/** Primary button with the 9° slanted edges. */
export const Btn: React.FC<{ children: React.ReactNode; bg?: string; color?: string; h?: number; press?: number; style?: React.CSSProperties }> = ({
  children,
  bg = C.lazurd,
  color = C.jiss,
  h = 46,
  press = 0,
  style,
}) => {
  const o = TAN9 * h;
  return (
    <div
      style={{
        height: h,
        background: bg,
        color,
        clipPath: `polygon(${o}px 0, 100% 0, calc(100% - ${o}px) 100%, 0 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: F.kufi,
        fontWeight: 700,
        fontSize: 16,
        transform: `scale(${1 - press * 0.05})`,
        filter: press > 0 ? `brightness(${1 - press * 0.12})` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Field: React.FC<{ label?: string; children: React.ReactNode; focus?: boolean }> = ({ label, children, focus }) => (
  <div>
    {label && <div style={{ fontSize: 12, color: C.ramad, marginBottom: 4 }}>{label}</div>}
    <div
      style={{
        background: C.jiss,
        border: `1.5px solid ${focus ? C.lazurd : C.line}`,
        borderRadius: 4,
        padding: "10px 12px",
        fontSize: 15,
        minHeight: 22,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
    </div>
  </div>
);

/** Typewriter driven by the feature clock. */
export const Type: React.FC<{ text: string; at: number; cps?: number; caret?: boolean }> = ({ text, at, cps = 16, caret = true }) => {
  const { t } = useClock();
  const n = Math.max(0, Math.min(text.length, Math.floor((t - at) * cps)));
  const on = Math.floor(t * 2.2) % 2 === 0;
  return (
    <span>
      {text.slice(0, n)}
      {caret && n < text.length + 1 && t > at - 0.6 && <span style={{ color: C.tabuq, opacity: on ? 1 : 0 }}>|</span>}
    </span>
  );
};

export const BottomNav: React.FC<{ active: number }> = ({ active }) => (
  <div
    style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 62,
      background: C.jiss,
      borderTop: `1px solid ${C.line}`,
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      fontSize: 12,
      color: C.ramad,
      paddingBottom: 8,
    }}
  >
    {["الرئيسية", "حجوزاتي", "ملفي", "المنتدى"].map((l, i) => (
      <span key={l} style={{ color: i === active ? C.lazurd : C.ramad, fontWeight: i === active ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{ width: 5, height: 5, background: i === active ? C.tabuq : "transparent", transform: "rotate(45deg)" }} />
        {l}
      </span>
    ))}
  </div>
);

/** A face inside the Baghdadi arch (the guide's only frame for people). */
export const ArchFace: React.FC<{ w: number; init: string; bg?: string; color?: string }> = ({ w, init, bg = C.tabuq, color = C.lazurd }) => (
  <div style={{ position: "relative", width: w, flexShrink: 0 }}>
    <Logo id={`af-${init}-${w}-${bg}`} width={w} state={{ nails: [0, 0, 0, 0], archColor: bg, thresh: 0 }} />
    <div style={{ position: "absolute", top: w * 0.47, left: 0, right: 0, textAlign: "center", fontFamily: F.kufi, fontWeight: 800, fontSize: w * 0.42, color, lineHeight: 1 }}>{init}</div>
  </div>
);

export const DocRow: React.FC<{ name: string; meta: string; init: string; tag?: React.ReactNode; right?: React.ReactNode; seal?: boolean }> = ({
  name,
  meta,
  init,
  tag,
  right,
  seal = true,
}) => (
  <Card style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <ArchFace w={50} init={init} />
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: F.kufi, fontWeight: 700, fontSize: 15, color: C.lazurd }}>
        {name}
        {seal && <Seal size={15} />}
      </div>
      <div style={{ fontSize: 12, color: C.ramad }}>{meta}</div>
      {tag && <div style={{ marginTop: 5 }}>{tag}</div>}
    </div>
    {right}
  </Card>
);

/** Rating with nails instead of stars (each icon carries a nail). */
export const NailRating: React.FC<{ value: number; size?: number; fill?: number }> = ({ value, size = 14, fill = 1 }) => (
  <span style={{ display: "inline-flex", gap: 2, direction: "rtl" }}>
    {Array.from({ length: 5 }).map((_, i) => {
      const on = Math.min(1, Math.max(0, value * fill - i));
      return (
        <svg key={i} width={size * 0.62} height={size} viewBox="282.73 288.99 30.15 49.34">
          <path d="M 282.730469 288.988281 L 312.882812 288.988281 L 302.191406 306.804688 L 300 338.332031 L 295.613281 338.332031 L 293.421875 306.804688 Z" fill={C.line} />
          <path
            d="M 282.730469 288.988281 L 312.882812 288.988281 L 302.191406 306.804688 L 300 338.332031 L 295.613281 338.332031 L 293.421875 306.804688 Z"
            fill={C.tabuq}
            style={{ clipPath: `inset(0 0 ${(1 - on) * 100}% 0)` }}
          />
        </svg>
      );
    })}
  </span>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.lazurd }) => (
  <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 15, color, margin: "14px 2px 8px" }}>{children}</div>
);

export const Barcode: React.FC<{ p?: number; h?: number }> = ({ p = 1, h = 44 }) => {
  const bars = Array.from({ length: 42 }).map((_, i) => ((i * 37 + 11) % 7) + 1);
  return (
    <div style={{ display: "flex", gap: 2, height: h, justifyContent: "center", direction: "ltr" }}>
      {bars.map((b, i) => (
        <div key={i} style={{ width: b > 4 ? 3.5 : 1.5, background: C.qeer, opacity: i / bars.length < p ? 1 : 0.07 }} />
      ))}
    </div>
  );
};

export { ar };
