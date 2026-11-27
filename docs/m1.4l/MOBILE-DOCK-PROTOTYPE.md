# M1.4N.2–M1.4N.3: mobile station dock (27 Nov 2026)

**Branch:** `feat/lab-v2`, on top of `c03d97b`. Committed in M1.4N.3 as `feat: add responsive mobile laboratory dock`.

**Status:**

- **Visual approval: PASS.** The owner reviewed the screenshots (phones, tablets, Cinematic, Lite, selected panels and the compact menu) and approved the design as built, with no redesign (M1.4N.3).
- **Production verification: PASS** (§10).
- **Outstanding:** real iPhone, real Android and screen-reader checks (§9, item 11).

**What it is:** Option B from [`MOBILE-LAB-INVESTIGATION.md`](MOBILE-LAB-INVESTIGATION.md). On portrait and narrow screens, `/lab-v2` gets:

- a compact header;
- a dock of the five stations;
- the existing station panel as a sheet above the dock.

All of it runs on the lab's existing state. Desktop, the homepage `/` and the project pages are unchanged.

**Result:**

- **Targeted validation:** 144 of 144 checks pass (§6).
- **Desktop and homepage:** the layout is identical to `c03d97b` at every size checked, and the homepage's markup is byte-identical (§7).
- **Static Lite:** `npm run static-lite:check` still reports "current".

## 1. Files changed

| File | Change |
|---|---|
| `components/lab/MobileLab.tsx` | **New.** `LabStationDock` (the dock) and `LabCompactHeader` (the compact header and its menu) |
| `app/lab-v2/page.tsx` | Renders both new components. Wraps `SiteHeader` in `.lab-desktop-header` (`display: contents`, so no box and no layout change). Marks `<main>` with `data-lab-mobile` |
| `components/lab/RenderModeSelector.tsx` | An optional `variant="compact"`: 44 px targets and its own radio-group name. The default variant's output is unchanged |
| `app/globals.css` | A new section at the end, "M1.4N.2 mobile lab". Every rule applies only to elements that exist on `/lab-v2` alone, inside two media queries (§2). No existing rule changed |

**Not changed:**

- the homepage (`app/page.tsx`);
- `SiteHeader`, `LabHero`, `StationPanel`, `LabStations`, `LabState` and `LabCamera`;
- the project pages and `data/`;
- every file the Static Lite check watches;
- any artwork, animation timing, the camera shots and the Lite images.

## 2. Responsive activation (approved)

| Layer | Media query | Applies to |
|---|---|---|
| **Compact header** | `(max-width: 1023.98px), (max-aspect-ratio: 5/4)` | Phones in either orientation, portrait tablets, and windows narrower than 1024 px |
| **Station mode** (dock, sheet, in-scene labels hidden) | `(max-aspect-ratio: 5/4)` | Portrait phones and tablets (320 × 640 to 1024 × 1366) and near-square windows |

**Why these values:**

- **1024 px, not 1040.** A width sweep of the current header found that its nav and utilities first touch at **996 px**: the gap is 0 px at 996, 14 px at 1024 and 20 px at 1040. So 1024 × 768 keeps the desktop header with room to spare. 1024 is also the breakpoint of the project pages' own compact header (`lg`).
- **Station mode uses aspect ratio.** Reachability depends on aspect ratio, not width (investigation §1.2). Landscape phones (844 × 390, aspect 2.16) show and can tap all five stations in the scene, so they keep it, with the compact header only. Every portrait size tested shows only Educational, so all of them get the dock.
- **No user-agent detection.** It's CSS only. `MobileLab.tsx` reads the same station-mode query with `matchMedia`, but only to decide where focus goes and how the header's in-lab anchors behave (§4).

## 3. Dock and header design

### Dock

- **Five stations in one row:** Engineering, Educational, Playground, Creative Studio, Experience, in the brief's order. Each has its existing station icon in its own colour (cyan, amber, violet, amber, amber) and its name.
- **Surface:** dark stone (a warm charcoal gradient), a faint border with a warm top highlight, and a soft shadow.
- **States**, so that colour is never the only signal:

  | State | Look |
  |---|---|
  | Selected | An amber mark with a glow at the top, an amber ring, a warmer surface, a bold amber label and the icon at full strength |
  | Focused | The site's amber focus outline, drawn inside the button |
  | Hovered | A lighter surface and white text, on devices that hover |
  | Pressed | A darker surface, and a 1 px press when motion is allowed |

- **Labels:** the full names everywhere, except that "Creative Studio" shows as "Creative" below 520 px. Its accessible name is always "Creative Studio" (checked in the accessibility tree).
  - At 320 px the dock's margin and gaps tighten, so "Engineering" (54 px wide) fits its 59 px slot.
