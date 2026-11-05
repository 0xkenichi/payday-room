// Lists the narration takes and screenshots in public/, for src/exists.ts.
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pub = join(import.meta.dirname, "..", "public");
const files = ["vo", "shots"].flatMap((d) => readdirSync(join(pub, d)).filter((f) => !f.startsWith(".")).map((f) => `${d}/${f}`));
writeFileSync(join(pub, "manifest.json"), JSON.stringify({ files }, null, 2) + "\n");
console.log(`${files.length} files in public/`);
