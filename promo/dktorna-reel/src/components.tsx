import React from "react";
import { interpolate } from "remotion";
import { ARCH_D, ARCH_LEN, C, F, LOGO_VB, NAILS, THRESH, TAN9, mix } from "./brand";

// ───────────────────────────────────────────────────────── Logo (باب الحكيم)
export type LogoState = {
  draw?: number; // arch outline drawing 0..1
  fill?: number; // arch fill rising from the threshold 0..1
  nails?: number[]; // 4 values 0..1 (fly-in + stamp)
  thresh?: number; // threshold slide 0..1
  archColor?: string;
  nailColor?: string;
  outline?: string;
};

export const Logo: React.FC<{ width: number; state?: LogoState; id: string }> = ({ width, state = {}, id }) => {
  const {
    draw = 1,
    fill = 1,
    nails = [1, 1, 1, 1],
    thresh = 1,
    archColor = C.teen,
    nailColor = C.lazurd,
    outline = C.tabuq,
  } = state;
  const { x, y, w, h } = LOGO_VB;
  const height = (width * h) / w;
  const fillTop = mix(fill, 480.6, 190);
  return (
    <svg width={width} height={height} viewBox={`${x} ${y} ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <clipPath id={`${id}-fill`}>
          <rect x={x - 20} y={fillTop} width={w + 40} height={500} />
        </clipPath>
      </defs>
      {draw > 0 && fill < 1 && (
        <path
          d={ARCH_D}
          fill="none"
          stroke={outline}
          strokeWidth={2.2}
          strokeDasharray={ARCH_LEN}
          strokeDashoffset={ARCH_LEN * (1 - draw)}
          opacity={interpolate(fill, [0, 0.6], [1, 0], { extrapolateRight: "clamp" })}
        />
      )}
      <path d={ARCH_D} fill={archColor} clipPath={`url(#${id}-fill)`} />
      {NAILS.map((n, i) => {
        const p = nails[i];
        if (p <= 0) return null;
        const dist = (1 - p) * 140;
        return (
          <g key={i} transform={`translate(${n.dx * dist} ${n.dy * dist})`} opacity={Math.min(1, p * 3)}>
            <path d={n.d} fill={nailColor} />
          </g>
        );
      })}
      <rect
        x={THRESH.x + (THRESH.w * (1 - thresh)) / 2}
        y={THRESH.y}
        width={THRESH.w * thresh}
        height={THRESH.h}
        fill={C.tabuq}
      />
    </svg>
  );
};

// ───────────────────────────────────────────────────────── Wordmark
export const Wordmark: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({
  size,
  color = C.teen,
  style,
}) => (
  <div style={{ fontFamily: F.logo, fontWeight: 700, fontSize: size, color, lineHeight: 1.1, direction: "rtl", ...style }}>
    دكتورنا
  </div>
);

// ───────────────────────────────────────────────────────── Icons (2px on a 24 grid, one nail each)
type IconProps = { size: number; color?: string; accent?: string; draw?: number };
const stroke = (color: string) => ({
  fill: "none",
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: "butt" as const,
  strokeLinejoin: "round" as const,
});

const dash = (len: number, draw: number) => ({ strokeDasharray: len, strokeDashoffset: len * (1 - draw) });

export const IconDoctor: React.FC<IconProps> = ({ size, color = C.lazurd, accent = C.tabuq, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M5 22 V10 C5 6.5 8 4 12 2 C16 4 19 6.5 19 10 V22 Z" {...stroke(color)} {...dash(60, draw)} />
    <path d="M12 10 V17 M8.5 13.5 H15.5" stroke={accent} strokeWidth={2.4} opacity={draw} />
  </svg>
);

export const IconPharmacy: React.FC<IconProps> = ({ size, color = C.nakheel, accent = C.nakheel, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M4 9 H20 L18.5 21 H5.5 Z" {...stroke(color)} {...dash(56, draw)} />
    <path d="M8.5 9 V6 C8.5 4 10 3 12 3 C14 3 15.5 4 15.5 6 V9" {...stroke(color)} {...dash(20, draw)} />
    <path d="M10.4 12.4 H13.6 L12.5 14.3 L12.3 18 H11.7 L11.5 14.3 Z" fill={accent} opacity={draw} />
  </svg>
);

export const IconPill: React.FC<IconProps> = ({ size, color = C.kashi, accent = C.tabuq, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <rect x="7" y="7" width="10" height="15" rx="1.5" {...stroke(color)} {...dash(52, draw)} />
    <path d="M6 3 H18 V7 H6 Z" {...stroke(color)} {...dash(32, draw)} />
    <path d="M9.5 13 H14.5 M9.5 16.5 H13" stroke={accent} strokeWidth={2} opacity={draw} />
  </svg>
);

export const IconTicket: React.FC<IconProps> = ({ size, color = C.lazurd, accent = C.tabuq, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M2 6 H22 V10 C20.5 10 20 11 20 12 C20 13 20.5 14 22 14 V18 H2 V14 C3.5 14 4 13 4 12 C4 11 3.5 10 2 10 Z" {...stroke(color)} {...dash(70, draw)} />
    <path d="M10 9.5 V14.5 M12.5 9.5 V14.5 M15 9.5 V14.5" stroke={accent} strokeWidth={1.8} opacity={draw} />
  </svg>
);

export const IconFile: React.FC<IconProps> = ({ size, color = C.lazurd, accent = C.tabuq, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M5 2 H14 L19 7 V22 H5 Z M14 2 V7 H19" {...stroke(color)} {...dash(70, draw)} />
    <path d="M8 11 H16 M8 14.5 H16 M8 18 H13" stroke={accent} strokeWidth={2} opacity={draw} />
  </svg>
);

export const IconLab: React.FC<IconProps> = ({ size, color = C.kashi, accent = C.tabuq, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M9 2 H15 M10 2 V9 L4.5 20.5 C4.2 21.2 4.6 22 5.4 22 H18.6 C19.4 22 19.8 21.2 19.5 20.5 L14 9 V2" {...stroke(color)} {...dash(60, draw)} />
    <path d="M7.5 15.5 H16.5" stroke={accent} strokeWidth={2.2} opacity={draw} />
  </svg>
);

/** Clock with a nail as its hour hand (تنبيه الدواء). */
export const IconClock: React.FC<IconProps & { minuteAngle?: number; hourAngle?: number }> = ({
  size,
  color = C.lazurd,
  accent = C.tabuq,
  draw = 1,
  minuteAngle = 0,
  hourAngle = 0,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="13" r="9" {...stroke(color)} {...dash(57, draw)} transform="rotate(-90 12 13)" />
    <path d="M9.5 2 H14.5" {...stroke(color)} opacity={draw} />
    <g transform={`rotate(${minuteAngle} 12 13)`} opacity={draw}>
      <path d="M12 13 V6.5" stroke={color} strokeWidth={1.6} />
    </g>
    <g transform={`rotate(${hourAngle} 12 13)`} opacity={draw}>
      {/* nail-shaped hour hand */}
      <path d="M10.6 7.8 H13.4 L12.45 9.4 L12.25 13 H11.75 L11.55 9.4 Z" fill={accent} />
    </g>
  </svg>
);

/** Seal of trust (ختم التوثيق) – eight nails inside a circle. */
export const Seal: React.FC<{ size: number; color?: string; nailColor?: string; ring?: number; nails?: number }> = ({
  size,
  color = C.lazurd,
  nailColor = C.tabuq,
  ring = 1,
  nails = 1,
}) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100">
    <circle r="46" fill={color} opacity={ring} />
    <circle r="40" fill="none" stroke={nailColor} strokeWidth="2" opacity={ring} strokeDasharray="252" strokeDashoffset={252 * (1 - ring)} />
    {Array.from({ length: 8 }).map((_, i) => {
      const p = Math.min(1, Math.max(0, nails * 8 - i));
      return (
        <g key={i} transform={`rotate(${i * 45}) translate(0 ${-30 + (1 - p) * -10})`} opacity={p}>
          <path d="M-4.5 -4 H4.5 L1.3 1 L0.6 12 H-0.6 L-1.3 1 Z" fill={nailColor} />
        </g>
      );
    })}
    <circle r="3.5" fill={nailColor} opacity={ring} />
  </svg>
);

// ───────────────────────────────────────────────────────── Slanted button (حافة مائلة ٩°)
export const SlantButton: React.FC<{
  w: number;
  h: number;
  bg: string;
  color: string;
  children: React.ReactNode;
  size?: number;
  shine?: number;
}> = ({ w, h, bg, color, children, size = 44, shine = -1 }) => {
  const o = TAN9 * h;
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id={`btn-${w}-${h}`}>
            <path d={`M${o} 0 H${w} L${w - o} ${h} H0 Z`} />
          </clipPath>
        </defs>
        <path d={`M${o} 0 H${w} L${w - o} ${h} H0 Z`} fill={bg} />
        {shine >= 0 && shine <= 1 && (
          <rect
            clipPath={`url(#btn-${w}-${h})`}
            x={mix(shine, w + 40, -160)}
            y={-20}
            width={70}
            height={h + 40}
            fill="#ffffff"
            opacity={0.22}
            transform={`skewX(-9)`}
          />
        )}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: F.kufi,
          fontWeight: 700,
          fontSize: size,
          color,
          direction: "rtl",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────── Phone shell
export const Phone: React.FC<{ width: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  width,
  children,
  style,
}) => {
  const height = width * 2.05;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.13,
        background: C.qeer,
        padding: width * 0.032,
        boxShadow: "0 30px 80px rgba(20,48,106,0.28)",
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: width * 0.105,
          overflow: "hidden",
          background: C.teen,
          position: "relative",
          direction: "rtl",
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Lazurd header with its lower edge tilted 9° (ترويسة بميل الزقورة). */
export const SlantHeader: React.FC<{ width: number; height: number; children?: React.ReactNode }> = ({
  width,
  height,
  children,
}) => {
  const o = width * 0.06;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width, height: height + o }}>
      <svg width={width} height={height + o} style={{ position: "absolute", inset: 0 }}>
        <path d={`M0 0 H${width} V${height + o} L0 ${height} Z`} fill={C.lazurd} />
      </svg>
      <div style={{ position: "relative", padding: "0 34px", height, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 14 }}>
        {children}
      </div>
    </div>
  );
};
