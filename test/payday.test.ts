import assert from "node:assert/strict";
import { test } from "node:test";
import { fmtUsdc, loadRules, toMicro, type Team } from "../scripts/lib.ts";
import { checkApprovals, planBatch, type Batch } from "../scripts/pay-batch.ts";
import { computeTable, type Claim, type ClaimsFile } from "../scripts/tally.ts";

const rules = loadRules();
const W = (n: number) => `0x${String(n).padStart(40, "0")}`;
const team: Team = {
  lead: "lead",
  approvers: ["lead", "ops"],
  contributors: {
    ada: { name: "Ada", wallet: W(1) },
    tunde: { name: "Tunde", wallet: W(2) },
    chioma: { name: "Chioma", wallet: W(3) },
    ops: { name: "Ops", wallet: W(4) },
  },
};
const claim = (c: Partial<Claim> & { ref: string; contributor: string }): Claim => ({
  type: "code",
  size: "M",
  size_source: "stated",
  evidence: `https://github.com/x/y/pull/${c.ref}`,
  ...c,
});
const file = (claims: Claim[]): ClaimsFile => ({ month: "2026-11", claims });

test("money rounds down to the cent and formats", () => {
  assert.equal(toMicro("3.00"), 3_000_000n);
  assert.equal(toMicro("0.05"), 50_000n);
  assert.equal(fmtUsdc(1_239_999n), "1.23");
  assert.throws(() => toMicro("1.2345678"));
});

test("payouts follow points, never exceed the pool, and the rest goes to reserve", () => {
  const t = computeTable(
    file([
      claim({ ref: "1", contributor: "ada", type: "code", size: "M" }), // 8
      claim({ ref: "2", contributor: "tunde", type: "community", size: "M" }), // 3
      claim({ ref: "3", contributor: "chioma", type: "docs", size: "M" }), // 5
    ]),
    rules,
    team,
    1,
  );
  assert.equal(t.total_points, 16);
  const pay = Object.fromEntries(t.rows.map((r) => [r.handle, fmtUsdc(r.payout_micro)]));
  // distributable 2.70; cap 35% = 0.94; ada's 8/16 = 1.35 is capped
  assert.deepEqual(pay, { ada: "0.94", chioma: "0.84", tunde: "0.50" });
  assert.equal(t.total_payout_micro + t.to_reserve_micro, t.pool_micro);
  assert.ok(t.rows.find((r) => r.handle === "ada")!.capped);
});

test("unclear, unproven, unknown and duplicate claims are held, not paid", () => {
  const t = computeTable(
    file([
      claim({ ref: "1", contributor: "ada" }),
      claim({ ref: "2", contributor: "ada", evidence: "https://github.com/x/y/pull/1" }), // duplicate link, same type
      claim({ ref: "3", contributor: "tunde", evidence: undefined }),
      claim({ ref: "4", contributor: "kola" }),
      claim({ ref: "5", contributor: "chioma", size_source: "inferred" }),
      claim({ ref: "6", contributor: "chioma", type: "vibes" }),
      claim({ ref: "7", contributor: "chioma", type: "review", size: "S", evidence: "https://github.com/x/y/pull/1" }), // review of PR 1 is fine
    ]),
    rules,
    team,
    1,
  );
  const held = Object.fromEntries(t.held.map((h) => [h.ref, h.flags]));
  assert.deepEqual(held, {
    "2": ["duplicate"],
    "3": ["no_evidence"],
    "4": ["unknown_contributor"],
    "5": ["unclear_size"],
    "6": ["unknown_task"],
  });
  assert.deepEqual(t.rows.map((r) => r.handle).sort(), ["ada", "chioma"]);
});

test("a lead can accept a guessed size but not an unknown contributor", () => {
  const t = computeTable(
    file([
      claim({ ref: "1", contributor: "chioma", size_source: "inferred", resolution: "accept" }),
      claim({ ref: "2", contributor: "kola", resolution: "accept" }),
      claim({ ref: "3", contributor: "ada", resolution: "drop" }),
    ]),
    rules,
    team,
    1,
  );
  assert.deepEqual(t.rows.map((r) => r.handle), ["chioma"]);
  assert.deepEqual(t.held.map((h) => h.ref), ["2"]);
  assert.deepEqual(t.dropped, ["3"]);
});

function approvedBatch(): Batch {
  const t = computeTable(
    file([claim({ ref: "1", contributor: "ada" }), claim({ ref: "2", contributor: "ops", type: "docs" })]),
    rules,
    team,
    1,
  );
  return planBatch({ ...t, approved: { by: "lead", at: "2026-11-05T00:00:00Z", quote: "approve table r1" } }, team, W(9) as `0x${string}`, "2026-11-05T10:00:00Z");
}

test("a batch id changes when anything about the money changes", () => {
  const b = approvedBatch();
  assert.match(b.batch_id, /^PAY-2026-11-[0-9a-f]{6}$/);
  const other = planBatch(
    { ...computeTable(file([claim({ ref: "1", contributor: "ada", size: "L" })]), rules, team, 1), approved: { by: "lead", at: "", quote: "" } },
    team,
    W(9) as `0x${string}`,
    "2026-11-05T10:00:00Z",
  );
  assert.notEqual(b.batch_id, other.batch_id);
});

test("two different approvers must quote the batch id, after it was posted", () => {
  const b = approvedBatch();
  const ok = (by: string, text = `approve ${b.batch_id}`, at = "2026-11-05T10:05:00Z") => ({ by, text, at });

  assert.equal(checkApprovals(b, [ok("lead")], team, rules).ok, false);
  assert.equal(checkApprovals(b, [ok("lead"), ok("lead")], team, rules).ok, false);
  assert.equal(checkApprovals(b, [ok("lead"), ok("stranger")], team, rules).ok, false);
  assert.equal(checkApprovals(b, [ok("lead"), ok("ops")], team, rules).ok, false, "ops is paid in this batch");
  assert.equal(checkApprovals(b, [ok("lead"), { by: "ops", text: "approve PAY-2026-11-000000" }], team, rules).ok, false);
  assert.equal(checkApprovals(b, [ok("lead"), ok("ops", undefined, "2026-11-05T09:00:00Z")], team, rules).ok, false);
  assert.equal(checkApprovals(b, [ok("lead", `don't approve ${b.batch_id} yet`)], team, rules).counted.length, 0);

  const team2: Team = { ...team, approvers: ["lead", "treasurer2"] };
  assert.equal(checkApprovals(b, [ok("@Lead"), ok("treasurer2")], team2, rules).ok, true);
});
