# M1.4P: the header's Experience opens the Experience station (28 Nov 2026)

**Branch:** `feat/lab-v2`, on top of `03028c4`.

**Result: done, and verified in a production build in Chrome, Firefox and WebKit.**

- **On desktop `/lab-v2`,** in Cinematic and in Lite, the header's Experience opens the Experience station: the same selection, panel, camera shot, URL and history as clicking the station's own title.
- **On the five case-study pages** (`/lab-v2/projects/[slug]`), the header's Experience goes to the lab with the Experience station open, in the render mode the visitor came with.
- **One state model.** It goes through the lab's existing state (`LabState`); there's no second station state.
- **Unchanged:** the homepage `/`, the mobile dock, the landscape-phone menu and the M1.4O scroll fix.
- **Checks:**
  - Development: 65 + 6.
  - Production, Chrome: 65 + 6 + 86.
  - Production, Firefox and WebKit: 22.
  - All pass. Typecheck and build pass, and the Static Lite check reports current.

## 1. Previous behaviour

Every header pointed Experience at the in-scene anchor `#station-experience`. It came from `NAV_ITEMS` in `data/site.ts`.

- **Desktop `/lab-v2` (and `/`):**
  - the URL became `/lab-v2#station-experience`, with one history entry added;
  - **nothing opened.** No station was selected, no panel, no camera move.
  - Since M1.4O, nothing scrolls either (`overflow: clip`, `EXPERIENCE-SCROLL-FIX.md`). That fix stopped the black band but left the link inert (its §9).
- **Project pages.** Their header maps the site's entries into the lab (`ProjectDetail.tsx`), so Experience was `/lab-v2#station-experience` (with `?render=lite` etc. when present). It landed on the lab at rest, with nothing open.
- **Mobile, station mode** (portrait, aspect ratio 5:4 or narrower). `LabStationDock` in `MobileLab.tsx` already caught that anchor in a capture-phase document listener and called `selectStation("experience")`. Desktop had no equivalent.

## 2. Root cause

The link was never wired to the station-selection system.

- `#station-experience` is the `id` of the Experience label in the scene, so following it is plain fragment navigation. The browser updates the URL and, at most, scrolls; the app has no fragment handling.
- Selection lives only in `LabState`'s reducer, reached through `selectStation` / `toggleStation`. Stations are selected by their in-scene titles, the dock, Escape / Back to Lab, the `?station=…` deep link (resolved on the server, as `initial`) and Back / Forward (`popstate` → `restore`).
- The fragment isn't part of the lab's URL convention (`?station=…&project=…`, `lib/lab-url.ts`). So `LabState` ignores it, whether it's followed in place or arrived at from a project page.
- The header is a server component (`SiteHeader`) rendered outside `LabStateProvider`, so it can't call the state's actions directly.

## 3. Implementation approach

### a. Experience points at the station's deep link (`/lab-v2` and its project pages)

`labV2ExperienceHref(view)` in `lib/lab-v2-pages.ts` returns `/lab-v2?station=experience`, the established deep link. The view parameters are kept: `render=lite`, and an explicit `floor`. It uses the existing `labV2Href` / `labViewQuery`.

**Two headers use it:**

- **`/lab-v2` itself,** through `labV2Nav(view)`: `NAV_ITEMS` with only Experience replaced. `SiteHeader` already takes a `nav` prop.
- **The project pages' header,** in `ProjectDetail.tsx`. Lab still goes to the lab at rest. Projects and About keep their in-lab anchors.

**No JavaScript needed to get there.** A link to the deep link works without any help: a Ctrl or middle click (new tab), a click before hydration, or a click on a project page all load `/lab-v2?station=experience`. The server renders it with Experience already open.

**Everything else in the header is unchanged:** the other entries, the text, the icons, the layout and the active pill. On `/lab-v2`, `activeHref` is still `/`, so Lab stays the active entry; on project pages it is still Projects.

