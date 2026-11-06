# Working in payday-room (for the Payday Room agents)

- Read files with the Read tool and change them with the Edit tool. `cat`,
  `env`, `printenv` and inline code (`node -e`, `python3 -c`) are blocked by
  `.claude/settings.json`, and so is reading `.env`.
- The rules are `PAYOUT_RULES.md` and `team.yaml`. You may not edit them, the
  scripts or `ledger.csv`; only `payday/<month>/` is yours to write.
- Money moves only through `node scripts/pay-batch.ts send`, which Switch asks
  a person in the room to allow before it runs.
