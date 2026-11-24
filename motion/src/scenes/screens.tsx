import {Img, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeOutCubic, waitFor, createRefArray, sequence} from '@motion-canvas/core';
import {C, KUFI, PLEX} from '../theme';
import tv from '../assets/tv-home.jpg';
import car from '../assets/car-scene.jpg';
import phone from '../assets/mobile-main.jpg';

// 5s
export default makeScene2D(function* (view) {
  view.fill(C.bg);
  view.opacity(0);
  const head = createRef<Txt>();
  const cards = createRefArray<Rect>();
  const items: [string, string, number, number, number][] = [
    [tv, 'تلفزيون', -560, 760, 428],
    [car, 'سيارة', 140, 520, 292],
    [phone, 'موبايل', 640, 230, 410],
  ];
  view.add(
    <Txt ref={head} text="ثلاث شاشات.. هوية وحدة" fontFamily={KUFI} fontWeight={700}
      fontSize={96} fill={C.cream} y={-400} textDirection="rtl" />,
  );
  items.forEach(([src, label, x, w, h], i) => {
    view.add(
      <Rect ref={cards} x={x + 200} y={50} layout direction="column" alignItems="center" gap={24} opacity={0}>
        <Rect radius={24} clip stroke={C.orange} lineWidth={4}>
          <Img src={src} width={w} height={h} />
        </Rect>
        <Txt text={label} fontFamily={PLEX} fontWeight={700} fontSize={48} fill={C.orange} textDirection="rtl" />
      </Rect>,
    );
  });
  yield* view.opacity(1, 0.3);
  yield* sequence(0.2, ...cards.map(c => c.opacity(1, 0.5)));
  yield* waitFor(0.1);
  yield* all(
    ...cards.map((c, i) => c.x(items[i][2], 0.8, easeOutCubic)),
  );
  yield* waitFor(2.6);
  yield* view.opacity(0, 0.3);
});
