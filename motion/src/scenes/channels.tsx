import {Img, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeOutCubic, createRefArray, sequence, waitFor} from '@motion-canvas/core';
import {C, KUFI, PLEX} from '../theme';
import ch from '../assets/tv-channels.jpg';

// 5s
export default makeScene2D(function* (view) {
  view.fill(C.bg);
  view.opacity(0);
  const n = createSignal(0);
  const chips = createRefArray<Rect>();
  const shot = createRef<Rect>();
  view.add(
    <>
      <Rect ref={shot} width={900} height={506} x={-440} y={0} radius={28} clip stroke={C.teal} lineWidth={5} opacity={0}>
        <Img src={ch} width={900} height={506} />
      </Rect>
      <Txt text={() => `+${Math.round(n())}`} fontFamily={PLEX} fontWeight={700} fontSize={240}
        fill={C.orange} x={500} y={-200} />
      <Txt text="قناة عربية مجانية" fontFamily={KUFI} fontWeight={700} fontSize={80}
        fill={C.cream} x={500} y={-30} textDirection="rtl" />
    </>,
  );
  ['أخبار', 'رياضة', 'أفلام', 'وثائقيات', 'أطفال'].forEach((t, i) => {
    view.add(
      <Rect ref={chips} x={780 - (i % 3) * 230} y={110 + Math.floor(i / 3) * 90} layout padding={[10, 26]}
        radius={30} fill={i % 2 ? C.teal : C.orange} opacity={0} scale={0.6}>
        <Txt text={t} fontFamily={PLEX} fontWeight={700} fontSize={36} fill={C.cream} textDirection="rtl" />
      </Rect>,
    );
  });
  yield* view.opacity(1, 0.3);
  yield* all(shot().opacity(1, 0.5), n(190, 1.4, easeOutCubic));
  yield* sequence(0.15, ...chips.map(c => all(c.opacity(1, 0.3), c.scale(1, 0.3))));
  yield* waitFor(2.1);
  yield* view.opacity(0, 0.3);
});
