import React from "react";
import { AbsoluteFill, Audio, Composition, staticFile } from "remotion";
import { C, S } from "./brand";
import { Scenes } from "./scenes";

const Reel: React.FC = () => (
  <AbsoluteFill style={{ background: C.lazurd }}>
    <Scenes />
    <Audio src={staticFile("audio/mix.wav")} />
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <Composition id="DktornaReel" component={Reel} durationInFrames={S(38)} fps={30} width={1080} height={1920} />
);
