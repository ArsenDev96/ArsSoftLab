# M1.4I.1E: Pointer transitions, before and after

Real mouse input in Chrome 157 (GPU, 1648 × 928, dev server). "Before" is checkpoint `6dd9505`. Both sides ran the same script and paths (`work/transitions.mjs`).

- **Drop:** the station loses its hover while the pointer is moving inside its region.
- **Restart:** a new spark leaves the A during one visit, counted at the source (`EnergySurge`).

## 1. Interruptions per station

| Station | Runs | Interrupted runs | Drops | Restarts |
|---|---|---|---|---|
| Engineering | 62 | 28 → **0** | 43 → **0** | 42 → **0** |
| Educational | 62 | 20 → **0** | 30 → **0** | 30 → **0** |
| Playground | 61 | 42 → **0** | 92 → **0** | 80 → **0** |
| Creative Studio | 50 | 29 → **0** | 52 → **0** | 52 → **0** |
| Experience | 50 | 33 → **0** | 49 → **0** | 49 → **0** |
| **All** | **285** | **152 → 0** | **266 → 0** | **253 → 0** |

Engineering and Educational have two chips, so they have more runs.

## 2. By transition (interrupted runs, before → after, of all runs)

| Transition | Engineering | Educational | Playground | Creative | Experience |
|---|---|---|---|---|---|
| Artwork → title | 5 → 0 of 8 | 3 → 0 of 8 | 6 → 0 of 10 | 3 → 0 of 8 | 6 → 0 of 8 |
| Title → artwork | 2 → 0 of 8 | 2 → 0 of 8 | 6 → 0 of 10 | 6 → 0 of 8 | 6 → 0 of 8 |
| Platform → chip | 8 → 0 of 16 | 3 → 0 of 16 | 7 → 0 of 12 | 6 → 0 of 10 | 5 → 0 of 10 |
| Chip → platform | 5 → 0 of 16 | 5 → 0 of 16 | 8 → 0 of 12 | 6 → 0 of 10 | 7 → 0 of 10 |
| Icon, title, chips | 3 → 0 of 6 | 4 → 0 of 6 | 7 → 0 of 8 | 4 → 0 of 6 | 6 → 0 of 6 |
| Repeated (11 legs in one go) | 3 → 0 of 4 | 3 → 0 of 4 | 4 → 0 of 5 | 4 → 0 of 4 | 3 → 0 of 4 |
| Pointer still for 5 s on the label | 2 → 0 of 4 | 0 → 0 of 4 | 4 → 0 of 4 | 0 → 0 of 4 | 0 → 0 of 4 |

Platform paths start or end at the middle and at both outer corners.

## 3. By speed (single moves, all stations)

| Time for the move | Interrupted, before | After |
|---|---|---|
| 150 ms (fast) | 2 of 25 | **0** |
| 400 ms | 26 of 97 | **0** |
| 1000 ms | 17 of 25 | **0** |
| 1500 ms | 62 of 72 | **0** |
| 2200 ms (slow) | 22 of 25 | **0** |

Slow moves failed most: the longer the pointer is in a gap, the more surely it outlasts the 90 ms grace.

## 4. Playground through its lift

| Start of the move | Interrupted, before | After |
|---|---|---|
| At rest, spark on its way | 7 of 11 | **0** |
| As the lift starts | 10 of 11 | **0** |
| Fully lifted | 21 of 35 | **0** |
| Pointer still on the label, from rest through the lift | 4 of 4 (10 restarts in 4 × 5 s) | **0** |

- **Intermediate positions:** the lift was paused at 11 moments (0 to 18 px). At each, every point of the region belonged to Playground, except 12 of 24,166 px, the same number at every height. Sampled at pixel centres (fully lifted), 3 remain, all on the region's right outline: rounding.
- **Still pointer, 18 points of the label column:** 16 start the station, none restarts it. The other two are in the gap between title and chip, which starts nothing, as before.
- **1C's own sign paths:** 45 of 45 without a restart (42 of 45 in 1C).

| Pointer rests here, clicks after the lift without moving | Opens |
|---|---|
| Chip: top, centre, lower edge | `?station=playground&project=aziz` |
| Title, right of the chip | `?station=playground` |
| Title, where the raised chip now is | `?station=playground&project=aziz` (the visible chip; see NOTES section 7) |

## 5. Random moves

16 slow straight moves per station between random points of hotspot and label: **0 of 80** interrupted. Not measured on the checkpoint.

## 6. Leaving and switching

| Check | Before | After |
|---|---|---|
| Out to the empty lab, from artwork, title, chip, platform and between (25) | 25 let go | **25 let go**, all stations back at rest |
| Time to let go, including input delivery: shortest, median, longest | 113, 162, 333 ms | 121, 178, 305 ms |
| Leave event to hover cleared, same page, without / with the bridges | 98–114 ms | 99–139 ms |
| To a neighbouring station, from label and platform, fast and slow (20) | 20 arrive | **20 arrive**, old station at rest |
| ...of which restarted the station being left | 3 | **0** |
| Standing in a bridge with nothing active | – | Nothing starts (5 of 5) |
| Standing 3.5 s in the bridge of an active station | – | Held, one spark (5 of 5) |
| Out of the bridge for 40 ms and back | – | Held (5 of 5) |

Runs used two Chrome processes at a time, before and after alike. Playground's "after" is its final run, which ran alone, after the rising-label rule was added (NOTES section 5). It was also 0 in the paired run before that rule (`transitions-after-a`).
