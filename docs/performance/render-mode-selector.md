# M1.4K.5B: Rendering mode selector

## Result: **a Cinematic / Lite selector is in `/lab-v2`'s header. Every check passes.** Status: **approved** and committed, with the accessibility improvement below.

The selector sits in the header row between the navigation and the search, clear of every station, label and chip. Cinematic remains the default.
- **Switching:** choosing a mode updates `render` in the URL without reloading the page, and keeps every other parameter and the lab's current selection.
- **Back and Forward:** both follow the mode.
- **Keyboard:** the selector is reachable with the keyboard and shows a visible focus ring.
- **Unchanged:** the cinematic animations, the station artwork and the homepage, whose header HTML is byte-identical.

Starting point `c05a89e`. Office computer, Chrome with default settings, headless, 1648 × 928, dev server.

![The header at 1648 × 928: Cinematic selected, Lite selected, and keyboard focus](work/captures/selector/sheet-header.png)

*The screenshot is ignored by Git, like every capture; `work/selector-check.mjs` recreates it.*

## Implementation

| | |
|---|---|
| **Control** | `components/lab/RenderModeSelector.tsx` (client). A `<fieldset>` with a screen-reader legend, "Rendering mode", holding two native radio buttons, **Cinematic** and **Lite** |
| **Descriptions** | Each option's description is both its mouse tooltip (`title`) and its accessible description (`aria-describedby`). The description text sits in a `hidden` element: assistive technology reads it, and it takes no layout space |
| **Look** | A small pill in the header's own style: the search button's dark glass and hairline, 32 reference px high, 13.5 px text. The selected option is a slightly lighter pill. Colours change through the existing `.lab-transition`, which is off under reduced motion. No new animation |
| **URL** | Lite writes `render=lite`. Cinematic **removes** `render`, so default links stay as they were; `?render=full` still works as Cinematic. Every other parameter (`station`, `project`, `floor`, …) and the hash are kept, read from the address bar, which the lab itself writes |
| **Switching** | `router.push(…, { scroll: false })`. This is a soft navigation: the page re-renders on the server for the new URL with no reload. A search-only navigation keeps the client state, so selection, focus and hover survive. The control shows the choice at once (`useOptimistic`) and is `aria-busy` until the new page arrives |
| **Back and Forward** | Each choice is a history entry. The page reads the mode from the URL, so Back and Forward show that entry's mode, and the control follows. This includes the lab's own entries (station and project) |
| **Keyboard** | One Tab stop; the arrow keys choose, as native radios do; the site's amber focus ring is drawn on the visible option |
| **Placement** | `SiteHeader` has a new optional `utilities` slot before the search. Only `/lab-v2` fills it; the homepage passes nothing and renders the same markup as before |

**Files changed:** `components/lab/RenderModeSelector.tsx` (new), `components/ui/SiteHeader.tsx` (the `utilities` slot) and `app/lab-v2/page.tsx` (passes the selector with the current mode). Nothing else in the application changed.

**Probes:** `work/selector-check.mjs` (the interaction pass and screenshots), `work/selector-a11y.mjs` (the final accessibility pass) and `work/selector-layout.mjs` (header and label positions, used for placement). Results are in `work/results/selector-check.json` and `selector-a11y.json`.

## Verification

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | PASS |
| Default is Cinematic; full scene; no `render` in the URL | PASS |
| **Mouse, Lite:** from `?floor=approved&station=engineering&project=sqlorbit`. Same document (no reload); every parameter kept and `render=lite` added; Engineering and SQLOrbit still selected; floor tone kept | PASS. The page updated about 1.4 s after the click (dev server) |
| **Back to Cinematic, Forward to Lite** | PASS (27–160 ms) |
| **Lite, then Escape:** `?floor=approved&render=lite`; Cinematic removes only `render`; Back twice returns to Lite with the lab home, then to Lite with Engineering selected (the lab's own entry) | PASS |
| **Keyboard:** Tab reaches the group (7 Tabs from the top) with a visible 2 px amber ring. ArrowRight chooses Lite with focus kept, ArrowLeft chooses Cinematic; `station=playground` kept | PASS. The page updated after 1.1–1.9 s |
| **Reduced motion:** both modes work; the selector has no transitions (`0s`) | PASS |
| Console errors (3 browser sessions) | None |
| **Visual, 1648 × 928:** the selector sits 30 px right of About and 28 px left of the search, vertically centred with the header controls. Station labels are well below it: Educational's at y 225 (and to the left), Playground's at y 324 (directly below). Nothing overlaps | PASS (`work/captures/selector/`, ignored by Git) |
| Homepage `/`: `<header>` HTML compared with and without the change | **Byte-identical** (7,519 bytes) |

## Remaining issues

1. **A switch waits for the server.** Changing mode re-renders the page on the server (a soft navigation, not a reload); the control itself updates at once. Measured on the dev server and this computer:
   - **warm switches:** 0.65–0.91 s from the arrow key to the scene in the new mode (§ final accessibility pass);
   - **first switches after load:** 1.1–1.9 s.

   A production build should be faster but was not measured. Making it instant would need the mode as client state, which means moving the scene's server components into the client bundle. That change is not worth it for this step.
2. **Narrow viewports were not checked.** Only 1648 × 928 was tested, as briefed. The selector uses the header's own scaled units, so it scales with the header. The header row is already tight at narrow widths; a small-screen layout is a header-wide question.
3. **The mode is not remembered**, as required: no localStorage and no detection. Leaving `/lab-v2` drops it, and a link without `render` opens in Cinematic.
4. ~~**The tooltips are mouse-only.**~~ **Resolved:** the descriptions are now also accessible descriptions (`aria-describedby`). Sighted keyboard users still don't see the text; the approved layout has no visible hint.

## Final accessibility pass (`work/selector-a11y.mjs`)

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | PASS |
| Chrome's accessibility tree: the group | role `group`, name "Rendering mode" — PASS |
| Cinematic | role `radio`, name "Cinematic", description "Full lighting and motion", checked — PASS |
| Lite | role `radio`, name "Lite", description "Lighter rendering for slower computers: stations light up at once, nothing moves", not checked — PASS |
| Keyboard | Tab reaches the group (7 Tabs) with the 2 px focus ring. ArrowRight and ArrowLeft switch 3 times each way, focus stays on the group, and the URL ends clean — PASS |
| Dev-server switching delay (arrow key to the scene in the other mode, warm) | To Lite: 654, 673, 809 ms. To Cinematic: 689, 802, 913 ms |
| Layout: the selector's pixels at rest (144 × 40 crop) before and after the change | **Identical** (0 differing pixels) |
| Console errors | None — PASS |
