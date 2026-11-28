# M1.4R.1: scene asset delivery and cache audit (28 Nov 2026)

**Branch:** `feat/lab-v2` at `f724729`. Measurement and planning only: no application code, image, header or configuration changed.

**Outcome:** the recommendation (§8) was implemented and accepted in M1.4R.2–R.3, limited to production builds. See [`SCENE-CACHE-PROTOTYPE.md`](SCENE-CACHE-PROTOTYPE.md). The audit below is unchanged from when it was written.

**Evidence:** `docs/m1.4l/scene-delivery/`; see its `README.md` for every file. It builds on [`FIRST-PAINT-INVESTIGATION.md`](FIRST-PAINT-INVESTIGATION.md) and [`FIRST-PAINT-SUPPLEMENT.md`](FIRST-PAINT-SUPPLEMENT.md).

**Measurement conditions.** Every measurement here was taken on an **idle machine**: no other server, Node or Chrome process at the start, and nothing else running alongside. So these are uncontended values, unlike much of M1.4Q.

- Machine: home computer with an RTX 4060.
- Browser: Chrome 158.0.8127.88, headless.
- Server: a production build of `f724729`, served by `next start` on localhost (HTTP/1.1).

**Three metrics are kept separate throughout:**

| Metric | Definition |
|---|---|
| **FCP** | The first contentful frame |
| **Scene visible** | Cinematic: the gated layer's opacity first rises above 0. Lite: the plate is ready, but never earlier than FCP |
| **Scene fully visible / ready** | Cinematic: the gate has finished fading in (opacity 1). "Ready" also requires every scene asset to have arrived |

## Summary

**Current behaviour:**

- `/scene/**` is served by Next's `public/` handler with `Cache-Control: public, max-age=0` plus a weak ETag and Last-Modified. So the browser has to revalidate every scene image on every visit.
- Hashed JS, CSS and font files are already `max-age=31536000, immutable`.
- HTML is `no-store`.

**There is no deployment:**

- no hosting or CDN configuration in the repository;
- no GitHub deployments, environments or Pages site;
- no published host name.

So this audit covers the local Next.js server only. Any host's behaviour is unverified.

**Measured on an idle machine** (median of 7 trials; scene fully visible):

| Visit | Cinematic, 50 Mbps / 20 ms | Cinematic, 12 Mbps / 70 ms |
|---|---|---|
| Initial | 1.63 s | 4.49 s, via the 4 s fallback |
| Repeat, current headers (94 revalidations, 22 KB) | 0.99 s | 1.95 s |
| **Repeat, emulated cache lifetime** (94 disk hits, 0 bytes) | **0.55 s** | **0.51 s** |

- **Lite repeat visits are already fast** (0.16–0.22 s): only 6 revalidations, so a cache lifetime makes no measurable difference.
- **Caching doesn't change first visits.**

**Recommendation: Option A,** a bounded browser cache lifetime (`public, max-age=86400`):

- **Scope:** `/scene/v2/**` only. That covers all 66 assets Cinematic's gate waits for, and nothing the homepage or Static Lite loads.
- **Pairs with an authoring rule:** never replace a `/scene/v2` file in place.
- **Option B** (versioned URLs with immutable caching) is the right long-term mechanism once a deployment pipeline exists. It isn't proportionate now: it would touch ~21 scene files, 37 watched modules in all, and force a Static Lite manifest re-record.
- **Nothing has been applied.**

## 1. Asset inventory

Initial, unthrottled load; fresh profile; one load per route. One row per asset is in `scene-delivery/results/scene-assets.csv`.

| Route | Scene requests | Image bytes | Awaited by `PlateGate` | In the gated layer, not awaited | Outside the gate | Full-frame 1672 × 941 files | Last scene asset arrives (localhost) |
|---|---|---|---|---|---|---|---|
| Cinematic `/lab-v2` | 94 (all PNG, all unique) | 5.66 MB | **66 / 4.54 MB** | 12 / 1.01 MB | 16 / 0.10 MB | 21 | 230 ms |
| Static Lite `?render=lite` | 6 (all WebP) | 2.58 MB | — (no gate) | — | 6 / 2.58 MB | 1 (the plate) | 59 ms |
| Homepage `/` | 73 (PNG and WebP) | 1.40 MB | 13 / 0.54 MB | 42 / 0.72 MB | 18 / 0.15 MB | 24 | 175 ms |

