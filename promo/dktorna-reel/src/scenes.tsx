import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { BrickPattern, C, F, S, NailRow, Nail, TAN9, ar, easeIn, easeInOut, mix, prog, slantClip } from "./brand";
import {
  IconClock,
  IconDoctor,
  IconFile,
  IconLab,
  IconPharmacy,
  IconPill,
  IconTicket,
  Logo,
  Phone,
  Seal,
  SlantButton,
  SlantHeader,
  Wordmark,
} from "./components";
import { In, Scene, Typed, Words, useG } from "./kit";

const V = 0.3; // voice offset in the mix
const v = (t: number) => t + V; // voice timestamp → video second

const Center: React.FC<{ top: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ top, children, style }) => (
  <div style={{ position: "absolute", top, left: 80, right: 80, display: "flex", justifyContent: "center", ...style }}>{children}</div>
);

const Tag: React.FC<{ children: React.ReactNode; bg?: string; color?: string; size?: number }> = ({
  children,
  bg = C.lazurd,
  color = C.jiss,
  size = 30,
}) => {
  const h = size * 1.9;
  const o = TAN9 * h;
  return (
    <div
      style={{
        background: bg,
        color,
        fontFamily: F.plex,
        fontWeight: 600,
        fontSize: size,
        height: h,
        display: "inline-flex",
        alignItems: "center",
        padding: `0 ${size * 0.9}px`,
        clipPath: `polygon(0 0, 100% 0, calc(100% - ${o}px) 100%, 0 100%)`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
};

// Shanasheel lattice (مشبّك الشناشيل) – light texture for cream scenes
const Lattice: React.FC<{ id: string; opacity: number; color?: string }> = ({ id, opacity, color = C.lazurd }) => (
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

const Ring: React.FC<{ at: number; x: number; y: number; color?: string; max?: number; dur?: number }> = ({
  at,
  x,
  y,
  color = C.tabuq,
  max = 900,
  dur = 1.1,
}) => {
  const f = useG();
  const p = prog(f, at, dur);
  if (p <= 0 || p >= 1) return null;
  const r = mix(p, 60, max);
  return (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        border: `${mix(p, 10, 1.5)}px solid ${color}`,
        opacity: (1 - p) * 0.7,
      }}
    />
  );
};

// ═══════════════════════════════════════════════ 1. Hook — «شكد مرة احتاجيت دكتور زين؟»
const HookInner: React.FC = () => {
  const f = useG();
  const search = prog(f, v(2.4), 1.0, easeInOut);
  const focus = Math.round(mix(search, 0, 2));
  return (
    <>
      <BrickPattern id="b1" color={C.teen} opacity={0.07} offset={-f * 0.6} />
      {/* three empty doctor-arches: nobody to go to */}
      <div style={{ position: "absolute", top: 430, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 70 }}>
        {[0, 1, 2].map((i) => {
          const d = prog(f, 0.15 + i * 0.22, 0.9);
          const q = prog(f, v(1.44) + i * 0.1, 0.4);
          const lit = f > (v(2.4)) * 30 && focus === i && search < 1;
          const dim = prog(f, v(3.0), 0.4);
          return (
            <div key={i} style={{ position: "relative", width: 230, transform: `translateY(${(1 - d) * 60}px)`, opacity: Math.min(1, d * 2) }}>
              <Logo
                id={`h${i}`}
                width={230}
                state={{
                  draw: d,
                  fill: 0,
                  nails: [0, 0, 0, 0],
                  thresh: d,
                  outline: lit ? C.teen : mix(dim, 0, 1) > 0.5 ? "rgba(241,232,216,0.35)" : C.tabuq,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 95,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontFamily: F.kufi,
                  fontWeight: 800,
                  fontSize: 120,
                  color: lit ? C.teen : C.tabuq,
                  opacity: q * mix(dim, 1, 0.45),
                  transform: `translateY(${(1 - q) * 30}px)`,
                }}
              >
                ؟
              </div>
            </div>
          );
        })}
      </div>
      <Center top={980}>
        <Words
          size={100}
          color={C.teen}
          words={[
            { w: "شكد", at: v(0.14) },
            { w: "مرة", at: v(0.38) },
            { w: "احتاجيت", at: v(0.59) },
            { w: "دكتور", at: v(1.04), color: C.tabuq },
            { w: "زين…", at: v(1.44), color: C.tabuq },
          ]}
        />
      </Center>
      <Center top={1250}>
        <Words
          size={64}
          weight={700}
          color={C.teen}
          words={[
            { w: "وما", at: v(2.28) },
            { w: "عرفت", at: v(2.44) },
            { w: "وين", at: v(2.76) },
            { w: "تروح؟", at: v(2.96) },
          ]}
        />
      </Center>
    </>
  );
};

// ═══════════════════════════════════════════════ 2. Waiting room — «كم ساعة انتظرت؟»
const WaitInner: React.FC = () => {
  const f = useG();
  const t = f / 30;
  const draw = prog(f, 4.15, 0.7);
  const spin = interpolate(t, [4.2, 8.2], [0, 360 * 9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const count = Math.round(interpolate(t, [5.3, 7.1], [1, 47], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut }));
  const outP = prog(f, 7.45, 0.6, easeIn);
  return (
    <>
      <Lattice id="l2" opacity={0.05} />
      <div style={{ transform: `scale(${mix(outP, 1, 0.82)})`, opacity: 1 - outP * 0.8, position: "absolute", inset: 0 }}>
        <Center top={300}>
          <div style={{ position: "relative" }}>
            <IconClock size={520} draw={draw} minuteAngle={spin} hourAngle={spin / 12} />
          </div>
        </Center>
        <Center top={920}>
          <Words
            size={86}
            words={[
              { w: "وكم", at: v(3.8) },
              { w: "ساعة", at: v(4.44), color: C.ajur },
              { w: "انتظرت", at: v(4.77) },
              { w: "بالعيادة،", at: v(5.16) },
              { w: "تنطر", at: v(6.03) },
              { w: "دورك؟", at: v(6.64), color: C.ajur },
            ]}
          />
        </Center>
        {/* queue ticker */}
        <Center top={1300}>
          <In at={5.25} dy={30}>
            <div style={{ display: "flex", alignItems: "center", gap: 26, direction: "rtl" }}>
              <Tag bg={C.ajur} size={34}>
                قبلك
              </Tag>
              <div style={{ fontFamily: F.logo, fontWeight: 700, fontSize: 120, color: C.ajur, minWidth: 150, textAlign: "center", lineHeight: 1 }}>
                {ar(count)}
              </div>
              <div style={{ fontFamily: F.plex, fontWeight: 500, fontSize: 40, color: C.ramad }}>مراجع</div>
            </div>
          </In>
        </Center>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════ 3. Reveal — the door opens: «دكتورنا»
const DROP = 9.38;
const RevealInner: React.FC = () => {
  const f = useG();
  const push = prog(f, 8.2, 4.6, (x) => x);
  const fill = prog(f, DROP, 0.38);
  const nails = [0, 1, 2, 3].map((i) => prog(f, 9.62 + i * 0.13 - 0.12, 0.2, easeIn));
  const thresh = prog(f, 10.1, 0.25);
  const lift = prog(f, 9.85, 0.7, easeInOut);
  const flash = f < S(DROP) ? 0 : interpolate(f / 30, [DROP, DROP + 0.25], [0.35, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <BrickPattern id="b3" color={C.teen} opacity={0.06} />
      <AbsoluteFill style={{ transform: `scale(${mix(push, 1, 1.05)})` }}>
        <Center top={230}>
          <Words size={70} weight={700} color={C.tabuq} words={[{ w: "من", at: v(8.15) }, { w: "اليوم…", at: v(8.23) }]} out={9.3} />
        </Center>
        <Ring at={DROP} x={540} y={670} max={1000} />
        <Ring at={DROP + 0.12} x={540} y={670} max={700} color={C.teen} />
        <div style={{ position: "absolute", left: 0, right: 0, top: mix(lift, 380, 330), display: "flex", justifyContent: "center" }}>
          <Logo
            id="main"
            width={mix(lift, 400, 360)}
            state={{ draw: prog(f, 8.35, 1.0, easeInOut), fill, nails, thresh }}
          />
        </div>
        <Center top={1000}>
          <div style={{ clipPath: slantClip(prog(f, 9.4, 0.55), 260), transform: `translateY(${(1 - lift) * 60}px)` }}>
            <Wordmark size={230} />
          </div>
        </Center>
        <Center top={1300}>
          <Words
            size={70}
            weight={500}
            font={F.kufi}
            color={C.tabuq}
            words={[
              { w: "حكيم", at: v(10.0) },
              { w: "المحلّة،", at: v(10.62) },
              { w: "بجيبك", at: v(11.6), color: C.teen },
            ]}
          />
        </Center>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.teen, opacity: flash }} />
    </>
  );
};

// ═══════════════════════════════════════════════ 4. Search — «دوّر على طبيب، صيدلية، أو دواء… قريب منك»
const DoctorCard: React.FC<{ name: string; meta: string; init: string; chip: string; chipBg: string; km: string }> = ({
  name,
  meta,
  init,
  chip,
  chipBg,
  km,
}) => (
  <div
    style={{
      background: C.jiss,
      border: `2px solid ${C.line}`,
      borderRadius: 10,
      padding: "16px 18px",
      display: "flex",
      gap: 16,
      alignItems: "center",
      direction: "rtl",
    }}
  >
    <div style={{ position: "relative", width: 76, flexShrink: 0 }}>
      <Logo id={`dc-${init}`} width={76} state={{ nails: [0, 0, 0, 0], archColor: C.tabuq, thresh: 0 }} />
      <div style={{ position: "absolute", top: 34, left: 0, right: 0, textAlign: "center", fontFamily: F.kufi, fontWeight: 800, fontSize: 30, color: C.lazurd }}>
        {init}
      </div>
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F.kufi, fontWeight: 700, fontSize: 26, color: C.lazurd }}>
        {name}
        <Seal size={24} />
      </div>
      <div style={{ fontFamily: F.plex, fontSize: 19, color: C.ramad, marginTop: 2 }}>{meta}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <span style={{ background: chipBg, color: C.jiss, fontFamily: F.plex, fontWeight: 600, fontSize: 16, padding: "3px 10px", borderRadius: 4 }}>{chip}</span>
        <span style={{ fontFamily: F.plex, fontSize: 17, color: C.ramad }}>{km}</span>
      </div>
    </div>
  </div>
);

const FloatChip: React.FC<{ at: number; side: "l" | "r"; top: number; icon: React.ReactNode; label: string; color: string }> = ({
  at,
  side,
  top,
  icon,
  label,
  color,
}) => (
  <div style={{ position: "absolute", top, [side === "l" ? "left" : "right"]: 36 }}>
    <In at={at} dx={side === "l" ? -120 : 120} dy={0} scale={0.9}>
      <div
        style={{
          background: C.jiss,
          borderRadius: 10,
          border: `2px solid ${C.line}`,
          boxShadow: "0 2px 0 rgba(27,58,122,0.08)",
          padding: "18px 26px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          direction: "rtl",
          borderInlineStart: `8px solid ${color}`,
        }}
      >
        {icon}
        <span style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 44, color }}>{label}</span>
      </div>
    </In>
  </div>
);

