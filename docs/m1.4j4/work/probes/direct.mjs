// M1.4J.4: the direct link's first settled frame.   node direct.mjs <out.png>
import { writeFileSync } from "node:fs";
import { open, sleep } from "../../../m1.4i/work/lib.mjs";
const p = await open("/lab-v2?station=experience", { gpu: true }); await sleep(1500);
writeFileSync(process.argv[2], Buffer.from((await p.page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
await p.page.close(); process.exit(0);
