# M1.4R.2–R.3 evidence: Cinematic scene cache

This folder backs [`../SCENE-CACHE-PROTOTYPE.md`](../SCENE-CACHE-PROTOTYPE.md).

**Conditions:**

- Collected on 28 Nov 2026, 15:15–16:10 local time, on an idle machine.
- Home computer with an RTX 4060; Chrome 158 headless.
- Two production servers (`next start`, HTTP/1.1, localhost), built from `f724729` and the same `public/` folder:
  - **baseline:** the committed `next.config.ts`;
  - **prototype:** the same config plus the `/scene/v2/:path*` header rule.
- The baseline was a temporary build in an ignored folder, deleted afterwards.
- No proxy anywhere.

**M1.4R.3** re-checked the final, production-only configuration on a production build and a development server (the `final-*` and `headers-final-*` files).

**Not kept:** screenshots, heatmaps, traces, browser profiles, builds, server logs.

## Results (`results/`)

| File | What it holds |
|---|---|
| `headers.json` | Both servers' response headers for representative URLs: `/scene/v2` files and edge cases, other `/scene` folders, Static Lite, hashed JS and CSS, HTML pages and icons. For scene files it also has the conditional (304), HEAD and Range (206) responses |
| `delivery.json` | Cinematic `/lab-v2`: 2 servers × 2 visit types (`initial`, `repeat`) × 2 networks (`50-20`, `12-70`) × 7 trials. For each trial:<ul><li>timings: FCP, scene visible and fully visible, gate style time, image delivery end;</li><li>scene requests, split by `/scene/v2`: disk-cache hits, wire 304 and wire 200;</li><li>memory-cache hits, network bytes, the Cache-Control the browser recorded;</li><li>failed requests and console messages.</li></ul> |
| `delivery-summary.md` | The median [min–max] and IQR table from `delivery.json`, next to the M1.4R.1 audit's Cinematic cells |
| `delivery-initial-recheck.json` | A second run of the 50 Mbps first-visit cell (both servers, 7 trials) |
| `delivery-order-check.json` | The same cell with the server order swapped (3 trials each). It shows the slow trial 0 follows run position, not the prototype |
| `scope.txt` | The `/scene/` requests of `/`, Lite, Cinematic (desktop and mobile) and a project page, at rest and with each station opened, with their Cache-Control |
| `navigation-smoke.txt`, `project-smoke.txt` | Output of the M1.4P suites against the prototype build: 65 / 65 and 86 / 86 |
| `visual-ab.txt` | Layout-fingerprint and pixel comparisons for 10 resting cases. Pairs: baseline vs prototype, prototype warm (cached images) and baseline warm. Also where the remaining Cinematic differences lie |
| `headers-final-production.json`, `headers-final-development.json` | M1.4R.3: the same header table for the final configuration under `next start` and under `next dev` |
| `final-production-check.json` | M1.4R.3: one Cinematic repeat visit per network on the final production build |
| `final-navigation-smoke.txt`, `final-project-smoke.txt` | M1.4R.3: the M1.4P navigation suite (65 / 65) and representative project pages (AriMap, AZIZ: 38 / 38) on the final production build |
| `visual-final.txt` | M1.4R.3: the 10 resting cases of the final production build against the M1.4R.2 baseline capture |
| `update-demo.txt` | The staleness-bound demonstration on a scratch server |

## Scripts (`scripts/`)

Run them from this folder with Node 22, against production servers (`npm run build`, then `npm run start`). They reuse `../../first-paint/scripts/cdp2.mjs` (measurement) or the repository's `scripts/visual/cdp.mjs` and `compare.mjs`.

| File | Purpose |
|---|---|
| `sc-measure.mjs` | The delivery measurement. It is `../../scene-delivery/scripts/sd-measure.mjs` without its proxy, plus console capture. Usage: `node sc-measure.mjs <out.json> 7 baseline=<url>,prototype=<url> [visits] [nets]` |
| `sc-summary.mjs` | `node sc-summary.mjs <delivery.json> [../../scene-delivery/results/delivery.json]` |
| `sc-headers.mjs` | The header table: `node sc-headers.mjs <out.json> <label>=<url>,…`. It sends an explicit `Cache-Control: max-age=0` on the conditional request, because `fetch()` otherwise adds `no-cache` and the server then answers 200 |
| `sc-scope.mjs` | Which `/scene/` URLs each page loads: `node sc-scope.mjs <url>` |
| `sc-capture.mjs`, `sc-ab.mjs`, `sc-bbox.mjs` | The M1.4P resting-state capture (with an optional `warm` visit), its A/B comparison, and the bounding box of pixel differences |
| `m14p-nav.mjs`, `m14p-projects.mjs` | The M1.4P navigation and project-page suites, copied unchanged apart from import paths and an optional `SHOTS` directory |
| `sc-update-demo.mjs` | Shows an in-place overwrite staying stale within the lifetime, a new URL being fetched at once, and revalidation after expiry. Uses port 3105 and a file in the OS temp folder |
