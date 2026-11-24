# M1.4I.1E: Station hover continuity

**Fixed on `/lab-v2`** (M1.4I defect P2-3): **253 restarts in 285 runs before, 0 after**, in all five stations and through Playground's lift. Verified in Chrome and Firefox on the dev server. Nothing committed or pushed. Numbers: `pointer-transitions.md`. Positions are scene px (1672 × 941).

| Question | Answer |
|---|---|
| 90 ms grace changed? | **No** |
| Engineering's label-only rise removed? | **Yes** (section 4) |
| Homepage changed? | **No**: markup, hit maps (at rest and with each station hovered) and pixels are identical |
| Lift, timing, artwork, sign hit area, animations changed? | **No** |
| Unavoidable gaps | Grazing paths only (section 7) |

## 1. Root causes

**A. Empty space between hotspot and label, all five stations.** They are separate elements. Between them, and between a label's icon, title and chips, nothing holds the hover; only the 90 ms grace covers it.

| Station | Where the gaps are |
|---|---|
| Engineering | Chips (bottom y 379) to laptop and hologram (top y 384–462). Widest under TableRefresh, down to the platform's right end: about 105 px |
| Educational | Chips (y 280) to the hotspot's top edge (y 288–308) |
| Playground | Cabinet's right side (x 1262) to title and chip (x 1287); chip (y 382) to controller (y 458) |
| Creative Studio | Easel (x 332–336) to icon (x 346) and title (x 406); chip (y 633) to platform (y 662–690) |
| Experience | Title (x 1376) to panel (x 1388); chip (y 626) to platform (y 640–690) |
| All | Icon to title 16–21 px (Playground has no icon); title to chips 9–10 px |

Of 60,000 straight hotspot-to-label paths per station, all cross a gap (Playground: 94 % at rest, 87 % lifted). The median of the widest gap on a path is 19–43 px.

**B. Labels that move away from a still pointer.** Playground's rises 18 px with its station; Engineering's rose 7.6 px on its own. The hover drops, the label comes back, the station restarts, and it repeats (Playground in 4 of 4 places tried, Engineering in 2 of 4).

M1.4I's quick check saw three stations. Slower moves and the chip paths show all five.

## 2. Files changed

| File | Change |
|---|---|
| `components/lab/station-bridges-v2.ts` | New: the five bridge outlines |
| `components/lab/LabStations.tsx` | Optional `bridges` and `stillLabels`; the CSS of the bridges and of the rising label |
| `components/lab/ProjectStation.tsx` | Optional `lifts` (default `true`) |
| `components/lab/LabScene.tsx` | `/lab-v2` passes both |
| `components/lab/scene-layout.ts` | `poly` is exported |

The homepage passes none of these.

## 3. Bridges
One transparent shape per station, along the pocket its own straight paths cross (`hit-regions.png`). **It holds a hover and never starts one.**

- **Only while its own station is active** (grace included). At rest the hit map is identical to before: 0 of 95,584 points changed. At most one bridge exists at a time.
- **Not a control:** no click, no pointer cursor, `aria-hidden`, not focusable.
- **Ownership:** any label, then any hotspot, then the bridge. A neighbouring station always wins.
- **Not for keyboard focus:** a mouse resting there must not take the station from the keyboard.
- **Size:** 0.6–1.0 % of the scene each, while active.

| | Bridge, px | Straight paths with a gap, before → after |
|---|---|---|
| Engineering | 16,387 | 100 → 0.06 % |
| Educational | 8,959 | 100 → 0.11 % |
| Playground, at rest | 15,347 | 94 → 0.06 % |
| Playground, lifted | 14,814 | 87 → 0.15 % |
| Creative Studio | 12,667 | 100 → 0.35 % |
| Experience | 9,843 | 100 → 1.66 % |

## 4. Engineering's label
The rise is the homepage's lift rule, where the platform rises too. On `/lab-v2` the platform stands still, so it was not intentional there.

