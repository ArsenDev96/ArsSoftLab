# M1.4I: Performance (`/lab-v2`)

**Setup:** Chrome 157 headless with the GPU (ANGLE, D3D11) on an AMD Radeon HD 5450; 1648 × 928; Next.js dev server on the same machine. Load times are for comparing `/` with `/lab-v2`, not absolute values. Frame data is from real-time runs, not from the stepped video.

Probes: `work/p4-perf.mjs`, `work/p13.mjs`. Data: `work/perf-*.json`, `work/p13.json`.

## Conclusion

- **No implementation defect makes the page stutter continuously.** One React commit per hover, no long tasks after load, no leak, and no running animation at idle.
- **A. Confirmed in the implementation:** (1) too many full-frame layers, so weight and GPU memory are high; (2) station images decode on the first hover.
- **B. Limited by this GPU:** frame rate during activations. The card cannot blend this many screen-sized pixels.

## B. The hardware limit, measured

| Control | Result |
|---|---|
| Blank page with one moving element | 60 fps (16.7 ms) |
| 12 blended full-screen layers, nothing else | **12 fps (83 ms per frame)** |
| Engineering activation, full size → a quarter of the pixels | 13 → 24–25 frames |
| Experience activation, full size → a quarter of the pixels | 16 / 39 → 52 / 60 frames (first / second) |
| Where the time goes (traces) | 0.4–1.5 s per activation inside the display driver's `Present` call |
| Main thread per activation | script 9–26 ms, layout 5 ms or less in total, first frame within 14 ms of the input |

With a quarter of the pixels, the same code draws roughly 1.5 to 3 times as many frames, so pixel fill is the bottleneck. **No animation duration or visual quality change is proposed on this evidence.**

## A. What the implementation adds

### Load

| | `/` (3 runs) | `/lab-v2` (3 runs) |
|---|---|---|
| Scene files | 75 (1.4 MB) | 83 (5.9 MB), of them 70 v2 files (5.85 MB) |
| First paint | 0.88–1.09 s | 1.10–1.35 s |
| Scene shown | 1.4–1.5 s | 1.2–2.2 s |
| Largest paint | 1.7–1.9 s | 3.0–3.5 s |
| Decoded images, `<img>` + CSS | 94 + 81 MB | 343.6 + 79 MB |
| GPU process | 349 MB | 676–844 MB |
| Renderer process | 203–335 MB | 315–337 MB |
| JavaScript heap | 12.1–12.4 MB | 12.4–15.2 MB |
| Long tasks | 53–155 ms | 52–156 ms, one of 351 ms |
| Layout shift | 0 | 0 |

Nearly all v2 layers are 1672 × 941 and mostly transparent. Cropping them losslessly would cut decoded memory without changing a pixel. The background PNG (2.3 MB) is the largest file. → P1-3

### First activation against later ones

| | Longest GPU task, first → later hover (traces) | Longest frame, first → later hover (4 fresh pages) |
|---|---|---|
| Playground | 298 → 21 ms or less | **303–402 → 193–218 ms** |
| Experience | 172 → 21 or less | 76–88 → 76–100 |
| Educational | 124 → 110 | 145–206 → 127–187 |
| Creative Studio | 117 → 21 or less | 82–106 → 79–91 |
| Engineering | 86 → 21 or less | 188–465 → 184–216 |

Image decodes: 16–58 per station on the first hover (117–361 ms on worker threads), about 0 on the second (Educational 24, Engineering 12).

Decoding on demand is an implementation choice (A); the milliseconds belong to this card (B). → P2-4

### Activation frames (three hovers in a row)

| Station | Frames drawn during its sequence |
|---|---|
| Engineering | 11 / 15 / 16 |
| Educational | 30 / 33 / 31 |
| Playground | 23 / 14 / 10 |
| Creative Studio | 27 / 31 / 31 |
| Experience | 29 / 33 / 20 |

### Growth over 240 station switches

| | After load | After 40 | After 240 |
|---|---|---|---|
| Heap | 9.79 MB | 10.49 | 10.86 (growth slowing) |
| Nodes / listeners / DOM elements | 3595 / 969 / 798 | 3575 / 974 / 798 | 3575 / 974 / 798 |
| Finished animations kept | 0 | 75 | 75 (bounded) |
| GPU process | 626 MB | 761 | 687 |
| React commits | 11 | 68 | 352 (about 1.4 per switch) |
| Layout shift | 0 | 0.0005 | 0.003 |

Pacing stayed the same: median 50 ms and 368–401 frames per round in all six rounds. **No leak and no slow-down.**

### Idle
No running animations and no `requestAnimationFrame` loop on `/lab-v2` at rest.

### Approved floor tone
Two fresh pages each, three rounds of five stations, alternating. The numbers are the frames per activation and the longest frame in later rounds:

| | Default | `?floor=approved` |
|---|---|---|
| Engineering | 46–47, 184–216 ms | 45–47, 191–198 ms |
| Educational | 73–83, 127–163 ms | 70–79, 140–187 ms |
| Playground | 46–67, 193–218 ms | 39–42, 207–212 ms |
| Creative Studio | 76–88, 81–84 ms | 73–80, 82–91 ms |
| Experience | 87–95, 76–100 ms | 90–93, 78–92 ms |

A small cost: nothing measurable on four stations, about 15% fewer frames on Playground (median 48 → 40); one extra mask file. Not a reason against the tone.

## Not measured
- A production build (excluded by the brief), a real network, current GPUs, Safari.
- Frame pacing above 1920 px wide.
