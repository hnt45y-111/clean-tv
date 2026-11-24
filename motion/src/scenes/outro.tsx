import {Img, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeOutBack, waitFor} from '@motion-canvas/core';
import {C, KUFI, PLEX} from '../theme';
import mark from '../assets/mark.svg';

// 5s
export default makeScene2D(function* (view) {
  view.fill(C.bg);
  const logo = createRef<Img>();
  const a = createRef<Txt>();
  const b = createRef<Txt>();
  const c = createRef<Txt>();
  view.add(
    <>
      <Img ref={logo} src={mark} width={220} height={220} y={-230} scale={0} />
      <Txt ref={a} text="مفتوح المصدر" fontFamily={KUFI} fontWeight={700} fontSize={120}
        fill={C.cream} y={0} opacity={0} textDirection="rtl" />
      <Txt ref={b} text="MIT License" fontFamily={PLEX} fontWeight={700} fontSize={52}
        fill={C.orange} y={110} opacity={0} />
      <Txt ref={c} text="github.com/hnt45y-111/clean-tv" fontFamily={PLEX} fontWeight={500}
        fontSize={48} fill={C.gray} y={250} opacity={0} />
    </>,
  );
  yield* logo().scale(1, 0.7, easeOutBack);
  yield* a().opacity(1, 0.5);
  yield* b().opacity(1, 0.5);
  yield* c().opacity(1, 0.5);
  yield* waitFor(2.4);
  yield* all(logo().opacity(0, 0.4), a().opacity(0, 0.4), b().opacity(0, 0.4), c().opacity(0, 0.4));
});
