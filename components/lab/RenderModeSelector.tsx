"use client";

import { useRouter } from "next/navigation";
import { useId, useOptimistic, useTransition } from "react";
import { u } from "@/lib/scene";

/**
 * M1.4K.5B (/lab-v2 only): the rendering mode, Cinematic (the default, full) or Lite (lite mode, M1.4K.5A).
 *
 * The mode lives in the URL only: `?render=lite`, and no parameter for Cinematic, so shared links stay as they were.
 * Choosing pushes a history entry with every other parameter kept (station, project, floor, …) and lets the router
 * re-render the page for it: a soft navigation, no reload, the lab's selection and hover untouched (a search-only
 * navigation keeps the client state). Back and Forward land on the mode of that entry, because the page reads it from
 * the URL; the control shows the page's mode (`mode`), optimistically the chosen one until the navigation commits.
 *
 * Native radio buttons, so the group is one Tab stop and the arrow keys choose; the focus ring is drawn on the visible
 * option. Each option's description is its tooltip (`title`, for the mouse) and its accessible description
 * (`aria-describedby`, a `hidden` element: read by assistive technology, no layout). No new animation: colours only,
 * through .lab-transition (off with reduced motion).
 */

export type RenderMode = "full" | "lite";
const RENDER_PARAM = "render";

const OPTIONS: readonly { mode: RenderMode; label: string; hint: string }[] = [
  { mode: "full", label: "Cinematic", hint: "Full lighting and motion" },
  { mode: "lite", label: "Lite", hint: "Lighter rendering for slower computers: stations light up at once, nothing moves" },
];

/** `search` with the mode set: Lite as `render=lite`, Cinematic without the parameter; every other parameter kept. */
function renderSearch(mode: RenderMode, search: string): string {
  const q = new URLSearchParams(search);
  if (mode === "lite") q.set(RENDER_PARAM, "lite");
  else q.delete(RENDER_PARAM);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function RenderModeSelector({ mode }: { mode: RenderMode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(mode);
  const id = useId();

  const choose = (next: RenderMode) => {
    if (next === shown) return;
    startTransition(() => {
      setShown(next);
      // The address bar is the truth (the lab writes station and project to it itself).
      const { pathname, search, hash } = window.location;
      router.push(pathname + renderSearch(next, search) + hash, { scroll: false });
    });
  };

  return (
    <fieldset
      data-render-selector={shown}
      aria-busy={pending || undefined}
      className="flex items-center rounded-full"
      style={{
        marginTop: u(4),
        marginRight: u(28),
        height: u(32),
        padding: u(3),
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.18)",
        background: "rgb(16 16 18 / 0.55)",
      }}
    >
      <legend className="sr-only">Rendering mode</legend>
      {OPTIONS.map((o) => {
        const on = o.mode === shown;
        return (
          <label
            key={o.mode}
            title={o.hint}
            className={[
              "lab-transition flex h-full cursor-pointer items-center rounded-full leading-none select-none",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber-glow has-[:focus-visible]:outline-solid",
              on ? "text-lab-text" : "text-[#bdbdc0] hover:text-lab-text",
            ].join(" ")}
            style={{
              paddingInline: u(12),
              fontSize: u(13.5),
              ...(on ? { background: "rgb(255 255 255 / 0.1)", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)" } : null),
            }}
          >
            <input type="radio" name="lab-render-mode" value={o.mode} checked={on} onChange={() => choose(o.mode)} aria-describedby={`${id}-${o.mode}`} className="sr-only" />
            {o.label}
          </label>
        );
      })}
      {OPTIONS.map((o) => (
        <span key={o.mode} id={`${id}-${o.mode}`} hidden>
          {o.hint}
        </span>
      ))}
    </fieldset>
  );
}
