# M1.4R.2–R.3: Cinematic scene cache (28 Nov 2026)

**Contents:**

- **M1.4R.2** implemented the narrowly scoped cache policy recommended by [`SCENE-DELIVERY-AUDIT.md`](SCENE-DELIVERY-AUDIT.md) §8. It then checked the policy on the real production server, without the audit's header-rewriting proxy.
- **M1.4R.3** limited the rule to production builds, re-verified production and development, and wrote down the invalidation policy (§6) and the final decision (§9–10).

**Evidence:** [`scene-cache/`](scene-cache/README.md).

## Summary

- **Final status: accepted.** The rule applies in production builds only; `next dev` keeps Next's default (§1, §10).
- **The Next.js header rule works.** Next 16.4.6 applies `headers()` to `public/` files, so in production every `/scene/v2/*` file is now served with `Cache-Control: public, max-age=86400`.
  - Nothing else changes: Static Lite, every other `/scene/` folder, hashed JS and CSS, HTML and the icons keep their previous headers exactly.
  - Missing files under `/scene/v2/` still get the uncacheable 404.
- **Cinematic repeat visits benefit for real.** Median time until the scene is fully visible, 7 trials per condition:

  | Network | Before (baseline build) | Prototype | Change |
  |---|---|---|---|
  | 50 Mbps / 20 ms | 0.99 s | **0.47 s** | −0.53 s |
  | 12 Mbps / 70 ms | 1.86 s | **0.51 s** | −1.35 s |

  - Each repeat visit now loads its 81 `/scene/v2` images from the browser's disk cache, with no request to the server.
  - Only the 13 activation files outside `/scene/v2` are still revalidated (304).
  - Network bytes fall from 22 KB to 3 KB.
- **First visits are unchanged:** same 94 downloads, same 5.66 MB, medians within the baseline's range.
- **No regressions found:**
  - navigation 65 of 65, project pages 86 of 86, no console errors;
  - layout fingerprints identical in all 10 cases;
  - pixels identical, apart from capture noise that the unchanged baseline shows as well.
- **Development is unaffected.** The prototype's rule also applied under `next dev`, so an image rewritten in place during asset work stayed stale on a normal reload. M1.4R.3 restricted the rule to production builds, as approved. Development now serves `/scene/v2/` with Next's default `public, max-age=0`.
- **Policy:** a published `/scene/v2/` image is never replaced at the same URL. A Git check before each deployment finds violations (§6).

## 1. Configuration change

`next.config.ts` is the only application file changed (+14 lines). Final version (M1.4R.3):

```ts
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/scene/v2/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
```

- There's a comment above it stating the never-replace-in-place condition.
- There's no `immutable`, no `stale-while-revalidate`, and no rule for `/scene/**`.
- **The production-only condition** relies on documented Next behaviour: when `NODE_ENV` isn't set, `next dev` sets it to `development` and every other command (`next build`, `next start`) to `production` (`environment-variables.md`).
  - The routes manifest records the header rule at build time.
  - The condition doesn't change the JavaScript or CSS bundles: the hashed file names are identical with and without it.
  - A shell that exports `NODE_ENV` explicitly overrides this; the repository's scripts don't.
- The M1.4R.2 prototype had the same rule without the condition. All of its measurements (§3–5, §7) were taken on production builds, where the condition doesn't change anything; §10 confirms it.

**Why it works.** The Next docs say "Headers are checked before the filesystem which includes pages and `/public` files". In the code:

- Next's static file sender (`send`, inside `next/dist/compiled`) only writes its own `public, max-age=0` when no `Cache-Control` is set yet.
- The `public/` path in `router-server.js` sets nothing for `public/` files.
- So the configured value stands. The production server confirmed it (§2).

**Scope check.** `/scene/v2/` holds the intended Cinematic assets only, with no overlap that needs narrowing:

