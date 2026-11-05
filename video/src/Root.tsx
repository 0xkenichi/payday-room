import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, Series, staticFile } from "remotion";
import { existsSync } from "./exists";
import { Caption, HowSwitch, Intro, Opener, Outro, Placeholder } from "./scenes";
import { Shots, type ShotSpec } from "./Shots";
import { FPS } from "./theme";
import { clips, T } from "./timeline";

const REPO = "github.com/0xkenichi/payday-room";
const f = (s: number) => Math.round(s * FPS);

// Narration takes from ElevenLabs (Victor Hopo), one per section, in public/vo/.
const Voice: React.FC<{ name: string }> = ({ name }) =>
  existsSync(`vo/${name}.mp3`) ? (
    <Sequence from={f(0.4)} layout="none">
      <Audio src={staticFile(`vo/${name}.mp3`)} />
    </Sequence>
  ) : null;

const Clip: React.FC<{ vo: string; step: string; text: string; shots: ShotSpec[] }> = ({ vo, step, text, shots }) => (
  <AbsoluteFill>
    {shots.length && shots.every((s) => existsSync(`shots/${s.file}`)) ? <Shots specs={shots} /> : <Placeholder label={text} />}
    <Caption step={step} text={text} />
    <Voice name={vo} />
  </AbsoluteFill>
);

const Section: React.FC<{ id: string; el: React.ReactNode }> = ({ id, el }) => (
  <AbsoluteFill>
    {el}
    <Voice name={id} />
  </AbsoluteFill>
);

const before = [
  { id: "opener", seconds: T.opener, el: <Opener /> },
  { id: "intro", seconds: T.intro, el: <Intro /> },
];
const after = [
  { id: "switch", seconds: T.switch, el: <HowSwitch /> },
  { id: "outro", seconds: T.outro, el: <Outro repo={REPO} /> },
];

const Demo: React.FC = () => (
  <Series>
    {before.map((s) => (
      <Series.Sequence key={s.id} durationInFrames={f(s.seconds)}>
        <Section id={s.id} el={s.el} />
      </Series.Sequence>
    ))}
    {clips.map((k) => (
      <Series.Sequence key={k.vo} durationInFrames={f(k.shots.reduce((a, s) => a + s.seconds, 0))}>
        <Clip vo={k.vo} step={k.step} text={k.text} shots={k.shots} />
      </Series.Sequence>
    ))}
    {after.map((s) => (
      <Series.Sequence key={s.id} durationInFrames={f(s.seconds)}>
        <Section id={s.id} el={s.el} />
      </Series.Sequence>
    ))}
  </Series>
);

const seconds =
  [...before, ...after].reduce((a, s) => a + s.seconds, 0) +
  clips.reduce((a, k) => a + k.shots.reduce((b, s) => b + s.seconds, 0), 0);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PaydayRoom" component={Demo} durationInFrames={f(seconds)} fps={FPS} width={1920} height={1080} />
    <Composition id="Opener" component={Opener} durationInFrames={f(T.opener)} fps={FPS} width={1920} height={1080} />
    <Composition id="Intro" component={Intro} durationInFrames={f(T.intro)} fps={FPS} width={1920} height={1080} />
    <Composition id="HowSwitch" component={HowSwitch} durationInFrames={f(T.switch)} fps={FPS} width={1920} height={1080} />
  </>
);
