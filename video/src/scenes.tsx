import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { c, fonts } from "./theme";

const appear = (frame: number, at: number, len = 14) =>
  interpolate(frame, [at, at + len], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: c.bg, fontFamily: fonts.body, color: c.ink }}>{children}</AbsoluteFill>
);

/** Lines that land one by one, each at a second given in `at`. */
export const Opener: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines: { text: string; at: number; tone?: string }[] = [
    { text: "Paid three months late.", at: 2.5 },
    { text: "Nobody wants to tally the month.", at: 9.5 },
    { text: "Nobody should press send alone.", at: 14.5, tone: c.gold },
  ];
  return (
    <Stage>
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 220px", gap: 34 }}>
        {lines.map((l) => {
          const p = appear(frame, l.at * fps, 18);
          return (
            <div
              key={l.text}
              style={{
                fontFamily: fonts.display,
                fontSize: 92,
                lineHeight: 1.08,
                color: l.tone ?? c.ink,
                opacity: p,
                transform: `translateY(${(1 - p) * 26}px)`,
              }}
            >
              {l.text}
            </div>
          );
        })}
      </AbsoluteFill>
    </Stage>
  );
};

const Chip: React.FC<{ label: string; sub: string; color: string; soft: string; p: number }> = ({ label, sub, color, soft, p }) => (
  <div
    style={{
      background: soft,
      border: `2px solid ${color}`,
      borderRadius: 28,
      padding: "30px 38px",
      width: 430,
      opacity: p,
      transform: `translateY(${(1 - p) * 24}px)`,
    }}
  >
    <div style={{ fontSize: 46, fontWeight: 600, color }}>{label}</div>
    <div style={{ fontSize: 30, color: c.ink2, marginTop: 10, lineHeight: 1.3 }}>{sub}</div>
  </div>
);

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 64 }}>
        <div style={{ textAlign: "center", opacity: appear(frame, 0.3 * fps, 20) }}>
          <div style={{ fontFamily: fonts.display, fontSize: 150, letterSpacing: -2 }}>Payday Room</div>
          <div style={{ fontSize: 40, color: c.ink2, marginTop: 14 }}>
            A Switch room in Telegram where agents do the tedious part and people keep the decisions.
          </div>
        </div>
        <div style={{ display: "flex", gap: 36 }}>
          <Chip label="Tally" sub="Claude Code. Reads the claims, applies the rules, drafts the table." color={c.money} soft={c.moneySoft} p={appear(frame, 3 * fps)} />
          <Chip label="People" sub="The lead approves the table. Two approvers approve the batch." color={c.gold} soft={c.goldSoft} p={appear(frame, 4.2 * fps)} />
          <Chip label="Treasurer" sub="Claude Code. Pays USDC on Arc testnet, posts every receipt." color={c.usdc} soft={c.usdcSoft} p={appear(frame, 5.4 * fps)} />
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

const Box: React.FC<{ title: string; lines: string[]; color: string; x: number; y: number; w: number; p: number }> = ({ title, lines, color, x, y, w, p }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      background: c.card,
      border: `2px solid ${color}`,
      borderRadius: 26,
      padding: "26px 30px",
      opacity: p,
      transform: `scale(${0.96 + 0.04 * p})`,
    }}
  >
    <div style={{ fontSize: 40, fontWeight: 600, color }}>{title}</div>
    {lines.map((l) => (
      <div key={l} style={{ fontSize: 27, color: c.ink2, marginTop: 10, fontFamily: l.includes("(") || l.includes("_") ? fonts.mono : fonts.body }}>
        {l}
      </div>
    ))}
  </div>
);

const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; p: number; label?: string }> = ({ x1, y1, x2, y2, p, label }) => (
  <>
    <svg style={{ position: "absolute", left: 0, top: 0 }} width={1920} height={1080}>
      <defs>
        <marker id="head" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={c.muted} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p} stroke={c.muted} strokeWidth={4} markerEnd={p > 0.95 ? "url(#head)" : undefined} />
    </svg>
    {label ? (
      <div style={{ position: "absolute", left: (x1 + x2) / 2 - 160, top: (y1 + y2) / 2 - 44, width: 320, textAlign: "center", fontSize: 24, color: c.muted, opacity: p }}>{label}</div>
    ) : null}
  </>
);

/** Why it stops working without Switch. */
export const HowSwitch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = (s: number) => appear(frame, s * fps, 16);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 120, top: 70, fontFamily: fonts.display, fontSize: 64 }}>Where Switch sits</div>
      <Box title="Telegram group" lines={["claims, edits, approvals", "receipts, in one thread"]} color={c.gold} x={120} y={330} w={440} p={p(0.5)} />
      <Box
        title="Switch"
        lines={["the room + addressing", "read_context · post_message", "approval card before send"]}
        color={c.money}
        x={740}
        y={300}
        w={480}
        p={p(2)}
      />
      <Box title="Claude Code agents" lines={["Tally → tally.ts", "Treasurer → pay-batch.ts"]} color={c.usdc} x={1400} y={250} w={420} p={p(3.5)} />
      <Box title="Arc testnet" lines={["USDC transfers", "ledger.csv"]} color={c.ink2} x={1400} y={640} w={420} p={p(5)} />
      <Arrow x1={560} y1={430} x2={740} y2={430} p={p(1.5)} label="bridge" />
      <Arrow x1={1220} y1={400} x2={1400} y2={360} p={p(3)} label="tools" />
      <Arrow x1={1610} y1={460} x2={1610} y2={640} p={p(4.5)} />
      <div style={{ position: "absolute", left: 120, right: 120, bottom: 90, fontSize: 38, color: c.ink2, opacity: p(6.5) }}>
        Take Switch away and there's no room to read, no one to post to, and no card in front of the money.
      </div>
    </Stage>
  );
};

export const Outro: React.FC<{ repo: string }> = ({ repo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30, textAlign: "center" }}>
        <div style={{ fontFamily: fonts.display, fontSize: 130, opacity: appear(frame, 0.3 * fps, 18) }}>Payday Room</div>
        <div style={{ fontFamily: fonts.mono, fontSize: 48, color: c.money, opacity: appear(frame, 1.5 * fps) }}>{repo}</div>
        <div style={{ fontSize: 34, color: c.ink2, opacity: appear(frame, 2.6 * fps) }}>
          Flip the Switch · Best Business Workflow · testnet only
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

export const Caption: React.FC<{ step: string; text: string }> = ({ step, text }) => {
  const frame = useCurrentFrame();
  const p = appear(frame, 8, 16);
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: 48,
        display: "flex",
        alignItems: "center",
        gap: 24,
        background: "rgba(14,19,22,0.92)",
        border: `2px solid ${c.line}`,
        borderRadius: 22,
        padding: "22px 30px",
        fontFamily: fonts.body,
        opacity: p,
        transform: `translateY(${(1 - p) * 20}px)`,
      }}
    >
      <div style={{ fontFamily: fonts.mono, fontSize: 26, color: c.bg, background: c.money, borderRadius: 10, padding: "6px 14px", letterSpacing: 2 }}>{step}</div>
      <div style={{ fontSize: 34, color: c.ink }}>{text}</div>
    </div>
  );
};

export const Placeholder: React.FC<{ label: string }> = ({ label }) => (
  <Stage>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontSize: 40, color: c.muted }}>[{label}]</AbsoluteFill>
  </Stage>
);
