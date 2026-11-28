// M1.4R.2: node sc-scope.mjs <base>.
// Which /scene/ URLs each page requests, at rest and with every station opened, and the Cache-Control each one got.
import { launch, sleep } from "../../../../scripts/visual/cdp.mjs";
const BASE = process.argv[2];
const STATIONS = ["engineering", "educational", "creative", "experience", "playground"];
const CASES = [["home", "/", (s) => `/?station=${s}`], ["lite", "/lab-v2?render=lite", (s) => `/lab-v2?station=${s}&render=lite`], ["cinematic", "/lab-v2", (s) => `/lab-v2?station=${s}`], ["project", "/lab-v2/projects/arimap", null], ["mobile", "/lab-v2", (s) => `/lab-v2?station=${s}`]];
const out = {};
for (const [name, path, st] of CASES) {
  const page = await launch(name === "mobile" ? { width: 390, height: 844, touch: true } : {});
  const seen = new Map();
  page.on((m) => { if (m.method === "Network.responseReceived") { const u = new URL(m.params.response.url); if (u.pathname.startsWith("/scene/")) seen.set(u.pathname, m.params.response.headers["cache-control"] ?? m.params.response.headers["Cache-Control"]); } });
  await page.send("Network.enable");
  await page.goto(BASE + path); await sleep(2500);
  if (st) for (const s of STATIONS) { await page.goto(BASE + st(s)); await sleep(2000); }
  const v2 = [...seen].filter(([p]) => p.startsWith("/scene/v2/")), other = [...seen].filter(([p]) => !p.startsWith("/scene/v2/"));
  out[name] = { total: seen.size, v2: v2.length, v2CacheControl: [...new Set(v2.map(([, c]) => c))], otherDirs: [...new Set(other.map(([p]) => p.split("/").slice(0, 3).join("/")))], otherCacheControl: [...new Set(other.map(([, c]) => c))] };
  console.log(name, JSON.stringify(out[name]));
  await page.close();
}