- **What's in it:** 159 PNG files, the Cinematic artwork. It is written only by the milestone generators under `scripts/` (`m14e-extract.py` … `m14j4-experience.py`), each into its own `m14*` folder.
- **Who reads it:** only the Cinematic scene components (`SceneV2`, the station `*V2` and `*Lift` modules, `scene-crops.ts`, `scene-v2-data.ts`).
- **Where it loads, from the real pages** (`results/scope.txt`). Every page was loaded at rest and then with each of the five stations opened:

  | Page | `/scene/` requests | from `/scene/v2/` | Their Cache-Control |
  |---|---|---|---|
  | `/` | 73 | 0 | — (all others `max-age=0`) |
  | Lite `/lab-v2?render=lite` | 6 | 0 | — (Static Lite `max-age=0`) |
  | Cinematic `/lab-v2` | 94 | 81 | `public, max-age=86400` |
  | Cinematic, mobile 390 × 844 | 94 | 81 | `public, max-age=86400` |
  | Project page | 0 | 0 | — |

- **Other references:**
  - `static-lite-manifest.json` and `scripts/static-lite/check.mjs` reference all 159 files as **bake inputs**: hashed on disk, never fetched by a browser.
  - The `scripts/visual/m14*-capture.mjs` scripts use fresh browser profiles, so the browser cache can't affect them.
- **Static Lite, the homepage and the activation lines are out of scope.**
  - Static Lite's images (`/scene/static-lite/`, re-baked in place) aren't covered.
  - The homepage requests nothing under `/scene/v2/`.
  - The 13 activation files Cinematic shares with `/` sit outside it.

## 2. Production response headers

`npm run build` and `next start`, compared with a baseline build of the same commit without the rule. Full detail is in `results/headers.json`.

| URL group | Baseline (`f724729`) | Prototype |
|---|---|---|
| `/scene/v2/*` (four files across `environment/`, `connections/`, `m14i2/`, `stations/`) | `public, max-age=0` | **`public, max-age=86400`** |
| — the same with a query string (`?v=1`), HEAD, Range (206) and conditional (304) responses | `public, max-age=0` | **`public, max-age=86400`** |
| `/scene/v2/does-not-exist.png`, `/scene/v2`, `/scene/V2/…`, `/scene/v2x/…` (404) | `private, no-cache, no-store, max-age=0, must-revalidate` | unchanged |
| `/scene/v2/` (308 trailing-slash redirect) | no Cache-Control | unchanged |
| `/scene/activation/*`, `/scene/layers25d/*`, `/scene/lab-plate.webp` | `public, max-age=0` | unchanged |
| Static Lite `/scene/static-lite/*.webp` | `public, max-age=0` | unchanged |
| Hashed `/_next/static/*.js`, `*.css` | `public, max-age=31536000, immutable` | unchanged |
| HTML: `/`, `/lab-v2`, `?render=lite`, `?station=experience`, `/lab-v2/projects/arimap` | `private, no-cache, no-store, max-age=0, must-revalidate` | unchanged |
| `/icon.svg`, `/favicon.ico` | `public, max-age=0, must-revalidate` | unchanged |

**Other header details:**

- Each response has exactly one `Cache-Control` header.
- The weak ETag (size + mtime) and `Last-Modified` are kept, so expired entries revalidate cheaply.
- **Rollout effect:** a 304 for a `/scene/v2` file carries the new lifetime. Browsers that cached the old `max-age=0` responses switch to the new policy at their next revalidation, without downloading anything again.

These match the audit's §2 baseline exactly, apart from the intended change.

### Final configuration: production and development (M1.4R.3)

Captured with the same URL list (`results/headers-final-production.json`, `results/headers-final-development.json`):

