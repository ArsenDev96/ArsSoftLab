# M1.3A: Five-station interaction system

All five stations now share one hover, keyboard-focus, selection and return system. Selecting a station replaces the hero heading with that station's information and projects. Each project can be selected, and shows one sentence plus an honest Open project action. The camera, connections and lighting respond, and Back to Lab, Escape or re-selecting the station returns to the lab.

At rest the lab is unchanged: idle is within 2/255 of the approved M1.1 baseline (mean 0.004) and within 1/255 of M1.2.2.

## Evidence (this folder)

| File | What it shows |
| --- | --- |
| `idle.png` | The default lab at 1648×928. |
| `educational-selected.png`, `engineering-selected.png`, `playground-selected.png`, `creative-selected.png`, `experience-selected.png` | Each station selected by pointer, after the camera has settled. |
| `project-selected.png` | Engineering with SQLOrbit selected: the sentence, and Open project marked "Coming soon". |
| `comparison.png` | The M1.1 baseline, M1.3A idle and their difference (×40), then the five selected states and the project state. |
| `checks/` | Supporting screenshots: returns, hover, reduced motion, the long session, the idle diff heatmap and the switching log. |

How the evidence was produced:
- `npm run visual -- --url http://localhost:3100 --out docs/m1.3a` produced the screenshots and `checks/`.
- `comparison.png` was composed offline with Pillow.
- No recording, `regression.txt` or GPU timing in this milestone: long runs were skipped during design development. `npm run visual:stations -- --record` produces timing and recording frames when needed.

## 1. Implementation summary

- **Data.** Every station now has its one-line description in `data/zones.ts`, using the brief's copy. Projects gained optional `summary` and `href` fields in `data/projects.ts`.
  No project descriptions existed anywhere in the repo, so none were invented. Until the owner writes them, `projectSummary()` builds a neutral sentence from data that already exists, for example "SQLOrbit is an Engineering project: developer tools and production engineering."
  `href` is unset for every project, so Open project says "Coming soon" and links nowhere.
- **State.** `LabState.tsx` was rewritten around one reducer (details in section 3).
- **Hero.** `StationPanel` replaces `StationFocusPanel` and exists for all five stations. It uses the same 40.5 px heading, the amber rule and the "INSIDE MY LAB" eyebrow. The content is: title, description, project names, Open project, the project sentence, the rule, and Back to Lab. There is no card, modal or panel chrome.
- **Hover.** Title and icon brighten: a warm halo on the title, a brightness lift on the icon. For the four stations without a layer, the platform's own light strips brighten through a new mask, `platforms.png`; Engineering keeps its M1.2.2 lift and light. The station's connection to the central A brightens through the existing connection masks. Educational keeps its orbit boost. Other stations are untouched.
- **Selection.** The camera moves to a per-station shot. The station's connection light rises to 0.85 and its energy pulse stays at full strength. The other pulses drop to 40%, other labels to 60%, and the orbit to 20% unless Educational is selected. The M1.2.1 vignette is kept.
  Engineering stays lifted while selected. The selected title is amber, as before.
- **Hotspots.** The rectangles are now polygons around each station (`clip-path`). Two pairs of rectangles used to overlap: Engineering with Creative, and Playground with Experience.
- **Return.** On return the selection and project clear, the heading comes back, the camera eases home and the lights fade. Focus returns to the station's title.

## 2. Files changed

