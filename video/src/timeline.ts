import type { ShotSpec } from "./Shots";

// Seconds per animated section: its narration take plus a breath.
export const T = { opener: 20, intro: 11, switch: 14, outro: 9 };

// The payday itself, in screenshots. Each clip's length is the sum of its shots.
export const clips: { vo: string; step: string; text: string; shots: ShotSpec[] }[] = [
  { vo: "claims", step: "CLAIMS", text: "People post their work in the room, with a link.", shots: [] },
  { vo: "tally", step: "TALLY", text: "Tally reads the room through Switch and applies PAYOUT_RULES.md.", shots: [] },
  { vo: "lead", step: "LEAD", text: "The lead fixes and approves the table in the thread.", shots: [] },
  { vo: "treasurer", step: "TREASURER", text: "One batch, two different approvers, then Switch's approval card.", shots: [] },
  { vo: "receipts", step: "PAID", text: "USDC on Arc testnet, every receipt in the chat, ledger updated.", shots: [] },
];
