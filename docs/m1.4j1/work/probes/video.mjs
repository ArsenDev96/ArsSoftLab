// Real-time screencast of the page, Engineering's area: rise, leave, rise, leave during the rise, quick return, chip.
import { mkdirSync } from "node:fs";
import { recordWebm } from "../../../../scripts/visual/record.mjs";
import { sleep } from "../../../../scripts/visual/cdp.mjs";
const out = process.argv[2];
let c;
const r = await recordWebm({ url: "http://localhost:3002/lab-v2", width: 1648, height: 928, fps: 60, bitrate: 9e6, out,
  prepare: async (p) => { await p.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`); await p.mouseMove(4, 924); await sleep(1200); c = await p.center('[data-hotspot="engineering"]'); await p.mouseMove(c.x, c.y); await sleep(2200); await p.mouseMove(4, 924); await sleep(1800); },
  crop: async () => ({ x: 200, y: 262, w: 640, h: 400, scale: 1.5 }),
  act: async (p) => {
    const on = () => p.mouseMove(c.x, c.y), off = () => p.mouseMove(4, 924);
    await on(); await sleep(3000); await off(); await sleep(1500);
    await on(); await sleep(620 + 250); await off(); await sleep(1300);          // left during the rise
    await on(); await sleep(620 + 900); await off(); await sleep(240); await on(); await sleep(2200); // quick return
    for (let k = 0; k <= 40; k++) { await p.mouseMove(c.x + (455 - c.x) * k / 40, c.y + (361 - c.y) * k / 40); await sleep(16); } await sleep(600); // to the chip
    await off(); await sleep(1500);
  } });
console.log(JSON.stringify(r)); process.exit(0);
