import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { c } from "./theme";

// Real screenshots of a payday (Telegram, Switch Console, Arcscan), each shown
// whole, then eased toward the part the narration is about. `focus` is that
// part as fractions of the image: [x, y, w, h].

export interface ShotSpec {
  file: string;
  seconds: number;
  focus?: [number, number, number, number];
  /** How far to zoom into the focus, 1 = not at all. */
  zoom?: number;
}

const FADE = 10;

const Shot: React.FC<{ spec: ShotSpec }> = ({ spec }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const [fx, fy, fw, fh] = spec.focus ?? [0, 0, 1, 1];
  const target = spec.zoom ?? (spec.focus ? Math.min(1.9, 0.92 / Math.max(fw, fh * (height / width) * (16 / 9))) : 1.04);
  const t = interpolate(frame, [12, Math.min(60, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const drift = interpolate(frame, [0, durationInFrames], [0, 0.03]);
  const scale = 1 + (target - 1) * t + drift;
  const cx = (fx + fw / 2) * width;
  const cy = (fy + fh / 2) * height;
  // Move the focus toward the upper middle of the frame, above the caption.
  const dx = (width / 2 - cx) * t;
  const dy = (height * 0.42 - cy) * t;
  const opacity = interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: c.bg, opacity }}>
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, transformOrigin: `${cx}px ${cy}px` }}>
        <Img src={staticFile(`shots/${spec.file}`)} style={{ width, height, objectFit: "contain" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Shots: React.FC<{ specs: ShotSpec[] }> = ({ specs }) => {
  const { fps } = useVideoConfig();
  let from = 0;
  return (
    <AbsoluteFill style={{ background: c.bg }}>
      {specs.map((spec, i) => {
        const duration = Math.round(spec.seconds * fps);
        const el = (
          <Sequence key={`${spec.file}-${i}`} from={from} durationInFrames={duration + (i < specs.length - 1 ? FADE : 0)}>
            <Shot spec={spec} />
          </Sequence>
        );
        from += duration;
        return el;
      })}
    </AbsoluteFill>
  );
};
