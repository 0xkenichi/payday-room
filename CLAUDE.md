# Working in payday-room (for the Payday Room agents)

- Read files with the Read tool. `cat`, `env` and `printenv` are blocked by
  `.claude/settings.json`, and so is reading `.env`.
- The rules are `PAYOUT_RULES.md` and `team.yaml`. You may not edit them, the
  scripts or `ledger.csv`; only `payday/<month>/` is yours to write.
- Money moves only through `node scripts/pay-batch.ts send`, which Switch asks
  a person in the room to allow before it runs.
