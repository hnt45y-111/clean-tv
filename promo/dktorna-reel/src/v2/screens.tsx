// The 16 app screens, one per feature — built from the guide's rules:
// teen background, lazurd header tilted 9°, faces inside arches, slanted buttons,
// 4px tile corners, section colours (lazurd/nakheel/kashi/teen/ajur).
import React from "react";
import { interpolate } from "remotion";
import { C, F, mix } from "../brand";
import { IconClock, IconDoctor, IconFile, IconLab, IconPharmacy, IconPill, IconTicket, Logo, Seal } from "../components";
import {
  AppHeader,
  ArchFace,
  Barcode,
  BottomNav,
  Btn,
  Card,
  Chip,
  DocRow,
  Field,
  NailRating,
  Pop,
  Screen,
  SectionTitle,
  Type,
  ar,
  lp,
  useClock,
} from "./ui";

const Body: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 0 }) => (
  <div style={{ padding: "0 18px", marginTop: top, display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
);

// 01 ─ Account & login
const Account: React.FC = () => {
  const { t, c, vo } = useClock();
  const role = t < c[1] ? 0 : t < c[2] ? 1 : 2;
  const roles = ["مريض", "طبيب", "صيدلية"];
  const found = lp(t, c[3] - 0.5, 0.5);
  return (
    <Screen>
      <div style={{ height: 250, background: C.lazurd, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Logo id="acc" width={74} />
        <div style={{ fontFamily: F.logo, fontSize: 34, color: C.teen }}>دكتورنا</div>
      </div>
      <Body top={18}>
        <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 20, color: C.lazurd }}>هلا بيك، سجّل دخولك</div>
        <div style={{ display: "flex", background: C.jiss, border: `1px solid ${C.line}`, borderRadius: 4, padding: 4, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: 4,
              bottom: 4,
              width: "calc((100% - 8px) / 3)",
              right: `calc(4px + ${mix(lp(t, c[role] - 0.15, 0.3), role === 0 ? 0 : role - 1, role)} * (100% - 8px) / 3)`,
              background: C.lazurd,
              borderRadius: 3,
            }}
          />
          {roles.map((r, i) => (
            <div key={r} style={{ flex: 1, textAlign: "center", padding: "9px 0", position: "relative", fontWeight: 600, fontSize: 15, color: i === role ? C.jiss : C.ramad }}>
              {r}
            </div>
          ))}
        </div>
        <Field label="الاسم الثلاثي" focus={t > vo + 0.3 && t < c[2]}>
          <Type text="زينب علي حسين" at={vo + 0.4} cps={12} caret={t < c[2]} />
        </Field>
        <Field label="رقم الهاتف" focus={t >= c[2] && found < 1}>
          <span style={{ direction: "ltr", display: "inline-block" }}>
            <Type text="0770 123 4567" at={c[2]} cps={14} caret={found <= 0} />
          </span>
        </Field>
        <div style={{ opacity: found, transform: `translateY(${(1 - found) * 20}px)` }}>
          <Card accent={C.nakheel} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <IconFile size={30} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 14, color: C.nakheel }}>لقينا سجلّك</div>
              <div style={{ fontSize: 12, color: C.ramad }}>سجّلك د. سلام حسن · ٣ زيارات سابقة</div>
            </div>
          </Card>
        </div>
        <Btn press={interpolate(t, [c[3] + 0.6, c[3] + 0.75, c[3] + 0.95], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} style={{ marginTop: 4 }}>
          دخول
        </Btn>
      </Body>
    </Screen>
  );
};

// 02 ─ Doctor profile
const MapSnip: React.FC<{ pin: number }> = ({ pin }) => (
  <div style={{ height: 120, borderRadius: 4, overflow: "hidden", position: "relative", background: "#E6DCC8", border: `1px solid ${C.line}` }}>
    <svg width="100%" height="100%" viewBox="0 0 354 120" preserveAspectRatio="none">
      <path d="M0 80 C80 70 120 100 200 60 S320 40 354 50" stroke={C.jiss} strokeWidth="12" fill="none" />
      <path d="M120 0 L150 120 M260 0 L240 120 M0 30 L354 20" stroke={C.jiss} strokeWidth="7" fill="none" />
      <path d="M0 105 C90 95 200 120 354 98" stroke="#BFD3D3" strokeWidth="10" fill="none" />
    </svg>
    <div style={{ position: "absolute", left: "52%", top: mix(pin, -30, 22), opacity: pin }}>
      <svg width="26" height="40" viewBox="0 0 30 44">
        <path d="M15 43 L11.5 18 A11 11 0 1 1 18.5 18 Z" fill={C.ajur} />
        <circle cx="15" cy="11" r="4.5" fill={C.jiss} />
      </svg>
    </div>
    <div style={{ position: "absolute", bottom: 6, right: 8, fontSize: 11, background: C.jiss, padding: "2px 6px", borderRadius: 3 }}>الكرادة · شارع ٦٢</div>
  </div>
);

const Doctor: React.FC = () => {
  const { t, c } = useClock();
  const seal = lp(t, c[1], 0.3);
  const filt = lp(t, c[2] - 1.0, 0.5);
  return (
    <Screen>
      <AppHeader title="" h={150} back />
      <div style={{ marginTop: -128, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
        <div style={{ position: "relative" }}>
          <ArchFace w={96} init="س" bg={C.teen} />
          <div style={{ position: "absolute", bottom: 2, left: -12, transform: `scale(${mix(seal, 2.2, 1)})`, opacity: seal }}>
            <Seal size={34} />
          </div>
        </div>
        <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 21, color: C.lazurd, marginTop: 6 }}>د. سلام حسن</div>
        <div style={{ fontSize: 13, color: C.ramad }}>اختصاص الباطنية · بورد عراقي</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
          <NailRating value={4.8} size={14} />
          <span style={{ fontSize: 12, color: C.ramad }}>{ar("4.8")} · ٢١٢ تقييم</span>
        </div>
      </div>
      <Body top={12}>
        <Pop at={c[0] - 0.4}>
          <MapSnip pin={lp(t, c[0], 0.5)} />
        </Pop>
        <div style={{ display: "flex", gap: 8, opacity: seal }}>
          <Chip bg={C.nakheel}>طبيب موثّق</Chip>
          <Chip outline bg={C.lazurd}>
            كشفية ٢٥٬٠٠٠ د.ع
          </Chip>
        </div>
        <div style={{ opacity: filt, transform: `translateY(${(1 - filt) * 16}px)` }}>
          <SectionTitle>أطباء مشابهين</SectionTitle>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <Chip>الباطنية ▾</Chip>
            <Chip outline>الكرادة ▾</Chip>
            <Chip outline bg={C.tabuq}>
              الأعلى تقييماً
            </Chip>
          </div>
          <DocRow name="د. زينب كاظم" meta="باطنية · الكرادة" init="ز" tag={<NailRating value={4.6} size={12} />} />
        </div>
      </Body>
    </Screen>
  );
};

// 03 ─ Clinic schedule
const Schedule: React.FC = () => {
  const { t, c, vo } = useClock();
  const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const hours: [number, number][] = [[0, 0], [14, 21], [14, 21], [16, 21], [14, 21], [14, 19], [10, 13]];
  const today = 2;
  return (
    <Screen>
      <AppHeader kicker="د. سلام حسن" title="جدول الدوام" />
      <Body top={10}>
        <Pop at={c[0] - 0.1} s={0.9}>
          <Card accent={C.nakheel} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IconClock size={34} color={C.nakheel} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 17, color: C.nakheel }}>موجود اليوم</div>
              <div style={{ fontSize: 13, color: C.ramad }}>من ٢ الظهر إلى ٩ المساء · باقي ١٤ مقعد</div>
            </div>
          </Card>
        </Pop>
        <SectionTitle>أيام الأسبوع</SectionTitle>
        {days.map((d, i) => {
          const p = lp(t, vo + 0.15 + i * 0.12, 0.45);
          const [a, b] = hours[i];
          const off = a === 0;
          return (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, opacity: p, transform: `translateX(${(1 - p) * -40}px)` }}>
              <div style={{ width: 62, fontSize: 13, fontWeight: i === today ? 700 : 400, color: i === today ? C.lazurd : C.qeer }}>{d}</div>
              <div style={{ flex: 1, height: 24, background: C.jiss, border: `1px solid ${C.line}`, borderRadius: 3, position: "relative", overflow: "hidden" }}>
                {off ? (
                  <div style={{ fontSize: 11, color: C.ajur, padding: "3px 8px" }}>عطلة</div>
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      bottom: 3,
                      right: `${((a - 8) / 15) * 100}%`,
                      width: `${(((b - a) / 15) * 100) * lp(t, vo + 0.3 + i * 0.12, 0.6)}%`,
                      background: i === today ? C.nakheel : C.lazurd,
                      borderRadius: 2,
                    }}
                  />
                )}
              </div>
              <div style={{ width: 54, fontSize: 11, color: C.ramad, direction: "ltr", textAlign: "left" }}>{off ? "—" : `${ar(a > 12 ? a - 12 : a)}–${ar(b - 12)}`}</div>
            </div>
          );
        })}
        <Pop at={c[1] - 0.2}>
          <Btn bg={C.nakheel} style={{ marginTop: 8 }}>
            احجز ليوم الاثنين
          </Btn>
        </Pop>
      </Body>
      <BottomNav active={0} />
    </Screen>
  );
};

