// The Tally agent's calculator. The agent reads the claims out of the Switch
// room and writes them to payday/<month>/claims.json; this script applies
// PAYOUT_RULES.md to them, so the arithmetic and the flags never depend on a
// model's mood.
//
//   node scripts/tally.ts draft   --month 2026-11
//   node scripts/tally.ts approve --month 2026-11 --rev 2 --by stillkenichi --quote "approve table r2" [--message-id <id>]
//   node scripts/tally.ts show    --month 2026-11
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CENT,
  canonical,
  flags,
  fmtUsdc,
  loadRules,
  loadTeam,
  monthDir,
  normHandle,
  readJson,
  sha256,
  shortAddr,
  toMicro,
  writeJson,
  type Rules,
  type Team,
} from "./lib.ts";

export type Claim = {
  ref: string;
  contributor: string;
  type: string;
  size: string;
  size_source?: "stated" | "inferred";
  evidence?: string;
  text?: string;
  posted_by?: string;
  posted_at?: string;
  work_date?: string;
  message_id?: string;
  note?: string;
  resolution?: "accept" | "drop" | null;
  resolved_by?: string;
  edits?: { field: string; from: unknown; to: unknown; by: string }[];
};

export type ClaimsFile = { month: string; claims: Claim[] };

export type Flag = "no_evidence" | "unknown_contributor" | "unknown_task" | "unclear_size" | "duplicate" | "wrong_month";

const FLAG_TEXT: Record<Flag, string> = {
  no_evidence: "no evidence link",
  unknown_contributor: "not in team.yaml or no wallet",
  unknown_task: "task type isn't in the rules",
  unclear_size: "size was guessed",
  duplicate: "same link already claimed for this task type",
  wrong_month: "work is outside this month",
};

// A lead can accept a held claim for these flags, but not for these two: an
// unknown person has no wallet and an unknown task has no points.
const UNACCEPTABLE: Flag[] = ["unknown_contributor", "unknown_task"];

export type Row = {
  handle: string;
  name: string;
  wallet: string;
  points: number;
  payout_micro: bigint;
  capped: boolean;
  below_min: boolean;
  claims: string[];
};

export type Table = {
  kind: "payday-table";
  month: string;
  revision: number;
  rules_hash: string;
  claims_hash: string;
  pool_micro: bigint;
  reserve_micro: bigint;
  distributable_micro: bigint;
  cap_micro: bigint;
  rows: Row[];
  held: { ref: string; contributor: string; flags: Flag[]; text?: string }[];
  dropped: string[];
  total_points: number;
  total_payout_micro: bigint;
  to_reserve_micro: bigint;
  table_hash: string;
  approved?: { by: string; at: string; quote: string; message_id?: string };
};

const normUrl = (u: string) => u.trim().replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();

export function flagClaims(claims: Claim[], month: string, rules: Rules, team: Team): Map<string, Flag[]> {
  const seen = new Set<string>();
  const out = new Map<string, Flag[]>();
  for (const c of claims) {
    const f: Flag[] = [];
    const who = team.contributors[normHandle(c.contributor)];
    if (!c.evidence || !/^https?:\/\/\S+$/.test(c.evidence.trim())) f.push("no_evidence");
    if (!who || !/^0x[0-9a-fA-F]{40}$/.test(who.wallet)) f.push("unknown_contributor");
    if (!rules.points[c.type]) f.push("unknown_task");
    if (!rules.sizes.includes(c.size as never) || c.size_source === "inferred") f.push("unclear_size");
    if (c.evidence) {
      // A review claim links the PR it reviewed, so only the same link for
      // the same kind of task counts as a duplicate.
      const key = `${c.type} ${normUrl(c.evidence)}`;
      if (seen.has(key)) f.push("duplicate");
      seen.add(key);
    }
    if (c.work_date && !c.work_date.startsWith(month)) f.push("wrong_month");
    out.set(c.ref, f);
  }
  return out;
}

