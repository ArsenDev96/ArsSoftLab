// M1.4K.5B: where the header's controls and the stations' labels are at 1648 x 928 (scene px boxes), to place the selector.
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const page = await launch({ width: 1648, height: 928 });
await page.goto((process.env.BASE || "http://localhost:3002") + "/lab-v2" + (process.argv[2] ?? ""));
await sleep(2500);
console.log(await page.eval(`JSON.stringify((() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
  const out = {};
  out.nav = r(document.querySelector('header nav'));
  out.navLast = r([...document.querySelectorAll('header nav li')].at(-1));
  out.utilities = r(document.querySelector('header > div.absolute'));
  out.utilKids = [...document.querySelector('header > div.absolute').children].map((e) => [e.tagName, (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20), r(e)]);
  out.selector = document.querySelector('[data-render-selector]') ? r(document.querySelector('[data-render-selector]')) : null;
  out.labels = [...document.querySelectorAll('[data-station]')].map((e) => [e.dataset.station, r(e)]);
  out.hero = r(document.querySelector('main h1') || document.body);
  return out;
})())`));
if (process.env.SHOT) await page.screenshot(process.env.SHOT);
await page.close(); process.exit(0);
