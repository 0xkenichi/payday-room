// The Treasurer agent's only way to move money. It turns the lead-approved
// table into one batch of USDC transfers on Arc testnet, and refuses to send
// until two different approvers from team.yaml have approved that exact batch.
//
//   node scripts/pay-batch.ts balance
//   node scripts/pay-batch.ts plan   --month 2026-11
//   node scripts/pay-batch.ts verify --month 2026-11 --approvals payday/2026-11/approvals.json
//   node scripts/pay-batch.ts send   --month 2026-11 --approvals payday/2026-11/approvals.json
//   node scripts/pay-batch.ts status --month 2026-11
//
// The treasury key is read from the file PAYDAY_ENV points at (default .env)
// when a command needs it, and is never printed, logged or written anywhere.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  LEDGER,
  LEDGER_HEADER,
  ROOT,
  canonical,
  flags,
  fmtUsdc,
  loadRules,
  loadTeam,
  monthDir,
  normHandle,
  readJson,
  readLedger,
  sha256,
  toMicro,
  writeJson,
  type Rules,
  type Team,
} from "./lib.ts";
import type { Table } from "./tally.ts";

// Testnet only. The script refuses any other chain, whatever the RPC says.
export const ARC_TESTNET_ID = 5042002;
export const USDC: Address = "0x3600000000000000000000000000000000000000";
export const EXPLORER = "https://testnet.arcscan.app";
const DEFAULT_RPC = "https://rpc.testnet.arc.network";
const GAS_BUFFER = toMicro("0.05");

const arcTestnet = defineChain({
  id: ARC_TESTNET_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [DEFAULT_RPC] } },
  blockExplorers: { default: { name: "ArcScan", url: EXPLORER } },
  testnet: true,
});

export type Transfer = {
  i: number;
  handle: string;
  wallet: Address;
  amount_micro: string;
  tx_hash?: Hex;
  status?: "success" | "reverted";
  block?: string;
};

export type Batch = {
  kind: "payday-batch";
  batch_id: string;
  month: string;
  table_revision: number;
  table_hash: string;
  chain_id: number;
  token: Address;
  from: Address;
  planned_at: string;
  total_micro: string;
  transfers: Transfer[];
  status: "awaiting_approval" | "sending" | "sent";
  approvals?: Approval[];
  sent_at?: string;
};

export type Approval = { by: string; text: string; at?: string; message_id?: string };

type Env = { rpc: string; key?: Hex; address?: Address };

function loadEnv(needKey: boolean): Env {
  const path = resolve(process.env.PAYDAY_ENV ?? join(ROOT, ".env"));
  const vars: Record<string, string> = {};
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith("#")) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  const rpc = vars.ARC_TESTNET_RPC || vars.ARC_RPC_URL || DEFAULT_RPC;
  const raw =
    vars.TREASURY_PRIVATE_KEY ||
    vars.PRIVATE_KEY ||
    Object.values(vars).find((v) => /^(0x)?[0-9a-fA-F]{64}$/.test(v));
  if (needKey && !raw) throw new Error(`no treasury key in ${path}. Set TREASURY_PRIVATE_KEY there (testnet only).`);
  const key = raw ? ((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex) : undefined;
  const address = key ? privateKeyToAccount(key).address : (vars.TREASURY_ADDRESS as Address | undefined);
  return { rpc, key, address };
}

async function publicClient(env: Env) {
  const client = createPublicClient({ chain: arcTestnet, transport: http(env.rpc) });
  const id = await client.getChainId();
  if (id !== ARC_TESTNET_ID) throw new Error(`RPC is on chain ${id}, not Arc testnet (${ARC_TESTNET_ID}). Refusing.`);
  return client;
}

async function usdcBalance(env: Env, who: Address): Promise<bigint> {
  const client = await publicClient(env);
  return client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [who] });
}

export function batchId(month: string, body: unknown): string {
  return `PAY-${month}-${sha256(canonical(body)).slice(0, 6)}`;
}