const SearchInner: React.FC = () => {
  const f = useG();
  const phoneIn = prog(f, 12.85, 0.6);
  return (
    <>
      <Lattice id="l4" opacity={0.045} />
      <Center top={175}>
        <Words
          size={66}
          words={[
            { w: "كل", at: v(12.59) },
            { w: "اللي", at: v(12.75) },
            { w: "تحتاجه…", at: v(12.9) },
            { w: "قريب", at: v(14.94), color: C.tabuq },
            { w: "منك", at: v(15.28), color: C.tabuq },
          ]}
        />
      </Center>
      <div style={{ position: "absolute", top: 380, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `translateY(${(1 - phoneIn) * 500}px)` }}>
        <Phone width={540}>
          <SlantHeader width={540 - 35} height={190}>
            <div style={{ fontFamily: F.plex, fontSize: 22, color: C.tabuq }}>هلا بيك</div>
            <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 38, color: C.jiss }}>شلون صحتك اليوم؟</div>
          </SlantHeader>
          <div style={{ position: "absolute", top: 250, left: 26, right: 26 }}>
            <div
              style={{
                background: C.jiss,
                border: `2px solid ${C.line}`,
                borderRadius: 10,
                padding: "14px 18px",
                fontFamily: F.plex,
                fontSize: 22,
                color: C.qeer,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24">
                <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke={C.lazurd} strokeWidth="2.2" />
                <path d="M15.5 15.5 L21 21" stroke={C.tabuq} strokeWidth="2.6" />
              </svg>
              {f < 13.15 * 30 ? (
                <span style={{ color: C.ramad }}>دوّر على طبيب، صيدلية، أو دواء</span>
              ) : (
                <Typed text="باطنية · الكرادة" at={13.15} cps={18} />
              )}
            </div>
            <In at={14.95} dy={20}>
              <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 26, color: C.lazurd, margin: "26px 4px 12px" }}>أطباء قريبين منك</div>
            </In>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <In at={15.05} dx={-200} dy={0}>
                <DoctorCard name="د. سلام حسن" meta="باطنية · الكرادة" init="س" chip="موجود اليوم" chipBg={C.nakheel} km={`${ar("1.2")} كم`} />
              </In>
              <In at={15.25} dx={-200} dy={0}>
                <DoctorCard name="د. زينب كاظم" meta="أطفال · المنصور" init="ز" chip="باقي ٦ مقاعد" chipBg={C.kashi} km={`${ar("2.4")} كم`} />
              </In>
            </div>
            <In at={15.5} dy={20}>
              <div style={{ marginTop: 18, background: "#E9DCC4", borderRadius: 10, padding: "14px 18px", borderInlineStart: `6px solid ${C.tabuq}` }}>
                <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 22, color: C.lazurd }}>صيدلية النخيل · مفتوحة</div>
                <div style={{ fontFamily: F.plex, fontSize: 18, color: C.ramad }}>توصيل للبيت خلال ساعة</div>
              </div>
            </In>
          </div>
          {/* bottom nav */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 70,
              background: C.jiss,
              borderTop: `2px solid ${C.line}`,
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              fontFamily: F.plex,
              fontSize: 17,
              color: C.ramad,
            }}
          >
            <span style={{ color: C.lazurd, fontWeight: 600 }}>الرئيسية</span>
            <span>حجوزاتي</span>
            <span>ملفي</span>
            <span>المنتدى</span>
          </div>
        </Phone>
      </div>
      <FloatChip at={v(13.5)} side="r" top={560} icon={<IconDoctor size={64} />} label="طبيب" color={C.lazurd} />
      <FloatChip at={v(13.88)} side="l" top={830} icon={<IconPharmacy size={64} />} label="صيدلية" color={C.nakheel} />
      <FloatChip at={v(14.45)} side="r" top={1100} icon={<IconPill size={64} />} label="دواء" color={C.kashi} />
      <div style={{ position: "absolute", top: 1330, left: 70 }}>
        <In at={v(14.94)} dy={-80}>
          <svg width="74" height="110" viewBox="0 0 30 44">
            {/* map pin: the nail's head */}
            <path d="M15 43 L11.5 18 A11 11 0 1 1 18.5 18 Z" fill={C.ajur} />
            <circle cx="15" cy="11" r="4.5" fill={C.jiss} />
          </svg>
        </In>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════ 5. Booking card — «احجز دورك وانت ببيتك»