// 04 ─ Booking
const Booking: React.FC = () => {
  const { t, c } = useClock();
  const n = Math.round(interpolate(t, [c[0] - 0.3, c[0] + 0.4], [1, 12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const card = lp(t, c[0] - 0.7, 0.55);
  const scan = lp(t, c[1] + 0.1, 0.7);
  const ok = lp(t, c[2] - 0.2, 0.4);
  return (
    <Screen>
      <AppHeader kicker="حجوزاتي" title="بطاقة الدور" />
      <Body top={14}>
        <div style={{ opacity: card, transform: `translateY(${(1 - card) * 60}px)` }}>
          <div style={{ background: C.jiss, border: `1px solid ${C.line}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.tabuq, padding: "10px 14px", display: "flex", justifyContent: "space-between", fontFamily: F.kufi, fontWeight: 700, fontSize: 14, color: C.lazurd }}>
              <span>د. سلام حسن</span>
              <span>الاثنين ١٦ / ١١</span>
            </div>
            <div style={{ padding: "8px 14px 14px", textAlign: "center", position: "relative" }}>
              <div style={{ fontSize: 13, color: C.ramad }}>رقمك</div>
              <div style={{ fontFamily: F.logo, fontSize: 118, lineHeight: 1.05, color: C.lazurd }}>{ar(n)}</div>
              <div style={{ fontSize: 13 }}>قبلك ٣ مراجعين · تقريباً ٢٥ دقيقة</div>
              <div style={{ borderTop: `2px dashed ${C.tabuq}`, margin: "12px -4px" }} />
              <div style={{ position: "relative" }}>
                <Barcode p={scan} h={52} />
                {scan > 0 && scan < 1 && <div style={{ position: "absolute", top: -6, bottom: -6, width: 3, background: C.ajur, left: `${scan * 100}%` }} />}
              </div>
              <div style={{ fontSize: 11, color: C.ramad, marginTop: 4, direction: "ltr" }}>DR-2611-0012</div>
              {ok > 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `rgba(46,107,78,${0.92 * ok})` }}>
                  <div style={{ textAlign: "center", color: C.jiss, transform: `scale(${mix(ok, 0.8, 1)})` }}>
                    <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 26 }}>تم تسجيل حضورك</div>
                    <div style={{ fontSize: 14 }}>تفضّل، الطبيب ينتظرك</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <Pop at={c[0] + 0.5}>
          <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: C.ramad }}>الدور الحالي بالعيادة</span>
            <span style={{ fontFamily: F.logo, fontSize: 24, color: C.nakheel }}>{ar(Math.min(9, 7 + Math.floor(Math.max(0, t - c[0]) / 1.2)))}</span>
          </Card>
        </Pop>
        <Btn bg={C.lazurd}>ورّي الباركود للسكرتير</Btn>
      </Body>
      <BottomNav active={1} />
    </Screen>
  );
};

// 05 ─ Clinic adds a walk-in patient (doctor side)
const Clinic: React.FC = () => {
  const { t, c, vo } = useClock();
  const print = lp(t, c[1], 0.9);
  const urgent = lp(t, c[2], 0.35);
  return (
    <Screen>
      <AppHeader kicker="لوحة العيادة · د. سلام" title="إضافة مراجع" color={C.lazurd} />
      <Body top={10}>
        <Field label="الاسم الثلاثي" focus={t < c[0] + 0.6}>
          <Type text="حسن جاسم محمد" at={vo + 0.6} cps={11} caret={t < c[0] + 0.5} />
        </Field>
        <Field label="رقم الهاتف" focus={t >= c[0] + 0.6 && t < c[1]}>
          <span style={{ direction: "ltr", display: "inline-block" }}>
            <Type text="0780 555 2190" at={c[0] + 0.5} cps={16} caret={t < c[1]} />
          </span>
        </Field>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: C.ramad }}>الرقم التسلسلي:</span>
          <span style={{ fontFamily: F.logo, fontSize: 26, color: C.lazurd }}>{urgent > 0.5 ? ar(4) : ar(19)}</span>
          <div style={{ opacity: urgent, transform: `scale(${mix(urgent, 1.6, 1)})` }}>
            <Chip bg={C.ajur}>حالة خاصة</Chip>
          </div>
        </div>
        <Btn bg={C.lazurd}>طباعة البطاقة</Btn>
        {/* printed ticket sliding out of the printer slot */}
        <div style={{ height: 230, overflow: "hidden", position: "relative" }}>
          <div style={{ height: 8, background: C.qeer, borderRadius: 4 }} />
          <div style={{ position: "absolute", top: 4, left: 30, right: 30, transform: `translateY(${mix(print, -230, 0)}px)` }}>
            <div style={{ background: "#fff", border: `1px solid ${C.line}`, padding: "10px 12px", textAlign: "center", boxShadow: "0 2px 0 rgba(0,0,0,.08)" }}>
              <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 12 }}>عيادة د. سلام حسن</div>
              <div style={{ fontSize: 11, color: C.ramad }}>حسن جاسم محمد</div>
              <div style={{ fontFamily: F.logo, fontSize: 64, lineHeight: 1.1, color: urgent > 0.5 ? C.ajur : C.qeer }}>{urgent > 0.5 ? ar(4) : ar(19)}</div>
              <Barcode h={34} />
            </div>
          </div>
        </div>
      </Body>
    </Screen>
  );
};

// 06 ─ Chat with the doctor
const Bubble: React.FC<{ me?: boolean; at: number; children: React.ReactNode }> = ({ me, at, children }) => (
  <div style={{ display: "flex", justifyContent: me ? "flex-start" : "flex-end" }}>
    <Pop at={at} dx={me ? 30 : -30} dy={6}>
      <div
        style={{
          maxWidth: 270,
          background: me ? C.lazurd : C.jiss,
          color: me ? C.jiss : C.qeer,
          border: me ? undefined : `1px solid ${C.line}`,
          borderRadius: 4,
          padding: "8px 11px",
          fontSize: 13.5,
          lineHeight: 1.6,
        }}
      >
        {children}
      </div>
    </Pop>
  </div>
);

const Chat: React.FC = () => {
  const { c, vo } = useClock();
  return (
    <Screen>
      <AppHeader title="د. سلام حسن" h={112}>
        <div style={{ fontSize: 12, color: C.tabuq }}>● متصل · المراسلة مفعّلة بموافقة الطبيب</div>
      </AppHeader>
      <Body top={8}>
        <Bubble me at={vo + 0.2}>
          دكتور، طلعتلي حساسية بالإيد من البارحة
        </Bubble>
        <Bubble me at={c[0] - 0.1}>
          <div style={{ width: 200, height: 110, borderRadius: 3, background: "#E2C6AC", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 40% 55%, rgba(178,74,44,.45) 0 12%, transparent 13%), radial-gradient(circle at 62% 40%, rgba(178,74,44,.35) 0 8%, transparent 9%)" }} />
            <div style={{ position: "absolute", bottom: 4, right: 6, fontSize: 10, color: C.jiss }}>صورة الحالة</div>
          </div>
        </Bubble>
        <Bubble at={c[1] - 0.1}>
          <b style={{ fontFamily: F.kufi, color: C.lazurd }}>التشخيص المبدئي:</b> التهاب جلدي تحسسي بسيط. لا تحك المنطقة.
        </Bubble>
        <Pop at={c[2] - 0.15}>
          <Card accent={C.nakheel} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IconPharmacy size={30} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 13.5, color: C.nakheel }}>الوصفة انرسلت للصيدلية</div>
              <div style={{ fontSize: 12, color: C.ramad, direction: "rtl" }}>Cetirizine 10mg · مرهم Hydrocortisone</div>
            </div>
          </Card>
        </Pop>
      </Body>
      <div style={{ position: "absolute", bottom: 14, left: 14, right: 14, display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: C.jiss, border: `1px solid ${C.line}`, borderRadius: 4, padding: "10px 12px", fontSize: 13, color: C.ramad }}>اكتب رسالتك…</div>
        <div style={{ width: 42, background: C.lazurd, borderRadius: 4, color: C.jiss, display: "flex", alignItems: "center", justifyContent: "center" }}>↑</div>
      </div>
    </Screen>
  );
};

// 07 ─ Pharmacies & delivery
const Pharmacy: React.FC = () => {
  const { t, c, vo } = useClock();
  const track = lp(t, c[2] - 0.3, 1.6);
  return (
    <Screen>
      <AppHeader kicker="الصيدليات" title="صيدلية النخيل" color={C.nakheel} />
      <Body top={8}>
        <Pop at={vo + 0.1}>
          <Card style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
            <span>الكادر: ٣ صيادلة</span>
            <span>مفتوحة لـ ١٢ بالليل</span>
            <span style={{ color: C.nakheel, fontWeight: 600 }}>توصيل ✓</span>
          </Card>
        </Pop>
        <Pop at={c[0] - 0.2}>
          <Card accent={C.nakheel} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <IconPill size={34} color={C.nakheel} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 14 }}>طلب دواء</div>
              <div style={{ fontSize: 12, color: C.ramad, direction: "rtl" }}>Cetirizine 10mg × ١ · Hydrocortisone × ١</div>
            </div>
            <Chip bg={C.nakheel}>أُرسل</Chip>
          </Card>
        </Pop>
        <Pop at={c[1] - 0.2}>
          <Card style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <ArchFace w={44} init="م" bg={C.nakheel} color={C.jiss} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 14, color: C.nakheel }}>صيدلي جوّال</div>
              <div style={{ fontSize: 12, color: C.ramad }}>م. مصطفى · يزورك للبيت لقياس الضغط والإبر</div>
            </div>
          </Card>
        </Pop>
        <Pop at={c[2] - 0.4}>
          <Card>
            <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>تتبّع التوصيل</div>
            <div style={{ position: "relative", height: 36 }}>
              <div style={{ position: "absolute", top: 16, left: 10, right: 10, height: 4, background: C.line }} />
              <div style={{ position: "absolute", top: 16, right: 10, width: `calc(${track * 100}% - ${track * 20}px)`, height: 4, background: C.nakheel }} />
              {["الصيدلية", "بالطريق", "باب دارك"].map((l, i) => (
                <div key={l} style={{ position: "absolute", right: `calc(${i * 50}% - ${i * 10}px)`, top: 10, textAlign: "center", width: 20 }}>
                  <div style={{ width: 14, height: 14, margin: "0 auto", transform: "rotate(45deg)", background: track >= i / 2 ? C.nakheel : C.jiss, border: `2px solid ${C.nakheel}` }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.ramad }}>
              <span>الصيدلية</span>
              <span>بالطريق</span>
              <span>باب دارك</span>
            </div>
          </Card>
        </Pop>
      </Body>
      <BottomNav active={0} />
    </Screen>
  );
};

// 08 ─ Medicine store
const Store: React.FC = () => {
  const { t, c, vo } = useClock();
  const items = [
    { n: "Amoxicillin 500mg", d: "كبسول · ٢٠ حبة", p: "٤٬٥٠٠" },
    { n: "Amoxiclav 625mg", d: "حبوب · ١٤ حبة", p: "٩٬٠٠٠" },
    { n: "Amoxil Syrup", d: "شراب أطفال · ١٠٠ مل", p: "٦٬٢٥٠" },
  ];
  const added = lp(t, c[1] + 0.2, 0.35);
  return (
    <Screen>
      <AppHeader kicker="منصة الأدوية" title="أسعار الأدوية العراقية" color={C.nakheel} />
      <Body top={8}>
        <Field focus>
          <span style={{ color: C.nakheel }}>⌕</span>
          <span style={{ direction: "ltr" }}>
            <Type text="Amox" at={vo + 0.2} cps={8} />
          </span>
        </Field>
        {items.map((it, i) => (
          <Pop key={it.n} at={c[0] - 0.4 + i * 0.18} dx={-30} dy={0}>
            <Card style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 4, background: C.teen, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconPill size={30} color={C.nakheel} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, direction: "ltr", textAlign: "right" }}>{it.n}</div>
                <div style={{ fontSize: 12, color: C.ramad }}>{it.d}</div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontFamily: F.kufi, fontWeight: 800, fontSize: 15, color: C.nakheel }}>{it.p}</div>
                <div style={{ fontSize: 10, color: C.ramad }}>دينار</div>
              </div>
            </Card>
          </Pop>
        ))}
        <Pop at={c[1] - 0.2}>
          <Btn bg={C.nakheel} press={interpolate(t, [c[1], c[1] + 0.12, c[1] + 0.3], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}>
            {added > 0.5 ? "✓ انضاف للسلة" : "أضف للسلة"}
          </Btn>
        </Pop>
      </Body>
      <div style={{ position: "absolute", bottom: 74, left: 18, opacity: added, transform: `scale(${mix(added, 1.5, 1)})` }}>
        <div style={{ background: C.lazurd, color: C.jiss, borderRadius: 4, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>السلة · ١ · ٤٬٥٠٠ د.ع</div>
      </div>
      <BottomNav active={0} />
    </Screen>
  );
};

// 09 ─ Patient medical record
const Record: React.FC = () => {
  const { t, c, vo } = useClock();
  const meds = [
    { n: "Metformin 500", d: "حبة الصبح · حبة بالليل", col: C.kashi },
    { n: "Amlodipine 5", d: "حبة وحدة بالصبح", col: C.nakheel },
  ];
  return (
    <Screen>
      <AppHeader kicker="ملفي الطبي" title="زينب علي حسين" />
      <Body top={6}>
        <Pop at={vo + 0.1}>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              ["فصيلة الدم", "O+"],
              ["الحساسية", "بنسلين"],
              ["المزمنة", "سكري"],
            ].map(([k, v]) => (
              <Card key={k} style={{ flex: 1, padding: 8, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.ramad }}>{k}</div>
                <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 14, color: k === "الحساسية" ? C.ajur : C.lazurd }}>{v}</div>
              </Card>
            ))}
          </div>
        </Pop>
        <Pop at={c[0] - 0.2}>
          <Card accent={C.lazurd} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <IconDoctor size={24} />
            <span>يطّلع عليه: د. سلام حسن · د. زينب كاظم</span>
          </Card>
        </Pop>
        <SectionTitle>الأدوية الحالية</SectionTitle>
        {meds.map((m, i) => (
          <Pop key={m.n} at={c[1] - 0.6 + i * 0.25} dx={-40} dy={0}>
            <Card style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 54, height: 54, borderRadius: 4, background: C.teen, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="38" height="38" viewBox="0 0 40 40">
                  <rect x="6" y="10" width="28" height="22" rx="2" fill={C.jiss} stroke={m.col} strokeWidth="2" />
                  <rect x="6" y="10" width="28" height="7" fill={m.col} />
                  <circle cx="15" cy="25" r="3" fill={m.col} opacity=".5" />
                  <circle cx="25" cy="25" r="3" fill={m.col} opacity=".5" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, direction: "ltr", textAlign: "right" }}>{m.n}</div>
                <div style={{ fontSize: 12, color: C.ramad }}>{m.d}</div>
              </div>
              <Chip outline bg={m.col}>
                تلقائي
              </Chip>
            </Card>
          </Pop>
        ))}
        <Pop at={c[2] - 0.2}>
          <Btn bg={C.kashi} press={interpolate(t, [c[2] + 0.1, c[2] + 0.22, c[2] + 0.4], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}>
            تحميل الملف PDF ↓
          </Btn>
        </Pop>
      </Body>
      <BottomNav active={2} />
    </Screen>
  );
};

// 10 ─ Lab requests
const Lab: React.FC = () => {
  const { t, c } = useClock();
  const steps = ["طلب الطبيب", "سحب العينة", "النتيجة جاهزة"];
  const stage = t < c[0] ? 0 : t < c[1] ? 1 : 2;
  const rows: [string, string, string, boolean][] = [
    ["HbA1c", "6.9 %", "4.0 – 5.6", true],
    ["Glucose (F)", "128 mg/dL", "70 – 100", true],
    ["Hemoglobin", "13.2 g/dL", "12 – 16", false],
    ["WBC", "7.1 ×10³", "4 – 11", false],
  ];
  return (
    <Screen>
      <AppHeader kicker="المختبر" title="طلب تحليل · د. سلام" color={C.kashi} />
      <Body top={8}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
            <div style={{ position: "absolute", top: 8, left: 30, right: 30, height: 3, background: C.line }} />
            <div style={{ position: "absolute", top: 8, right: 30, width: `calc(${(stage / 2) * lp(t, c[stage] - 0.3, 0.5) * 100}% - ${(stage / 2) * 60}px)`, height: 3, background: C.kashi }} />
            {steps.map((s, i) => (
              <div key={s} style={{ textAlign: "center", width: 80, position: "relative" }}>
                <div style={{ width: 14, height: 14, margin: "1px auto 6px", transform: "rotate(45deg)", background: i <= stage ? C.kashi : C.jiss, border: `2px solid ${C.kashi}` }} />
                <div style={{ fontSize: 11.5, color: i <= stage ? C.kashi : C.ramad, fontWeight: i === stage ? 700 : 400 }}>{s}</div>
              </div>
            ))}
          </div>
        </Card>
        <Pop at={c[1] - 0.1}>
          <Card accent={C.kashi} style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", fontFamily: F.kufi, fontWeight: 700, fontSize: 14, color: C.kashi, display: "flex", justifyContent: "space-between" }}>
              <span>نتيجة التحليل</span>
              <span style={{ fontFamily: F.plex, fontWeight: 400, fontSize: 12, color: C.ramad }}>مختبر الرافدين</span>
            </div>
            {rows.map(([k, v, r, hi], i) => {
              const p = lp(t, c[1] + 0.1 + i * 0.15, 0.4);
              return (
                <div key={k} style={{ display: "flex", padding: "8px 12px", borderTop: `1px solid ${C.line}`, fontSize: 12.5, direction: "ltr", opacity: p, background: i % 2 ? C.teen : C.jiss }}>
                  <span style={{ flex: 1.2 }}>{k}</span>
                  <span style={{ flex: 1, fontWeight: 700, color: hi ? C.ajur : C.qeer }}>{v}</span>
                  <span style={{ flex: 1, color: C.ramad }}>{r}</span>
                </div>
              );
            })}
          </Card>
        </Pop>
        <Pop at={c[2] - 0.2}>
          <div style={{ display: "flex", gap: 8 }}>
            <Card accent={C.lazurd} style={{ flex: 1, display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
              <IconFile size={22} /> انحفظت بملفك
            </Card>
            <Btn bg={C.kashi} h={42} style={{ width: 130 }}>
              PDF ↓
            </Btn>
          </div>
        </Pop>
      </Body>
    </Screen>
  );
};

// 11 ─ Alerts (shown on the lock screen)
const Alerts: React.FC = () => {
  const { t, c, vo } = useClock();
  const notes = [
    { at: c[0] - 0.3, title: "موعد مراجعتك باچر", body: "د. سلام حسن · الساعة ٥ العصر · رقمك ١٢", col: C.lazurd, icon: <IconTicket size={26} color={C.jiss} accent={C.tabuq} /> },
    { at: c[1] - 0.3, title: "وقت علاجك · ٨:٠٠ المساء", body: "Metformin 500 · حبة وحدة بعد العشا", col: C.ajur, icon: <IconPill size={26} color={C.jiss} accent={C.tabuq} />, img: true },
    { at: vo + 0.1, title: "باقي أسبوع على مراجعتك", body: "راح نذكّرك كل يوم لحد الموعد", col: C.tabuq, icon: <IconClock size={26} color={C.jiss} accent={C.lazurd} /> },
  ].sort((a, b) => a.at - b.at);
  const time = "8:00";
  return (
    <Screen bg={C.lazurd}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.08 }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="lockb" width="48" height="24" patternUnits="userSpaceOnUse">
              <path d="M0 0.5 H48 M0 12.5 H48 M0.5 0 V12 M24.5 12 V24" stroke={C.teen} strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lockb)" />
        </svg>
      </div>
      <div style={{ position: "relative", textAlign: "center", color: C.teen, marginTop: 70 }}>
        <div style={{ fontSize: 15 }}>الاثنين ١٦ تشرين الثاني</div>
        <div style={{ fontFamily: F.logo, fontSize: 92, lineHeight: 1.15, direction: "ltr" }}>{ar(time)}</div>
      </div>
      <div style={{ position: "relative", padding: "0 14px", display: "flex", flexDirection: "column-reverse", gap: 10, marginTop: 30 }}>
        {notes.map((n, i) => {
          const p = lp(t, n.at, 0.5);
          return (
            <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * -60}px) scale(${mix(p, 0.92, 1)})` }}>
              <div style={{ background: "rgba(251,246,236,0.96)", borderRadius: 6, padding: 12, display: "flex", gap: 10, borderInlineStart: `5px solid ${n.col}` }}>
                <div style={{ width: 44, height: 44, background: n.col, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.ramad }}>
                    <span>دكتورنا</span>
                    <span>الآن</span>
                  </div>
                  <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 14, color: C.qeer }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: C.ramad, direction: "rtl" }}>{n.body}</div>
                </div>
                {n.img && (
                  <div style={{ width: 44, height: 44, borderRadius: 4, background: C.teen, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconPill size={28} color={C.kashi} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
};

// 12 ─ Voice assistant
const Voice: React.FC = () => {
  const { t, c } = useClock();
  const listening = t > c[0] && t < c[1] + 0.2;
  const said = "«احجزلي عند الدكتور سلام، يوم الأحد، الساعة خمسة»";
  const done = lp(t, c[1] + 0.25, 0.45);
  return (
    <Screen bg={C.qeer}>
      <div style={{ position: "relative", padding: "80px 22px 0", color: C.teen }}>
        <div style={{ fontSize: 13, color: C.tabuq, direction: "ltr", textAlign: "right" }}>Google Assistant · Siri</div>
        <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 21, lineHeight: 1.7, marginTop: 14, minHeight: 150 }}>
          <Type text={said} at={c[0] + 0.15} cps={15} caret={listening} />
        </div>
      </div>
      {/* waveform made of nails */}
      <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", gap: 6, height: 120, marginTop: 10 }}>
        {Array.from({ length: 15 }).map((_, i) => {
          const a = listening ? 0.35 + 0.65 * Math.abs(Math.sin(t * 9 + i * 0.9) * Math.cos(t * 4.3 + i * 0.4)) : 0.12;
          return <div key={i} style={{ width: 8, height: 100 * a, background: i % 3 === 1 ? C.tabuq : C.teen, borderRadius: 1 }} />;
        })}
      </div>
      <div style={{ position: "relative", padding: "20px 18px", opacity: done, transform: `translateY(${(1 - done) * 40}px)` }}>
        <div style={{ background: C.jiss, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ background: C.lazurd, color: C.jiss, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, fontFamily: F.kufi, fontWeight: 700, fontSize: 14 }}>
            <Logo id="va" width={20} /> دكتورنا · تم الحجز
          </div>
          <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <ArchFace w={50} init="س" />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 15, color: C.lazurd }}>د. سلام حسن</div>
              <div style={{ fontSize: 12.5, color: C.ramad }}>الأحد · الساعة ٥ العصر</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.ramad }}>رقمك</div>
              <div style={{ fontFamily: F.logo, fontSize: 36, color: C.lazurd, lineHeight: 1 }}>{ar(7)}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: "50%",
            background: listening ? C.tabuq : C.lazurd,
            boxShadow: listening ? `0 0 0 ${10 + 6 * Math.sin(t * 8)}px rgba(201,160,99,.25)` : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24">
            <rect x="9" y="3" width="6" height="11" rx="3" fill={C.jiss} />
            <path d="M5.5 11 C5.5 15 8.5 17.5 12 17.5 C15.5 17.5 18.5 15 18.5 11 M12 17.5 V21" stroke={C.jiss} strokeWidth="2" fill="none" />
          </svg>
        </div>
      </div>
    </Screen>
  );
};