### b. On `/lab-v2`, a plain click selects in place

`components/lab/HeaderStationLinks.tsx` renders nothing. It sits inside `LabStateProvider` and adds one capture-phase `click` listener on the document. This is the same mechanism the mobile dock uses for `#station-experience`.

**What it acts on:** a plain primary click on a link inside `[data-lab-header-stations]` whose URL is this page with a valid `?station=`.

- A plain click is the left button with no modifiers and no other `target`. Keyboard Enter counts: it fires `click`.
- `[data-lab-header-stations]` is set only on `/lab-v2`'s desktop header wrapper, which is `display: contents`.

**What it does:**

1. `preventDefault()`. `next/link` checks `defaultPrevented` and skips its own navigation (`next/dist/client/app-dir/link.js`).
2. `selectStation(station, project)` through the existing reducer.

**After that, `LabState` does what it already does for every selection:**

- pushes one `?station=experience` entry;
- follows Back / Forward through `popstate`;
- clears the selection on Back to Lab / Escape and pushes the lab's URL;
- moves focus to the panel heading on opening, and back to the station's title on return.

**Modified clicks are left to the browser.** Ctrl+click opens the deep link in a new tab, and the current tab is untouched.

**Why `selectStation` and not `toggleStation`:** the header entry is "go to Experience". A second click while Experience is open leaves it open and adds no history entry. The mobile dock's menu handling does the same.

**Why not a router navigation to `?station=experience` on `/lab-v2`:** a search-only soft navigation keeps `LabStateProvider` mounted, and its reducer ignores a changed `initial`. The address bar and the selection would disagree. Selecting in place keeps one source of truth.

### c. From a project page

There, the click is an ordinary `next/link` navigation to another route (`/lab-v2`). The lab mounts fresh with `initial` resolved from `?station=experience`, so the panel is open from the first render. History works the usual way: Back returns to the project page, and Forward returns to the lab with Experience open.

## 4. Files changed

