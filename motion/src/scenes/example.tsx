import {Circle, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, waitFor} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#0f172a');
  const circle = createRef<Circle>();
  const label = createRef<Txt>();

  view.add(
    <>
      <Circle ref={circle} size={0} fill="#38bdf8" />
      <Txt ref={label} text="Clean TV" fill="white" fontSize={0} />
    </>,
  );

  yield* all(circle().size(240, 1), label().fontSize(72, 1));
  yield* circle().position.x(300, 1).to(-300, 1.5).to(0, 1);
  yield* waitFor(0.5);
});
