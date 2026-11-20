"use client";

import { useEffect, useRef } from "react";
import { u } from "@/lib/scene";
import { SearchIcon } from "./icons";

/**
 * Search entry point with its Ctrl/⌘+K shortcut. The command palette itself
 * is out of scope for M1.1, so the shortcut moves focus to this control,
 * which is where the palette will open from.
 */
export function SearchTrigger() {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      aria-label="Search the lab"
      aria-keyshortcuts="Control+K Meta+K"
      className="lab-transition flex items-center rounded-full text-lab-text hover:bg-white/5"
      style={{
        marginTop: u(1),
        width: u(109),
        height: u(39),
        paddingLeft: u(16),
        gap: u(7),
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.26)",
        background: "rgb(16 16 18 / 0.55)",
      }}
    >
      <SearchIcon style={{ width: u(22), height: u(22) }} />
      <kbd
        className="flex items-center justify-center font-sans leading-none text-lab-subtle"
        style={{
          height: u(24),
          paddingInline: u(9),
          fontSize: u(14.5),
          borderRadius: u(7),
          background: "rgb(40 40 44 / 0.85)",
        }}
      >
        Ctrl K
      </kbd>
    </button>
  );
}
