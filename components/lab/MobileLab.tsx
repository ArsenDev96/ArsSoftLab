"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Monogram } from "@/components/ui/Monogram";
import { ExperienceIcon, HomeIcon, ProjectsIcon, SendIcon, UserIcon } from "@/components/ui/icons";
import { NAV_ITEMS, SITE, type NavIconName } from "@/data/site";
import { getZone, type ZoneId } from "@/data/zones";
import { stationPanelId, useLabState } from "./LabState";
import { RenderModeSelector, type RenderMode } from "./RenderModeSelector";
import { StationIcon } from "./StationIcon";

/**
 * M1.4N.2 (prototype, `/lab-v2` only): the lab on portrait screens and narrow windows.
 * See docs/m1.4l/MOBILE-LAB-INVESTIGATION.md (causes) and MOBILE-DOCK-PROTOTYPE.md (this design).
 *
 * Two layers, both rendered on every viewport and switched on by CSS media queries (globals.css, "M1.4N.2"), so the
 * server renders the right one from the first byte and desktop pixels don't change:
 *
 *   compact header  below 1024 px wide, or in station mode: the brand, the Cinematic/Lite selector and a menu
 *                   holding the header's navigation. Replaces SiteHeader, whose sections are laid out for a frame
 *                   at least 1037 px wide.
 *   station mode    portrait and near-square screens (aspect ratio 5:4 or narrower), where only Educational is in
 *                   view: a dock of the five stations drives the lab's own state (toggleStation, as the in-scene
 *                   titles do); the selected station's existing panel opens as a sheet above it. The in-scene labels
 *                   are hidden, and the camera and the off-screen spotlight are held still.
 *
 * Keep STATION_MODE_QUERY and COMPACT_QUERY in step with globals.css.
 */
export const STATION_MODE_QUERY = "(max-aspect-ratio: 5/4)";

/** Dock order (left to right). */
const DOCK_ORDER: readonly ZoneId[] = ["engineering", "educational", "playground", "creative", "experience"];
/** A shorter visible label below 520 px, where the full title doesn't fit a fifth of the dock; the full title stays the accessible name. */
const SHORT_LABEL: Partial<Record<ZoneId, string>> = { creative: "Creative" };

/** The dock: the five stations, always in view in station mode. */
export function LabStationDock() {
  const { station, toggleStation, selectStation } = useLabState();
  const buttons = useRef<Partial<Record<ZoneId, HTMLButtonElement | null>>>({});

  // Back to the lab (Back to Lab, Escape, the dock button again, browser Back): in station mode the in-scene title
  // that LabState returns focus to is hidden, so focus goes to the station's dock button instead. This runs before
  // LabState's own effect (child first), which then finds focus placed and leaves it.
  const shown = useRef(station);
  useEffect(() => {
    const was = shown.current;
    shown.current = station;
    if (station || !was || !window.matchMedia(STATION_MODE_QUERY).matches) return;
    const active = document.activeElement;
    if (!active || active === document.body || active.closest("[data-station-panel]")) buttons.current[was]?.focus({ preventScroll: true });
  }, [station]);

  // The header's in-lab anchors point at in-scene elements, which station mode hides. There, "#lab-stations"
  // (Projects, the skip link) goes to the dock and "#station-experience" (Experience) opens that station. Outside
  // station mode the links behave as before.
  useEffect(() => {
    const mq = window.matchMedia(STATION_MODE_QUERY);
    const onClick = (e: MouseEvent) => {
      if (!mq.matches || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = (e.target as Element | null)?.closest?.("a[href]")?.getAttribute("href");
      if (href === "#lab-stations") {
        e.preventDefault();
        buttons.current[station ?? DOCK_ORDER[0]]?.focus();
      } else if (href === "#station-experience") {
        e.preventDefault();
        selectStation("experience");
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [station, selectStation]);

  return (
    <nav aria-label="Lab stations" data-lab-dock className="lab-dock">
      <ul className="lab-dock-list">
        {DOCK_ORDER.map((id) => {
          const zone = getZone(id);
          const on = station === id;
          const short = SHORT_LABEL[id];
          return (
            <li key={id} className="min-w-0">
              <button
                ref={(el) => {
                  buttons.current[id] = el;
                }}
                type="button"
                aria-expanded={on}
                aria-controls={stationPanelId(id)}
                data-dock-station={id}
                data-selected={on || undefined}
                onClick={() => toggleStation(id)}
                className="lab-dock-button"
              >
                <span aria-hidden="true" className="lab-dock-mark" />
                <span aria-hidden="true" className="lab-dock-icon" style={{ "--u": "0.5px" } as CSSProperties}>
                  <StationIcon name={zone.icon} accent={zone.accent} />
                </span>
                {short ? (
                  // The full title where it fits (520 px and wider); below that the short one is shown and the full
                  // title stays as the (visually hidden) accessible name. globals.css: .lab-dock-full / .lab-dock-short.
                  <span className="lab-dock-label">
                    <span className="lab-dock-full">{zone.title}</span>
                    <span aria-hidden="true" className="lab-dock-short">
                      {short}
                    </span>
                  </span>
                ) : (
                  <span className="lab-dock-label">{zone.title}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const NAV_ICONS: Record<NavIconName, typeof HomeIcon> = {
  home: HomeIcon,
  projects: ProjectsIcon,
  experience: ExperienceIcon,
  user: UserIcon,
};

/**
 * The lab's header on narrow and portrait screens. Same destinations as SiteHeader (its four entries and Let's Talk,
 * in a disclosure menu), the brand, and the Cinematic/Lite selector. Not the search: it is still a placeholder that
 * only takes focus (SearchTrigger), and a second one would compete for its Ctrl+K shortcut.
 */
export function LabCompactHeader({ mode, activeHref = "/" }: { mode: RenderMode; activeHref?: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // Close on a press outside the header.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <header
      ref={root}
      className="lab-compact-header"
      onKeyDown={(e) => {
        // Escape closes the menu first (and doesn't also leave a selected station: LabState skips handled keys).
        if (e.key === "Escape" && open) {
          e.preventDefault();
          setOpen(false);
          toggle.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Link href="/" className="lab-compact-brand" aria-label={`${SITE.owner} — ${SITE.brand} home`}>
        <Monogram className="h-8 w-[33px] shrink-0" />
        <span className="lab-compact-name">
          <span className="lab-compact-owner">{SITE.owner}</span>
          <span className="lab-compact-role">{SITE.role}</span>
        </span>
      </Link>

      <div className="flex items-center gap-1">
        <RenderModeSelector mode={mode} variant="compact" />
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
          className="lab-compact-menu-button"
        >
          <span className="sr-only">Menu</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="size-[22px]">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      <nav id={menuId} aria-label="Primary" hidden={!open} className="lab-compact-menu">
        <ul>
          {NAV_ITEMS.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const active = item.href === activeHref;
            return (
              <li key={item.label}>
                <Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className="lab-compact-menu-link">
                  <Icon className={active ? "size-5 text-[#f7bb67]" : "size-5"} />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <a href={SITE.contactHref} onClick={() => setOpen(false)} className="lab-compact-menu-link lab-compact-talk">
              <SendIcon className="size-5 text-[#fbcf86]" />
              Let&rsquo;s Talk
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
