import type { ChatShot } from "./ChatStep";
import type { ShotSpec } from "./Shots";

// Seconds per animated section: its narration take plus a breath.
export const T = { opener: 14.5, intro: 10.5, switch: 13, outro: 10 };

// Length of each narration take, so the music can dip under the voice.
export const VO_SECONDS: Record<string, number> = {
  opener: 12.9,
  intro: 8.75,
  tally: 8.05,
  treasurer: 14.76,
  receipts: 5.8,
  outro: 8.3,
};

// Switch Console, full width: the template and the agents it created.
export const setup: { step: string; text: string; shots: ShotSpec[] } = {
  step: "SWITCH",
  text: "One Switch template creates Tally and Treasurer and puts them in the Telegram room.",
  shots: [
    { file: "wide-01-template.png", seconds: 5, focus: [0.23, 0.36, 0.62, 0.36] },
    { file: "wide-02-created.png", seconds: 4.5 },
  ],
};

// The October payday, as it happened in the Telegram group (focus = fractions of the screenshot).
export const steps: { vo?: string; step: string; title: string; lines: string[]; shots: ChatShot[] }[] = [
  {
    step: "1 · CLAIMS",
    title: "People post their work in the room",
    lines: ["In plain words, with a link.", "A lead can post for someone: for @ada: …"],
    shots: [{ file: "r1-01-claims.png", seconds: 7 }],
  },
  {
    vo: "tally",
    step: "2 · TALLY",
    title: "Tally applies the written rules",
    lines: ["Reads the room through Switch.", "Runs tally.ts: points, pool, reserve, a 35% cap.", "Holds anything unclear, by name."],
    shots: [
      { file: "r1-02-tally-working.png", seconds: 3.5, focus: [0.05, 0.53, 0.72, 0.37] },
      { file: "r1-03-tally-table.png", seconds: 5.5, focus: [0.07, 0.14, 0.7, 0.32] },
      { file: "r1-03-tally-table.png", seconds: 6, focus: [0.07, 0.47, 0.7, 0.3] },
    ],
  },
  {
    step: "3 · LEAD",
    title: "The lead decides, in the thread",
    lines: ["accept c3 · drop c5 · drop c6", "approve table r2: only the lead can, and the script checks."],
    shots: [
      { file: "r1-035-lead-edits.png", seconds: 5, focus: [0.31, 0.3, 0.69, 0.11] },
      { file: "r1-04-table-r2.png", seconds: 6, focus: [0.07, 0.4, 0.7, 0.33] },
    ],
  },
  {
    step: "4 · HANDOFF",
    title: "Agent to agent, through Switch",
    lines: ["Tally records the lead's approval and hands the table to Treasurer.", "Same room, same thread."],
    shots: [{ file: "r1-05-handoff.png", seconds: 6, focus: [0.07, 0.46, 0.7, 0.1] }],
  },
  {
    vo: "treasurer",
    step: "5 · TREASURER",
    title: "One batch. Two approvers.",
    lines: ["The batch id is a hash of who gets what.", "One approval isn't enough: it refuses.", "Then Switch asks a person to allow the send."],
    shots: [
      { file: "r1-06-batch.png", seconds: 6, focus: [0.07, 0.36, 0.7, 0.45] },
      { file: "r1-07-one-of-two.png", seconds: 6, focus: [0.07, 0.78, 0.7, 0.11] },
      { file: "r1-08-second-approval.png", seconds: 5, focus: [0.08, 0.4, 0.84, 0.25] },
      { file: "r1-09-allow.png", seconds: 6, focus: [0.07, 0.41, 0.7, 0.49] },
    ],
  },
  {
    vo: "receipts",
    step: "6 · PAID",
    title: "Receipts in the chat",
    lines: ["USDC on Arc testnet, one transfer each.", "Every link posted, ledger.csv updated."],
    shots: [{ file: "r1-10-receipts.png", seconds: 8, focus: [0.07, 0.2, 0.7, 0.45] }],
  },
];

// Arcscan, full width: a transfer from the batch on the explorer.
export const proof: { step: string; text: string; shots: ShotSpec[] } = {
  step: "ON-CHAIN",
  text: "Every transfer is on Arc testnet's explorer, from the treasury to the contributor.",
  shots: [{ file: "wide-03-arcscan.png", seconds: 5, focus: [0, 0, 1, 0.84], zoom: 1 }],
};
