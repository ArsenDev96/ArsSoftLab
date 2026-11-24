// M1.4I.2: every scene file /lab-v2 loads (idle, then each station visited).  node loaded.mjs [path]  -> loaded.json
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IDS, launch, sleep } from "../../m1.4i/work/lib.mjs";
const page = await launch({ gpu: true });
await page.goto("http://localhost:3002/lab-v2?floor=approved");
for (const id of IDS) { const c = await page.center(`[data-hotspot="${id}"]`); await page.mouseMove(c.x, c.y); await sleep(1800); await page.mouseMove(4, 924); await sleep(900); }
const u = await page.eval(`[...new Set(performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname).filter((n) => n.startsWith("/scene/")))].sort()`);
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "loaded.json"), JSON.stringify(u, null, 0) + "\n");
console.log(u.length);
await page.close();
process.exit(0);