export function planBatch(table: Table, team: Team, from: Address, plannedAt: string): Batch {
  if (!table.approved) throw new Error("the table isn't approved by the lead yet");
  const transfers: Transfer[] = table.rows
    .filter((r) => BigInt(r.payout_micro) > 0n)
    .map((r, i) => {
      const member = team.contributors[r.handle];
      if (!member) throw new Error(`@${r.handle} is in the table but not in team.yaml`);
      if (member.wallet.toLowerCase() !== r.wallet.toLowerCase()) {
        throw new Error(`@${r.handle}'s wallet changed since the table was approved. Redraft the table.`);
      }
      return { i: i + 1, handle: r.handle, wallet: r.wallet as Address, amount_micro: BigInt(r.payout_micro).toString() };
    });
  if (!transfers.length) throw new Error("the approved table pays nobody");
  const total = transfers.reduce((a, t) => a + BigInt(t.amount_micro), 0n);
  if (total > BigInt(table.distributable_micro)) throw new Error("the table pays out more than the distributable pool");
  const body = {
    month: table.month,
    table_hash: table.table_hash,
    chain_id: ARC_TESTNET_ID,
    token: USDC,
    from,
    transfers: transfers.map((t) => [t.handle, t.wallet, t.amount_micro]),
  };
  return {
    kind: "payday-batch",
    batch_id: batchId(table.month, body),
    month: table.month,
    table_revision: table.revision,
    table_hash: table.table_hash,
    chain_id: ARC_TESTNET_ID,
    token: USDC,
    from,
    planned_at: plannedAt,
    total_micro: total.toString(),
    transfers,
    status: "awaiting_approval",
  };
}