With the bridge alone, the *station's* hover held. But a pointer on the lower edge of the chip or title ended up on bare bridge, so that control lost its hover and its click. No hit area can fix that, so the rise was removed. **At rest, typography, colour and placement are unchanged**; the label is now in the same place at rest and active. To restore the rise, remove `stillLabels` in `LabScene.tsx`.

## 5. Playground
- **Region:** its bridge includes the 18 px the label rises through, so it is continuous at every position (`playground-lift-hit-region.png`).
- **Title and chip:** the one under the pointer keeps the strip it rises out of (a pseudo-element of the same button, 20 px). Only while it is already hovered: coming from the platform, there is no target below the visible chip. So a still pointer on AZIZ still opens AZIZ after the lift.
- **Unchanged:** lift distance and timing, artwork, game, shadows, the 1C outline (45 of 45 of its own paths hold).

## 6. Verification
`npm run typecheck` passes. No console errors.

| Check | Result |
|---|---|
| Transitions, speeds, repeats, lift, still pointer, leaving, switching | `pointer-transitions.md` |
| Each station active: points of other stations or controls that changed | 0 |
| Bridge over the central A; connection route points inside a bridge | 0; 0 of 133 |
| Bridge outline over another station's hotspot, label or bridge | 0 |
| Focus order, accessible names | Identical (26 Tab presses, 96 and 100 nodes), both pages |
| Keyboard focus with the mouse resting in a bridge | Each of 12 stops lights its own station |
| Enter, Escape, focus return | Correct, 5 of 5 |
| Chips, reached by mouse from the platform | 7 of 7 open their own project, one spark each |
| Title and platform clicks | 10 of 10 select their station |
| Direct links | 5 of 5 powered at once, no spark; at rest after Escape |
| Reduced motion | One hover per visit, no spark, nothing lifts |
| `/lab-v2` idle pixels | At most 1 of 255, except one launch variant that the reference captures also have |
| `/lab-v2` markup | Besides the bridges, only Engineering's label lost its lift attributes |
| Firefox 144 (headless), 3 speeds and a still pointer per station | 20 of 20: one hover, one spark; at rest after |
| 1C sign: timing, paths, click | As in 1C; lift 18 px |
| 1B and 1D real-pointer probes | Creative Studio and Experience clean. Engineering and Educational not, **as on the checkpoint** (below) |

**1B and 1D, stated plainly.** On this machine those probes are not fully clean for two stations, with or without this change. Both sides, one session, three rounds each:

| Runs with a flag | Checkpoint | This change |
|---|---|---|
| Engineering (premature light) | 3 of 30 | 4 of 30 |
| Educational | 2 of 33 | 1 of 33 |

A first round with this change alone had 2 of 10 and 1 of 11. In the Engineering records, each of these is a value held for one frame. Those pointer paths never touch a bridge and no station code changed, so nothing was changed for it. 1B and 1D recorded 0; the difference is not explained here.

Also the same on both sides: 1C's "back after 40 ms" probe drops the hover here. Leaving Playground costs a frame of about 230 ms on this machine, with and without the bridges, which probably eats the grace.

## 7. Remaining gaps and overlap risks
- **Grazing paths:** 0.06–0.35 % of straight paths (Experience 1.66 %) skim outside an outline. Of these, 0.72 % in Experience cross Playground's own hotspot and 0.02 % in Creative Studio cross Engineering's. Those switch station, as they should.
- **Closest neighbours:** Creative Studio's bridge stays 3 px or more from Engineering's hotspot (bottom edge y 553); Experience's stays about 6 px from Playground's (y 556).
- **Playground's title over the raised chip:** left of x 1347, a still pointer on the title ends up over the raised chip. Both positions are the approved layout and lift; the visible chip wins.
- **Bridges start nothing:** resting between title and chip does not activate a station, as before.
- **Reduced motion:** Playground's bridge keeps the 18 px above its label although nothing rises.
- **Without CSS `:has`**, the bridges stay off and the old behaviour remains.
- **Not tested:** production build, Safari, touch. 1A's navigation code was not touched and its probe was not rerun.

Probes and data: `work/`. Images are local only.