**The largest and most important assets:**

| URL | Type | Transfer | Dimensions | Role | Priority | Shared |
|---|---|---|---|---|---|---|
| `/scene/v2/environment/lab-background.png` | PNG | 2,238 KB | 1672 × 941 | Cinematic: awaited by the gate | **Low** (preload) | Cinematic only |
| `/scene/v2/stations/playground.png` | PNG | 630 KB | 1672 × 941 | Cinematic: awaited by the gate | Low | Cinematic only |
| `/scene/v2/m14h4/experience-reveal.png` | PNG | 246 KB | 1656 × 1536 | Cinematic: CSS mask in the gated layer, not awaited | Low | Cinematic only |
| `/scene/v2/m14f/experience.png` | PNG | 183 KB | 1672 × 941 | Cinematic: awaited by the gate | Low | Cinematic only |
| `/scene/static-lite/plate.webp` | WebP | 1,619 KB | 1672 × 941 | Lite: the scene | **High** | Lite only |
| `/scene/static-lite/on-*.webp` (5 files) | WebP | 134–269 KB each | 351–714 × 229–330 | Lite: station sprites | Low | Lite only |
| `/scene/lab-plate.webp` | WebP | 357 KB | 1672 × 941 | `/`: awaited by the gate | Low | `/` only |
| `/scene/power/unpowered.png` | PNG | 111 KB | 1672 × 941 | `/`: awaited by the gate | Low | `/` only |

**Sharing:**

- **Cinematic and Lite share no scene assets.**
- **Cinematic and `/` share 13:** `/scene/activation/core.png` and 12 `/scene/activation/lines/*` files, 72 KB in all, none gated.
- **`/` requests nothing under `/scene/v2/`.**

**How the assets are requested:**

| Route | Preload or `<img>` | SVG `<image>` (crops) | CSS (masks and backgrounds) |
|---|---|---|---|
| Cinematic | 15 | 52 | 27 |
| `/` | 29 | — | 44 |
| Lite | 6 | — | — |

- **Priority:** every gate-awaited asset is fetched at Low priority (64 Low and 2 Medium on Cinematic). Only Lite's plate is High.
- **Not fetched in Chrome:**
  - 51 Cinematic `data-full` fallbacks (1.35 MB). They are full-frame files an SVG layer uses only when the browser lacks `object-view-box`; Chrome has it. Browsers without it would fetch these instead of the crops. Not measured (§11).
  - 2 homepage CSS masks used only on interaction.

## 2. Current response headers (local `next start`)

| Response | Cache-Control | Validators | Render-blocking |
|---|---|---|---|
| Lab HTML (`/`, `/lab-v2`) | `private, no-cache, no-store, max-age=0, must-revalidate` | — | — |
| CSS (1 file, 11 KB) | `public, max-age=31536000, immutable` | ETag | **Yes** (the only render-blocking resource) |
| Font (1 woff2, 32 KB, preloaded) | `public, max-age=31536000, immutable` | ETag | No |
| JS (9 chunks) | `public, max-age=31536000, immutable` | ETag | No |
| `/icon.svg` | `public, max-age=0, must-revalidate` | — | No |
| **Every `/scene/**` file** | **`public, max-age=0`** | Weak ETag `W/"<size>-<mtime>"` and Last-Modified | No |

**Example:** `lab-background.png` returns `W/"22f502-1a203160416"`, which is its size (0x22f502 = 2,290,946 bytes) and modification time.

**The ETag follows the file's modification time, not its content.** So a deployment that rewrites the files (a fresh checkout or copy) would probably change every ETag and turn every revalidation into a full download once, even for unchanged images. That's an inference from the ETag format; no deployment exists to check it on.

**Next.js documents this behaviour** (`node_modules/next/dist/docs`, `public-folder.md`): it "cannot safely cache assets in the `public` folder because they may change", and applies `public, max-age=0`.

- `headers.md`: `Cache-Control` can't be overridden for hashed immutable assets, but "you can set `Cache-Control` headers for other responses".
- **Whether a `headers()` rule overrides the `public/` default in this version is not stated, so it must be verified first** (§9).

## 3. Deployment findings

