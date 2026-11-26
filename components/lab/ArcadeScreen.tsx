"use client";

import { useEffect, useRef } from "react";
import type { ZoneId } from "@/data/zones";
import { u, type SceneRect } from "@/lib/scene";
import { BOOT_S, drawGame, GAME_H, GAME_W, STILL_G } from "./arcade-game";
import { useLabState } from "./LabState";
import { SURGE_ARRIVE_MS, type ScreenQuad } from "./scene-fx";

/**
 * M1.3E: the Playground cabinet's screen comes alive as a miniature game.
 *
 * Compositing: a GAME_W x GAME_H canvas is warped onto the cabinet's screen
 * by a projective matrix3d (the screen is a true perspective quad: its side
 * edges are not parallel), mapped slightly past the measured display edges
 * and clipped to them exactly, so the plate's own bezel frames it. At rest
 * the wrapper is transparent and nothing is drawn or scheduled.
 *
 * Timing, without callbacks between the parts:
 *   - Visibility is CSS (ACTIVATION_CSS): the wrapper fades in at the energy's
 *     arrival (`--arrive-now`) and fades out at once on leave.
 *   - Content is a pure function of game time, read from a Web Animation
 *     started on hover, so it shares the scene's clock: the screen switches
 *     on exactly at arrival (a 200 ms wipe from the top), and a paused /
 *     seeked timeline (evidence capture) shows the exact frame.
 *   - One rAF loop, only while the screen is visible: started on hover, ended
 *     once the fade-out completes (or at once when left before arrival), and
 *     suspended while the page is hidden. A quick return during the fade
 *     keeps the same loop and game: no restart, no duplicate.
 *   - Reduced motion: one static frame, no loop.
 */

type Pt = readonly [number, number];