const NEGATIVE = /\b(don'?t|do not|not|no|reject|rejected|hold|wait|stop)\b/i;

/** Which approvals count for this batch, and why the others don't. */
export function checkApprovals(batch: Batch, approvals: Approval[], team: Team, rules: Rules) {
  const recipients = new Set(batch.transfers.map((t) => t.handle));
  const counted: Approval[] = [];
  const problems: string[] = [];
  const phrase = new RegExp(`\\b${rules.approval_phrase}\\b`, "i");
  for (const a of approvals) {
    const by = normHandle(a.by);
    const text = String(a.text ?? "");
    if (!team.approvers.includes(by)) problems.push(`@${by} isn't an approver in team.yaml`);
    else if (!phrase.test(text) || !text.toUpperCase().includes(batch.batch_id.toUpperCase()))
      problems.push(`@${by}'s message doesn't say "${rules.approval_phrase} ${batch.batch_id}"`);
    else if (NEGATIVE.test(text)) problems.push(`@${by}'s message reads as a refusal or a hold`);
    else if (a.at && new Date(a.at) < new Date(batch.planned_at)) problems.push(`@${by} approved before the batch was posted`);
    else if (recipients.has(by)) problems.push(`@${by} is paid in this batch, so can't approve it`);
    else if (counted.some((c) => normHandle(c.by) === by)) problems.push(`@${by} already approved; it counts once`);
    else counted.push({ ...a, by });
  }
  return { ok: counted.length >= rules.approvals_required, counted, problems, needed: rules.approvals_required };
}

function renderPlan(b: Batch, balance: bigint | null): string {
  const lines = [
    `BATCH ${b.batch_id} · Arc testnet · USDC`,
    `table ${b.month} r${b.table_revision} (${b.table_hash})`,
    "",
    ...b.transfers.map((t) => `${String(t.i).padStart(2)}. ${t.handle.padEnd(8)}${fmtUsdc(BigInt(t.amount_micro)).padStart(6)}  ${t.wallet}`),
    "",
    `total ${fmtUsdc(BigInt(b.total_micro))} USDC from ${b.from}`,
    ...(balance === null ? [] : [`treasury holds ${fmtUsdc(balance)} USDC`]),
  ];
  return ["```", ...lines, "```", "", `Two approvers, reply exactly: approve ${b.batch_id}`].join("\n");
}

function renderSent(b: Batch): string {
  const lines = b.transfers.map(
    (t) => `${t.status === "success" ? "✅" : "❌"} @${t.handle} ${fmtUsdc(BigInt(t.amount_micro))} USDC: ${EXPLORER}/tx/${t.tx_hash}`,
  );
  return [
    `PAID ${b.batch_id}: ${b.transfers.length} transfers, ${fmtUsdc(BigInt(b.total_micro))} USDC on Arc testnet.`,
    `Approved by ${(b.approvals ?? []).map((a) => `@${a.by}`).join(" and ")}.`,
    "",
    ...lines,
    "",
    `Treasury: ${EXPLORER}/address/${b.from}`,
    `Written to ledger.csv.`,
  ].join("\n");
}

function appendLedger(b: Batch, t: Transfer) {
  if (!existsSync(LEDGER)) writeFileSync(LEDGER, LEDGER_HEADER + "\n");
  const row = [
    new Date().toISOString(),
    b.month,
    b.batch_id,
    t.handle,
    t.wallet,
    fmtUsdc(BigInt(t.amount_micro)),
    t.tx_hash,
    `${EXPLORER}/tx/${t.tx_hash}`,
    `r${b.table_revision}`,
    (b.approvals ?? []).map((a) => a.by).join("+"),
  ];
  appendFileSync(LEDGER, row.join(",") + "\n");
}

async function main() {
  const [cmd = "status", ...rest] = process.argv.slice(2);
  const f = flags(rest);
  const rules = loadRules();
  const team = loadTeam();

  if (cmd === "balance") {
    const env = loadEnv(false);
    if (!env.address) throw new Error("no treasury key or TREASURY_ADDRESS in the env file");
    const bal = await usdcBalance(env, env.address);
    console.log(`Treasury ${env.address}: ${fmtUsdc(bal)} USDC on Arc testnet. ${EXPLORER}/address/${env.address}`);
    return;
  }

  if (!f.month) throw new Error("--month is required, e.g. --month 2026-11");
  const dir = monthDir(f.month);
  const batchPath = join(dir, "batch.json");

  if (cmd === "plan") {
    if (readLedger().some((r) => r.month === f.month)) throw new Error(`${f.month} is already in ledger.csv. A month is paid once.`);
    if (existsSync(batchPath)) {
      const prev = readJson<Batch>(batchPath);
      if (prev.status !== "awaiting_approval") throw new Error(`${prev.batch_id} is already ${prev.status}.`);
    }
    const table = readJson<Table>(join(dir, "table.approved.json"));
    const env = loadEnv(false);
    if (!env.address) throw new Error("no treasury key or TREASURY_ADDRESS in the env file");
    const batch = planBatch(table, team, env.address, new Date().toISOString());
    if (existsSync(batchPath)) {
      const prev = readJson<Batch>(batchPath);
      if (prev.batch_id === batch.batch_id) batch.planned_at = prev.planned_at;
    }
    const bal = await usdcBalance(env, env.address);
    if (bal < BigInt(batch.total_micro) + GAS_BUFFER) {
      throw new Error(`treasury holds ${fmtUsdc(bal)} USDC but the batch needs ${fmtUsdc(BigInt(batch.total_micro) + GAS_BUFFER)} with gas. Top it up from https://faucet.circle.com first.`);
    }
    writeJson(batchPath, batch);
    console.log(renderPlan(batch, bal));
    return;
  }

  const batch = readJson<Batch>(batchPath);

  if (cmd === "status") {
    console.log(batch.status === "sent" ? renderSent(batch) : renderPlan(batch, null));
    console.log(`\nstatus: ${batch.status}`);
    return;
  }

  if (cmd === "verify" || cmd === "send") {
    if (!f.approvals) throw new Error("--approvals <file> is required");
    const approvals = readJson<Approval[]>(resolve(f.approvals));
    const check = checkApprovals(batch, approvals, team, rules);
    const summary = `${check.counted.length} of ${check.needed} approvals for ${batch.batch_id}: ${check.counted.map((a) => `@${a.by}`).join(", ") || "none"}`;
    if (cmd === "verify" || !check.ok) {
      console.log(summary);
      for (const p of check.problems) console.log(`- not counted: ${p}`);
      if (!check.ok) {
        if (cmd === "send") throw new Error(`not sending: ${check.needed} different approvers must approve ${batch.batch_id}`);
        process.exitCode = 2;
      }
      return;
    }
    if (batch.status === "sent") throw new Error(`${batch.batch_id} was already sent`);
    if (readLedger().some((r) => r.batch_id !== batch.batch_id && r.month === batch.month)) {
      throw new Error(`${batch.month} was already paid by another batch`);
    }

    const env = loadEnv(true);
    if (env.address!.toLowerCase() !== batch.from.toLowerCase()) throw new Error("the env key isn't the treasury this batch was planned from");
    const pub = await publicClient(env);
    const wallet = createWalletClient({ account: privateKeyToAccount(env.key!), chain: arcTestnet, transport: http(env.rpc) });
    batch.status = "sending";
    batch.approvals = check.counted;
    writeJson(batchPath, batch);

    for (const t of batch.transfers) {
      if (t.status === "success") continue;
      if (!t.tx_hash) {
        t.tx_hash = await wallet.writeContract({
          address: USDC,
          abi: erc20Abi,
          functionName: "transfer",
          args: [t.wallet, BigInt(t.amount_micro)],
        });
        writeJson(batchPath, batch); // keep the hash even if the wait below dies
      }
      const receipt = await pub.waitForTransactionReceipt({ hash: t.tx_hash });
      t.status = receipt.status;
      t.block = receipt.blockNumber.toString();
      writeJson(batchPath, batch);
      if (receipt.status === "success") appendLedger(batch, t);
      console.error(`${t.i}/${batch.transfers.length} @${t.handle} ${receipt.status} ${t.tx_hash}`);
    }
    batch.status = "sent";
    batch.sent_at = new Date().toISOString();
    writeJson(batchPath, batch);
    const md = renderSent(batch);
    writeFileSync(join(dir, "receipts.md"), md + "\n");
    console.log(md);
    return;
  }

  throw new Error(`unknown command ${cmd}: use balance, plan, verify, send or status`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`pay-batch: ${(e as Error).message}`);
    process.exit(1);
  });
}