| Question | Finding |
|---|---|
| Deployment configuration in the repository | **None:** no `vercel.json`, `netlify.toml`, Dockerfile, proxy configuration, `_headers` or CI workflow. `next.config.ts` sets only `reactStrictMode` and `distDir` |
| Documented deployment model | `npm run build`, then `npm run start` (README; `PRODUCTION-VERIFICATION.md`): a Node.js server. The project pages render on request, so there's no static export |
| GitHub | A public repository with no deployments, environments, Pages site, homepage URL or webhooks (read-only API check) |
| Published host | **None found** in the repository or its documentation |

**So, by layer:**

| Layer | Status |
|---|---|
| Local Next.js production server | **Measured:** §2, §5 |
| CDN or reverse proxy | **Not applicable:** none exists. A future host may add its own caching, compression or HTTP/2, and may override or ignore application headers |
| Browser caching | **Measured** against the local server (§6) |
| Expected deployment behaviour | **Unverified.** Every recommendation here assumes the host passes the application's `Cache-Control` through unchanged, and has to be re-checked on the real host |

## 4. Scene-loading dependency chain

**Cinematic `/lab-v2`:**

1. **HTML** (`no-store`, 81 KB gzip). It carries 15 image preloads and the inline gate script.
2. **The render-blocking CSS and the preloaded font.** Then FCP: header, hero and labels on black.
3. **The gate starts.** `PlateGate`'s inline script runs as its markup is parsed. It waits for **66 assets**: 14 full-frame `<img data-gate>`s, and 52 SVG `<image data-gate>` crops awaited through an `Image` of the crop file. Each has to **load and `decode()`**. A 4 s fallback opens the gate regardless.
4. **The gate opens.** Its style is inserted, and the plate layer fades in over 240 ms: scene first visible, then fully visible.
5. **Not on the gate's path, though fetched by the initial load:**
   - 12 gated-layer CSS masks and backgrounds (1.01 MB);
   - 16 assets outside the gate (0.10 MB), including the 13 activation lines shared with `/`.

   These can still arrive after the gate opens.

**`/`:** the same chain, but with 13 awaited images (537 KB). The rest (42 + 18 assets) isn't awaited.

**Lite:**

1. HTML.
2. CSS.
3. The six WebP files (preloaded; the plate at High priority).
4. **No gate.** The plate is drawn as soon as it has loaded, so the first frame that follows contains the scene.

## 5. Controlled network measurements

**Set-up:**

- **One fresh-profile Chrome per cell,** warmed by one unthrottled visit of the route. Every trial therefore has the same warm GPU state, avoiding M1.4Q's cold/warm confusion.
- **Before each measured visit,** the tab goes to another site. That gives the visit a new renderer process, so only the HTTP disk cache can help. Memory-cache hits were counted: 0 in every trial.
- **Network emulation:** DevTools, applied to the measured visit only.
- **Visit types:**
  - **initial:** HTTP cache cleared;
  - **repeat:** one previous visit, current headers;
  - **repeat-fresh:** one previous visit through a **test-only local proxy** that rewrites `/scene/*` responses to `Cache-Control: public, max-age=86400`. That emulates any fresh-cache option within its lifetime. The app is untouched.
- **Same path for every cell:** every cell goes through the proxy, with headers passed through unchanged for initial and repeat, so all cells are comparable.
- **Why a proxy:** DevTools `Fetch` interception was tried first, but Chrome's HTTP cache kept the original headers, so it didn't emulate a header change.

**Results** (7 trials per cell; median [min–max]; ms from navigation start):

