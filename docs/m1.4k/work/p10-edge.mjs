// Edge smoke test (the same checks as Firefox, over CDP): CHROME_PATH=<msedge.exe> node p10-edge.mjs
import { ARRIVE, IDS, POWERED, REST, open, save, sleep } from "./lib.mjs";
const { page, errors, hover, away, read, settle, shot } = await open("/lab-v2", { gpu: true });
const r0 = await read();
const out = { ua: await page.eval("navigator.userAgent"), all_at_rest: IDS.every((o) => REST[o](r0[o])), stations: {} };
await shot("edge-idle.png");
for (const id of IDS) {
  await hover(id);
  await sleep(ARRIVE[id] * 0.5);
  const mid = await read();
  const on = await settle((s) => POWERED[id](s[id]), 8000);
  await sleep(300);
  if (id === "experience") await shot("edge-experience.png");
  await away();
  const off = await settle((s) => IDS.every((o) => REST[o](s[o])), 6000);
  out.stations[id] = { spark_mid: mid.sparks[id] > 0, powered: on, rest_after: off };
}
out.errors = errors;
await page.close();
save("edge.json", out);
console.log(JSON.stringify(out));
