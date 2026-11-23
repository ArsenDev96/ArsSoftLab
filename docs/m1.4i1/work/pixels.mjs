// M1.4I.1A: idle captures, before vs after the fix, and full load vs client-side entry (difference per pixel, 0-255).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "../../../scripts/visual/cdp.mjs";
import { compareImages, prepare } from "../../../scripts/visual/compare.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const page = await launch();
await prepare(page);
for (const p of ["home", "v2"])
  for (const [a, b] of [
    ["before/direct", "after/direct"],
    ["after/direct", "after/client"],
    ["before/direct", "after/client"],
    ["after/direct", "after-404/client"],
    ["after/direct", "before/client"],
  ]) {
    const [x, y] = [join(HERE, `${a}-${p}.png`), join(HERE, `${b}-${p}.png`)];
    if (!existsSync(x) || !existsSync(y)) continue;
    const r = await compareImages(page, x, y);
    console.log(`${p}: ${a} vs ${b}`, JSON.stringify({ max: r.max, mean: r.mean, over2: r.over2, over12: r.over12 }));
  }
await page.close();
process.exit(0);