const Barcode: React.FC<{ p: number }> = ({ p }) => {
  const bars = Array.from({ length: 46 }).map((_, i) => ((i * 37) % 7) + 1);
  return (
    <div style={{ display: "flex", gap: 4, height: 110, justifyContent: "center", direction: "ltr" }}>
      {bars.map((b, i) => (
        <div key={i} style={{ width: b > 4 ? 7 : 3, background: C.qeer, height: "100%", opacity: i / bars.length < p ? 1 : 0.06 }} />
      ))}
    </div>
  );
};

const BookingInner: React.FC = () => {
  const f = useG();
  const t = f / 30;
  const card = prog(f, 16.35, 0.65);
  const n = Math.round(interpolate(t, [v(18.1), v(18.75)], [1, 12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const scan = prog(f, 20.0, 0.45, easeInOut);
  return (
    <>
      <BrickPattern id="b5" color={C.teen} opacity={0.06} offset={f * 0.5} />
      <Center top={200}>
        <Words
          size={74}
          color={C.teen}
          words={[
            { w: "احجز", at: v(15.89) },
            { w: "دورك", at: v(16.62), color: C.tabuq },
            { w: "وانت", at: v(16.92) },
            { w: "ببيتك", at: v(17.24) },
          ]}
        />
      </Center>
      <div
        style={{
          position: "absolute",
          top: 400,
          left: 130,
          right: 130,
          transform: `translateY(${(1 - card) * 700}px) rotate(${(1 - card) * -4}deg)`,
          opacity: Math.min(1, card * 2),
        }}
      >
        <div style={{ background: C.jiss, borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 0 rgba(0,0,0,0.08)" }}>
          <div
            style={{
              background: C.tabuq,
              padding: "26px 40px",
              display: "flex",
              justifyContent: "space-between",
              fontFamily: F.kufi,
              fontWeight: 800,
              fontSize: 36,
              color: C.lazurd,
            }}
          >
            <span>د. سلام حسن</span>
            <span style={{ fontFamily: F.plex, fontWeight: 600 }}>السبت {ar(14)} / {ar(11)}</span>
          </div>
          <div style={{ padding: "26px 40px 34px", textAlign: "center" }}>
            <div style={{ fontFamily: F.plex, fontSize: 32, color: C.ramad }}>رقمك</div>
            <div style={{ fontFamily: F.logo, fontWeight: 700, fontSize: 260, lineHeight: 1.05, color: C.lazurd, transform: `scale(${1 + 0.06 * (1 - prog(f, v(18.75), 0.3))})` }}>
              {ar(n)}
            </div>
            <In at={v(19.24)} dy={20}>
              <div style={{ fontFamily: F.plex, fontWeight: 500, fontSize: 34, color: C.qeer }}>
                قبلك {ar(3)} مراجعين · تقريباً {ar(25)} دقيقة
              </div>
            </In>
            <div style={{ borderTop: `3px dashed ${C.tabuq}`, margin: "30px -10px 30px" }} />
            <Barcode p={scan} />
            <div style={{ fontFamily: F.plex, fontSize: 24, color: C.ramad, marginTop: 10, direction: "ltr" }}>DR-2611-0012</div>
          </div>
        </div>
        {/* scan line */}
        {scan > 0 && scan < 1 && (
          <div style={{ position: "absolute", bottom: 74, height: 130, width: 6, background: C.ajur, left: `${mix(scan, 8, 92)}%`, opacity: 0.85, boxShadow: `0 0 0 2px ${C.ajur}33` }} />
        )}
      </div>
      <Center top={1450}>
        <Words
          size={50}
          weight={700}
          color={C.teen}
          words={[
            { w: "تعرف", at: v(18.16) },
            { w: "رقمك،", at: v(18.64), color: C.tabuq },
            { w: "وكم", at: v(19.24) },
            { w: "واحد", at: v(19.74) },
            { w: "قبلك", at: v(20.08), color: C.tabuq },
          ]}
        />
      </Center>
    </>
  );
};

// ═══════════════════════════════════════════════ 6. Reminder — «ودواك؟ إحنا نذكّرك بوقته»
const ReminderInner: React.FC = () => {
  const f = useG();
  const turn = prog(f, 21.05, 0.9, easeInOut);
  const notif = prog(f, 21.3, 0.55);
  return (
    <>
      <Lattice id="l6" opacity={0.045} />
      <Center top={250}>
        <div style={{ position: "relative" }}>
          <IconClock size={460} minuteAngle={mix(turn, -220, 0)} hourAngle={mix(turn, 150, 240)} draw={prog(f, 21.0, 0.5)} />
        </div>
      </Center>
      <div style={{ position: "absolute", top: mix(notif, -300, 770), left: 70, right: 70 }}>
        <div
          style={{
            background: C.jiss,
            borderRadius: 10,
            border: `2px solid ${C.line}`,
            boxShadow: "0 2px 0 rgba(27,58,122,0.08)",
            padding: "28px 32px",
            display: "flex",
            alignItems: "center",
            gap: 26,
            borderInlineStart: `10px solid ${C.tabuq}`,
          }}
        >
          <div style={{ background: C.lazurd, borderRadius: 14, width: 110, height: 110, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IconPill size={74} color={C.teen} accent={C.tabuq} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.plex, fontSize: 24, color: C.ramad }}>
              <span>دكتورنا · تنبيه الدواء</span>
              <span>الآن</span>
            </div>
            <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 42, color: C.lazurd, marginTop: 4 }}>وقت علاجك · {ar("8:00")} المساء</div>
            <div style={{ fontFamily: F.plex, fontWeight: 500, fontSize: 34, color: C.qeer, marginTop: 2 }}>حبّة وحدة بعد العشا</div>
          </div>
        </div>
      </div>
      <Center top={1120}>
        <Words size={120} words={[{ w: "ودواك؟", at: v(20.8) }]} />
      </Center>
      <Center top={1320}>
        <Words
          size={64}
          weight={700}
          color={C.ramad}
          words={[
            { w: "إحنا", at: v(21.96) },
            { w: "نذكّرك", at: v(22.52), color: C.lazurd },
            { w: "بوقته", at: v(23.0), color: C.lazurd },
          ]}
        />
      </Center>
    </>
  );
};

// ═══════════════════════════════════════════════ 7. Medical file — «ملفك الطبي… كله بمكان واحد»
const FileInner: React.FC = () => {
  const f = useG();
  const line = prog(f, 24.35, 1.8, easeInOut);
  const entries = [
    { at: 24.6, date: "١٢ تشرين الثاني", title: "تحليل CBC", where: "المختبر", color: C.kashi, icon: <IconLab size={46} /> },
    { at: 25.0, date: "١٠ تشرين الثاني", title: "Paracetamol 500", where: "صيدلية النخيل", color: C.nakheel, icon: <IconPharmacy size={46} /> },
    { at: 25.4, date: "٨ تشرين الثاني", title: "مراجعة باطنية", where: "د. سلام حسن", color: C.lazurd, icon: <IconDoctor size={46} /> },
    { at: 25.8, date: "٢ تشرين الثاني", title: "حجز رقم ١٢", where: "بطاقة الحجز", color: C.tabuq, icon: <IconTicket size={46} /> },
  ];
  return (
    <>
      <Center top={180}>
        <Words
          size={96}
          words={[
            { w: "ملفك", at: v(23.76) },
            { w: "الطبي", at: v(24.56), color: C.tabuq },
          ]}
        />
      </Center>
      <div style={{ position: "absolute", top: 390, left: 90, right: 90 }}>
        <In at={24.15} dy={60}>
          <div style={{ background: C.jiss, borderRadius: 10, border: `2px solid ${C.line}`, padding: "34px 40px 30px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 26 }}>
              <IconFile size={64} />
              <div>
                <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 38, color: C.lazurd }}>الملف الطبي</div>
                <div style={{ fontFamily: F.plex, fontSize: 26, color: C.ramad }}>كل زيارة، تحليل، ودواء</div>
              </div>
            </div>
            <div style={{ position: "relative", paddingInlineStart: 64 }}>
              {/* vertical lazurd timeline */}
              <div style={{ position: "absolute", top: 10, insetInlineStart: 18, width: 6, height: `${line * 96}%`, background: C.lazurd }} />
              {entries.map((e, i) => {
                const p = prog(f, e.at, 0.45);
                return (
                  <div key={i} style={{ position: "relative", marginBottom: 22, opacity: Math.min(1, p * 2), transform: `translateX(${(1 - p) * -60}px)` }}>
                    <div style={{ position: "absolute", insetInlineStart: -58, top: 30, width: 26, height: 26, background: C.jiss, border: `6px solid ${e.color}`, transform: "rotate(45deg)" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 18, background: C.teen, borderRadius: 10, padding: "16px 20px", borderInlineStart: `8px solid ${e.color}` }}>
                      {e.icon}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: F.plex, fontSize: 22, color: C.ramad }}>{e.date}</div>
                        <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 32, color: C.qeer }}>{e.title}</div>
                      </div>
                      <div style={{ fontFamily: F.plex, fontWeight: 600, fontSize: 24, color: e.color }}>{e.where}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <In at={26.2} dy={20}>
              <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 6 }}>
                <SlantButton w={340} h={74} bg={C.kashi} color={C.jiss} size={30}>
                  تحميل PDF
                </SlantButton>
              </div>
            </In>
          </div>
        </In>
      </div>
      <Center top={1460}>
        <Words
          size={60}
          weight={700}
          color={C.lazurd}
          words={[
            { w: "كله", at: v(25.44) },
            { w: "بمكان", at: v(25.76) },
            { w: "واحد", at: v(26.24), color: C.tabuq },
          ]}
        />
      </Center>
    </>
  );
};

// ═══════════════════════════════════════════════ 8. Trust & voice — «أطباء موثّقين، وكلام يشبه أهلنا»
const Bubble: React.FC<{ at: number; side: "l" | "r"; text: string; bg: string; color: string }> = ({ at, side, text, bg, color }) => (
  <div style={{ display: "flex", justifyContent: side === "r" ? "flex-start" : "flex-end", direction: "rtl" }}>
    <In at={at} dx={side === "r" ? 80 : -80} dy={10}>
      <div
        style={{
          background: bg,
          color,
          fontFamily: F.plex,
          fontWeight: 600,
          fontSize: 40,
          padding: "22px 34px",
          borderRadius: 10,
          borderStartStartRadius: side === "r" ? 0 : 10,
          borderStartEndRadius: side === "l" ? 0 : 10,
          maxWidth: 760,
        }}
      >
        {text}
      </div>
    </In>
  </div>
);

const TrustInner: React.FC = () => {
  const f = useG();
  const sealP = prog(f, 28.0, 0.22, easeIn);
  const out = prog(f, 31.0, 0.35, easeIn);
  return (
    <>
      <BrickPattern id="b8" color={C.teen} opacity={0.06} />
      <AbsoluteFill style={{ transform: `scale(${mix(out, 1, 0.9)})`, opacity: 1 - out }}>
        <Center top={175}>
          <Words
            size={92}
            color={C.teen}
            words={[
              { w: "أطباء", at: v(26.96) },
              { w: "موثّقين", at: v(27.73), color: C.tabuq },
            ]}
          />
        </Center>
        <div style={{ position: "absolute", top: 380, left: 110, right: 110 }}>
          <In at={27.25} dy={60}>
            <div style={{ background: C.jiss, borderRadius: 10, padding: "34px 36px", display: "flex", gap: 30, alignItems: "center", position: "relative" }}>
              <div style={{ position: "relative", width: 190, flexShrink: 0 }}>
                <Logo id="doc-face" width={190} state={{ nails: [0, 0, 0, 0], archColor: C.tabuq }} />
                <div style={{ position: "absolute", top: 90, left: 0, right: 0, textAlign: "center", fontFamily: F.kufi, fontWeight: 800, fontSize: 80, color: C.lazurd }}>س</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 50, color: C.lazurd }}>د. سلام حسن</div>
                <div style={{ fontFamily: F.plex, fontSize: 32, color: C.ramad, marginTop: 4 }}>باطنية · الكرادة، بغداد</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, opacity: sealP }}>
                  <span style={{ fontFamily: F.plex, fontWeight: 600, fontSize: 28, color: C.nakheel }}>طبيب موثّق من النقابة</span>
                </div>
              </div>
              {/* the seal stamps onto the card */}
              <div
                style={{
                  position: "absolute",
                  top: -46,
                  left: -30,
                  transform: `scale(${mix(sealP, 2.6, 1)}) rotate(${mix(sealP, -40, -8)}deg)`,
                  opacity: sealP,
                }}
              >
                <Seal size={150} nails={prog(f, 28.15, 0.45)} />
              </div>
            </div>
          </In>
        </div>
        <Ring at={28.22} x={170} y={420} max={420} dur={0.8} />
        <div style={{ position: "absolute", top: 830, left: 90, right: 90, display: "flex", flexDirection: "column", gap: 26 }}>
          <Bubble at={v(28.75)} side="r" text="هلا بيك، شلون صحتك اليوم؟" bg={C.jiss} color={C.lazurd} />
          <Bubble at={v(29.35)} side="l" text="تم. دورك رقم ١٢ عند د. سلام" bg={C.tabuq} color={C.lazurd} />
          <Bubble at={v(29.95)} side="r" text="الله يشافيك" bg={C.jiss} color={C.lazurd} />
        </div>
        <Center top={1420}>
          <Words
            size={58}
            weight={700}
            color={C.teen}
            words={[
              { w: "وكلام", at: v(28.75) },
              { w: "يشبه", at: v(29.63) },
              { w: "أهلنا", at: v(30.28), color: C.tabuq },
            ]}
          />
        </Center>
      </AbsoluteFill>
    </>
  );
};