// 13 ─ Ratings
const Rating: React.FC = () => {
  const { t, c, vo } = useClock();
  const fill = lp(t, c[0] - 0.1, 0.9);
  const bars = [78, 14, 5, 2, 1];
  return (
    <Screen>
      <AppHeader kicker="التقييم" title="قيّم زيارتك" color={C.lazurd} />
      <Body top={8}>
        <Card style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ textAlign: "center", width: 90 }}>
            <div style={{ fontFamily: F.logo, fontSize: 48, color: C.lazurd, lineHeight: 1.1 }}>{ar((4.8 * Math.min(1, fill * 1.3)).toFixed(1))}</div>
            <NailRating value={4.8} fill={fill} size={14} />
            <div style={{ fontSize: 11, color: C.ramad, marginTop: 2 }}>٢١٢ تقييم</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            {bars.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <span style={{ width: 10 }}>{ar(5 - i)}</span>
                <div style={{ flex: 1, height: 7, background: C.line, borderRadius: 2 }}>
                  <div style={{ width: `${b * lp(t, vo + 0.2 + i * 0.08, 0.7)}%`, height: "100%", background: C.tabuq, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <SectionTitle>آراء المراجعين</SectionTitle>
        {[
          { n: "أم علي", r: 5, txt: "طبيب ذوق ويسمع للمريض، والدور مرتب ما انتظرت." },
          { n: "حيدر ك.", r: 5, txt: "التطبيق ذكّرني بالموعد، والصيدلية جابت الدوا للبيت." },
          { n: "سارة م.", r: 4, txt: "العيادة نظيفة والانتظار قليل." },
        ].map((r, i) => (
          <Pop key={r.n} at={c[0] + 0.5 + i * 0.45} dx={-30} dy={0}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 13 }}>{r.n}</span>
                <NailRating value={r.r} size={12} />
              </div>
              <div style={{ fontSize: 12.5, color: C.ramad, marginTop: 4 }}>{r.txt}</div>
            </Card>
          </Pop>
        ))}
      </Body>
    </Screen>
  );
};