- **Button sizes:**

  | Width | 320 | 390 | 430 | 768 and 1024 |
  |---|---|---|---|---|
  | Each button | 59 × 56 px | 69 × 56 px | 77 × 56 px | 115 × 56 px |

  The dock is at most 600 px wide, centred, and sits above the bottom edge and the device's safe area.

### Compact header

- **Left:** the brand (monogram and name; the role line from 480 px; the monogram alone below 360 px). The link keeps its full accessible name.
- **Right:** the Cinematic/Lite selector (`RenderModeSelector`, compact variant) and a **Menu** button (44 × 44). Each mode option is a 44 px tall target around a smaller visible pill.
- **The menu** is a disclosure (`aria-expanded`, `aria-controls`). It holds the same five destinations as the desktop header: Lab, Projects, Experience and About (same `href`s, and Lab marked as the current page, as on desktop), plus Let's Talk. Each row is 44 px tall.
  - It closes on Escape (focus returns to the button, and the lab doesn't also leave a selected station), on a tap outside, on focus leaving it, and after a link is chosen.
- **Not included: search.** The desktop search is a placeholder that only takes focus. A second instance would compete for its Ctrl+K shortcut. This is recorded here, not removed silently.

## 4. Integration with the lab's state

- **One navigation model.** A dock button calls `toggleStation(id)`, exactly as a station's title does: tap to select it, tap again to return to the lab. It mirrors the title's semantics (`aria-expanded`, `aria-controls` → the station's panel).
- **Everything else is the lab's own:** state, URL (`?station=…&project=…`, `pushState`), history, deep links, the panel, project selection, "Open project", "Coming soon" and the announcements.
- **Initial render.** The server renders the dock from the URL's selection, so a deep link highlights its station from the first byte. Back and Forward update the dock and the panel together.
- **Focus.**
  - Opening a station moves focus to its panel heading (existing behaviour).
  - Returning to the lab (Back to Lab, Escape, the dock button again or browser Back) moves focus to that station's dock button, because the in-scene title that `LabState` would focus is hidden in station mode.
- **The header's in-lab anchors in station mode.** They point at in-scene elements, which station mode hides:
  - "Projects" (and the skip link) → `#lab-stations`: moves focus to the dock;
  - "Experience" → `#station-experience`: opens the Experience station;
  - "About" → `#lab-intro`: unchanged.

  This also avoids the sideways scroll that `#station-experience` caused on phones. Outside station mode, the anchors behave as before (§9, item 9).
- **The scene in station mode.**
  - The scene stays as the backdrop. Its framing (Educational's island and the central "A") and all its artwork and animation are unchanged.
  - The in-scene labels, chips and hotspots are hidden (`display: none`), so no off-screen control stays focusable.
  - On selection the camera doesn't move, and the spotlight aimed at an off-screen station is replaced by an even dim. The dim uses the vignette's existing fade timing.
  - Cinematic still runs the selected station's activation, so selecting Educational lights its platform in view.

## 5. Panel position and touch targets

- **Where it sits.** The panel is the existing `StationPanel` (same content, links and order), shown as a sheet:
  - between the compact header and the dock, never overlapping either (both checked for every station at every size);
  - in the same centred 600 px column as the dock, with an internal scroll when the content is taller than the space. None of the seven tested sizes needed it. At 320 × 480 the sheet fills the space between header and dock (y 90–398), with 310 px of content in 308 px: it scrolls the rest, and Back to Lab stays reachable;
  - the eyebrow stays above it.
- **Look:** the dock's stone surface; heading 26 px, description 15 px, project names 16.5 px.
- **Touch targets:** project names, "Open project" and "Back to Lab" are at least 44 px tall; the smallest measured is 44 px at every size. The "Esc" key hint is hidden in station mode.
- **Safe areas:** `env(safe-area-inset-*)` is applied to the header, the hero, the dock and the sheet. The root layout doesn't set `viewport-fit=cover`, so on iPhones these insets are currently 0 and Safari keeps the page inside the safe area itself (§9, item 7).

## 6. Targeted test results

These ran on the development server in headless Chrome, with touch emulation below desktop, at 320 × 640, 390 × 844, 430 × 932, 768 × 1024, 1024 × 1366, 844 × 390 and 1648 × 928, each in Cinematic and Lite. **144 of 144 checks pass.**

| Check | Result |
|---|---|
| Right layout per size | Station mode at the five portrait sizes; compact header only at 844 × 390; desktop at 1648 × 928, where the dock and compact header aren't rendered (`display: none`) |
| Compact header | No overlap; every control in view; the mode options are 44 px or taller; the menu button is 44 × 44 |
| Dock | All five, in order, fully in view, at least 44 × 44, labels not cut. Accessible names are the full station names |
| Each station, from the dock | Opens its own panel, inside the viewport, clear of the header and the dock. Project targets are at least 44 px and tappable at their centre. URL `?station=…` (plus `&render=lite`) |
| Projects | Its first project selects: "Open project" for SQLOrbit, AriMap and AZIZ (unchanged `href`, with `?render=lite` in Lite); **"Coming soon"** (`aria-disabled`) for Wallpapers and Koreez |
| Toggle | Tapping the selected station again returns to the lab, with focus on its dock button |
| Back / Forward | Station, project and station steps keep the dock and the panel in step |
| Deep link | `?station=experience&project=koreez`: the dock is highlighted in the server HTML and after hydration, and the panel shows Coming soon |
| Project round trip | Armat → "Open project" → its page → "Back to the lab" restores the station, project, dock and panel |
| Mode toggle | The compact selector switches Cinematic ↔ Lite in place, keeping the station, dock and panel |
| Landscape phone | The in-scene title still selects its station (Playground), with the panel in the hero as before |
| Menu | Five destinations with 44 px rows. Escape closes it and returns focus. A tap outside closes it. In station mode, Projects goes to the dock and Experience opens its station, with no sideways scroll |
| Keyboard | Escape from a station returns to the lab, with focus on its dock button |
| Overflow | No horizontal overflow, and `<main>` never scrolled, after every interaction |
| Console | No errors or warnings, and no exceptions |
| `npm run typecheck` | Pass |
| `npm run static-lite:check` | "current" (6 images, 196 sources, baked at `63fb64f`) |

**Not tested:** real devices (iPhone Safari, Android Chrome), a production build, and screen readers in use (accessible names and roles were checked in the accessibility tree).

## 7. Desktop and homepage regression evidence

**Method:** an A/B run against `c03d97b`, served side by side from a copy of that commit on a second development server. For each case:

1. **A layout fingerprint:** every element's box, display, visibility, opacity, transform, colour, background and font size. The new elements are excluded.
2. **A screenshot with reduced motion,** compared pixel for pixel.
3. **A screenshot with normal motion,** frozen.

| Case | Layout | Pixels |
|---|---|---|
| `/lab-v2` Cinematic: 1648 × 928 (at rest, Engineering hovered, Engineering + SQLOrbit selected), 1366 × 768, 1920 × 945 (at rest, Playground selected), 1024 × 768 | **Identical**, except the `useId` value on the Cinematic/Lite selector's two hidden hint spans (below) | Only in the arcade `<canvas>`, the animated light, and the header text band. These reproduce between two runs of the *same* build (below) |
| `/lab-v2` Lite: 1648 × 928 (at rest, hovered, selected), 1366 × 768, 1024 × 768 (selected) | **Identical**, except the same hint spans | **0 px**, apart from 28–55 px in the header text band (also seen on the untouched `/`) |
| `/` at 1648 × 928 (at rest, hovered, AriMap selected), 1366 × 768, 390 × 844 (at rest, Engineering), 1024 × 1366, 844 × 390, 320 × 640 | **Identical** | 0 px, or capture noise (§ below) |

**Markup:**

- `/` and `/?station=educational&project=arimap`: **byte-identical** to before (DOM and React payload), on the development server.
- `/lab-v2/projects/sqlorbit` and `/lab-v2/projects/arimap?render=lite`: **byte-identical**.
- In a production build, the shared stylesheet's hashed file name will differ, because `globals.css` grew. Nothing else in the homepage's markup changes.

**Noise, measured:**

- Two captures of the *same* `c03d97b` build at 1920 × 945 differ by 54,087 px in the arcade region. Two of the new build differ in the same box. The arcade game's frame depends on time.
- The header-text band differs by 28–55 px, with a **maximum difference of 1/255** and no pixel off by more than 8. It also appears between identical builds.
- An occasional whole-frame difference on the homepage at 1648 × 928 appeared in some runs. It was first seen between two captures of the *unchanged* code, before any edit (857,978 px). Three further A/B runs gave 0–30 px, header band only.

**The only desktop markup difference on `/lab-v2`:**

- `data-lab-mobile` on `<main>`;
- the `display: contents` wrapper;
- the hidden dock and compact header;
- new `useId` values (`_R_t9bn5rlb_…`, was `_R_f9bn5rlb_…`) on the selector's two hidden hint spans and the `aria-describedby` that points at them.

The M1.4L "byte-identical to `63fb64f`" check therefore no longer applies to `/lab-v2`. As the investigation planned, the layout fingerprint replaces it.

## 8. Screenshots

All are in `docs/m1.4l/work/captures/mobile-dock/` (not committed; Git ignores `docs/**/*.png`):

| File | Shows |
|---|---|
| `01-390-cinematic-rest.png`, `02-390-lite-rest.png` | 390 × 844, no station selected |
| `03-390-cinematic-engineering.png` | Engineering selected |
| `04-390-cinematic-engineering-sqlorbit.png`, `05-390-lite-engineering-sqlorbit.png` | Engineering with SQLOrbit and its Open project |
| `06-390-cinematic-playground-aziz.png`, `07-390-lite-playground-aziz.png` | Playground with AZIZ |
| `08-390-cinematic-menu.png` | The open menu |
| `09-320-cinematic-creative-wallpapers.png`, `10-320-lite-experience-koreez.png` | 320 × 640, Coming soon |
| `11-430-cinematic-educational-arimap.png`, `12-768-cinematic-engineering-tablerefresh.png` | 430 × 932 and 768 × 1024 |
| `13-1024x1366-cinematic-educational-armat.png`, `14-1024x1366-lite-playground-aziz.png` | Portrait tablet |
| `15-844x390-cinematic-landscape.png`, `16-844x390-lite-landscape.png` | Landscape phone: compact header and the scene's own labels |
| `17-1648-cinematic-desktop.png`, `18-1648-lite-desktop.png` | Desktop regression view, unchanged |

## 9. Known limitations and owner decisions

Items 1–6 were the design decisions put to the owner. All were **approved as built** in M1.4N.3 (visual approval: PASS, no redesign).

1. **Dock order.** The brief's order is Engineering, Educational, Playground, Creative Studio, Experience. The room's left-to-right order is Creative Studio, Engineering, Educational, Playground, Experience, which would put Educational, the station in view, in the middle. This is a one-line change (`DOCK_ORDER`).
2. **"Creative" below 520 px.** This is the only abbreviation. Its accessible name stays "Creative Studio".
3. **The scene in station mode.** The camera is held, and an even dim (`rgb(4 5 7 / 0.5)`) replaces the off-screen spotlight. Educational's island stays the backdrop for every station. In Cinematic, an off-screen station's activation still runs while selected; it isn't visible, and its cost on a phone isn't measured.
4. **The sheet** sits above the dock, in a 600 px column on tablets. The hero heading's mobile size is 27 px at 320 px wide and at most 37 px.
5. **Compact header contents.** Search is left out (§3). On screens narrower than 360 px, the brand is the monogram alone.
6. **Landscape phones** keep the scene. Their hero heading still lies over the Engineering label (pre-existing, investigation §1.2), and the label can still be tapped. Possible fixes: a smaller hero on short screens, or station mode for landscape phones too.
7. **Safe areas.** Real insets need `viewport-fit=cover` in the root layout's viewport, which the homepage shares. It isn't changed here.
8. **Threshold band.** Station mode starts at an aspect ratio of 5:4 (1.25). Sizes between 1.25 and 1.33 (4:3, where the scene works) haven't been reviewed by eye.
9. **Pre-existing desktop issue, untouched:** the header's "Experience" link scrolls the Cinematic scene 61 px and leaves a black band, on `/` and `/lab-v2` (investigation §10). The compact header's menu uses the same link, so the same can happen on landscape phones. In station mode it is handled (§4).
10. **First paint:** production first paint on the lab is about 1.0–1.2 s (`PRODUCTION-VERIFICATION.md` §6). This is separate and unchanged; the prototype adds no images or animation.
11. **Outstanding: physical validation.** None of this has been done; nothing here should be read as a device pass.
    - A real iPhone (Safari/WebKit) and a real Android phone (Chrome), on a production build: look, touch, safe areas and Cinematic performance on a phone GPU.
    - A screen-reader pass (VoiceOver, TalkBack, and NVDA or JAWS).
    - Safari's engine (WebKit) hasn't been run at all. Every check here used Chrome (Chromium), headless, with touch emulation for phones and tablets.

## 10. Final verification in production (M1.4N.3)

**Build:**

- `npm run build` passes: compiled in 28.1 s, TypeScript clean, 12 of 12 static pages, no warnings.
- The route inventory is unchanged from M1.4M (`PRODUCTION-VERIFICATION.md` §2).
- The production server was `next start`, in headless Chrome. Touch emulation was used for the mobile checks; keyboard checks ran with no touch emulation.

### 10.1 Mobile checks

These ran at 320 × 480, 360 × 560, 390 × 844 and 1024 × 1366, in Cinematic and Lite. **All passed.**

| # | Check | Result |
|---|---|---|
| 1 | All five dock buttons accessible | Accessibility-tree names: Engineering, Educational, Playground, Creative Studio, Experience (role button). Sizes: 59 × 56 (320), 63 × 56 (360), 69 × 56 (390), 115 × 56 (1024) |
| 2 | The panel scrolls on short screens | Every station's sheet, with its first project selected, stays between the header and the dock. Where it is taller than the space, a touch swipe scrolls it to the end. At 320 × 480 that is Engineering + SQLOrbit (3 px) and Creative Studio + Wallpapers (2 px); everything else fits |
| 3 | Back to Lab accessible | It is in view in every sheet, after scrolling where needed, and 44 px tall. A tap returns to the lab with focus on the station's dock button |
| 4 | Project actions by touch | TableRefresh → Open project → its page → Back to the lab restores the station, project, dock, panel and mode |
| 5 | Compact menu | Opens with a tap: 5 links, 44 px rows, in view and tappable. Closes on a tap outside. "Experience" opens that station, and the menu closes |
| 6 | Deep links and history | `?station=playground&project=aziz` highlights Playground in the server HTML and after hydration. Back and Forward move the dock and the panel together |
| 7 | Nothing over the dock | The centre and four inset points of every dock button hit the button itself, at rest and with every sheet open |
| 8 | Console and hydration | No errors or warnings and no exceptions, across every run |
| 9 | Development indicator | Absent (no `nextjs-portal`) |
| 10 | Horizontal overflow | None, and `<main>` never scrolled, after every interaction |

### 10.2 Accessibility

These checks were automated or used a desktop browser with the keyboard; no physical device or screen reader was used (§9, item 11).

- **Dock names:** the full station names, as above.
- **Keyboard order** at 390 × 844 and 320 × 480: skip link → brand → Cinematic/Lite (one Tab stop) → Menu → the five dock buttons. Each shows the amber focus outline (`:focus-visible`, solid, at least 2 px).
- **Dock and panel by keyboard:**
  - Enter on a dock button opens its panel and moves focus to the panel heading.
  - Tab reaches the projects, "Open project" and Back to Lab. The focused control is inside the sheet's visible area, including on the overflowing 320 × 480 sheet.
  - Enter on Back to Lab returns, with focus on the dock button.
- **Menu by keyboard:** Enter opens it, Tab moves into it ("Lab" first, with a visible outline), and Escape closes it with focus back on its button.
- **Skip link:** "Skip to lab stations" is the first Tab stop, visible on focus, and moves focus to the dock with no layout shift. The first automated run reported a failure here, but that came from the test: it pressed Tab after the menu check, so focus continued from the menu button. Re-run from a fresh page, it passed in both modes.
- **Touch targets:** dock buttons, mode options, the menu button, menu rows, project names, "Open project" and Back to Lab are all at least 44 px.

### 10.3 Homepage and desktop isolation

This compares production against production: `c03d97b` built and served separately against this change.

- **`/` markup:** `/`, `/?station=educational&project=arimap`, `/?station=engineering`, two project pages and the Koreez 404 are **identical** once two things are normalised: the hashed file names of three chunks and the per-build ID, which change with any rebuild.
- **Stylesheet:** 0 rules removed. 65 rules added: the new scoped section, and Tailwind utilities generated for the new components that no homepage element uses.
- **JavaScript:** two shared chunks changed by regrouping only, because `MobileLab` shares the icons and `StationIcon`.
- **`/` rendering:** the layout fingerprint is **identical**, and pixels differ by **0 px**, at 1648 × 928 (at rest, hovered, AriMap selected), 390 × 844, 1024 × 1366, 844 × 390 and 320 × 640. One case had 1 px, at 1/255.
- **Desktop `/lab-v2`:**
  - The layout fingerprint is identical, except the regenerated `useId` values on the selector's two hidden hint spans (§7).
  - Lite differs by **0 px** at 1648 × 928, at rest and selected.
  - Cinematic differs only in the arcade `<canvas>` box (41,024 px at 1648; 28,247 px at 1366). The `c03d97b` production build compared with *itself* gives the same 41,024 px in the same box, because the game's frame depends on time.
- **Static Lite:** `npm run static-lite:check` reports current (6 images, 196 sources, baked at `63fb64f`).

**Unchanged and outside this milestone:**

- the desktop "Experience" link's 61 px scene scroll (investigation §10; §9, item 9 here);
- the lab's first paint of about 1.0–1.2 s in production.
