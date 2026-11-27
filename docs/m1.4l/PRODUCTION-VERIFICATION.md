# M1.4M: production build and runtime verification (27 Nov 2026)

**Branch:** `feat/lab-v2` at `c03d97b`. No application code, artwork, animation or Static Lite asset changed; this file is the only addition, besides the two RTX 4060 result files listed in §8.

**Machine:** the home computer: RTX 4060 (driver 610.88), Windows 11, Node 22.22.3, Next.js 16.4.6 (Turbopack). Browser checks used the repository's headless Chrome harness (`scripts/visual/cdp.mjs`), which composites on the RTX 4060 here.

**Result: PASS.** The build succeeds, every approved page and critical interaction works in production, and no release-blocking regression was found.

## 1. Build

| | |
|---|---|
| Command | `npm run build` (`next build`) |
| Outcome | **Success** (exit 0) |
| Compile | 113 s |
| TypeScript | Passed in 27.1 s, no errors |
| Static generation | 12/12 pages in 626 ms, no failures |
| Warnings | None |

The development server was running during the build. Next.js 16 keeps development output in `.next/dev`, so the two don't conflict.

## 2. Route inventory

| Route | Type | Notes |
|---|---|---|
| `/` | Dynamic (ƒ) | Production homepage |
| `/lab-v2` | Dynamic (ƒ) | Reads `render`, `station`, `project` and `floor` |
| `/lab-v2/projects/[slug]` | Dynamic (ƒ) | `generateStaticParams` lists the five projects that have a page, and `dynamicParams = false` |
| `/_not-found`, `/_global-error` | Static (○) | |
| `/icon.svg`, `/apple-icon.png`, `/favicon.ico` | Static (○) | |

The project pages render on request, not at build time, because the page reads `searchParams` (to carry `render=lite` back to the lab). `dynamicParams = false` still holds at runtime: any slug other than the five returns 404 (§3).

## 3. Runtime checks

The production server was started with `next start -p 3004`, the repository's deployment model (README: `npm run build`, then `npm run start`). There is no static export.

| Path | Status |
|---|---|
| `/`, `/lab-v2`, `/lab-v2?render=lite`, `/lab-v2?render=full` | 200 |
| `/lab-v2/projects/sqlorbit`, `arimap`, `tablerefresh`, `armat`, `aziz` (also with `?render=lite`) | 200 |
| `/lab-v2/projects/koreez`, `/lab-v2/projects/wallpapers` | **404** (the Next.js "This page could not be found" page) |
| `/lab-v2/projects/<unknown>`, `/lab-v2/projects`, `/<unknown>` | 404 |
| `/icon.svg`, `/apple-icon.png`, `/favicon.ico` | 200 |

The renderer markers in the production markup match the intended modes:

- `/lab-v2` draws the Cinematic scene.
- `?render=lite` draws the static scene (`data-lite-renderer="static"`, six images).
- `?render=lite&lite=layered` also draws the static scene, so the development-only layered source is off in production, as designed (`docs/performance/STATIC-LITE-INTEGRATION.md` §5.7).

**Assets and links.** A crawl of 12 pages checked 244 unique URLs (images, `srcset` entries, scripts, stylesheets, fonts, CSS `url()` references and internal links): **0 failures**. The Next.js image optimiser (`/_next/image`) serves the project screenshots. The three external project links (WordPress.org, armat.site, Google Play) return 200.

## 4. Interaction results

**45 of 45 passed** in production, at 1648 × 928. Each group below ran in both Cinematic and Static Lite.

| Check | Result |
|---|---|
| Station selection | Each of the five stations: a point inside its hotspot hovers it, and a click selects it (vignette on, URL `?station=…`, plus `&render=lite` in Lite). Escape returns to the lab |
| Opening project pages | Each of the five projects: its chip, then Open project, opens its page (`h1` correct; `?render=lite` kept in Lite) |
| Returning to the lab | Back to the lab returns to `?station=…&project=…`, in the same mode, with the station and project selected |
| Back and Forward | Project page → project → station → lab, and forward again, in the same mode at every step |
| Deep links into the lab | `?station=educational&project=arimap`, `?station=playground`, `?station=experience&project=koreez` and `?station=engineering&project=tablerefresh` each load with the right station and project. Open project points to the right page, or to Coming soon for Koreez |
| Direct project-page links | Every page, with and without `?render=lite`: correct `h1`, the back link targets its own station and project in the same mode, and all images load with none broken |
| Unavailable projects | Wallpapers and Koreez: Open project is an `aria-disabled` button with "Coming soon" and no page link. Activating it stays in the lab and announces "The … project page is coming soon." Their URLs return the 404 page |
| Switching modes | Cinematic → Lite and Lite → Cinematic within the same document (no reload), with the selection kept. Back returns to the previous mode |
| Homepage | `/` renders without broken images and has no link to `/lab-v2`. On `/?station=educational&project=arimap`, AriMap's Open project is still Coming soon |

