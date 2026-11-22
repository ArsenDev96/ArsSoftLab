# M1.3E.1: Visible power transfer and Playground lift

This milestone fixes two problems, both on Playground only:

- **Energy before hover.** Energy appeared to exist before hover. Now the lines are still at rest, and hovering Playground visibly charges its line from the central A.
- **No lift.** The station didn't rise. Now, on arrival, the whole station (platform, cabinet, controller and details) rises 10 px, and the arcade game runs on its screen.

This is a prototype for review. It is **not** visually approved.

## Evidence (this folder)

| File | What it shows |
| --- | --- |
| `playground-power-lift.webm` | Full scene at 1:1 (1648 × 928), 30 fps, 6.6 s: idle (0.7 s), then hover (charge, lift, gameplay; 4.6 s), then exit (1.3 s). |
| `idle.png` | The lab at rest. |
| `energy-halfway.png` | 300 ms: the line is lit from the A to the spark, about half way. |
| `playground-lifted.png` | 2 s: lifted, lights on, game running. |
| `return-to-idle.png` | 1.3 s after leaving. |
| `checks/charge-*.png` | The charge front at 150, 300, 450 and 600 ms (line crop, 3×). |
| `checks/idle-line.png` | The unpowered line at rest. |
| `checks/station-rest.png`, `checks/station-lifted.png` | The station before and after the lift (3×). |
| `checks/timeline.json`, `checks/exit.json` | Measured every 20 ms (hover) and 100 ms (exit). |
| `checks/reduced-motion.png` | The reduced-motion powered state. |
| `probes.txt` | Behaviour probes, live, on the production build: 17/17 OK. |

**How the frames were made.** Every animation, and the game clock, is paused and seeked for each frame, so the video plays in real time with exact timing.

**Command:** `npm run visual:playground -- --url http://localhost:3000 --out docs/m1.3e1`

## Timing (measured, from the hover)

| ms | What happens |
| --- | --- |
| 0 | A bright amber spark leaves the A, with the A's soft flash. |
| 0–600 | The line fills behind the spark: 6 % lit at 100 ms, 28 % at 200, 54 % at 300, 78 % at 400, all of it by 620. |
| ~600 | Arrival. The platform and neon flare once, and the platform lights come on. |
| 620–980 | The whole station rises 10 px: a slow start, a long settle, no bounce. The contact shadow deepens under it. |
| 650 → | The game switches on (a 200 ms wipe), then plays. |
| exit | After the 90 ms leave grace, the charge drains back toward the A (about 0.6 s), the station lowers (420 ms), and the game fades back into the original screen (340 ms). |

## What changed

**A. Idle connection state**

- **Ambient loop removed.** The ambient energy loop (`EnergyFlow`: a pulse on every line every 8 s) is gone, so no energy moves at rest. In the probe, two frames 1.5 s apart are identical; only Educational's globe orbit, which isn't a connection, still moves.
- **Unpowered Playground line.** The painted line was too bright to read as unpowered, so at rest it is shown dimmed: an overlay made from the plate itself (`playground-line-dim.png`).
  - **How it's made.** Each pixel near the line is moved toward the floor beside it, keeping 28 % of the line's own light. It is masked to where the line actually adds light, so the floor around it is untouched.
  - **Unchanged.** The reference image and the plate are not modified.
- **Charging.** On hover, the overlay is uncovered from the A outward, just behind the spark. The original painted line shows through, plus the spark's trail on top, so it reads as powered. It is not a whole-line brighten.
- **Exit.** Leaving drains the charge back toward the A.

**B. Playground as an independent layer**

`scripts/make-playground-layer.mjs` writes four layers into `public/scene/layers/playground*.png`: the station cut-out, the background behind it, the contact shadow, and the platform-strip light. It's a Node port of the M1.2.2 Engineering method; no Python is needed.

- **Silhouette.** A hand-traced outline of the platform, cabinet, controller, plant and the two purple glass panels, with a soft 1.2 px edge.
  - **Included:** a little of the neon's own glow, so it moves with the cabinet.
  - **Left on the floor:** the floor ring, the floor reflections and the connection line.
- **Background.** The scenery behind the station is rebuilt. The strip the lift uncovers is filled from the real floor at the contact line.
- **Matting.** The cut-out's colours are solved so that cut-out over background reproduces the plate exactly at rest (max 0.99/255).
- **At rest the original plate is shown.** The layer appears only from arrival, at zero lift, and hides again after the return, so the switch can't be seen. Back at rest, the lab matches idle within 1/255.

**C. Lift**

- **Movement:** 10 px up, 420 ms, `cubic-bezier(0.55, 0, 0.2, 1)`, no scale.
- **What lifts with it:** the label and chips (as with Engineering).
- **What stays put:** the contact shadow (opacity 0.8), the line and the floor reflections.

**D. Game screen**

The M1.3E game is unchanged. It now sits inside the lifting layer, so it moves with the cabinet. In the probes the screen's box moves by exactly the lift (393.98 → 383.98 px), and the close-ups at 820 ms (mid-lift) and 1.6 s show it registered in the bezel.

**E. Interruption**

| Case | Result |
| --- | --- |
| Leaving at 250 ms | No lift or game ever starts, and the charge drains. |
| Switching to Engineering mid-charge | Playground stays at rest. |
| Repeated quick hovers | End in a clean rest. |
| A new hover | Cancels the previous sequence's pending animations first. The one completion callback (dropping the finished drain) can only reset to rest, and never fires for a cancelled drain. |

**F. Accessibility and reduced motion**

- **Keyboard focus:** the same sequence.
- **Click:** Playground stays selected, lifted and powered.
- **Escape:** focus returns to the title, so it stays lifted with no second pulse. Blur returns to rest.
- **Deep link `?station=playground`:** loads selected and already lifted, with no lift animation.
- **Reduced motion:** the powered state at once (line lit, lights, a still game frame), with no spark and no lift.

## Reconstruction and other limitations

1. **The rebuilt background behind the station is a smooth fill, not a real scene.** A 10 px lift uncovers only:
   - a strip under the stone base, filled from the real floor and covered by the contact shadow;
   - slivers about 3 px wide along the cabinet's slanted left edge, against a dark wall.

   Neither shows a visible artifact at 1648 × 928. A lift beyond about 16 px would start to show the smooth fill. The `--preview` review sheets show it.
2. **Platform-strip light.** It is clipped to the station, so it lifts with it. Its reflections on the floor stay as painted and don't brighten on hover.
3. **Line glow on the platform.** The amber light the line casts on the platform's left corner belongs to the station, so it stays slightly lit at rest while the line itself is dimmed. It is subtle.
4. **Glass panels.** The purple glass panels carry the wall seen through them up by 10 px. It isn't noticeable at normal scale.
5. **Deep-link load.** The station layer appears once its images have decoded, as for Engineering. On a slow first load, a deep-linked Playground can show at rest for a moment before appearing lifted.
6. **Charge front.** The front runs about 6 px ahead of the spark's centre, inside the spark's glow.
7. **Other stations' lines.** Only Playground's line has the unpowered treatment. With the ambient loop gone, the other four lines are still and still painted bright. They need the same treatment when their stations are done.
