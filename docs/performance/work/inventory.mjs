// Animation lag diagnosis: read-only inventory. Overdraw at rest, the CSS filters, and what animates during one activation.
//   node inventory.mjs [station]   -> results/inventory.json
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const id = process.argv[2] ?? "engineering";
const page = await launch({ width: 1648, height: 928, gpu: false });
await page.goto((process.env.BASE || "http://localhost:3002") + "/lab-v2");
await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
await page.mouseMove(4, 924); await sleep(2500);
const AREA = `const V = innerWidth * innerHeight, vis = (e) => { const r = e.getBoundingClientRect(), w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); return w * h / V; };
  const shown = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false; } return true; };`;
const rest = await page.eval(`(() => { ${AREA}
  const all = [...document.querySelectorAll(".lab-camera *")], cs = new Map(all.map((e) => [e, getComputedStyle(e)]));
  const drawn = all.filter((e) => (e.tagName === "IMG" || e.tagName === "svg" || cs.get(e).backgroundImage !== "none" || cs.get(e).maskImage !== "none" || cs.get(e).mixBlendMode !== "normal") && shown(e));
  const blend = all.filter((e) => cs.get(e).mixBlendMode !== "normal");
  return { overdrawVisible: +drawn.reduce((t, e) => t + vis(e), 0).toFixed(1), overdrawAllIncludingHidden: +all.filter((e) => e.tagName === "IMG" || cs.get(e).maskImage !== "none" || cs.get(e).mixBlendMode !== "normal").reduce((t, e) => t + vis(e), 0).toFixed(1),
    fullFrameBlendShown: blend.filter((e) => vis(e) > 0.5 && shown(e)).length, fullFrameBlendHidden: blend.filter((e) => vis(e) > 0.5 && !shown(e)).length,
    filters: all.filter((e) => cs.get(e).filter !== "none").map((e) => [e.className?.baseVal ?? e.className, cs.get(e).filter.slice(0, 60), +vis(e).toFixed(3)]),
    svgFilters: [...document.querySelectorAll(".lab-camera filter")].map((f) => [f.id, f.innerHTML.slice(0, 80)]) }; })()`);
await page.mouseMove(...Object.values(await page.center(`[data-hotspot="${id}"]`)));
await sleep(900);
const during = await page.eval(`(() => { ${AREA}
  const a = document.getAnimations(), t = new Set(a.map((x) => x.effect?.target).filter(Boolean));
  const big = [...t].filter((e) => vis(e) > 0.5);
  // Elements whose computed style depends on an animating inherited number are not listed by getAnimations: count descendants of animating scopes.
  const desc = [...t].reduce((n, e) => n + e.querySelectorAll("*").length, 0);
  return { animations: a.length, targets: t.size, fullFrameTargets: big.length, fullFrameTargetNames: big.slice(0, 12).map((e) => (e.className?.baseVal ?? e.className) || e.tagName), descendantsOfTargets: desc,
    props: Object.entries(a.reduce((o, x) => { const p = x.transitionProperty ?? x.animationName ?? "waapi"; o[p] = (o[p] ?? 0) + 1; return o; }, {})).sort((p, q) => q[1] - p[1]).slice(0, 15) }; })()`);
const out = { station: id, rest, during };
console.log(JSON.stringify(out, null, 1));
writeFileSync(join(HERE, "results", "inventory.json"), JSON.stringify(out, null, 1) + "\n");
await page.close(); process.exit(0);