| File | Change |
| --- | --- |
| `components/lab/LabState.tsx` | Rewritten: selection reducer, hover attributes, generated per-station CSS state, Escape, focus return, `returning`, announcements. |
| `components/lab/StationPanel.tsx` | New. Replaces `StationFocusPanel.tsx`, which was deleted. |
| `components/lab/StationLights.tsx` | New: masked platform and connection lights. |
| `components/lab/LabStations.tsx` | Polygon hotspots; uses the new actions; compositing anchor (see section 8). |
| `components/lab/ProjectStation.tsx` | `data-zone`, title as disclosure for every station, keyboard lighting for the whole label, chip re-mount after the lift (see section 8). |
| `components/lab/LabHero.tsx` | Renders a panel for every station. |
| `components/lab/LabCamera.tsx` | Reads the selected station. |
| `components/lab/LabScene.tsx` | New "lights" layer. |
| `components/lab/MaskedLight.tsx`, `GlobeOrbit.tsx` | `data-zone` on the orbit, so it reacts to Educational's state. |
| `components/lab/scene-layout.ts` | Hotspot polygons, camera shots for all five stations (with bounds). |
| `components/lab/scene-fx.ts` | `PLATFORM_LIGHTS` and `CONNECTION_LIGHTS` boxes. |
| `app/globals.css` | Per-station state rules; selection now keyed on `data-lab-selected`; hero project and detail styles; the lift also applies while Engineering is selected. |
| `data/zones.ts`, `data/projects.ts` | Station descriptions; optional project `summary` / `href`; `projectSummary()`. |
| `scripts/make-scene-masks.py` | `PLATFORM_BANDS` and `platforms.png`. The four existing masks regenerate byte-identical. |
| `public/scene/masks/platforms.png` | New, 10 KB. |
| `scripts/visual/check.mjs` | Rewritten for five stations (see section 4). |
| `scripts/visual/stations.mjs`, `stations-evidence.mjs` | New probes; performance and recording evidence. |
| `scripts/visual/cdp.mjs`, `compare.mjs`, `lift.mjs` | Touch emulation and tap; the grid streams images; the lift label probe works under the camera. |
| `package.json`, `README.md` | `visual:stations`; documentation. |

## 3. Interaction architecture

```
LabStateProvider
  selection  useReducer(labReducer)   { station, project, returning }
  hover      useState × 2             pointer, keyboard  (not in context)
  <style>    generated per station    [data-lab-hover=X] [data-zone=X] { --zone-hover: 1 } …
  <div data-lab-hover data-lab-selected data-lab-project data-lab-returning class="contents">
    LabScene (camera, lights, fx, stations)  LabHero (5 × StationPanel)  ExploreCue
```

- **One source of truth.** The reducer has five actions: `select`, `toggle`, `project`, `back` and `returned`. They can't express two selected stations, or a project outside the selected station.
  - Selecting a project from another station switches station.
  - Selecting the selected project again clears it.
  - `back` records `returning`. That state ends once the camera has eased home (760 ms, or 200 ms with reduced motion).
- **No re-renders on hover.** Hover and keyboard focus are kept out of the context value, so pointer movement re-renders only the provider's wrapper, and its children keep their identity. Every visual response is CSS.
  The provider generates two rules per station that set `--zone-hover` and `--zone-selected` on that station's elements (`data-zone`, or `data-connection` for energy tracks). `globals.css` derives `--zone-other` (another station is selected). Each effect is a single rule reading these variables, for example the platform light's `opacity: max(0.6·hover, 0.85·selected)`.
  At rest every value resolves to the previous look, so idle is untouched. Adding a station needs no CSS edits.
- **Selection re-renders** only the consumers (stations, camera, vignette, panels), once per click or key.
- **Continuous motion** (energy, orbit) stays compositor-only CSS, as in M1.2.
- **Focus management.**
  - An opening panel focuses its heading; switching stations moves focus again.
  - Return puts focus back on the station's title, if focus was in the hero or would otherwise be lost.
  - Keyboard focus anywhere in a label lights that station, but only with `:focus-visible`, not after mouse clicks.

### Camera shots

All five stations use the existing `frameTarget` clamp, so the plate always covers the frame. Two constraints set the shots:
- The hero slot is outside the camera, at the top left. Any zoom about the centre moves Engineering's label up and left toward it.
- The Experience platform touches the right edge of the frame.

