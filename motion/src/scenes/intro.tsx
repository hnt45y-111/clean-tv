import {Img, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeOutBack, waitFor} from '@motion-canvas/core';
import {C, KUFI, PLEX} from '../theme';
import mark from '../assets/mark.svg';

// 4.5s
export default makeScene2D(function* (view) {
  view.fill(C.bg);
  const logo = createRef<Img>();
  const title = createRef<Txt>();
  const sub = createRef<Txt>();
  const line = createRef<Rect>();
  view.add(
    <>
      <Img ref={logo} src={mark} width={320} height={320} y={-120} scale={0} rotation={-20} />
      <Txt ref={title} text="مدير الشاشات" fontFamily={KUFI} fontWeight={700} fontSize={150}
        fill={C.cream} y={160} opacity={0} textDirection="rtl" />
      <Rect ref={line} width={0} height={6} y={250} fill={C.orange} radius={3} />
      <Txt ref={sub} text="CLEAN TV" fontFamily={PLEX} fontWeight={700} fontSize={48}
        letterSpacing={14} fill={C.orange} y={310} opacity={0} />
    </>,
  );
  yield* all(logo().scale(1, 0.9, easeOutBack), logo().rotation(0, 0.9, easeOutBack));
  yield* all(title().opacity(1, 0.5), title().y(140, 0.5));
  yield* all(line().width(420, 0.5), sub().opacity(1, 0.5));
  yield* waitFor(2.2);
  yield* all(view.opacity(0, 0.4));
});