// 14 ─ Forum & blog
const Forum: React.FC = () => {
  const { t, c } = useClock();
  const scroll = interpolate(t, [c[0], c[1]], [0, -170], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Screen>
      <AppHeader kicker="المجتمع" title="المنتدى والمدوّنة" h={120} />
      <div style={{ display: "flex", gap: 6, padding: "0 18px 8px" }}>
        <Chip bg={t < c[1] ? C.lazurd : C.ramad}>المنتدى</Chip>
        <Chip bg={t >= c[1] ? C.lazurd : C.ramad}>مدوّنة الأطباء</Chip>
      </div>
      <div style={{ transform: `translateY(${scroll}px)` }}>
        <Body>
          {[
            { u: "أبو مصطفى", q: "أحد جرب يحجز عند دكتور عيون بالمنصور؟ شنو رأيكم؟", r: "١٢ رد" },
            { u: "نور هـ.", q: "شكراً للي نصحني بدكتورة الأطفال، ابني صار أحسن", r: "٨ ردود" },
            { u: "علي ج.", q: "منو يعرف صيدلية خفارة بالكرادة الليلة؟", r: "٥ ردود" },
          ].map((p, i) => (
            <Pop key={p.u} at={c[0] - 0.4 + i * 0.3}>
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 26, height: 26, background: C.tabuq, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.lazurd }}>{p.u[0]}</div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.u}</span>
                  <span style={{ fontSize: 11, color: C.ramad, marginInlineStart: "auto" }}>{p.r}</span>
                </div>
                <div style={{ fontSize: 13 }}>{p.q}</div>
              </Card>
            </Pop>
          ))}
          <Pop at={c[1] - 0.3}>
            <Card accent={C.lazurd} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ height: 96, background: C.lazurd, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 20, top: 14 }}>
                  <IconDoctor size={64} color={C.teen} />
                </div>
                <div style={{ position: "absolute", right: 14, bottom: 10, color: C.teen, fontFamily: F.kufi, fontWeight: 800, fontSize: 16, width: 220 }}>٥ نصايح تحمي كليتك بالصيف</div>
              </div>
              <div style={{ padding: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <ArchFace w={34} init="ز" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 13, color: C.lazurd }}>
                    د. زينب كاظم <Seal size={14} />
                  </div>
                  <div style={{ fontSize: 11.5, color: C.ramad }}>طبيبة موثّقة · ٤ دقايق قراءة</div>
                </div>
              </div>
            </Card>
          </Pop>
        </Body>
      </div>
    </Screen>
  );
};