| Station | Zoom | Translation (scene px) | Why |
| --- | --- | --- | --- |
| Educational | 1.09 | −2, +42 | Rear centre: no sideways move; the clamp allows a 42 px drop. |
| Engineering | 1.09 | +75, +33 | Unchanged from M1.2.1. |
| Playground | 1.09 | −15, +42 | A full −75 px lean would put Engineering's icon under the hero's lower rows. |
| Creative Studio | 1.09 | +75, +10 | A full upward lean (−42) would lift Engineering's label into the hero. |
| Experience | **1.03** | −25, 0 | At 1.09× the platform leaves the frame unless the shot pans the full −75 px, which puts Engineering under the hero. The movement is reduced, as the brief allows. |

## 4. Test results

The last complete `npm run visual` run passed **183 of 183** checks. It covered every area the brief lists:

- **Selection:** each of the five stations, by pointer and by keyboard.
- **Hero content:** title, description and projects, matching the brief exactly.
- **Projects:** all seven selectable from the hero and from the scene, and toggling. Open project says "coming soon" and has no link.
- **Return:** Back to Lab and Escape for every station, with focus returned to the station's title.
- **Re-selecting** a station's title returns to the lab.
- **Switching and invariants:** one station, one panel, one expanded title, project within its station, at every step.
- **Hover:** each station lights only itself.
- **Reduced motion:** all five stations, no camera move or lift.
- **Touch:** at 390×844 with no hover.
- **Camera edges:** hidden at five viewport sizes.
- **Hero overlaps:** no label under the hero at three 16:9 sizes.
- **Pixels:** idle equals the baseline, returns equal idle, and a long session leaves no artifacts.

That run was made before two changes:
- removal of an overridden duplicate CSS rule (no effect);
- swapping the in-suite comparison grid for a three-tile sheet, because the grid stalled the DevTools connection.

TypeScript and a clean production build pass on the final code.

## 5. Performance observations

- **Not measured in this milestone.** Long GPU runs were skipped. `npm run visual:stations` does the measurement when needed.
- **By construction:**
  - Hover changes only `data-lab-hover` plus CSS custom properties. React consumers don't re-render, and the effects are opacity, filter and text-shadow transitions on small elements.
  - Selection re-renders the consumers once per click.
  - The camera and the lift are transform-only, as measured in M1.2.1 / M1.2.2 (60 fps on the weak test GPU).
  - The extra elements are 4 platform lights and 5 connection lights. They are fully transparent at rest and are not animated continuously.
  - Pulses of unselected stations keep running, but at reduced opacity. Nothing new is animated per frame.

### Decoded image memory

- **Already there:** plate 6.3 MB, four M1.2 masks 25 MB, Engineering layers 25 MB (M1.2.2).
- **New in M1.3A:** `platforms.png` at half resolution, 1.6 MB decoded. The connection lights reuse the two connection masks already decoded for the energy flow.
- No station was extracted.

## 6. Visual regression results

| Comparison | Max | Mean |
| --- | --- | --- |
| Idle vs approved baseline (M1.1) | 2 | 0.0044 |
| Idle vs M1.2.2 idle | 1 | 0.0001 |
| Return from each of the five stations vs idle | 0 | 0 |
| Long session (hover, mid-transition switches, projects, keyboard) vs idle | 0 | 0 |
| Reduced-motion idle vs baseline | 2 | 0.0044 |
| Engineering hover, outside the station and its line, vs idle | 0 | 0 |
| Engineering hover return vs idle | 0 | 0 |

Every selected state differs visibly from idle (more than 10,000 px over 12/255), as intended.

## 7. Accessibility findings