| Route | Network | Visit | FCP | Scene visible | Scene fully visible | Ready (assets + gate) | Last scene image | Requests | Wire 200 / 304 | Disk hits | Network bytes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cinematic | 50 / 20 | initial | 192 [188–228] | 1433 [1319–1809] | 1633 [1519–2017] | 1633 | 1349 [1250–1739] | 94 | 94 / 0 | 0 | 5,657 KB |
| Cinematic | 50 / 20 | repeat | 160 [148–188] | 791 [703–910] | 991 [903–1110] | 991 | 722 [643–854] | 94 | 0 / 94 | 0 | 22 KB |
| Cinematic | 50 / 20 | **repeat-fresh** | 260 [180–284] | **350** [261–356] | **550** [461–555] | 550 | 134 [110–140] | 94 | 0 / 0 | **94** | **0** |
| Cinematic | 12 / 70 | initial | 320 [300–332] | 4277 [4249–4299] | 4489 [4457–4517] | 4579 [4468–4683] | 4579 [4431–4683] | 94 | 94 / 0 | 0 | 5,657 KB |
| Cinematic | 12 / 70 | repeat | 208 [144–212] | 1745 [1674–2775] | 1945 [1874–2974] | 1945 | 1677 [1618–2793] | 94 | 0 / 94 | 0 | 22 KB |
| Cinematic | 12 / 70 | **repeat-fresh** | 148 [124–212] | **307** [290–314] | **507** [490–514] | 507 | 156 [143–170] | 94 | 0 / 0 | **94** | **0** |
| Lite | 50 / 20 | initial | 180 [148–268] | 648 [578–933] | 648 | 648 | 645 [574–930] | 6 | 6 / 0 | 0 | 2,578 KB |
| Lite | 50 / 20 | repeat | 156 [104–288] | 156 [104–344] | 156 | 156 | 93 [61–320] | 6 | 0 / 6 | 0 | 1 KB |
| Lite | 50 / 20 | repeat-fresh | 172 [144–280] | 172 [144–280] | 172 | 172 | 45 [38–92] | 6 | 0 / 0 | 6 | 0 |
| Lite | 12 / 70 | initial | 376 [344–432] | 2340 [2195–2419] | 2340 | 2340 | 2337 [2191–2414] | 6 | 6 / 0 | 0 | 2,578 KB |
| Lite | 12 / 70 | repeat | 192 [144–260] | 220 [192–320] | 220 | 220 | 197 [181–298] | 6 | 0 / 6 | 0 | 1 KB |
| Lite | 12 / 70 | repeat-fresh | 212 [196–312] | 212 [196–312] | 212 | 212 | 105 [92–204] | 6 | 0 / 0 | 6 | 0 |

**Observations:**

- **At 12 Mbps, every Cinematic initial visit opened by the gate's fallback** (gate style at 4218 [4194–4233] ms, 7 of 7). Gated images were still arriving afterwards (ready 4579 ms), so layers can appear after the scene is shown.
- **At 50 Mbps it opened normally,** at 1364 ms.
- **Lite's scene follows its bytes:** 0.65 s (50 Mbps) or 2.34 s (12 Mbps) on a first visit. On a repeat visit it appears with the first frame.
- **FCP is unaffected by caching,** except Cinematic's repeat-fresh cell at 50 Mbps: 260 vs 160 ms. The same cell at 12 Mbps doesn't show it (148 ms), and it's within the cell's spread, so it isn't treated as an effect (§11).

**Compared with M1.4Q:** its 12 Mbps repeat-visit Cinematic value (2.64 s) was contended, used a different scene metric, and reused the renderer process between visits. The idle-machine values above (1.75–1.95 s) replace it; the two sets are not compared numerically.

## 6. Repeat-visit cache behaviour

**What happens now on a repeat visit:**

- the browser sends a conditional request for every scene asset (`If-None-Match` / `If-Modified-Since`);
- the server answers `304`: 94 on Cinematic, 6 on Lite;
- only ~22 KB moves, but each revalidation costs a round trip, and HTTP/1.1 allows six connections per host.

**The resulting delay** (repeat visit, scene fully visible):

| Route | Network | Current headers | Emulated lifetime | Gain |
|---|---|---|---|---|
| Cinematic | 50 / 20 | 0.99 s | 0.55 s | −0.44 s |
| Cinematic | 12 / 70 | 1.95 s | 0.51 s | **−1.44 s (−74 %)** |
| Lite | either | 0.16–0.22 s | 0.17–0.21 s | None |

The remaining ~0.5 s for Cinematic is the gate's decode wait and its 240 ms fade.

**Cache lifetime and network latency:** with a fresh cache lifetime, the repeat visit is independent of network latency. That's why 12 Mbps is no slower than 50 Mbps.

**Not measured:** a repeat visit after the lifetime expires. It reverts to today's behaviour (304s), or to full downloads if the ETags changed in a redeploy.

## 7. Comparison of caching options

