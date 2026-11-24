// M1.4I.1E: the scene at rest and Playground raised, for the diagrams (full frame 1648 x 928).  node shots.mjs <label>
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { POWERED, open, sleep } from "../../m1.4i/work/lib.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const L = await open("/lab-v2", { gpu: true });
const shot = async (n) => writeFileSync(join(HERE, n), Buffer.from((await L.page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
await shot("scene-rest.png");
await L.page.mouseMove(L.cam.x + 1205 * L.cam.k, L.cam.y + 440 * L.cam.k);
await L.settle((s) => POWERED.playground(s.playground), 8000);
await sleep(900);
await shot("scene-playground.png");
console.log(L.cam);
await L.page.close();
process.exit(0);
