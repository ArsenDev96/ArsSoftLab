// M1.4R.1 (secondary): does browser shutdown time explain the M1.4Q reused-profile discrepancy?
// node sd-profile.mjs <base> <trials> <out.json> [routes]
// One factor varies: after Browser.close, Chrome is killed after 0.3 s (session A's launcher) or given 1.5 s (session
// B's). Each route x variant gets its own new persistent profile, seeded by one visit of that route (closed the same
// way), then <trials> relaunches: HTTP cache cleared, navigate at once, FCP. Unthrottled. Also records the size of the
// profile's persistent Graphite pipeline cache after the run.
import { writeFileSync, rmSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { launch, sleep } from "../../first-paint/scripts/cdp2.mjs";

const [BASE, TRIALS = "5", OUT, ROUTES_ARG = "home,lite,cinematic"] = process.argv.slice(2);
const ROUTES = { home: "/", lite: "/lab-v2?render=lite", cinematic: "/lab-v2" };
const loadOf = (p) => new Promise((ok) => { const off = p.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
const go = async (p, u) => { const l = loadOf(p); await p.send("Page.navigate", { url: u }); await l; };
async function shut(page, graceMs) { page.send("Browser.close").catch(() => {}); await sleep(graceMs); await page.close(); /* kills ~0.3 s later if still running */ }
const dirSize = (d) => !existsSync(d) ? 0 : readdirSync(d, { recursive: true }).reduce((s, f) => { try { const st = statSync(join(d, f)); return s + (st.isFile() ? st.size : 0); } catch { return s; } }, 0);

const results = [];
for (const route of ROUTES_ARG.split(",")) for (const grace of [0, 1200]) { // + the launcher's own 0.3 s: 0.3 s vs 1.5 s total
  const prof = join(tmpdir(), `m14r-profile-${route}-${grace}`);
  rmSync(prof, { recursive: true, force: true });
  const seed = await launch({ profileDir: prof }); await seed.send("Page.enable"); await go(seed, BASE + ROUTES[route]); await sleep(2500); await shut(seed, grace); await sleep(500);
  for (let i = 0; i < Number(TRIALS); i++) {
    const page = await launch({ profileDir: prof });
    await page.send("Page.enable"); await page.send("Network.enable"); await page.send("Network.clearBrowserCache");
    await go(page, BASE + ROUTES[route]); await sleep(1500);
    const fcp = await page.eval(`Math.round(performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint")?.startTime ?? -1)`);
    await shut(page, grace); await sleep(500);
    results.push({ route, killAfterMs: grace + 300, trial: i, fcp });
    console.log(route, grace + 300, i, fcp);
  }
  const cache = dirSize(join(prof, "GPUPersistentCache"));
  results.push({ route, killAfterMs: grace + 300, graphiteCacheBytes: cache });
  console.log(route, grace + 300, "GPUPersistentCache bytes", cache);
  rmSync(prof, { recursive: true, force: true });
}
writeFileSync(OUT, JSON.stringify({ base: BASE, trials: Number(TRIALS), collectedAt: new Date().toISOString(), results }, null, 1));
