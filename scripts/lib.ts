// Shared pieces of the Payday Room scripts: the rules, the team, money as
// integer micro-USDC, file locations and the ledger. No network, no keys.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export type Size = "S" | "M" | "L";

export type Rules = {
  pool_usdc: string;
  reserve_pct: number;
  cap_pct: number;
  min_payout_usdc: string;
  sizes: Size[];
  points: Record<string, Record<Size, number>>;
  approvals_required: number;
  approval_phrase: string;
};

export type Contributor = { name: string; role?: string; wallet: string };
export type Team = {
  lead: string;
  approvers: string[];
  contributors: Record<string, Contributor>;
};

/** The YAML block fenced as ```yaml payout-rules in PAYOUT_RULES.md. */
export function loadRules(path = join(ROOT, "PAYOUT_RULES.md")): Rules & { hash: string } {
  const md = readFileSync(path, "utf8");
  const m = md.match(/```yaml payout-rules\n([\s\S]*?)```/);
  if (!m) throw new Error(`${path} has no \`\`\`yaml payout-rules block`);
  const rules = parse(m[1]) as Rules;
  for (const [task, sizes] of Object.entries(rules.points)) {
    for (const s of rules.sizes) {
      if (!Number.isInteger(sizes[s]) || sizes[s] < 0) throw new Error(`points.${task}.${s} must be a whole number`);
    }
  }
  if (rules.approvals_required < 2) throw new Error("approvals_required must be at least 2");
  return { ...rules, hash: sha256(m[1]).slice(0, 12) };
}

export function loadTeam(path = join(ROOT, "team.yaml")): Team {
  const team = parse(readFileSync(path, "utf8")) as Team;
  team.lead = normHandle(team.lead);
  team.approvers = team.approvers.map(normHandle);
  const contributors: Record<string, Contributor> = {};
  for (const [h, c] of Object.entries(team.contributors ?? {})) contributors[normHandle(h)] = c;
  team.contributors = contributors;
  return team;
}

export const normHandle = (h: string) => String(h ?? "").trim().replace(/^@/, "").toLowerCase();

// Money: integer micro-USDC (6 decimals), the unit Arc's USDC token uses.
export const MICRO = 1_000_000n;
export const CENT = 10_000n;

export function toMicro(usdc: string | number): bigint {
  const s = String(usdc).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(s)) throw new Error(`not a USDC amount: ${usdc}`);
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * MICRO + BigInt(frac.padEnd(6, "0"));
}

export function fmtUsdc(micro: bigint): string {
  const neg = micro < 0n;
  const v = neg ? -micro : micro;
  const cents = v / CENT;
  return `${neg ? "-" : ""}${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

/** Stable JSON: object keys sorted, bigints as strings. Used for hashes. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "bigint") return v.toString();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]));
    }
    return v;
  });
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const monthDir = (month: string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`month must look like 2026-11, got ${month}`);
  const dir = join(ROOT, "payday", month);
  mkdirSync(dir, { recursive: true });
  return dir;
};

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n");
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Read --flag value pairs from argv. */
export function flags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[a.slice(2)] = "true";
    else out[a.slice(2)] = argv[++i];
  }
  return out;
}

export const LEDGER = join(ROOT, "ledger.csv");
export const LEDGER_HEADER =
  "sent_at,month,batch_id,contributor,wallet,amount_usdc,tx_hash,explorer_url,table_rev,approved_by";

export function readLedger(path = LEDGER): Record<string, string>[] {
  if (!existsSync(path)) return [];
  const [head, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const cols = head.split(",");
  return lines.filter(Boolean).map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}