// ═══════════════════════════════════════════════ 9. CTA — «نزّل دكتورنا هسه… الحكيم موجود»
const FIN = 31.72;
const CtaInner: React.FC = () => {
  const f = useG();
  const hit = prog(f, FIN, 0.4);
  const btn = prog(f, 34.55, 0.5);
  const press = interpolate(f / 30, [35.15, 35.25, 35.45], [1, 0.95, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shine = interpolate(f / 30, [35.2, 35.9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const settle = prog(f, 36.0, 2.0, (x) => x);
  return (
    <>
      <BrickPattern id="b9" color={C.teen} opacity={0.07} offset={-f * 0.4} />
      <div style={{ position: "absolute", top: 150, left: 0, right: 0 }}>
        <NailRow count={14} size={34} color={C.tabuq} reveal={prog(f, 31.8, 1.2)} gap={36} />
      </div>
      <Ring at={FIN} x={540} y={560} max={1100} />
      <Ring at={FIN + 0.1} x={540} y={560} max={800} color={C.teen} />
      <AbsoluteFill style={{ transform: `scale(${mix(settle, 1, 1.03)})` }}>
        <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: hit, transform: `scale(${mix(hit, 1.35, 1)})` }}>
          <Logo id="cta" width={300} />
        </div>
        <Center top={760}>
          <div style={{ clipPath: slantClip(prog(f, v(31.72), 0.5), 220) }}>
            <Wordmark size={190} />
          </div>
        </Center>
        <Center top={1020}>
          <Words
            size={66}
            weight={700}
            color={C.teen}
            words={[
              { w: "نزّله", at: v(31.43) },
              { w: "هسه…", at: v(32.24), color: C.tabuq },
              { w: "الحكيم", at: v(32.82) },
              { w: "موجود", at: v(33.85), color: C.tabuq },
            ]}
          />
        </Center>
        <div style={{ position: "absolute", top: 1200, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ opacity: btn, transform: `translateY(${(1 - btn) * 80}px) scale(${press})` }}>
            <SlantButton w={700} h={128} bg={C.tabuq} color={C.lazurd} size={52} shine={shine}>
              نزّل التطبيق مجاناً
            </SlantButton>
          </div>
        </div>
        <Center top={1365}>
          <In at={34.9} dy={20}>
            <div style={{ fontFamily: F.plex, fontWeight: 500, fontSize: 34, color: C.teen, opacity: 0.85, display: "flex", gap: 18, alignItems: "center" }}>
              <span>متوفر على</span>
              <span style={{ fontWeight: 600, direction: "ltr" }}>App Store</span>
              <Nail size={22} color={C.tabuq} />
              <span style={{ fontWeight: 600, direction: "ltr" }}>Google Play</span>
            </div>
          </In>
        </Center>
      </AbsoluteFill>
    </>
  );
};

// ═══════════════════════════════════════════════ Timeline
export const Scenes: React.FC = () => (
  <>
    <Scene name="1 · Hook" start={0} end={4.5} bg={C.lazurd}>
      <HookInner />
    </Scene>
    <Scene name="2 · Waiting" start={4.0} end={8.4} bg={C.teen} enter={{ type: "slant", at: 4.0, dur: 0.42 }}>
      <WaitInner />
    </Scene>
    <Scene name="3 · Reveal" start={7.5} end={13.15} bg={C.lazurd} enter={{ type: "arch", at: 7.55, dur: 0.75 }} exit={{ type: "push", at: 12.72 }}>
      <RevealInner />
    </Scene>
    <Scene name="4 · Search" start={12.72} end={16.5} bg={C.teen} enter={{ type: "push", at: 12.72 }}>
      <SearchInner />
    </Scene>
    <Scene name="5 · Booking" start={15.95} end={21.4} bg={C.lazurd} enter={{ type: "slant", at: 15.95, dur: 0.42 }} exit={{ type: "push", at: 20.92 }}>
      <BookingInner />
    </Scene>
    <Scene name="6 · Reminder" start={20.92} end={24.3} bg={C.teen} enter={{ type: "push", at: 20.92 }}>
      <ReminderInner />
    </Scene>
    <Scene name="7 · Medical file" start={23.82} end={27.5} bg={C.teen} enter={{ type: "slant", at: 23.82, dur: 0.42 }} exit={{ type: "push", at: 27.05 }}>
      <AbsoluteFill style={{ background: C.jiss }} />
      <Lattice id="l7" opacity={0.04} />
      <FileInner />
    </Scene>
    <Scene name="8 · Trust" start={27.05} end={31.4} bg={C.lazurd} enter={{ type: "push", at: 27.05 }}>
      <TrustInner />
    </Scene>
    <Scene name="9 · CTA" start={31.1} end={38} bg={C.lazurd} enter={{ type: "arch", at: 31.1, dur: 0.62 }}>
      <CtaInner />
    </Scene>
  </>
);