// 15 ─ Chronic diseases
const Chronic: React.FC = () => {
  const { t, c } = useClock();
  const tab = t < c[1] ? 0 : t < c[2] ? 1 : 2;
  const pts = [142, 136, 151, 128, 122, 131, 118, 115, 121, 112];
  const draw = lp(t, c[0], 1.6);
  const w = 330;
  const h = 120;
  const path = pts.map((v, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * w} ${h - ((v - 100) / 60) * h}`).join(" ");
  return (
    <Screen>
      <AppHeader kicker="دعم الأمراض المزمنة" title="رحلتك مع السكري" color={C.nakheel} />
      <div style={{ display: "flex", gap: 6, padding: "0 18px 10px" }}>
        {["السكري", "الضغط", "الربو"].map((l, i) => (
          <div key={l} style={{ transform: `scale(${i === tab ? 1.06 : 1})` }}>
            <Chip bg={i === tab ? C.nakheel : C.ramad}>{l}</Chip>
          </div>
        ))}
      </div>
      <Body>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.ramad, marginBottom: 6 }}>
            <span style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 13, color: C.qeer }}>السكر الصايم · آخر ١٠ أيام</span>
            <span style={{ color: C.nakheel, fontWeight: 600 }}>↓ يتحسن</span>
          </div>
          <svg width={w} height={h + 6} style={{ overflow: "visible" }}>
            <rect x="0" y={h - (30 / 60) * h} width={w} height={(30 / 60) * h} fill={C.nakheel} opacity=".08" />
            <path d={path} fill="none" stroke={C.nakheel} strokeWidth="2.5" strokeDasharray="600" strokeDashoffset={600 * (1 - draw)} />
            {pts.map((v, i) => (
              <rect key={i} x={(i / (pts.length - 1)) * w - 3.5} y={h - ((v - 100) / 60) * h - 3.5} width="7" height="7" transform={`rotate(45 ${(i / (pts.length - 1)) * w} ${h - ((v - 100) / 60) * h})`} fill={C.jiss} stroke={C.nakheel} strokeWidth="2" opacity={draw * (pts.length - 1) >= i ? 1 : 0} />
            ))}
          </svg>
        </Card>
        <Pop at={c[2] + 0.3}>
          <Card accent={C.tabuq}>
            <div style={{ fontFamily: F.kufi, fontWeight: 700, fontSize: 13.5, color: C.lazurd }}>نصيحة من د. زينب كاظم</div>
            <div style={{ fontSize: 12.5, color: C.ramad }}>المشي ٢٠ دقيقة بعد العشا ينزّل السكر الصباحي.</div>
          </Card>
        </Pop>
        <Pop at={c[2] + 1.1}>
          <Card style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex" }}>
              {["م", "ح", "ن"].map((x, i) => (
                <div key={x} style={{ width: 28, height: 28, borderRadius: 3, marginInlineStart: i ? -8 : 0, background: [C.tabuq, C.kashi, C.nakheel][i], color: C.jiss, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.jiss}` }}>
                  {x}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12.5 }}>
              <b>٣٢٠ مريض</b> يساندون بعضهم بهالمساحة
            </div>
          </Card>
        </Pop>
      </Body>
    </Screen>
  );
};

