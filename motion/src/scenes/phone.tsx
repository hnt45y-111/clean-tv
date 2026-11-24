import {Img, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeOutCubic, createRefArray, sequence, waitFor} from '@motion-canvas/core';
import {C, KUFI, PLEX} from '../theme';
import studio from '../assets/studio-design.jpg';

// 4.5s
export default makeScene2D(function* (view) {
  view.fill(C.bg);
  view.opacity(0);
  const shot = createRef<Rect>();
  const rows = createRefArray<Rect>();
  view.add(
    <>
      <Txt text="تحكّم من موبايلك" fontFamily={KUFI} fontWeight={700} fontSize={84}
        fill={C.cream} y={-420} textDirection="rtl" />
      <Rect ref={shot} width={760} height={427} x={-420} y={90} radius={28} clip stroke={C.orange} lineWidth={5} opacity={0} scale={0.9}>
        <Img src={studio} width={760} height={427} />
      </Rect>
    </>,
  );
  ['معاينة حية قبل التصدير', 'مرآة شاشة سريعة', 'ريموت كامل بلوحة لمس'].forEach((t, i) => {
    view.add(
      <Rect ref={rows} x={600} y={-60 + i * 130} width={720} height={96} radius={18} fill={C.panel}
        layout alignItems="center" justifyContent="end" gap={24} padding={[0, 28]} opacity={0}>
        <Txt text={t} fontFamily={PLEX} fontWeight={500} fontSize={42} fill={C.cream} textDirection="rtl" />
        <Rect width={22} height={22} radius={11} fill={i % 2 ? C.orange : C.teal} />
      </Rect>,
    );
  });
  yield* view.opacity(1, 0.3);
  yield* all(shot().opacity(1, 0.5), shot().scale(1, 0.5, easeOutCubic));
  yield* sequence(0.4, ...rows.map(r => all(r.opacity(1, 0.4), r.x(520, 0.5, easeOutCubic))));
  yield* waitFor(2.1);
  yield* view.opacity(0, 0.3);
});