| | **A. Bounded lifetime** (e.g. `max-age=86400`, then revalidate) | **B. Versioned URLs + `immutable`** | **C. Current** (`max-age=0`, revalidate always) |
|---|---|---|---|
| Repeat-visit gain (Cinematic) | Within the lifetime: −0.44 s (50 Mbps), −1.44 s (12 Mbps). After expiry, as C | The same, without expiry. Unchanged assets stay cached across deployments | Baseline |
| First visits | None | None | — |
| Update reliability | A file replaced **in place** can be stale for up to the lifetime. New paths are always picked up, because HTML is `no-store` | Exact: a changed file gets a new URL, and the new HTML references it immediately | Exact |
| Stale-imagery risk | Bounded by the lifetime. Highest if one image is replaced while related files or code change. Lite's sprites must match the box coordinates baked into the code, so Lite should be excluded | None, if every reference is versioned. An unversioned reference falls back to C | None |
| Cinematic | Gains fully if `/scene/v2/**` is covered (all 66 gated assets) | Gains fully | Slow repeat visits |
| Static Lite | No gain (6 revalidations already cost < 0.1 s); stale-sprite risk. **Exclude** | No gain; **a one-time manifest re-record**, because the code that builds its URLs is watched | — |
| Existing deployment | One header rule in `next.config.ts` `headers()`, if Next applies it to `public/` (to verify). A future host must pass it through | Code changes in ~21 files that build scene URLs, plus a build-time content-hash map or static imports (Next's own hashed `/_next/static/media` with `immutable`) | Nothing |
| Static Lite fingerprints | **Unaffected:** `next.config.ts` isn't watched, and no asset or URL changes | **Affected:** 37 watched code files build the URLs. A rename would also change 159 watched artwork paths | Unaffected |
| Complexity | Low | Medium–high (every new reference must go through the versioning helper; a URL refactor) | None |
| Verification | That the header is applied; that 304s go to 0 within the lifetime; an update test | A hash for every URL; correct invalidation on change; a Static Lite re-record shown to change no pixels | — |

**How common in-place replacement is.** The committed history shows 278 scene files added, **0 modified in place**, and 0 renamed or deleted. So far, new artwork has always arrived at a new path (milestone folders `m14e`, `m14f1`, …). But that history is only 6 commits over 20–27 Nov, so edits between commits wouldn't appear. It supports a convention, not a guarantee.

**Static Lite is the clear exception:** its bake overwrites `public/scene/static-lite/*.webp` in place by design. That's why it should be excluded from Option A.

## 8. Recommended strategy

**Option A, narrowly scoped,** for the current maturity: no deployment, no pipeline, and a single owner who controls asset paths.

1. **Rule:** `Cache-Control: public, max-age=86400` (one day) for **`/scene/v2/:path*` only**.
   - It covers all 66 Cinematic gate assets: 81 of its 94 requests.
   - It leaves untouched:
     - the homepage (it loads nothing from `/scene/v2/`);
     - Static Lite (`/scene/static-lite/`, which is overwritten in place, and gains nothing);
     - the 13 activation lines shared with `/` (not gated, 72 KB).
   - No `immutable`, and no `stale-while-revalidate` in the first experiment, so expiry stays simple and bounded.
2. **Authoring rule** (documentation): never replace a file under `/scene/v2/` in place. Changed artwork gets a new path, which is the existing convention. If an in-place replacement is ever unavoidable, accept up to one day of staleness, or rename the file.
3. **Revisit Option B** once a host and a deployment pipeline exist. At that point, longer lifetimes and cross-deployment reuse become worth a URL refactor and a Static Lite re-record. Static image imports (Next's own content hashing) or a build-time content-hash query are the two mechanisms to compare then.

**Why not B now:** it changes ~21 scene modules and forces a Static Lite manifest re-record, for no extra gain within a day's lifetime.

**Why not leave C:** at 12 Mbps / 70 ms it costs Cinematic repeat visitors ~1.4 s for no correctness benefit, given the new-path convention.

**Kept out of this plan** (separate future candidates, unchanged from M1.4Q):

- compression of `lab-background.png`;
- the scene gate's scope and fallback;
- fetch priority for gate assets (every one is Low today; §1).

## 9. Proposed targeted implementation scope (M1.4R.2, not started)

**In scope:**

- **`next.config.ts`:** one `headers()` entry, `source: "/scene/v2/:path*"`, setting `Cache-Control: public, max-age=86400`. Nothing else in the config changes.
- **First, verify** with `next start` that the header replaces the `public/` default for `/scene/v2/*`, and leaves `/scene/*` outside v2, `/scene/static-lite/*`, `/_next/static/*` and the HTML unchanged. **If Next doesn't apply `headers()` to public files, stop and report.** Don't work around it in application code.
- **A short authoring note** next to the scene assets, or in `docs/`, stating the never-replace-in-place rule for `/scene/v2/`.
- **Re-measure** with `docs/m1.4l/scene-delivery/scripts/sd-measure.mjs` through the pass-through path only. `repeat` should then behave like this audit's `repeat-fresh`.

**Out of scope:**

- the homepage's assets;
- Static Lite assets;
- image files and URLs;
- application code;
- versioned URLs;
- compression;
- gate changes;
- deployment.

## 10. Acceptance criteria (for M1.4R.2)

1. **Headers** (local `next start`):
   - every `/scene/v2/*` response carries `Cache-Control: public, max-age=86400`;
   - `/scene/static-lite/*`, `/scene/*` outside v2, `/_next/static/*`, the HTML and `/icon.svg` keep their current headers exactly (§2).
2. **Repeat visit, Cinematic** (idle machine, the harness above, 7 trials per cell):
   - scene fully visible **≤ 0.7 s** at 12 Mbps / 70 ms (now 1.95 s) and **≤ 0.7 s** at 50 Mbps / 20 ms (now 0.99 s);
   - **0 wire 304s for `/scene/v2/*`**: the 13 outside v2 may still revalidate.
3. **First visits:** no regression. Cinematic and Lite initial-visit medians within their current ranges (§5); FCP unchanged within noise.
4. **Lite and `/`:** headers and timings unchanged.
5. **Update behaviour:** an asset under a **new** path is served on the next page load. The documented staleness bound for an in-place replacement is demonstrated once, for example with a cached test file in a scratch build: served from cache within the lifetime, revalidated after it.
6. **Static Lite:** `npm run static-lite:check` reports current; no file under `public/` or `components/` changes.
7. **Pixels and layout:** reduced-motion screenshots and layout fingerprints of `/`, Cinematic and Lite identical to before.
8. **Build:** `npm run typecheck` and `npm run build` pass; no console errors.

## 11. Remaining uncertainties

- **No deployment exists.** Every expectation about a host is unverified: its headers, CDN caching, HTTP/2 or HTTP/3, compression, and whether file modification times (and so ETags) survive a deploy. HTTP/2 would cut the cost of the current revalidations, so the measured gain is likely an upper bound for such a host.
- **Whether `headers()` overrides `public/` caching** in Next 16.4.6 is undocumented here. It's criterion 1, and the first thing to check.
- **Emulation.**
  - The lifetime was emulated by a local proxy: same server, same bytes, only the header changed.
  - DevTools throttling approximates bandwidth and latency per request.
  - Results are synthetic and **not predictions of real traffic**.
- **The cost after expiry** (a repeat visit after a day) wasn't measured; it should equal today's repeat visit.
- **Other browsers.** Firefox and Safari lack `object-view-box`, so Cinematic there would fetch 51 full-frame fallbacks (1.35 MB) instead of the crops. Not measured.
- **The FCP rise in one cell** (Cinematic repeat-fresh at 50 Mbps: 260 vs 160 ms) didn't recur at 12 Mbps. Possibly disk-cache reads competing with the first frame; unexplained.
- **Lite's "scene visible"** is when the plate is ready, clamped to FCP; it isn't a paint measurement. Cinematic's is the gate's computed opacity, so the two aren't directly comparable.
- **The reused-profile discrepancy** (secondary; `profile-shutdown.json`; 5 trials per variant, one profile each, unthrottled). Shutdown delay does **not** consistently explain it:

  | Route | Killed after 0.3 s: FCP (pipeline cache) | Given 1.5 s: FCP (pipeline cache) |
  |---|---|---|
  | `/` | 328 ms (2.43 MB) | 940 ms (1.19 MB) |
  | Lite | 728 ms (2.27 MB) | 560 ms (2.43 MB) |
  | Cinematic | 464 ms (2.12 MB) | 468 ms (2.26 MB) |

  - The effect is opposite on `/` and Lite, and nil on Cinematic.
  - Identically prepared profiles persisted very different amounts of pipeline cache (1.19 vs 2.43 MB for `/`). That points to variable cache persistence, not shutdown timing.
  - **It stays unresolved,** and was not pursued further. It concerns fresh or reused GPU caches, not scene delivery.