// 16 ─ Rewards & referral
const Rewards: React.FC = () => {
  const { t, c } = useClock();
  const pts = Math.round(interpolate(t, [c[1] - 0.2, c[1] + 1.0], [120, 470], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const credit = lp(t, c[0] - 0.1, 0.5);
  return (
    <Screen>
      <AppHeader kicker="المكافآت" title="ادعُ صديقك، وخذ رصيد" color={C.lazurd} />
      <Body top={6}>
        <Card style={{ textAlign: "center", padding: 14, background: C.lazurd, border: "none", color: C.teen }}>
          <div style={{ fontSize: 12.5, color: C.tabuq }}>نقاطك</div>
          <div style={{ fontFamily: F.logo, fontSize: 60, lineHeight: 1.1 }}>{ar(pts)}</div>
          <div style={{ height: 6, background: "rgba(241,232,216,.2)", borderRadius: 2, marginTop: 6 }}>
            <div style={{ width: `${(pts / 500) * 100}%`, height: "100%", background: C.tabuq, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 11.5, marginTop: 4 }}>باقي {ar(500 - pts)} نقطة على كوبون ١٠٪</div>
        </Card>
        <Card style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.ramad }}>كود الدعوة</div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: 2, direction: "ltr", textAlign: "right" }}>DKT-2611</div>
          </div>
          <Btn bg={C.tabuq} color={C.lazurd} h={38} style={{ width: 110 }}>
            شارك
          </Btn>
        </Card>
        <div style={{ opacity: credit, transform: `scale(${mix(credit, 1.2, 1)})` }}>
          <Card accent={C.nakheel} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>انضم صديقك حيدر بكودك</span>
            <span style={{ fontFamily: F.kufi, fontWeight: 800, color: C.nakheel }}>+٥٬٠٠٠ د.ع</span>
          </Card>
        </div>
        <SectionTitle>كوبوناتك</SectionTitle>
        {[
          { a: "١٥٪", d: "خصم على الأدوية · صيدلية النخيل", col: C.nakheel },
          { a: "١٠٪", d: "خصم على تحاليل مختبر الرافدين", col: C.kashi },
        ].map((k, i) => (
          <Pop key={k.a + i} at={c[2] - 0.1 + i * 0.25} dx={-40} dy={0}>
            <div style={{ display: "flex", background: C.jiss, border: `1px solid ${C.line}`, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: 84, background: k.col, color: C.jiss, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.logo, fontSize: 26, borderInlineEnd: `2px dashed ${C.jiss}` }}>{k.a}</div>
              <div style={{ padding: "10px 12px", fontSize: 12.5, flex: 1 }}>{k.d}</div>
            </div>
          </Pop>
        ))}
      </Body>
    </Screen>
  );
};

export const SCREENS: Record<string, React.FC> = {
  account: Account,
  doctor: Doctor,
  schedule: Schedule,
  booking: Booking,
  clinic: Clinic,
  chat: Chat,
  pharmacy: Pharmacy,
  store: Store,
  record: Record,
  lab: Lab,
  alerts: Alerts,
  voice: Voice,
  rating: Rating,
  forum: Forum,
  chronic: Chronic,
  rewards: Rewards,
};

export const FEATURE_ICONS: Record<string, React.FC<{ size: number; color?: string; accent?: string; draw?: number }>> = {
  account: IconFile,
  doctor: IconDoctor,
  schedule: IconClock,
  booking: IconTicket,
  clinic: IconDoctor,
  chat: IconDoctor,
  pharmacy: IconPharmacy,
  store: IconPill,
  record: IconFile,
  lab: IconLab,
  alerts: IconClock,
  voice: IconTicket,
  rating: IconDoctor,
  forum: IconFile,
  chronic: IconPharmacy,
  rewards: IconTicket,
};
