import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, Series, staticFile } from "remotion";
import { ChatStep } from "./ChatStep";
import { existsSync } from "./exists";
import { Caption, HowSwitch, Intro, Opener, Outro, Placeholder } from "./scenes";
import { Shots, type ShotSpec } from "./Shots";
import { FPS } from "./theme";
import { proof, setup, steps, T } from "./timeline";

const REPO = "github.com/0xkenichi/payday-room";
const f = (s: number) => Math.round(s * FPS);

// Narration takes from ElevenLabs (Victor Hopo), one per section, in public/vo/.
const Voice: React.FC<{ name?: string }> = ({ name }) =>
  name && existsSync(`vo/${name}.mp3`) ? (
    <Sequence from={f(0.4)} layout="none">
      <Audio src={staticFile(`vo/${name}.mp3`)} />
    </Sequence>
  ) : null;

const Wide: React.FC<{ step: string; text: string; shots: ShotSpec[] }> = ({ step, text, shots }) => {
  const have = shots.filter((s) => existsSync(`shots/${s.file}`));
  return (
    <AbsoluteFill>
      {have.length ? <Shots specs={have} /> : <Placeholder label={text} />}
      <Caption step={step} text={text} />
    </AbsoluteFill>
  );
};

const seconds = (shots: { seconds: number }[]) => shots.reduce((a, s) => a + s.seconds, 0);
const present = <S extends { file: string }>(shots: S[]) => shots.filter((s) => existsSync(`shots/${s.file}`));

const sections: { key: string; seconds: number; el: React.ReactNode; vo?: string }[] = [
  { key: "opener", seconds: T.opener, el: <Opener />, vo: "opener" },
  { key: "intro", seconds: T.intro, el: <Intro />, vo: "intro" },
  { key: "setup", seconds: Math.max(4, seconds(present(setup.shots))), el: <Wide {...setup} /> },
  ...steps.map((s) => {
    const shots = present(s.shots);
    return {
      key: s.step,
      seconds: Math.max(4, seconds(shots)),
      vo: s.vo,
      el: shots.length ? <ChatStep step={s.step} title={s.title} lines={s.lines} shots={shots} /> : <Placeholder label={s.title} />,
    };
  }),
  { key: "proof", seconds: Math.max(4, seconds(present(proof.shots))), el: <Wide {...proof} /> },
  { key: "switch", seconds: T.switch, el: <HowSwitch />, vo: "switch" },
  { key: "outro", seconds: T.outro, el: <Outro repo={REPO} />, vo: "outro" },
];

const Demo: React.FC = () => (
  <Series>
    {sections.map((s) => (
      <Series.Sequence key={s.key} durationInFrames={f(s.seconds)}>
        <AbsoluteFill>
          {s.el}
          <Voice name={s.vo} />
        </AbsoluteFill>
      </Series.Sequence>
    ))}
  </Series>
);

const total = sections.reduce((a, s) => a + s.seconds, 0);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PaydayRoom" component={Demo} durationInFrames={f(total)} fps={FPS} width={1920} height={1080} />
    <Composition id="Opener" component={Opener} durationInFrames={f(T.opener)} fps={FPS} width={1920} height={1080} />
    <Composition id="Intro" component={Intro} durationInFrames={f(T.intro)} fps={FPS} width={1920} height={1080} />
    <Composition id="HowSwitch" component={HowSwitch} durationInFrames={f(T.switch)} fps={FPS} width={1920} height={1080} />
  </>
);
