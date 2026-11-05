# Payout rules

These are the rules the **Tally agent** applies every payday and the **Treasurer agent** enforces before it sends anything. People change them by editing this file in a pull request, not by asking an agent in chat.

The block at the bottom is what the scripts read. The prose explains it.

## The pool

- **Monthly pool:** 3.00 USDC (Arc testnet). A real team would set this to its own budget; the rules don't change with the number.
- **Reserve:** 10% of the pool stays in the treasury every month. It covers gas, disputes and late claims.
- **Distributable:** the pool minus the reserve, shared by points.
- **Cap:** nobody gets more than 35% of the distributable amount in one month. Anything over the cap goes back to the reserve instead of being spread around, so a cap never quietly changes someone else's payout.
- **Minimum:** a payout under 0.05 USDC isn't sent. It goes to the reserve.
- **Rounding:** every payout is rounded **down** to the cent. The leftover goes to the reserve.

Each contributor's payout is `distributable × their points ÷ everyone's points`, then capped and rounded.

## Points per task

| Task | S | M | L | Evidence that counts |
|---|---|---|---|---|
| `code` | 3 | 8 | 20 | A merged pull request or a commit on the main branch |
| `docs` | 2 | 5 | 12 | The published page or the merged docs change |
| `design` | 2 | 6 | 15 | The design file or the shipped screen |
| `community` | 1 | 3 | 8 | The event page, thread, recording or attendance list |
| `review` | 1 | 2 | 4 | The reviewed pull request, with the review visible |
| `bug` | 1 | 2 | 5 | The issue, with steps to reproduce |

**Sizes:** `S` is under about two hours. `M` is half a day to two days. `L` is more than two days, or a whole feature.

## How to post a claim

Post one message per piece of work in the Payday Room, in plain words. Say what you did, how big it was and where the proof is. For example:

> claim: fixed the rounding bug in the payout script, about a day of work. https://github.com/0xkenichi/payday-room/pull/4

A lead may post a claim for someone else by starting with `for @handle`. The Tally agent reads the type and the size from your words. If it has to guess, it says so and flags the claim.

## What gets flagged

The Tally agent never decides these itself. A flagged claim is **held**: it's left out of the table until a lead accepts or drops it in the thread.

1. **No evidence:** there's no link.
2. **Unknown contributor:** the person isn't in `team.yaml`, or has no wallet on file.
3. **Unknown task:** the work doesn't fit a task type above.
4. **Unclear size:** the claim doesn't say how big the work was, so the Tally agent proposes a size and flags it.
5. **Duplicate:** the same link is claimed twice.
6. **Wrong month:** the work was done outside the payday month.

## Who approves what

- **The lead** reviews the draft table in the thread. They can change a size, accept or drop a flagged claim, or approve the table. Only the lead's approval turns a draft into an approved table.
- **The treasury** needs **two different approvers** from `team.yaml` before any money moves. Each approval must quote the batch id, for example `approve PAY-2026-11-3f9a1c`, so an approval can't be reused for a different batch.
- **An approver who is paid in a batch can't count as one of its two approvals.**
- **A batch is sent once.** The ledger records every transfer, and a month that's already been paid can't be paid again.

## Machine-readable rules

The scripts read this block. Keep it in step with the prose above.

```yaml payout-rules
pool_usdc: "3.00"
reserve_pct: 10
cap_pct: 35
min_payout_usdc: "0.05"
sizes: [S, M, L]
points:
  code:      { S: 3, M: 8, L: 20 }
  docs:      { S: 2, M: 5, L: 12 }
  design:    { S: 2, M: 6, L: 15 }
  community: { S: 1, M: 3, L: 8 }
  review:    { S: 1, M: 2, L: 4 }
  bug:       { S: 1, M: 2, L: 5 }
approvals_required: 2
approval_phrase: approve
```
