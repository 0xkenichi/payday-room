# Payday Room demo: narration

Voice: ElevenLabs, model Eleven v4, "Victor Hopo - Deep and Warm" (the same voice as the Tideover and Blinkbox videos). One take per section, saved to `public/vo/<file>.mp3`. Target about 2:50 in total.

The lines are drafts until the recorded payday is final: the numbers and ids get filled in from the real run.

| File | Section | Line |
|---|---|---|
| opener.mp3 | Opener | [casually] So... I've been paid late by crypto projects. Like, three months late. [sighs] And honestly, it's rarely bad faith. It's that nobody wants to sit down and tally who did what this month... and nobody should press send on the team's money alone. |
| intro.mp3 | Intro | [warmly] So I built Payday Room. It's a Telegram group, wired up with Switch, where two Claude Code agents do the boring part... and people keep every decision. |
| claims.mp3 | Claims | Here's the room. People post what they did, in plain words, with a link. Then I ask Tally, the first agent, to tally the month. |
| tally.mp3 | Tally | Tally reads the room through Switch, writes the claims down, and runs our payout rules. Points per task, a pool, a reserve, a cap. [thoughtful] And it doesn't just guess. No link, a size it had to guess, someone who isn't on the team... those get held, for me to decide. |
| lead.mp3 | Lead | So I answer right in the thread. Accept this one, drop that one... and approve the table. Only the lead can do that, and the script checks. |
| treasurer.mp3 | Treasurer | Then Treasurer takes over. It turns the table into one batch of USDC transfers on Arc testnet, and the batch id is a hash of who gets what, so an approval can't be reused. It needs two different approvers to quote that id. One isn't enough... [chuckles] it just refuses. With two, Switch puts an approval card right in the chat, and a person has to press Allow. |
| receipts.mp3 | Receipts | And there it is. Every transfer, every receipt, linked on Arcscan... and the ledger's updated, so next month starts clean. |
| outro.mp3 | Outro | [warmly] So that's Payday Room. Built for Flip the Switch, in the business workflow track. Without Switch, there's no room, no approvals, no receipts. The code's on GitHub... go have a look. |
