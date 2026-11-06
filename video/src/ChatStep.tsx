import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { c, fonts } from "./theme";

// One step of the payday: what happened, in big type on the left, and the real
// Telegram screenshot on the right, easing toward the line that matters.
// `focus` is that line as fractions of the screenshot: [x, y, w, h].

export interface ChatShot {
  file: string;
  seconds: number;
  focus?: [number, number, number, number];
}

const PANEL = { x: 800, y: 40, w: 1060, h: 1000 };
const FADE = 10;

const Panel: React.FC<{ shot: ChatShot }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const [fx, fy, fw, fh] = shot.focus ?? [0, 0, 1, 1];
  const t = interpolate(frame, [15, Math.min(70, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const zoom = shot.focus ? Math.min(1.45, 0.95 / Math.max(fw, fh)) : 1;
  const scale = 1 + (zoom - 1) * t + interpolate(frame, [0, durationInFrames], [0, 0.02]);
  // The image is laid out at the panel's width; keep the focus inside the panel.
  const imgH = PANEL.w * (1077 / 1120);
  const cx = (fx + fw / 2) * PANEL.w;
  const cy = (fy + fh / 2) * imgH;
  // Glide the focus toward the middle, but never so far that an edge of the
  // screenshot comes into the panel.
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const dx = clamp((PANEL.w / 2 - cx) * t, PANEL.w - cx - (PANEL.w - cx) * scale, cx * (scale - 1));
  const dy = clamp((PANEL.h / 2 - cy) * t, PANEL.h - cy - (imgH - cy) * scale, cy * (scale - 1));
  const opacity = interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${dx}px, ${dy}px) scale(${scale})`, transformOrigin: `${cx}px ${cy}px` }}>
        <Img src={staticFile(`shots/${shot.file}`)} style={{ width: PANEL.w, height: imgH, display: "block" }} />
      </div>
    </AbsoluteFill>
  );
};

export const ChatStep: React.FC<{ step: string; title: string; lines: string[]; shots: ChatShot[] }> = ({ step, title, lines, shots }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = (s: number) =>
    interpolate(frame, [s * fps, s * fps + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  let from = 0;
  return (
    <AbsoluteFill style={{ background: c.bg, fontFamily: fonts.body, color: c.ink }}>
      <div style={{ position: "absolute", left: 90, top: 150, width: 640 }}>
        <div
          style={{
            display: "inline-block",
            fontFamily: fonts.mono,
            fontSize: 26,
            letterSpacing: 3,
            color: c.bg,
            background: c.money,
            borderRadius: 10,
            padding: "6px 16px",
            opacity: p(0.2),
          }}
        >
          {step}
        </div>
        <div style={{ fontFamily: fonts.display, fontSize: 64, lineHeight: 1.08, marginTop: 30, opacity: p(0.4), transform: `translateY(${(1 - p(0.4)) * 20}px)` }}>
          {title}
        </div>
        {lines.map((l, i) => (
          <div key={l} style={{ fontSize: 32, lineHeight: 1.35, color: c.ink2, marginTop: i ? 18 : 34, opacity: p(1 + i * 0.9) }}>
            {l}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: PANEL.x,
          top: PANEL.y,
          width: PANEL.w,
          height: PANEL.h,
          borderRadius: 30,
          overflow: "hidden",
          border: `2px solid ${c.line}`,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          background: "#000",
        }}
      >
        {shots.map((s, i) => {
          const d = Math.round(s.seconds * fps);
          const el = (
            <Sequence key={`${s.file}-${i}`} from={from} durationInFrames={d + (i < shots.length - 1 ? FADE : 0)}>
              <Panel shot={s} />
            </Sequence>
          );
          from += d;
          return el;
        })}
      </div>
    </AbsoluteFill>
  );
};