| URL group | Production (`next build` + `next start`) | Development (`next dev`) |
|---|---|---|
| `/scene/v2/*`, including query string, HEAD, 206 and 304 | **`public, max-age=86400`** | `public, max-age=0` (Next's default) |
| Missing `/scene/v2/*` (404) | `private, no-cache, no-store, max-age=0, must-revalidate` | `no-store` |
| Other `/scene/` folders, Static Lite | `public, max-age=0` | `public, max-age=0` |
| Hashed `/_next/static/*` | `public, max-age=31536000, immutable` | (development chunks) |
| HTML | `private, no-cache, no-store, max-age=0, must-revalidate` | `no-store` |
| `/icon.svg`, `/favicon.ico` | `public, max-age=0, must-revalidate` | `no-cache, must-revalidate` |

**Production** is identical, row for row, to the M1.4R.2 prototype in the table above.

- One file from each of the other folders in `public/` keeps `max-age=0`: `projects/arimap`, `projects/tablerefresh`, `scene/activation`, `scene/layers`, `scene/layers25d`, `scene/masks`, `scene/power`, `scene/static-lite` and `scene/lab-plate.webp`.
- So the rule reaches no directory but `/scene/v2/`.

**Development** shows no one-day lifetime anywhere. The other development values are Next's own development defaults, unchanged by this work.

- `/scene/V2/…` (wrong case) resolves in development only, because the development server reads the case-insensitive Windows file system.
- It gets the default `max-age=0` there, not the rule.

## 3. Baseline versus prototype measurements

**Method:**

- The audit's harness (`sd-measure.mjs`) without its proxy (`scene-cache/scripts/sc-measure.mjs`).
- Two production servers ran side by side from the same commit and the same `public/` folder: the **baseline** build without the rule, and the **prototype** with it.
- **Browser state:** one fresh Chrome profile per cell, warmed by one unthrottled visit. Before each measured visit the tab goes to another site, so there's a new renderer and only the HTTP disk cache can help.
- **Cells:** interleaved (baseline then prototype for each condition), 7 trials each.
- **Machine:** Chrome 158 headless; idle, 11–17 % background CPU; another project's test run had finished before the measurement started.
- These are synthetic results, **not predictions of real traffic**.

**Metrics:**

- **FCP:** first contentful paint, kept separate from the scene.
- **Scene visible:** the scene gate's opacity first above 0.
- **Scene fully visible:** gate opacity 1, after its 240 ms fade.
- Values are medians [min–max]; full table with IQRs in `results/delivery-summary.md`.

| Network | Visit | Source | FCP | Scene visible | Scene fully visible |
|---|---|---|---|---|---|
| 50 / 20 | repeat | **baseline** | 160 | 793 [463–1245] | **993** [663–1445] |
| 50 / 20 | repeat | **prototype** | 168 | 265 [260–278] | **465** [460–478] |
| 50 / 20 | repeat | audit, unchanged headers via proxy | 160 | 791 | 991 |
| 50 / 20 | repeat | audit, emulated lifetime on all `/scene/*` | 260 | 350 | 550 |
| 12 / 70 | repeat | **baseline** | 144 | 1661 [1378–1695] | **1862** [1577–1895] |
| 12 / 70 | repeat | **prototype** | 184 | 310 [261–395] | **512** [461–595] |
| 12 / 70 | repeat | audit, unchanged headers via proxy | 208 | 1745 | 1945 |
| 12 / 70 | repeat | audit, emulated lifetime on all `/scene/*` | 148 | 307 | 507 |

**Reading:**

- **The prototype meets the audit's target** of at most 0.7 s on both profiles. Its spread is also much tighter (IQR 10–28 ms against 65–164 ms).
- **It reproduces the proxy emulation** (0.47 / 0.51 s against 0.55 / 0.51 s), although 13 activation files still revalidate. They aren't awaited by the scene gate, so they don't hold it back.
- **Baseline vs audit:** the same-session baseline agrees with the audit's (0.99 / 1.86 s against 0.99 / 1.95 s). The audit's small extra cost at 12 Mbps is its proxy hop.
- **FCP is unchanged within noise.** The 12 / 70 repeat medians, 144 vs 184 ms, have overlapping ranges (128–216 vs 128–296) and IQRs of about 60 ms. The audit's unexplained FCP rise in its emulated 50 Mbps cell (260 ms) didn't recur: 168 ms here.

## 4. Cache hit and revalidation evidence

Median per repeat visit, from the browser's network log, 7 of 7 trials identical in counts:

| | Scene requests | `/scene/v2/`: disk-cache hits | `/scene/v2/`: wire 304 | Other `/scene/`: wire 304 | Wire 200 | Memory-cache hits | Network bytes |
|---|---|---|---|---|---|---|---|
| Baseline | 94 | 0 | 81 | 13 | 0 | 0 | 22 KB |
| Prototype | 94 | **81** | **0** | 13 | 0 | 0 | 3 KB |

- **Zero wire 304s for `/scene/v2/`:** the audit's criterion 2, met in all 14 prototype repeat trials (7 per network).
- **Zero memory-cache hits:** each visit really started a new renderer, so these hits are the HTTP disk cache.
- The browser recorded `public, max-age=86400` on every prototype `/scene/v2/` response and `public, max-age=0` on every baseline one.
- **No failed requests and no console errors**, warnings or uncaught exceptions in any of the 76 measured visits (56 in the main run, 20 in the re-checks).

## 5. First-visit behaviour

The header can't help a first visit, and it doesn't hurt one:

| Network | Baseline | Prototype |
|---|---|---|
| 50 / 20, run 1 | 1632 [1491–1806] | 1587 [1493–2960] |
| 50 / 20, re-check | 1607 [1571–1712] | 1578 [1447–2749] |
| 12 / 70 | 4491 [4451–4510] | 4478 [4458–4508] |

Values are scene fully visible, in ms.

- **Downloads:** 94 downloads, 5,657 vs 5,658 KB. The extra kilobyte is the longer header across 81 responses.
- **FCP:**
  - 50 / 20: 196 vs 200 ms;
  - 12 / 70: 324 vs 316 ms.
- **At 12 Mbps** the gate's 4 s fallback still opens the scene in 7 of 7 trials on both builds, as in the audit. That's a first-visit issue for the separate gate candidate.

**One outlier, explained.** The prototype's 50 Mbps first-visit cell had one slow trial (2.96 s), and the re-check reproduced it (2.75 s). In both runs it was trial 0, the first visit of the second browser launched.

- **Order-swap test** (`results/delivery-order-check.json`): with the prototype run first, its trial 0 is normal (1.68 s) and the baseline's is too.
- **Across the run:** trial 0 is the slowest trial in four of the eight cells, on both builds.
- **Conclusion:** it's a start-up effect of the measuring browser right after the previous one shuts down, not the cache policy. Medians aren't affected.

## 6. Cache invalidation policy

**Policy.** Never replace a published `/scene/v2/` image at the same URL. When its content changes, publish the replacement under a new URL (a new file name or a new `m14*` folder) and update its references in the code.

**Why:**

- **Cached images stay fresh for up to 24 hours.** In production, every image a visitor has loaded stays fresh in their browser for up to 24 hours. During that time the browser doesn't contact the server at all.
- **New application code arrives immediately.** JS and CSS have hashed names and HTML is `no-store`, so a deployment's new code reaches the next page load.
- **New code with stale images can break the layout.** An image replaced in place can be shown with code written for its replacement, for example crop rectangles in `scene-crops.ts` or positions in `scene-v2-data.ts`. Mixing new layout coordinates with stale imagery can misalign a station or crop the wrong region, which is a visual defect, not just older art.
- **New URLs are safe.** The new HTML and code reference them immediately, and no browser has them cached.
- **Removing an unreferenced file is safe.**

**The staleness bound, demonstrated** (`results/update-demo.txt`, `scripts/sc-update-demo.mjs`). The demo runs on a scratch server on port 3105, not the app, and changes nothing in the repository.

- **Setup:** the scratch server sends a test file with `public, max-age=5` and a size-mtime weak ETag, as Next does. The file is overwritten in place between fetches.

| When | Response | Server contacted |
|---|---|---|
| First load | version 1 | yes |
| After the in-place overwrite, within the lifetime | **version 1 (stale)** | **no** |
| A new URL for the new content | version 2 | yes |
| Same URL after the lifetime | version 2 | yes, conditional; the ETag changed, so 200 |

With the real rule the bound is one day. A shared cache, such as a future CDN honouring `public`, could hold the old file for the same time unless purged.

### Verification procedure (Git)

Run this before each deployment. `<base>` is the commit that is currently deployed. Until a deployment exists, use the last reviewed commit on `origin/feat/lab-v2` (or the merge base with `main` for a merge).

```sh
# 1. Net change since <base>. Anything but "A" needs review:
#    M  modified or replaced in place (also a file deleted and re-added at the same path): VIOLATION
#    T  type change: VIOLATION
#    D  deleted (a rename shows as D + A): fine only if nothing references the old path any more
git diff --no-renames --name-status <base>..HEAD -- public/scene/v2 | grep -v '^A'

# 2. Commits that changed an existing file in place, even if a later commit restored it:
git log --no-renames --diff-filter=MT --name-status --format='commit %h %s' <base>..HEAD -- public/scene/v2

# 3. Uncommitted changes, which must be empty before building a deployment:
git status --porcelain -- public/scene/v2

# 4. For each "D" from step 1, confirm the old path is no longer referenced (expect no output):
git grep -n '<old path without public/>' -- app components lib
```

**Reviewers should:**

- **Expect no output from checks 1–3**, apart from intended deletions whose paths check 4 shows to be unreferenced.
- **For any `M` or `T`:** ask for the change to be republished under a new URL with its references updated. If an in-place change must ship anyway, record in the review that visitors may see the old image for up to a day.
- **Check deployment tooling too.** Before a first deployment, confirm the host doesn't rewrite `public/` files' contents or headers (§8).

**Tested:**

- **On this repository:** from the first commit to `HEAD`, all 159 `public/scene/v2` files are `A`. Check 2 finds no commit that modified one, and check 3 is clean.
- **On a throwaway repository** (no images in this repository were touched), checks 1–3 caught every case:
  - an in-place modification (`M`);
  - a file deleted and re-added at the same path (`M`);
  - a rename (`D` + `A`);
  - an uncommitted edit.

**What already exists:**

- **Convention:** every milestone so far wrote new artwork into a new folder (`m14e` … `m14j4`). The committed history shows 0 in-place modifications.
- **Generators write fixed paths.** For example, `scripts/m14j4-experience.py` always writes `public/scene/v2/m14j4/*.png`.
  - Re-running an old generator with changed output after its images are published would violate the policy.
  - The checks above find that.
- **`npm run static-lite:check`** also fails, with `source changed: public/scene/v2/…`, when one of these files is modified, because it hashes them as bake inputs.
  - It doesn't enforce the policy: its remedy, re-bake then `--write`, accepts the change.
- No hook or CI check enforces the policy. None is added in this milestone.

**Possible later safeguard (not implemented):** `scripts/static-lite/check.mjs` could report a *modified* `public/scene/v2/` source with its own message, and refuse `--write` for it without an explicit flag. That's about ten lines, reusing hashes it already computes.

**Development server.** The production-only condition (§1) keeps `next dev` at Next's default `max-age=0`, verified in §2. So artwork rewritten during iteration shows on a normal reload, and the policy only concerns published images.

**Deployment.** Future deployment work must revisit this policy if the hosting provider or a CDN in front of it overrides, strips or extends caching headers (§8).

## 7. Functional and visual regression results

All against the **prototype production build** (`next start`), headless Chrome, motion on for the functional suites.

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run static-lite:check` | current (6 images, 196 sources, baked at `63fb64f`) |
| `npm run build` | pass (Next.js 16.4.6, Turbopack), run again at the end |
| M1.4P navigation suite (`scripts/m14p-nav.mjs`, see the list below) | **65 of 65 pass** |
| M1.4P project-page suite (`scripts/m14p-projects.mjs`, see the list below) | **86 of 86 pass** |
| Console during the 76 measured visits | no errors, warnings or exceptions |

**What the navigation suite covers:**

- Cinematic and Lite: header Experience, direct station links, station selection and switching;
- Back / Forward, Back to Lab and Escape;
- deep links and the scroll scan;
- homepage isolation;
- the mobile dock and the landscape-phone menu;
- console checks.

**What the project-page suite covers:**

- the five case studies in both modes;
- Experience from each project page, Back / Forward and the render mode being kept;
- Ctrl+click and console checks.

**Visual A/B** (`results/visual-ab.txt`):

- **Setup:** the M1.4P resting-state capture with reduced motion, frozen animations and finished transitions, plus a layout fingerprint of every element's box and computed style.
- **The 10 cases:**
  - `/` at 1648 and 1920, and with Experience;
  - Cinematic at 1648 and 1920, and with Experience;
  - Lite at rest and with Experience;
  - mobile 390 × 844 at rest and with Experience.
- **Variants:** baseline and prototype both on a first visit; and a **warm** variant (a visit, another site, then the captured visit), so the prototype's images come from the disk cache.

| Pair | Layout fingerprint | Pixels |
|---|---|---|
| Baseline vs prototype, first visit | identical, 10 / 10 | identical in 9; Cinematic + Experience max 9 / 255 on 303 px |
| Baseline vs baseline, second capture | identical, 10 / 10 | the same 303 px, max 9 |
| Baseline vs prototype warm (cached images) | identical, 10 / 10 | `/`, Lite and mobile identical (≤ 1 / 255); Cinematic at rest differs inside the Playground station only |
| Baseline vs **baseline warm** | identical, 10 / 10 | the **same** Playground-only difference at 1648: max 66, 12,140 px, same box |

- **The Cinematic differences are capture noise along the Playground station**, and they occur without the cache policy. M1.4P recorded the same Playground noise between two captures of an unchanged build (`EXPERIENCE-HEADER-NAVIGATION.md` §5).
- **Outside the Playground box**, every Cinematic pair is identical.
- **Unchanged:** the laboratory composition, station artwork, lighting, chips, Static Lite and the desktop and mobile layouts.
- **No image file changed** (`git status`), and station geometry, animation code and timings are untouched.

## 8. Risks and deployment limitations

- **In-place replacement:** up to one day stale, and possibly misaligned with newer code (§6). This is the only correctness risk. It's bounded, and the policy and the Git check before each deployment prevent it; nothing enforces it automatically.
- **Rollback isn't instant:** removing the rule leaves already-cached images fresh for up to a day.
- **There's no deployment yet, so every host behaviour is unverified.**
  - `public` lets shared caches, such as a CDN, store the images too.
  - A future host or CDN may honour, override, strip or extend the header.
  - It may add its own edge caching, which would then also need purging for an in-place change.
  - It may change file modification times (and so the weak ETags) on each deploy, which only causes extra downloads after expiry.
  - **Future deployment work must re-check the production headers on the real host and revisit this policy if the host changes them.**
- **HTTP/1.1 on localhost.** On HTTP/2 or HTTP/3 the baseline's 81 revalidations cost less, so the real gain is likely smaller than measured.
- **Synthetic conditions:** Chrome only, headless, emulated networks, one machine; not predictions of real traffic.
  - Firefox and Safari fetch 51 full-frame fallbacks (1.35 MB, also under `/scene/v2/`, so covered by the rule); that path wasn't measured.
- **Visits more than a day apart get no benefit:** they revalidate as before. Browsers may also evict cached images earlier.
- **The condition depends on `NODE_ENV`:** a build run with `NODE_ENV` explicitly set to something other than `production` would ship without the rule (§1).

## 9. Final acceptance decision

**Accepted (M1.4R.3).**

**Why:**

- The production-only rule delivers `Cache-Control: public, max-age=86400` for `/scene/v2/*` and nothing else.
- It cuts Cinematic's repeat-visit scene time from 0.99 s to 0.47 s at 50 Mbps / 20 ms, and from 1.86 s to 0.51 s at 12 Mbps / 70 ms.
- It has no first-visit cost and causes no functional or visual regression.
- It leaves Static Lite, the homepage, HTML and hashed assets unchanged, and development unaffected.

**Audit acceptance criteria (`SCENE-DELIVERY-AUDIT.md` §10):**

| # | Criterion | Result |
|---|---|---|
| 1 | Headers: `/scene/v2/*` gets the rule; everything else exactly as before | Met in production; development keeps the default (§2) |
| 2 | Repeat visit ≤ 0.7 s on both profiles; 0 wire 304s for `/scene/v2/*` | Met: 0.47 s and 0.51 s; 0 of 81 (§3–4) |
| 3 | First visits not regressed; FCP unchanged within noise | Met (§5) |
| 4 | Lite and `/` unchanged | Headers, requests and pixels unchanged (§1, §2, §7, §10). Their timings weren't re-measured, as nothing they load changed |
| 5 | Update behaviour: new path picked up at once; staleness bound demonstrated | Met, on a scratch server (§6) |
| 6 | `static-lite:check` current; no file under `public/` or `components/` changed | Met |
| 7 | Pixels and layout identical | Met, apart from noise reproduced without the change (§7, §10) |
| 8 | Typecheck, build, no console errors | Met (§10) |

**Remaining priorities, not part of this work:**

- **The first visit is now the slow path.** At 12 Mbps / 70 ms the scene gate's 4 s fallback still opens Cinematic on every first visit (§5). The separate candidates from the audit address it:
  - compressing `lab-background.png` (2.29 MB, the largest gated image);
  - the scene gate's scope and fallback;
  - raising the fetch priority of the gated images (all Low today).
- **Cold-GPU first paint** (`FIRST-PAINT-INVESTIGATION.md`) is unaffected by caching and remains open. So does the reused-profile discrepancy recorded there and in `SCENE-DELIVERY-AUDIT.md` §11.
- **Versioned URLs** (the audit's Option B) and the optional `static-lite:check` safeguard (§6), once a host and a deployment pipeline exist.

## 10. Final validation (M1.4R.3)

**Setup:** the final `next.config.ts` (production-only rule), production build served by `next start`, headless Chrome. The full seven-trial matrix wasn't repeated, because the production behaviour is unchanged from the prototype (§2).

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run static-lite:check` | current (6 images, 196 sources, baked at `63fb64f`) |
| `npm run build` | pass. The routes manifest contains the one `/scene/v2/:path*` header rule; JS and CSS chunk names are identical to the prototype's |
| Production headers | as the prototype, row for row; no other `public/` folder affected (§2) |
| Development headers (`next dev`) | `/scene/v2/*` at Next's default `public, max-age=0`; no one-day lifetime anywhere (§2) |
| Cinematic repeat visit, one per network (`results/final-production-check.json`) | 50 / 20: scene fully visible at 485 ms. 12 / 70: 544 ms. Both inside the prototype's ranges. Each had 81 `/scene/v2` disk-cache hits, 0 `/scene/v2` 304s, 3 KB transferred, the browser recorded `public, max-age=86400`, and there were no console messages |
| M1.4P navigation suite (`results/final-navigation-smoke.txt`): Cinematic and Lite stations, deep links, Back / Forward, homepage, mobile dock, landscape menu, console | **65 of 65 pass** |
| Project navigation (`results/final-project-smoke.txt`): AriMap and AZIZ, in Cinematic and Lite, plus the lab header's Ctrl+click | **38 of 38 pass** |
| Visual (`results/visual-final.txt`): 10 resting cases against the M1.4R.2 baseline capture | layout fingerprints identical in 10 of 10. Pixels identical in 7 cases; mobile within 1 / 255; Cinematic with Experience shows the known 303-pixel, max 9 / 255 capture noise, identical between two baseline captures (§7) |
| Console and hydration errors | none, in any of the above |
