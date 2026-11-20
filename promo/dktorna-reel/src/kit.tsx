import React, { createContext, useContext } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { C, F, S, easeInOut, mix, prog, slantClip } from "./brand";

const W = 1080;

// Scenes are written in GLOBAL seconds so they line up 1:1 with the voice track.
const GFrame = createContext(0);
export const useG = () => useContext(GFrame);

type Trans = { type: "push" | "slant" | "fade" | "arch" | "none"; at: number; dur?: number };

const InnerShell: React.FC<{ start: number; enter: Trans; exit: Trans; bg: string; children: React.ReactNode }> = ({
  start,
  enter,
  exit,
  bg,
  children,
}) => {
  const f = useCurrentFrame() + S(start);
  let transform = "";
  let clipPath: string | undefined;
  let opacity = 1;

  if (enter.type !== "none") {
    const p = prog(f, enter.at, enter.dur ?? 0.38, easeInOut);
    if (enter.type === "push") transform += ` translateX(${mix(p, -W, 0)}px)`;
    if (enter.type === "slant") clipPath = slantClip(p, 1920, "ltr");
    if (enter.type === "fade") opacity = p;
    if (enter.type === "arch") clipPath = `url(#arch-reveal-${start})`;
  }
  if (exit.type !== "none") {
    const p = prog(f, exit.at, exit.dur ?? 0.38, easeInOut);
    if (exit.type === "push") transform += ` translateX(${mix(p, 0, W)}px)`;
    if (exit.type === "fade") opacity *= 1 - p;
  }

  const archP = enter.type === "arch" ? prog(f, enter.at, enter.dur ?? 0.8, easeInOut) : 1;
  const archScale = mix(archP, 0.02, 16);

  return (
    <GFrame.Provider value={f}>
      {enter.type === "arch" && (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <clipPath id={`arch-reveal-${start}`} clipPathUnits="userSpaceOnUse">
              {/* the logo's own arch, opening like a door from the screen centre */}
              <path
                transform={`translate(540 ${enter.type === "arch" ? 1010 : 960}) scale(${archScale}) translate(-297.8 -339)`}
                d="M 209.375 480.570312 L 209.375 330.238281 C 209.375 268.339844 249.167969 228.542969 297.804688 197.59375 C 346.441406 228.542969 386.238281 268.339844 386.238281 330.238281 L 386.238281 480.570312 Z"
              />
            </clipPath>
          </defs>
        </svg>
      )}
      <AbsoluteFill style={{ background: bg, transform, clipPath, opacity, overflow: "hidden", direction: "rtl" }}>
        {children}
      </AbsoluteFill>
    </GFrame.Provider>
  );
};

export const Scene: React.FC<{
  name: string;
  start: number;
  end: number;
  enter?: Trans;
  exit?: Trans;
  bg: string;
  children: React.ReactNode;
}> = ({ name, start, end, enter = { type: "none", at: 0 }, exit = { type: "none", at: 0 }, bg, children }) => (
  <Sequence name={name} from={S(start)} durationInFrames={S(end) - S(start)}>
    <InnerShell start={start} enter={enter} exit={exit} bg={bg}>
      {children}
    </InnerShell>
  </Sequence>
);

// ── Word-by-word kinetic text, timed to the voice
export type Word = { w: string; at: number; color?: string };

export const Words: React.FC<{
  words: Word[];
  size: number;
  color?: string;
  font?: string;
  weight?: number;
  style?: React.CSSProperties;
  lineHeight?: number;
  out?: number; // global second when the line leaves
}> = ({ words, size, color = C.lazurd, font = F.kufi, weight = 800, style, lineHeight = 1.45, out }) => {
  const f = useG();
  const outP = out !== undefined ? prog(f, out, 0.3, easeInOut) : 0;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: size * 0.28,
        direction: "rtl",
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight,
        color,
        ...style,
      }}
    >
      {words.map((wd, i) => {
        const p = prog(f, wd.at - 0.05, 0.42);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", padding: `0 ${size * 0.04}px`, margin: `-${size * 0.08}px 0` }}>
            <span
              style={{
                display: "inline-block",
                color: wd.color ?? color,
                transform: `translateY(${mix(p, 135, 0) + outP * -135}%)`,
                opacity: Math.min(p * 2, 1) * (1 - outP),
              }}
            >
              {wd.w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Pops an element in (fade + short rise, no overshoot) at a global second. */
export const In: React.FC<{
  at: number;
  dur?: number;
  dx?: number;
  dy?: number;
  scale?: number;
  out?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ at, dur = 0.45, dx = 0, dy = 40, scale = 1, out, style, children }) => {
  const f = useG();
  const p = prog(f, at, dur);
  const o = out !== undefined ? prog(f, out, 0.3, easeInOut) : 0;
  return (
    <div
      style={{
        opacity: Math.min(1, p * 1.6) * (1 - o),
        transform: `translate(${(1 - p) * dx}px, ${(1 - p) * dy}px) scale(${mix(p, scale, 1)})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Typewriter for the search field. */
export const Typed: React.FC<{ text: string; at: number; cps?: number; caret?: boolean; style?: React.CSSProperties }> = ({
  text,
  at,
  cps = 14,
  caret = true,
  style,
}) => {
  const f = useG();
  const n = Math.max(0, Math.min(text.length, Math.floor(((f - S(at)) / 30) * cps)));
  const blink = Math.floor(f / 15) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {caret && <span style={{ opacity: blink ? 1 : 0, color: C.tabuq }}>|</span>}
    </span>
  );
};