/** Canvas box (GAME_W x GAME_H CSS px) -> quad, as a CSS matrix3d (Heckbert's square-to-quad). */
function homography([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: readonly Pt[]) {
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  const [W, H] = [GAME_W, GAME_H];
  const m = [(x1 - x0 + g * x1) / W, (y1 - y0 + g * y1) / W, 0, g / W, (x3 - x0 + h * x3) / H, (y3 - y0 + h * y3) / H, 0, h / H, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toPrecision(7)).join(", ")})`;
}

/**
 * The quad is the display's half-maximum edge; the plate's own 1–2 px of
 * half-lit transition into the bezel lies outside it (and is brightened by
 * the cabinet's activation glow), so the clip grows past it by GROW, and the
 * game falls off into the bezel at its edges like the original display. The
 * canvas maps BLEED further still, so its own edge never shows.
 */
const GROW = 1.4;

/** The game switches on this long after the energy arrives (ms; M1.3E.1). */
export const GAME_DELAY_MS = 50;
const BLEED = 0.8;

/** Offset every edge of a convex quad outward by `d` (reference px). */
function grow(quad: readonly Pt[], d: number): Pt[] {
  const n = quad.length;
  const cx = quad.reduce((a, p) => a + p[0], 0) / n;
  const cy = quad.reduce((a, p) => a + p[1], 0) / n;
  // Each edge as a point and direction, shifted along its outward normal.
  const lines = quad.map((p, i) => {
    const q = quad[(i + 1) % n];
    const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
    const len = Math.hypot(dx, dy);
    let [nx, ny] = [dy / len, -dx / len];
    if (nx * (p[0] - cx) + ny * (p[1] - cy) < 0) [nx, ny] = [-nx, -ny];
    return { x: p[0] + nx * d, y: p[1] + ny * d, dx, dy };
  });
  // Corner i is where edge i-1 meets edge i.
  return lines.map((b, i) => {
    const a = lines[(i + n - 1) % n];
    const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / (a.dx * b.dy - a.dy * b.dx);
    return [a.x + a.dx * t, a.y + a.dy * t] as const;
  });
}

/** M1.4K.4 `still` (/lab-v2?render=lite): the reduced-motion screen, one static frame and no loop, whatever the preference. */
export function ArcadeScreen({ id, quad, box, still = false }: { id: ZoneId; quad: ScreenQuad; box: SceneRect; still?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { onHoverChange, station } = useLabState();
  const initialStation = useRef(station);

  const shown = grow(quad, GROW);
  const xs = shown.map((p) => p[0]);
  const ys = shown.map((p) => p[1]);
  const rect = { x: Math.floor(Math.min(...xs)) - 1, y: Math.floor(Math.min(...ys)) - 1, w: 0, h: 0 };
  rect.w = Math.ceil(Math.max(...xs)) + 1 - rect.x;
  rect.h = Math.ceil(Math.max(...ys)) + 1 - rect.y;
  const pct = (v: number, of: number) => `${+((v / of) * 100).toFixed(3)}%`;
  const clip = `polygon(${shown.map(([x, y]) => `${pct(x - rect.x, rect.w)} ${pct(y - rect.y, rect.h)}`).join(", ")})`;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;
    const arrive = SURGE_ARRIVE_MS[id] ?? 0;
    const reducedQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bled = grow(quad, GROW + BLEED).map(([x, y]) => [x - rect.x, y - rect.y] as const);
    const quadWidth = (Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]) + Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1])) / 2;

    let clock: Animation | null = null;
    let bootAt = 0; // clock time (ms) at which the screen switches on
    let raf = 0;
    let active = false;
    let scale = 0;
    let drawn = NaN;
    let frames = 0;
    let state = "";
    const setState = (s: string) => {
      if (s !== state) wrap.dataset.state = state = s;
    };

    // Warp: the wrapper's layout size gives the current reference-px scale.
    const place = () => {
      const unit = wrap.offsetWidth / rect.w;
      if (unit > 0) canvas.style.transform = homography(bled.map(([x, y]) => [x * unit, y * unit] as const));
    };
    // Backing store about 1.3x the screen's device pixels (camera zoom
    // included), so the warp never minifies hard (no shimmer on thin lines).
    const fit = () => {
      const px = (wrap.getBoundingClientRect().width / rect.w) * quadWidth * (window.devicePixelRatio || 1);
      const k = Math.min(4, Math.max(0.6, Math.round(((px * 1.3) / GAME_W) * 10) / 10));
      if (scale && Math.abs(k - scale) / scale < 0.15) return;
      scale = k;
      canvas.width = Math.round(GAME_W * k);
      canvas.height = Math.round(GAME_H * k);
      drawn = NaN;
    };
    const paint = (g: number) => {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawGame(ctx, g);
      drawn = g;
    };
    const clear = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawn = NaN;
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      clock?.cancel();
      clock = null;
      clear();
      setState("off");
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!clock) return stop();
      // Left: run until the fade-out has finished, then stop.
      if (!active && +getComputedStyle(wrap).opacity === 0) return stop();
      if (++frames % 30 === 0) fit();
      const g = (Number(clock.currentTime) - bootAt) / 1000;
      if (g < 0) {
        if (!Number.isNaN(drawn)) clear();
        return setState("charging");
      }
      setState(g < BOOT_S ? "booting" : "running");
      if (g !== drawn) paint(g);
    };

    let last: [ZoneId | null, ZoneId | null] = [null, null];
    const update = (hovered: ZoneId | null, selected: ZoneId | null) => {
      last = [hovered, selected];
      active = hovered === id || selected === id;
      if (!active) {
        // Left before the energy arrived: it never switches on.
        if (clock && Number(clock.currentTime) < bootAt) stop();
        return;
      }
      if (still || reducedQ.matches) {
        if (clock) stop();
        fit();
        paint(STILL_G);
        setState("still");
        return;
      }
      // Already powered or charging (a quick return during the fade, or a
      // click while the energy travels): keep the same game and switch-on
      // time. The wrapper's CSS transition, already waiting for arrival,
      // keeps its delay too, so both stay in step.
      if (!clock) {
        fit();
        clock = canvas.animate(null, { duration: 1e9 });
        // Hover waits for the energy; a selection alone is immediate (as in CSS).
        bootAt = hovered === id && selected !== id ? arrive + GAME_DELAY_MS : 0;
        setState("charging");
      }
      if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (clock && !raf) raf = requestAnimationFrame(tick);
    };
    const onReduced = () => {
      if (!active) return;
      if (clock) stop();
      update(...last);
    };

    place();
    const ro = new ResizeObserver(place);
    ro.observe(wrap);
    document.addEventListener("visibilitychange", onVisibility);
    reducedQ.addEventListener("change", onReduced);
    const unsubscribe = onHoverChange(update);
    // Listeners are told about changes only: a deep link may already have
    // selected this station.
    update(null, initialStation.current);
    return () => {
      unsubscribe();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQ.removeEventListener("change", onReduced);
      stop();
    };
    // The quad is static configuration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, onHoverChange, still]);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      data-arcade={id}
      className="lab-arcade absolute overflow-hidden"
      style={{ left: u(rect.x - box.x), top: u(rect.y - box.y), width: u(rect.w), height: u(rect.h), clipPath: clip }}
    >
      <canvas
        ref={canvasRef}
        width={GAME_W}
        height={GAME_H}
        className="absolute top-0 left-0"
        style={{ width: `${GAME_W}px`, height: `${GAME_H}px`, transformOrigin: "0 0" }}
      />
    </div>
  );
}