## 5. Console, warnings and presentation

**Console (production):** no errors, warnings, exceptions, hydration errors or failed requests in any run. The only network errors were Chrome's log of the intended 404 responses for Koreez and Wallpapers.

**Presentation:** ten pages at three sizes: 1648 × 928, 1366 × 768, and 390 × 844 with touch emulation. The pages were `/`, Cinematic and Lite `/lab-v2`, two selected-station deep links and the five project pages.

| Check | Production result |
|---|---|
| Horizontal overflow | 0 px on every page and size |
| Missing images | 0 (lazy screenshots were checked after scrolling) |
| Unexpected fallback text (`undefined`, `NaN`, "Application error", "Loading…" and similar) | None |
| Console errors | 0 |

**Development and production compared:** the same 30 screenshots were taken from the development server with CSS animations frozen, then compared pixel by pixel.

- **28 are identical.**
- Cinematic `/lab-v2` at 1648 differs in 470 px (0.03 %). All of them are on the Playground arcade screen, a JavaScript-driven `<canvas>` that freezing CSS animations doesn't stop.
- AriMap at 1366 differs in 1 px.
- There are no visual differences between development and production.

The development server alone logged a Next.js advisory on AriMap and TableRefresh: a lazy screenshot "was detected as the Largest Contentful Paint". The probe triggers it by scrolling to load the lazy images, and production doesn't emit it.

## 6. Limitations

1. **The lab on phones (pre-existing; not a production regression).** At 390 px the lab shows the desktop composition cover-scaled:
   - the header overlaps itself, and a selected station's panel overlaps the Educational label;
   - only Educational is in view.

   This was recorded in `docs/m1.3a/NOTES.md` (narrow-screen notes) as a later layout task. It is identical in development and applies to `/` as well. The project pages have their own compact header and are correct at 390 px.

   *Later:* M1.4N.3 added a mobile station dock and compact header to `/lab-v2` (`MOBILE-DOCK-PROTOTYPE.md`). The homepage `/` is unchanged and still has this limitation.
2. **First paint (measured; not a functional defect).** In production the server responds in 5–100 ms, but in this headless browser the first paint lands at:
   - about 0.4 s on the bare 404 page (the browser's own floor here);
   - 0.8–1.0 s on project pages;
   - 1.0–1.2 s on `/lab-v2` (both modes; one Cinematic run 1.9 s);
   - 1.2–2.3 s on `/`.

   The hero text is the largest element, so LCP equals first paint. The delay therefore comes from browser-side work before the first frame, not from serving.

   *Correction:* the RTX 4060 verification earlier today attributed the 1.2–2.7 s first paint it measured to the development server. Production shows that was wrong. Finding what holds the first frame (a trace of script and hydration before the first paint) would be a separate performance task.
3. **Project pages need a Node.js server.** They render on request (§2), so the site can't be exported as static files. It was verified with a local `next start`, not on a hosting platform or behind a CDN.
4. **Browsers.** Headless Chrome only, with touch emulation for 390 × 844. Safari, Firefox and real phones were not tested.
5. **Static Lite resolution.** The 1672 × 941 plate is upscaled on larger screens (`STATIC-LITE-INTEGRATION.md` §5.5). This is unchanged and was already recorded.
6. **Not timed:** how long the Cinematic/Lite switch takes in production. Its correctness was checked (§4).

## 7. Recommendation

**PASS.** The production build succeeds with no warnings. All five project pages, the lab in both modes and the homepage serve and behave as in development. Koreez and Wallpapers remain unavailable, as intended. No release-blocking regression was found. Items 1 and 2 of §6 are candidates for later milestones; neither is caused by the production build.

## 8. RTX 4060 verification of Static Lite (earlier, 27 Nov 2026)

All six checks in `STATIC-LITE-INTEGRATION.md` §6 passed on this computer and were not repeated here. The results are in:

- `docs/performance/work/results/lite-integration-smoke-rtx.txt`: the integration smoke test.
- `docs/performance/work/results/lite-rtx.json`: one round of `static-perf.mjs` in Lite. Its `"chrome"` field reads "default flags (software compositing on this computer)". That is the probe's fixed label, written for the office computer. On the RTX 4060, default Chrome composites on the GPU (ANGLE, Direct3D 11).

The Cinematic markup comparison against `63fb64f`, the by-eye review and the Static Lite asset check were also run at that time. The production check above is consistent with them. Note the correction in §6, item 2.
