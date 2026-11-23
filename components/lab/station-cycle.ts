import type { ZoneId } from "@/data/zones";
import { PLATFORM_POWER } from "./platform-power";

/** One number of a station's sequence: its transition from the energy's arrival (`on` waits for --arrive-now) and on leaving. */
export interface CycleNumber {
  v: string;
  on: string;
  off: string;
}

/** Escape and Back leave a station with neither hover nor selection for an instant (ms). */
const RETURN_HOLD = 20;

/**
 * M1.4I.1D (/lab-v2: Educational, Creative Studio, Experience; Engineering has
 * the same in EngineeringV2, M1.4I.1B): a quick return starts a new cycle.
 *
 * A transition that is waiting for the energy holds whatever value it
 * interrupted, so a return while a station was still running back used to carry
 * the previous cycle's numbers through the new charge, and on from there. Each
 * number is therefore two:
 *   --x-on  (.<cls>-cycle, a wrapper without a box)  this cycle's progress: 0
 *           until the energy arrives, and back to 0 at once on leaving
 *   --x     (.<cls>-seq)  what is shown: follows --x-on; on leaving it runs back
 *           with its own timing, and a return doesn't touch that (--x-on is
 *           still 0), so the arrival always starts from standby
 * The strips' pulse waits for its own part's front too (--<key>q<part>-on): the
 * strips keep their level until then (POWER_CSS), the pulse must not stand on it.
 *
 * --<key>h: fully powered. Returning from a selection, the focus lands on the
 * station's title an instant after the selection is gone: it never lost power,
 * so this keeps it through that instant (only then, and only once the sequence
 * had finished) and nothing is replayed.
 */
export function cycleCss({ id, cls, key, numbers, doneMs, pulse }: { id: ZoneId; cls: string; key: string; numbers: readonly CycleNumber[]; doneMs: number; pulse: number }): string {
  const on = `:is([data-lab-hover="${id}"],[data-lab-selected="${id}"])`;
  const held = `--${key}h`;
  const parts = PLATFORM_POWER[id].parts;
  const part = (k: number) => `--${key}q${k}-on`;
  const cycle = [
    ...numbers.map((n) => ({ v: `${n.v}-on`, on: n.on })),
    ...parts.map((p, k) => ({ v: part(k), on: `0ms linear calc(var(--arrive-now) + ${p.on.delay}ms)` })),
    { v: held, on: `0ms linear calc(var(--arrive-now) + ${doneMs}ms)` },
  ];
  return (
    [...numbers, ...cycle].map(({ v }) => `@property ${v}{syntax:"<number>";inherits:true;initial-value:0}`).join("") +
    `.${cls}-cycle{${cycle.map((c) => `${c.v}:0`).join(";")};transition:none}` +
    `[data-lab-returning="${id}"] .${cls}-cycle{transition:${held} 0ms linear ${RETURN_HOLD}ms}` +
    `${on} .${cls}-cycle{${cycle.map((c) => `${c.v}:1`).join(";")};transition:${cycle.map((c) => `${c.v} ${c.on}`).join(",")}}` +
    `@media (prefers-reduced-motion: reduce){.${cls}-cycle{transition:none!important}}` +
    `.${cls}-seq{${numbers.map((n) => `${n.v}:max(var(${n.v}-on),var(${held}))`).join(";")};transition:${numbers.map((n) => `${n.v} ${n.off}`).join(",")}}` +
    // Follows at once; naming the properties (not `none`) lets a run-back in progress finish.
    `${on} .${cls}-seq{transition:${numbers.map((n) => `${n.v} 0s`).join(",")}}` +
    // The strips' pulse rides each power front (it never runs while draining).
    `.${cls}-pulse{opacity:0}` +
    parts.map((_, k) => `${on} .${cls}-pulse[data-part="${k}"]{opacity:calc(min(1, var(--pw) * 12) * min(1, (1 - var(--pw)) * 10) * ${pulse} * var(${part(k)}))}`).join("")
  );
}