- **Keyboard.** Tab reaches every title, project chip, hero project, Open project and Back to Lab. Enter and Space activate. Focus rings are visible: the global amber `:focus-visible` outline. Escape returns from anywhere.
- **Names and roles.**
  - Station titles are disclosure buttons (`aria-expanded` and `aria-controls` → panel). The panels are `section`s labelled by their `h2`, and inert while closed.
  - Project names are toggle buttons (`aria-pressed`).
  - Open project is "Open project ⟨name⟩", `aria-disabled`, described as "Project page coming soon".
  - Back to Lab has `aria-keyshortcuts="Escape"`.
- **Focus management.** Verified for every station: heading on open, title on return, by pointer and by keyboard. Reduced-motion panels switch `visibility` instantly, so focus can move in.
- **Announcements.** One polite live region announces:
  - "Experience selected. Building and maintaining real-world software. Press Escape or Back to Lab to return."
  - the project with its sentence;
  - "Back in the lab."
  
  Open project has its own live region.
- **Nothing depends on hover.** Descriptions are plain text in the hero. On touch (390×844, no hover), tapping a title, a project and Back to Lab all work, and no hover state is left behind.
- **Hotspots** are pointer-only polygons that no longer overlap. The titles carry the same actions.
- **Findings / open items.**
  - On phones the scene is the desktop composition cover-scaled, as in M1.1. At 390 px wide only Educational is in view, and the header overlaps itself. That is a layout task for a later milestone; the interactions themselves work.
  - Hero controls scale with the viewport (`--vu`, minimum 0.62 px per reference px). The hero project buttons are about 28 reference px tall, so below about 1440 px wide (16:9) they fall under the 24 px target-size minimum (WCAG 2.5.8). The in-scene chips already did, since M1.1.
  - The decorative in-scene chips and the hero project buttons do the same thing, so screen-reader users meet the project list twice while a station is selected. This is intentional (both are real controls), but worth reviewing with real users.

## 8. Known limitations

1. **Project copy.** No per-project descriptions exist yet. The sentence shown is derived from station data and says nothing project-specific until `summary` is filled in `data/projects.ts`.
2. **Camera is lean, not centring.** At 1.09× the plate allows only about 75 px of sideways movement, so outer stations are approached rather than centred. Experience zooms less (1.03×).
3. **Chrome workaround: stale chip paint.** In M1.2.2, a project chip (which has `backdrop-filter`) that repainted while the Engineering label was lifted kept its stale raster after the label settled, about 2 px off, until reload. Its own hover colour was enough to trigger it.
   The new long-session test found this; it predates M1.3A. The label now re-mounts its chip list once the lift has fully returned: one render, focus kept. Without the fix the session test fails with max 227 on 673 px.
4. **Compositing anchor.** Removing the old hotspot glow, which used `mix-blend-mode: screen`, changed how Chrome composites the station layer, and the chips' backdrop blur shifted by up to 5/255 against the baseline. An always-transparent screen-blend element keeps the approved path. `isolation: isolate` does not reproduce it.
5. **Mobile layout** is unchanged from M1.1 (see section 7).
6. **Hero overlap is verified at 16:9.** At other aspect ratios the hero (contain scale) and the scene (cover scale) scale differently. No overlaps occurred at 1280×1024, 2560×1080 or 1024×1366, but those sizes are reported, not enforced.
7. **Reduced motion** keeps the brightening and fades, but drops the energy and orbit animations, as in M1.2.

## 9. Recommendations for M1.3B

- Write the seven one-sentence project summaries, and add `href` as each detail page lands. The UI switches from "Coming soon" to a real link automatically.
- Give phones their own composition (a station list or carousel over the plate) instead of the cover-cropped desktop scene. The state and panels can be reused as they are.
- If the camera should approach outer stations more strongly, it needs more resolution at the edges (a 2× plate for the camera layer only), not a larger zoom of the current plate.
- Before extracting more stations, report the stale-chip-paint behaviour to Chromium, or move the chip blur into a pre-rendered image, so the workaround in item 3 can go.
- Consider keeping a selection in the URL (`?station=engineering&project=sqlorbit`) so states can be linked and survive reloads. The reducer already has the right shape.