export function computeTable(file: ClaimsFile, rules: Rules & { hash: string }, team: Team, revision: number): Table {
  const refs = new Set<string>();
  for (const c of file.claims) {
    if (refs.has(c.ref)) throw new Error(`claim ref ${c.ref} is used twice`);
    refs.add(c.ref);
  }
  const flagged = flagClaims(file.claims, file.month, rules, team);
  const points = new Map<string, { pts: number; claims: string[] }>();
  const held: Table["held"] = [];
  const dropped: string[] = [];

  for (const c of file.claims) {
    const f = flagged.get(c.ref) ?? [];
    if (c.resolution === "drop") {
      dropped.push(c.ref);
      continue;
    }
    const accepted =
      c.resolution === "accept" && !f.some((x) => UNACCEPTABLE.includes(x)) && rules.sizes.includes(c.size as never);
    if (f.length && !accepted) {
      held.push({ ref: c.ref, contributor: normHandle(c.contributor), flags: f, text: c.text });
      continue;
    }
    const handle = normHandle(c.contributor);
    const p = rules.points[c.type][c.size as "S" | "M" | "L"];
    const cur = points.get(handle) ?? { pts: 0, claims: [] };
    cur.pts += p;
    cur.claims.push(c.ref);
    points.set(handle, cur);
  }

  const pool = toMicro(rules.pool_usdc);
  const reserve = (pool * BigInt(rules.reserve_pct)) / 100n;
  const distributable = pool - reserve;
  const cap = (((distributable * BigInt(rules.cap_pct)) / 100n) / CENT) * CENT;
  const min = toMicro(rules.min_payout_usdc);
  const totalPts = [...points.values()].reduce((a, b) => a + b.pts, 0);

  const rows: Row[] = [...points.entries()]
    .sort((a, b) => b[1].pts - a[1].pts || a[0].localeCompare(b[0]))
    .map(([handle, { pts, claims }]) => {
      const raw = totalPts ? (distributable * BigInt(pts)) / BigInt(totalPts) : 0n;
      let payout = (raw / CENT) * CENT;
      const capped = payout > cap;
      if (capped) payout = cap;
      const below_min = payout < min;
      if (below_min) payout = 0n;
      const who = team.contributors[handle];
      return { handle, name: who.name, wallet: who.wallet, points: pts, payout_micro: payout, capped, below_min, claims };
    });

  const total = rows.reduce((a, r) => a + r.payout_micro, 0n);
  const body = {
    kind: "payday-table" as const,
    month: file.month,
    revision,
    rules_hash: rules.hash,
    claims_hash: sha256(canonical(file.claims)).slice(0, 12),
    pool_micro: pool,
    reserve_micro: reserve,
    distributable_micro: distributable,
    cap_micro: cap,
    rows,
    held,
    dropped,
    total_points: totalPts,
    total_payout_micro: total,
    to_reserve_micro: pool - total,
  };
  return { ...body, table_hash: tableHash(body) };
}

/** The hash covers who gets what, so any change to a payout changes it. */
export function tableHash(t: Omit<Table, "table_hash" | "approved">): string {
  return sha256(
    canonical({
      month: t.month,
      revision: t.revision,
      rules_hash: t.rules_hash,
      rows: t.rows.map((r) => [r.handle, r.wallet, r.payout_micro]),
    }),
  ).slice(0, 12);
}

export function renderTable(t: Table, claims: ClaimsFile): string {
  const pad = (s: string, n: number) => s.padEnd(n);
  const lpad = (s: string, n: number) => s.padStart(n);
  const lines = [
    `TALLY ${t.month} · r${t.revision} · ${t.table_hash}`,
    `pool ${fmtUsdc(t.pool_micro)} · reserve ${fmtUsdc(t.reserve_micro)} · to share ${fmtUsdc(t.distributable_micro)}`,
    "",
    `${pad("who", 8)}${lpad("pts", 4)}${lpad("USDC", 7)}  wallet`,
    ...t.rows.map(
      (r) =>
        `${pad(r.handle, 8)}${lpad(String(r.points), 4)}${lpad(fmtUsdc(r.payout_micro), 7)}  ${shortAddr(r.wallet)}${r.capped ? " (cap)" : ""}${r.below_min ? " (<min)" : ""}`,
    ),
    `${pad("total", 8)}${lpad(String(t.total_points), 4)}${lpad(fmtUsdc(t.total_payout_micro), 7)}`,
    `${pad("reserve", 12)}${lpad(fmtUsdc(t.to_reserve_micro), 7)}`,
  ];
  const out = ["```", ...lines, "```"];
  const byRef = new Map(claims.claims.map((c) => [c.ref, c]));
  if (t.held.length) {
    out.push("", `Held for the lead (${t.held.length}):`);
    for (const h of t.held) {
      const c = byRef.get(h.ref);
      const what = c ? `${c.type}/${c.size}` : "";
      out.push(`- ${h.ref} @${h.contributor} ${what}: ${h.flags.map((f) => FLAG_TEXT[f]).join("; ")}`);
    }
  }
  if (t.dropped.length) out.push("", `Dropped by the lead: ${t.dropped.join(", ")}`);
  return out.join("\n");
}