| File | Change |
|---|---|
| `components/lab/HeaderStationLinks.tsx` | **New.** The click listener (§3b) |
| `lib/lab-v2-pages.ts` | `labV2ExperienceHref(view)` (the destination) and `labV2Nav(view)` (`/lab-v2`'s header entries) |
| `app/lab-v2/page.tsx` | The desktop header wrapper gets `data-lab-header-stations` and `nav={labV2Nav(labViewQuery(query))}`. `<HeaderStationLinks />` is added inside `LabStateProvider`, after the dock |
| `components/project/ProjectDetail.tsx` | Its header's Experience uses `labV2ExperienceHref(view)` instead of `/lab-v2…#station-experience`. One `href` mapping and its import; no content or styling |
| `docs/m1.4l/EXPERIENCE-HEADER-NAVIGATION.md` | This report |

**Not changed:**

- `app/page.tsx`, `SiteHeader`, `data/site.ts` (`NAV_ITEMS`) and `LabState`;
- the mobile dock and compact header (`MobileLab.tsx`) and `globals.css`;
- the scene, artwork, station positions, camera, animation timings and Static Lite assets;
- project content and the project pages' styling;
- any dependency.

The only modules that import the changed files are `/lab-v2` and its project pages. None of the changed files is watched by the Static Lite staleness check.

## 5. Focused test results (development server)

**Setup:**

- Next.js development server (16.4.6, Turbopack).
- Headless Chrome through `scripts/visual/cdp.mjs`.
- Real mouse and key input (CDP `Input.*`), with motion **on**. Motion on is the condition where the old frame overhang scrolled; see `EXPERIENCE-SCROLL-FIX.md` §6.
- "Nothing scrolled" means no element in the document, and not the window, has a non-zero `scrollTop` / `scrollLeft`. That is the black-band defect's own signature.

**Desktop, 1648 × 928.** Every row was checked on Cinematic `/lab-v2` and on Lite `/lab-v2?render=lite`. **28 checks in Cinematic and 27 in Lite (no camera there); all pass.**

| Check | Result |
|---|---|
| Header Experience `href` is the deep link (`/lab-v2?station=experience`; Lite: `…&render=lite`); the other entries are unchanged (`/`, `#lab-stations`, `#lab-intro`) | PASS |
| **Click:** Experience selected and its panel open; URL `?station=experience` with no fragment; exactly one history entry; focus on the panel heading; nothing scrolled. Cinematic only: the camera moves to the Experience shot (`matrix(1.03, 0, 0, 1.03, -24.7, 0)`) | PASS |
| Second click while open: stays open, URL unchanged, no new history entry | PASS |
| **Back:** lab, panel closed, URL `/lab-v2` (Lite: `?render=lite`), nothing scrolled. **Forward:** Experience open again | PASS |
| **Back to Lab:** panel closed, URL back to the lab's, focus on the Experience title, nothing scrolled | PASS |
| **Switching:** Engineering's title opens Engineering; the header's Experience then switches to Experience; Back returns to Engineering; from Experience, Educational's title opens Educational | PASS |
| **Keyboard:** focus the link, press Enter. Experience opens, one entry, focus on the heading, nothing scrolled. **Escape** closes it and restores the URL | PASS |
| **Direct deep link** `?station=experience`: open on load, nothing scrolled. The header's Experience then changes nothing and adds no entry | PASS |
| Direct `…#station-experience` (old links): nothing scrolled. The M1.4O fix is intact | PASS |
| Console: no errors or warnings | PASS |

**Other desktop sizes:** the header Experience click in Cinematic and Lite at 1920 × 945, 2560 × 1080 and 1366 × 768. The first two are wider than 16:9, where M1.4O's `<main>` scroll was largest.

- **6 of 6 pass:** Experience open, deep-link URL, nothing scrolled.

**Homepage `/`, 1648 × 928.** 4 checks, all pass:

- Experience is still `#station-experience`.
- The page has no `.lab-desktop-header` and no `[data-lab-header-stations]`.
- A click follows the anchor exactly as before: URL `/#station-experience`, one entry, nothing selected.
- Nothing scrolled.

**Mobile.** 6 checks, all pass:

- **390 × 844 (station mode):** the compact menu's Experience opens Experience through the dock's handler. The dock button is marked selected, the URL is `?station=experience`, and nothing scrolled. The dock's Experience toggles closed, then open again, and Escape closes it.
- **844 × 390 (landscape phone: compact header, not station mode):** the menu's Experience still follows the anchor as before. The URL becomes `…#station-experience`, nothing is selected, and nothing scrolled.

**Visual isolation (A/B):** the same 10 resting cases were captured with the edited `/lab-v2` files at their `03028c4` contents (A) and with this change (B). Each capture used reduced motion, frozen animations and finished transitions.

**The cases:**

- `/` at 1648 and 1920, and `/?station=experience`;
- Cinematic `/lab-v2` at 1648 and 1920, and with Experience open;
- Lite `/lab-v2`, at rest and with Experience open;
- the mobile dock at 390 × 844, at rest and with Experience open.

**Results:**

- **Layout fingerprint** (every element's box, display, visibility, opacity, transform, colour and overflow): **identical in all 10**, at 357–1084 elements each.
- **Lite and mobile screenshots:** pixel-identical, or within 1/255.
- **The remaining Cinematic and homepage differences are capture noise:**
  - At 1920, along Playground's outline, two captures of the *unchanged* baseline differ in exactly the same way.
  - The other differences are the Next.js development indicator in a corner, and the homepage, whose code is identical in A and B, differs just the same.

## 6. Production verification (28 Nov 2026)

**Setup:**

- `npm run typecheck`: pass.
- `npm run static-lite:check`: current (6 images, 196 sources, baked at `63fb64f`).
- `npm run build`: passes (Next.js 16.4.6, Turbopack; TypeScript passes in the build).
- `next start`.
- Headless Chrome through `scripts/visual/cdp.mjs`, motion on.

**The §5 suites, rerun against the production server.**

- **65 of 65 pass:** desktop Cinematic and Lite, the homepage and mobile. That covers:
  - click, keyboard, Back / Forward, Back to Lab, Escape and switching stations;
  - deep links;
  - the black-band scroll scan;
  - homepage isolation, the mobile dock and the landscape-phone menu.
- **6 of 6 pass** at the other desktop sizes.

**Project pages to the lab, Ctrl+click, console. 86 of 86 pass.** Each of the five case-study pages was checked in Cinematic and in Lite, 8 checks each:

| Check, per page and mode | SQLOrbit | AriMap | TableRefresh | Armat | AZIZ |
|---|---|---|---|---|---|
| Header Experience `href` is `/lab-v2?station=experience` (Lite: `…&render=lite`) | PASS | PASS | PASS | PASS | PASS |
| Click: lands on `/lab-v2` with Experience selected and its panel open, at that exact URL | PASS | PASS | PASS | PASS | PASS |
| Render mode kept: Cinematic shows the camera scene, Lite shows Static Lite | PASS | PASS | PASS | PASS | PASS |
| Lab is the active header entry on arrival | PASS | PASS | PASS | PASS | PASS |
| Nothing scrolled on arrival | PASS | PASS | PASS | PASS | PASS |
| Back: the project page again (same URL, mode kept) | PASS | PASS | PASS | PASS | PASS |
| Forward: the lab with Experience open; nothing scrolled | PASS | PASS | PASS | PASS | PASS |

The same run also checked, in each mode:

- **Ctrl+click** on `/lab-v2`'s header Experience: a new tab opens at the deep link, and the current tab keeps its URL, its selection (none) and its history length.
- **Console:** no errors, warnings, hydration messages or uncaught exceptions on any page above.

## 7. Browser coverage

| Engine | Where | Checks | Result |
|---|---|---|---|
| Chrome (headless) | Development and production | Everything in §5 and §6 | All pass |
| Firefox 155.0 (Playwright build) | Production | Cinematic and Lite at 1648 × 928, 11 checks | 11 of 11 pass |
| WebKit 27.2 (Playwright build, Windows) | Production | Cinematic and Lite at 1648 × 928, 11 checks | 11 of 11 pass |

**What Firefox and WebKit covered,** in each mode:

- the header Experience click (station open, deep-link URL, nothing scrolled);
- Back (closed, lab URL);
- AZIZ's header Experience (lab with Experience open, render mode kept, nothing scrolled);
- no page errors and no console errors or warnings.

These are the Playwright browser builds already on the machine, as in M1.4O. Nothing was installed.

## 8. Remaining limitations

- **The landscape phone, and the compact header outside station mode,** are unchanged by design. At 844 × 390, for example, the menu's Experience still follows the anchor `#station-experience` and opens nothing; nothing scrolls. Only station mode (the dock) opens the station from that menu. Wiring it up is a separate change.
- **The homepage `/` keeps the inert anchor,** as instructed.
- **Experience isn't the active header entry while its station is open.** By decision, Lab keeps the active pill on `/lab-v2` (Projects on project pages).
- **Engines not covered:**
  - Safari itself (macOS or iOS);
  - branded release Firefox;
  - real phones;
  - Chromium browsers other than headless Chrome.

  Firefox and WebKit ran only the brief §7 set, not the full suites.
- **A click in the moment between the header's hydration and the listener's effect** would make a soft navigation to `?station=experience` without selecting the station. The listener attaches in the same commit's effects, so this window is practically nil, and it was not observed.
- **Development tooling note.** Restoring files with `git stash` / `stash pop` while `next dev` (Turbopack, Windows) was running left that server serving `/lab-v2` as 404 until it was restarted. The files themselves were correct. Later checks ran on a fresh server.
