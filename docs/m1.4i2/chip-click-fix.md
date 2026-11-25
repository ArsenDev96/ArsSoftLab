# M1.4I.2.1: Playground's AZIZ chip, click stability

**Fixed.** A still pointer anywhere on the visible chip now opens AZIZ before, during and after the lift: **67 of 228 tested clicks or key presses failed before, 0 of 227 after**, and every pixel of the chip's outline works at three window sizes. The lift, its timing, the artwork and the homepage are unchanged. Not committed.

This supersedes the "not applied" notes in `NOTES.md` (section 6) and `final-verification.md` (section 3), which were left as they are.

Dev server, Chrome 158 with the GPU, RTX 4060, 60 Hz. Positions are scene px (1672 × 941).

## 1. Root cause

**Click target geometry, carried by the label's transform.**

M1.4I.1E gave the hovered chip an invisible strip below its box (`button:hover::after`, 20 px), so that the chip can rise 18 px and keep its click. Two parts of the chip's way were not covered:

1. **The round ends.** The chip is a pill (59 × 26, radius 13) and the browser's hit area follows the curve. The strip began below the *box*. Beside each curve, between pill and strip, was a notch that belonged to neither. The rise carries it across a pointer on the outer 5–7 px; the chip loses its hover there, and the strip goes with it.
2. **The left edge.** The station also grows 1 % about x 1218, which moves the chip 0.7 px to the right, off a pointer on its leftmost pixel.

| Suspected | Finding |
|---|---|
| Moving hit area | Yes, as above |
| Label's transform | It is what moves the notch. Not wrong in itself |
| Click target geometry | **Yes, the cause** |
| Pointer ownership | No. The station keeps its hover: one spark per visit in every failed run |
| Bridge boundary | No. The bridge takes the pointer only after the chip has lost it, and so receives the lost click |

## 2. Correction

One file, CSS only: `components/lab/LabStations.tsx` (`risingLabelCss`). One rule added for chips, on the same pseudo-element of the same button:

```css
.lab-chip:hover::after { left: -1u; top: 50%; height: calc(50% + 20u); border-radius: 0 0 13u 13u }   /* u = 1 scene px */
```

- **It is the pill's own shape along its way**, so it holds at every height, not only at the top.
- **Not a second control:** same button, nothing painted, no new element, handler or focus stop. Only while the chip is already hovered, as before. Reduced motion: not there, as before.
- **Not larger:** with the chip hovered, its region grows by 16 px² while charging and 2 px² when raised. The strip's old square corners went, the notches were filled.
- The title's strip keeps its rule.

## 3. Was the one-line candidate sufficient?

**Almost. No.** `top:50%;height:calc(50% + 20u)` fixed the round ends (0 of 228 failed at 1648 × 928), but not the left edge: at 1920 × 1080 the leftmost pixel (1477, 423) was still lost. It would also have kept square bottom corners outside the chip's path. The two further declarations, `left` and `border-radius`, cover these.

## 4. Before and after

| Still pointer at | Before | Candidate | **After** |
|---|---|---|---|
| Before the lift (click at 300 ms, 13 points) | 0 of 13 | 0 of 13 | **0 of 13** |
| During the lift, 5 moments × 13 points | 20 of 65 | 0 of 65 | **0 of 65** |
| During the lift, followed to the address (10 points) | 2 of 10 | 0 of 10 | **0 of 10** |
| Fully lifted, 45 points | 17 of 45 | 0 of 45 | **0 of 45** |
| Returning to rest: onto the sinking chip, 7 places × 5 moments | 12 of 34 | 0 of 34 | **0 of 33** |
| Rapid re-entry, charging and raised, after 20–300 ms | 16 of 49 | 0 of 49 | **0 of 49** |
| Keyboard: Tab, then Enter or Space; before, during, lifted; mouse away or resting on the chip's end | 0 of 12 | 0 of 12 | **0 of 12** |
| **All** | **67 of 228** | 0 of 228 | **0 of 227** |

A failure is a click that does not reach AZIZ, a chip no longer under the pointer after the lift, or a second spark. Clicks on real addresses ended at `?station=playground&project=aziz`. During the five moments, on the way back and on re-entry the click's target was recorded and stopped instead, so that the station stayed up. One or two "returning" runs per side are left out: the chip had moved from under the pointer before it arrived.

The points follow the pill's outline, 0.5 and 3 px inside it: top, bottom, both round ends, and the centre. All failures before were on the ends.

**Every outline pixel (whole pixels, as a mouse reports them), still from rest through the lift:**

| Window | Outline pixels | Lost before | Candidate | **After** |
|---|---|---|---|---|
| 1920 × 1080 | 162 | 51 | 1 | **0** |
| 1648 × 928 | 140 | not run | not run | **0** |
| 1366 × 768 | 118 | not run | not run | **0** |

**Low frame rate** (slowed to 27 frames per second): 20 of 20 points keep the chip. At 26 before: 8 of the 15 on the ends.

## 5. What did not change

| Check | Result |
|---|---|
| Playground's sign: area, timing, click, paths, return | As in 1C: 1,311 of 1,311 and 1,339 of 1,339 px; 45 of 45 paths; lift 18 px, complete 1081–1083 ms after the hover |
| Station-to-label moves, Playground | 61 of 61 without interruption; leaving 5 of 5; switching 4 of 4 |
| Bridges: hold, start nothing, five stations | 5 of 5; 0 points of other stations changed |
| Region through the lift; still pointer | 12 of 24,166 px, as before; 16 starts, 0 restarts |
| Hit map, whole scene and around the label: at rest, pointer on title, pointer on cabinet | **0 points changed** |
| ...pointer on the chip | Only chip against Playground's own bridge, label and (4 px²) hotspot. No other station |
| Below the raised chip, coming from the platform | Still nothing to click there |
| Titles, platforms and chips of all five stations | 17 of 17 open their own place |
| Keyboard order, Enter, Escape, focus return; reduced motion | As before, five of five |
| Label's pixels (title and chip, raised, hovered) | 0 changed |
| **Homepage** | Server markup of the station layer identical; the rule is not sent; hit maps identical at rest and hovered |
| `npm run typecheck`; console errors | Passes; 0 |

The raised captures differ in Playground's cabinet, left of and below the label (at most 63 levels): Chrome's known resampling variant (`final-verification.md`, section 4).

## 6. Remaining edge cases
- **Playground's title, leftmost pixel column** (1 px, 20 of the 48 outline pixels this probe samples, plus one at its lower right corner): a still click after the lift is lost, for the same left-edge reason. It is the title's 1E strip, unchanged and outside this task. The same `left` offset should cover the column; not tested.
- **Title over the raised chip:** left of x 1347 a still pointer on the title ends up over the raised chip and opens AZIZ, as approved in 1E.
- **Between title and chip** nothing starts, as before.
- `CHIP_RADIUS` is half the chip's height in `ProjectStation.tsx` (26): change both together.
- Not tested: production build, Firefox, Safari, touch.

Data and probes: `work/chip/`. Run the probes from a folder that contains `out/` and `cap/`.
