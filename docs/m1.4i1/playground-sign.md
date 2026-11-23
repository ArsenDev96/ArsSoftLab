# M1.4I.1C: Playground's "ArsSoftLab" sign

**Fixed on `/lab-v2`** (M1.4I defect P1-4). Verified on the dev server in Chrome, with a short check in Firefox. Nothing committed or pushed. M1.4I.1A, M1.4I.1B and the email link are in place.

| | Before | After |
|---|---|---|
| Sign panel that responds, at rest | 0 of 1,311 px | **1,311 of 1,311** |
| Sign panel that responds, raised | 0 of 1,339 px | **1,339 of 1,339** |
| Pointer paths across sign, body, platform and label without a restart | 2 of 45 | **42 of 45** |

The three remaining paths are an existing label issue (section 6). Positions are scene px (1672 × 941).

## 1. Root cause
**The hotspot's outline stops below the sign.** Nothing intercepts the pointer.

- Playground's target is one polygon (`scene-layout.ts`), shared with the homepage and drawn round the homepage's cabinet. Its top edge is y 352.
- The v2 cabinet is taller: its top is y 320.5 and the sign is y 331–350.
- The artwork can't respond itself: every station image is `pointer-events: none`, by design.
- At the sign, `elementsFromPoint` returns only the full-frame layers and the background. The first station target below is at y 352–353.
- **The lift adds a second gap.** Raised, the sign is drawn at y 311–331, but the hotspot doesn't move. Pointing at the sign of an already active cabinet therefore dropped the hover, at any speed. Raising the polygon's top edge alone would have left that.

The homepage's cabinet is lower and has no "ArsSoftLab" sign, so it is not affected.

## 2. Files changed

| File | Change |
|---|---|
| `components/lab/playground-sign-v2.ts` | New: the v2 outline, at rest and raised |
| `components/lab/LabStations.tsx` | Optional `hotspots` prop: a station's own outline, following its lift |
| `components/lab/scene-layout.ts` | `HotspotShape` type; `hotspotClip` takes an optional box |
| `components/lab/LabScene.tsx` | `/lab-v2` passes the Playground outline |

No artwork, animation, connection, label, shared polygon or other station changed.

## 3. How the sign joins the existing target
The same element (`[data-hotspot="playground"]`) with the same handlers; only its outline grows. There is no second control, so moving between body, sign and platform never leaves it.

- **Shape:** the cabinet's head, which carries the sign, traced within 5 px of the artwork. The rest is the shared polygon, unchanged.
- **Follows the lift:** the head's points rise with the station (18 px, ×1.01), on the lift's own curve, duration and arrival delay. While the station is down, the wall above the sign is not a target.
- **Towards the label:** a sliver of wall beside the head, 8–21 px wide and 18 px tall, reaches the label's left edge. Without it, a slow move from the sign to the label would leave the target.
- **Reduced motion:** nothing rises, so the outline stays at rest.

Diagram: `playground-sign-region.png` (green: target; blue: label and chip; local only, images are not in Git).

## 4. Intentional changes to pointer behaviour
- Hovering or clicking the sign, or the rest of the cabinet's head, acts as Playground.
- Pointing at the raised sign keeps Playground active.
- The region above y 352 is 3,797 px at rest, of which 475 are off the artwork (196 of those in the sliver).
- Raised: 6,679 px, 724 off the artwork (307 in the sliver). Up to 13 px of that lies beside the raised cabinet's recess, where the sign rests.

## 5. Verification
`npm run typecheck` passes. No console errors.

| Check | Result |
|---|---|
| Hover on the sign | Spark at once; strips and lift start 674–683 ms after hover, lift complete 1090–1099 ms, 18 px |
| Hover on the body, same run | 666–681 ms; 1082–1098 ms; 18 px |
| Other stations' sparks meanwhile | None |
| Click on the sign | Same as the body: `?station=playground`, panel opens, focus on its title |
| Second click, zoomed in | Stays selected |
| Click while the spark travels | Selected and powered |
| Cabinet → sign → platform, sign → body → sign, body ↔ raised sign (120–1500 ms) | No restart |
| Raised sign → title, sign → chip, title → raised sign | No restart |
| Resting on the raised sign's edge for 2.5 s | Stable, 18 px |
| Pointer on the wall above the resting sign | No activation |
| Leaving | At rest |
| Back after 40 ms | No restart (inside the 90 ms grace) |
| Back after 120–700 ms | One new activation, fully powered |
| Arcade game | Runs and keeps drawing with the pointer on sign, screen and body |
| Keyboard | 21 stops in the same order; focus powers, Enter selects, Escape returns focus to the title |
| Hotspots | Still `aria-hidden`, not focusable, no role |
| Title and chip | Still their own targets; the chip opens its project |
| Other four stations | Power and return; their share of the hit map is unchanged |
| Reduced motion | Sign activates and selects, no lift |
| Homepage | Hit map and markup identical |
| Firefox 151 | Sign, raised sign and lift correct; no errors |
| M1.4I.1A, M1.4I.1B | 4 of 4 entries shown; 10 of 10 quick returns clean |

Whole-scene hit map, every 4 px: 248 points became Playground. One point on the polygon's existing edge became free (rounding).

**Pixels**, with and without the new outline, four captures each: idle, charging, lifted and leaving differ by at most 2 of 255, the homepage by 0.

**Arcade input:** the cabinet's game plays by itself. The code has no pointer or key input and its canvas is `pointer-events: none`, so there was nothing to block or to play by hand.

## 6. Remaining issues
- **Label moves away while the station rises (existing, not touched).** If the pointer enters the label and stays there as the lift starts, the label rises from under it and the hover can drop once. It is seen in 3 of 45 paths (charging: sign → title at 800 ms, sign → chip at 800 and 1500 ms). It also happens with no sign involved: resting on the lower half of the chip alone restarts Playground repeatedly. Same family as M1.4I P2-3.
- **The cabinet's right side below the head** (x 1262–1280, y 352–452) is still outside the shared polygon.
- Not tested: production build, Safari, touch.

Probes and data: `docs/m1.4i1/work/sign-*`.
