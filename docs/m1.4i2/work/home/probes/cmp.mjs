import { readFileSync, writeFileSync } from "node:fs";
import { viewer } from "./px.mjs";
const D = "cap/visual/1648-gpu-0/";
const px = await viewer();
const put = (k, f) => px.put(k, readFileSync(D + f + ".png").toString("base64"));
await put("idle", "idle"); await put("tone", "idle-tone");
const out = { tone: await px.diff("idle", "tone"), lumDefault: await px.lum("idle"), lumTone: await px.lum("tone"), rest: {}, powered: {} };
for (const id of ["engineering", "educational", "playground", "creative", "experience"]) {
  await put("x", id + "-rest-after"); out.rest[id] = await px.diff("idle", "x");
  await put("y", id + "-powered"); out.powered[id] = await px.diff("idle", "y");
}
console.log(JSON.stringify(out, null, 1)); writeFileSync("out/cmp.json", JSON.stringify(out, null, 1));
await px.close(); process.exit(0);
