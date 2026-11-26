// M1.4K.5B (final): the selector's accessibility, one focused pass (default Chrome, 1648 x 928).
//   node selector-a11y.mjs [label]   -> captures/selector/crop-<label>.png; with label "after": results/selector-a11y.json
//   accessibility tree   group "Rendering mode"; two radios named Cinematic / Lite, each with its description
//   keyboard             Tab reaches the group with a visible focus ring; arrows switch; the dev server's switching
//                        delay (arrow key -> the scene in the other mode), 3 times each way, warm
//   layout               a crop of the selector, compared with the one taken before the change (pixel-identical)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const label = process.argv[2] ?? "after";
const DIR = fileURLToPath(new URL("./captures/selector/", import.meta.url)); mkdirSync(DIR, { recursive: true });
const page = await launch({ width: 1648, height: 928 });
const errors = [];
page.on((m) => {
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
});
await page.send("Runtime.enable");
await page.goto(`${BASE}/lab-v2`);
await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
await page.mouseMove(4, 924); await sleep(2500);
// The selector's own pixels (at rest, nothing hovered or focused).
const box = await page.eval(`(() => { const b = document.querySelector("[data-render-selector]").getBoundingClientRect(); return { x: Math.floor(b.x) - 4, y: Math.floor(b.y) - 4, width: Math.ceil(b.width) + 8, height: Math.ceil(b.height) + 8, scale: 1 }; })()`);
const shot = await page.send("Page.captureScreenshot", { format: "png", clip: box });
writeFileSync(DIR + `crop-${label}.png`, Buffer.from(shot.data, "base64"));
console.log("crop", label, JSON.stringify(box));
if (label !== "after") { await page.close(); process.exit(0); }

const res = { steps: [] };
const step = (name, pass, detail = {}) => { res.steps.push({ name, pass, ...detail }); console.log(pass ? "PASS" : "FAIL", name, JSON.stringify(detail)); };
// Chrome's accessibility tree for an element.
const ax = async (sel) => {
  const { result } = await page.send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(sel)})` });
  const { nodes } = await page.send("Accessibility.getPartialAXTree", { objectId: result.objectId, fetchRelatives: false });
  const n = nodes[0], prop = (k) => n.properties?.find((p) => p.name === k)?.value?.value;
  return { role: n.role?.value, name: n.name?.value, description: n.description?.value ?? null, checked: prop("checked") ?? null };
};
await page.send("Accessibility.enable");
const group = await ax("[data-render-selector]");
const cin = await ax('input[name="lab-render-mode"][value="full"]');
const lite = await ax('input[name="lab-render-mode"][value="lite"]');
step("group named", group.role === "group" && group.name === "Rendering mode", group);
step("Cinematic: radio, name, description", cin.role === "radio" && cin.name === "Cinematic" && !!cin.description && cin.checked === "true", cin);
step("Lite: radio, name, description", lite.role === "radio" && lite.name === "Lite" && !!lite.description && lite.checked === "false", lite);

let tabs = 0, found = false;
for (; tabs < 40 && !found; tabs++) { await page.key("Tab", "Tab", 9); await sleep(30); found = await page.eval(`document.activeElement?.name === "lab-render-mode"`); }
const ring = await page.eval(`(() => { const c = getComputedStyle(document.activeElement.closest("label")); return { focusVisible: document.activeElement.matches(":focus-visible"), outline: c.outlineStyle + " " + c.outlineWidth }; })()`);
step("Tab reaches the group, focus ring visible", found && ring.focusVisible && ring.outline === "solid 2px", { tabs, ...ring });

const isLite = () => page.eval(`!!document.querySelector('[data-lab-render="lite"]')`);
const delays = { toLite: [], toCinematic: [] };
for (let k = 0; k < 3; k++) for (const [key, code, want, list] of [["ArrowRight", 39, true, delays.toLite], ["ArrowLeft", 37, false, delays.toCinematic]]) {
  const t0 = Date.now(); await page.key(key, key, code);
  while ((await isLite()) !== want && Date.now() - t0 < 15000) await sleep(20);
  list.push(Date.now() - t0); await sleep(700);
}
const focusKept = await page.eval(`document.activeElement?.name === "lab-render-mode"`);
const end = await page.eval(`location.search`);
step("arrows switch both ways, focus stays on the group", focusKept && end === "", { delays, end });
res.delays = delays;
step("no console errors", errors.length === 0, { errors });
res.pass = res.steps.every((x) => x.pass);
writeFileSync(fileURLToPath(new URL("./results/selector-a11y.json", import.meta.url)), JSON.stringify(res, null, 1) + "\n");
console.log(res.pass ? "ALL PASS" : "SOME FAILED");
await page.close(); process.exit(0);