function latestRevision(dir: string): number {
  const revs = readdirSync(dir)
    .map((f) => f.match(/^table\.r(\d+)\.json$/))
    .filter(Boolean)
    .map((m) => Number(m![1]));
  return revs.length ? Math.max(...revs) : 0;
}

function main() {
  const [cmd = "draft", ...rest] = process.argv.slice(2);
  const f = flags(rest);
  if (!f.month) throw new Error("--month is required, e.g. --month 2026-11");
  const dir = monthDir(f.month);
  const rules = loadRules();
  const team = loadTeam();

  if (cmd === "draft") {
    const claims = readJson<ClaimsFile>(join(dir, "claims.json"));
    if (claims.month !== f.month) throw new Error(`claims.json is for ${claims.month}, not ${f.month}`);
    const last = latestRevision(dir);
    if (existsSync(join(dir, "table.approved.json"))) {
      throw new Error(`${f.month} already has an approved table. Start a new month instead of redrafting.`);
    }
    let table = computeTable(claims, rules, team, last || 1);
    if (last) {
      const prev = readJson<Table>(join(dir, `table.r${last}.json`));
      const same = prev.claims_hash === table.claims_hash && prev.rules_hash === table.rules_hash;
      if (!same) table = computeTable(claims, rules, team, last + 1);
    }
    writeJson(join(dir, `table.r${table.revision}.json`), table);
    const md = renderTable(table, claims);
    writeFileSync(join(dir, `table.r${table.revision}.md`), md + "\n");
    console.log(md);
    return;
  }

  if (cmd === "approve") {
    const rev = Number(f.rev);
    const last = latestRevision(dir);
    if (!rev || rev !== last) throw new Error(`only the latest draft (r${last}) can be approved, not r${f.rev}`);
    const by = normHandle(f.by);
    if (by !== team.lead) throw new Error(`@${by} isn't the lead (@${team.lead}) in team.yaml`);
    const quote = String(f.quote ?? "");
    if (!/\bapprove/i.test(quote) || !new RegExp(`\\br${rev}\\b`, "i").test(quote)) {
      throw new Error(`the lead's message must say "approve" and name r${rev}; got: ${quote}`);
    }
    const table = readJson<Table>(join(dir, `table.r${rev}.json`));
    if (table.held.length) {
      throw new Error(`r${rev} still has ${table.held.length} held claim(s): ${table.held.map((h) => h.ref).join(", ")}. Accept or drop them first.`);
    }
    const approved = { ...table, approved: { by, at: new Date().toISOString(), quote, message_id: f["message-id"] } };
    writeJson(join(dir, "table.approved.json"), approved);
    console.log(`Table ${f.month} r${rev} (${table.table_hash}) approved by @${by}. Total ${fmtUsdc(BigInt(table.total_payout_micro))} USDC to ${table.rows.filter((r) => BigInt(r.payout_micro) > 0n).length} people.`);
    return;
  }

  if (cmd === "show") {
    const last = latestRevision(dir);
    if (!last) throw new Error(`no draft for ${f.month} yet`);
    const claims = readJson<ClaimsFile>(join(dir, "claims.json"));
    const t = readJson<Table>(join(dir, `table.r${last}.json`));
    console.log(renderTable({ ...t, pool_micro: BigInt(t.pool_micro), reserve_micro: BigInt(t.reserve_micro), distributable_micro: BigInt(t.distributable_micro), total_payout_micro: BigInt(t.total_payout_micro), to_reserve_micro: BigInt(t.to_reserve_micro), rows: t.rows.map((r) => ({ ...r, payout_micro: BigInt(r.payout_micro) })) }, claims));
    return;
  }

  throw new Error(`unknown command ${cmd}: use draft, approve or show`);
}

if (import.meta.main) {
  try {
    main();
  } catch (e) {
    console.error(`tally: ${(e as Error).message}`);
    process.exit(1);
  }
}
