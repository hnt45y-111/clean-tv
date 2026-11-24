import {Img, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeOutCubic, createRefArray, sequence, waitFor} from '@motion-canvas/core';
import {C, KUFI, PLEX} from '../theme';
import tv from '../assets/tv-home.jpg';

// 6s
export default makeScene2D(function* (view) {
  view.fill(C.bg);
  view.opacity(0);
  const shot = createRef<Rect>();
  const rows = createRefArray<Rect>();
  const feats = [
    'ساعة وتاريخ هجري وميلادي',
    'مواقيت الصلاة وآية اليوم',
    'شريط مباريات عربي مباشر',
    'وضع الأطفال وقفل التطبيقات',
    'تصاميم Samsung و LG و Google TV',
  ];
  view.add(
    <>
      <Txt text="واجهة نظيفة بدون إعلانات" fontFamily={KUFI} fontWeight={700} fontSize={84}
        fill={C.cream} x={0} y={-440} textDirection="rtl" />
      <Rect ref={shot} width={840} height={473} x={-470} y={80} radius={28} clip stroke={C.orange} lineWidth={5} opacity={0} scale={0.9}>
        <Img src={tv} width={840} height={473} />
      </Rect>
    </>,
  );
  feats.forEach((t, i) => {
    view.add(
      <Rect ref={rows} x={520 + 120} y={-130 + i * 120} width={760} height={92} radius={18} fill={C.panel}
        layout alignItems="center" justifyContent="end" gap={24} padding={[0, 28]} opacity={0}>
        <Txt text={t} fontFamily={PLEX} fontWeight={500} fontSize={40} fill={C.cream} textDirection="rtl" />
        <Rect width={22} height={22} radius={11} fill={i % 2 ? C.teal : C.orange} />
      </Rect>,
    );
  });
  yield* view.opacity(1, 0.3);
  yield* all(shot().opacity(1, 0.6), shot().scale(1, 0.6, easeOutCubic));
  yield* sequence(
    0.45,
    ...rows.map(r => all(r.opacity(1, 0.4), r.x(520, 0.5, easeOutCubic))),
  );
  yield* waitFor(2.5);
  yield* view.opacity(0, 0.3);
});
