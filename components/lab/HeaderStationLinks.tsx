"use client";

import { useEffect } from "react";
import { locationFromSearch } from "@/lib/lab-url";
import { useLabState } from "./LabState";

/** Marks the header whose station links are handled in place (the desktop SiteHeader's wrapper in app/lab-v2/page.tsx). */
const HEADER_STATION_LINKS = "data-lab-header-stations";

/**
 * M1.4P (`/lab-v2` only): a plain click on a header link to a station of this page (`/lab-v2?station=…`, labV2Nav)
 * selects that station through the lab's own state, as a station title does. No second state and no router
 * navigation: LabState pushes the history entry (`?station=…`) and follows Back / Forward, so the panel, the URL and
 * history behave exactly as for an in-scene selection. Nothing is followed, so nothing scrolls.
 *
 * Capture phase on the document, as the mobile dock's anchor handling (MobileLab): it runs before next/link's own
 * click handler, which then sees the event handled and does nothing. Modified clicks (new tab or window), other
 * buttons and links elsewhere on the page are left alone. Only links inside [data-lab-header-stations] are handled.
 */
export function HeaderStationLinks() {
  const { selectStation } = useLabState();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || !link.closest(`[${HEADER_STATION_LINKS}]`)) return;
      if (link.target && link.target !== "_self") return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
      const { station, project } = locationFromSearch(url.search);
      if (!station) return;
      e.preventDefault();
      selectStation(station, project);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [selectStation]);

  return null;
}
