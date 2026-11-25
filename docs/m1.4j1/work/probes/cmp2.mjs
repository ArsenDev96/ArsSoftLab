import { readFileSync, readdirSync } from "node:fs";
import { viewer } from "./px2.mjs";
const px = await viewer();
const put = async (k, f) => px.put(k, readFileSync(f).toString("base64"));
const B = "cap/j1/before/1648-gpu-0/", B2 = "cap/j1/before/1648-gpu-1/", A = `cap/j1/${process.argv[2] ?? "after"}/1648-gpu-0/`;
for (const f of readdirSync(A).sort()) { await put("a", A + f); await put("b", B + f); await put("c", B2 + f); const BX = [1040, 290, 1362, 545]; const d1 = await px.diffx("a", "b", BX), d2 = await px.diffx("a", "c", BX), n = await px.diffx("b", "c", BX); const d = d1.over2 <= d2.over2 ? d1 : d2; console.log(f.padEnd(28), "after vs nearest before", JSON.stringify(d), "| noise", JSON.stringify([n.max, n.over2])); }
for (const s of ["1648", "1920", "1366", "1024", "home"]) { await put("a", `cap/j1/sizes/after-${s}.png`); await put("b", `cap/j1/sizes/before-${s}.png`); await put("c", `cap/j1/sizes/before2-${s}.png`); const k = s === "home" ? 1 : +s / 1648, BX = s === "1920" ? [1210, 340, 1590, 640] : s === "1366" ? [860, 235, 1135, 455] : s === "1024" ? [700, 190, 900, 380] : [1040, 290, 1362, 545]; const d1 = await px.diffx("a", "b", s === "home" ? [-1, -1, -1, -1] : BX), d2 = d1; console.log("idle", s, JSON.stringify(d1.over2 <= d2.over2 ? d1 : d2), "| noise", JSON.stringify(await px.diffx("b", "c", BX))); }
const J = (f) => JSON.parse(readFileSync(f)); const a = J("out/j1-refs-after.json"), b = J("out/j1-refs-before.json");
for (const k of Object.keys(b)) if (Array.isArray(b[k]) && k !== "errors" && k !== "focus") { const ch = {}; let n = 0; b[k].forEach((r, j) => [...r].forEach((c, i) => { if (c !== a[k][j][i]) { n++; const q = c + ">" + a[k][j][i]; ch[q] = (ch[q] ?? 0) + 1; } })); console.log("hit map", k, n, JSON.stringify(ch)); }
console.log("focus same", JSON.stringify(a.focus) === JSON.stringify(b.focus), "home markup same", a.homeMarkup === b.homeMarkup, "errors", a.errors);
await px.close(); process.exit(0);
