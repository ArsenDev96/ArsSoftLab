// Probes for the M1.3A five-station interaction system.

/** Expected hero content per station (from the M1.3A brief). */
export const STATIONS = {
  educational: { title: "Educational", summary: "Interactive learning experiences and tools.", projects: ["AriMap", "Armat"] },
  engineering: { title: "Engineering", summary: "Developer tools and production engineering.", projects: ["SQLOrbit", "TableRefresh"] },
  playground: { title: "Playground", summary: "Games, challenges, and playful experiments.", projects: ["AZIZ"] },
  creative: { title: "Creative Studio", summary: "Visual ideas and creative products.", projects: ["Wallpapers"] },
  experience: { title: "Experience", summary: "Building and maintaining real-world software.", projects: ["Koreez"] },
};
export const STATION_IDS = Object.keys(STATIONS);

export const trigger = (id) => `#station-${id}-trigger`;
export const panel = (id) => `[data-station-panel="${id}"]`;

/** Interaction state as seen from the DOM. */
export const labState = (page) =>
  page.eval(`(() => {
    const wrap = document.querySelector("[data-lab-selected], [data-lab-hover], [data-lab-returning]");
    const css = (sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : null; };
    const open = [...document.querySelectorAll("[data-station-panel][data-open]")];
    const p = open[0];
    const vis = (e) => e && getComputedStyle(e).visibility + "/" + getComputedStyle(e).opacity;
    return {
      selected: wrap?.dataset.labSelected ?? null,
      hover: wrap?.dataset.labHover ?? null,
      project: wrap?.dataset.labProject ?? null,
      returning: wrap?.dataset.labReturning ?? null,
      openPanels: open.length,
      expanded: [...document.querySelectorAll("[id$=-trigger][aria-expanded=true]")].map((e) => e.id),
      active: document.activeElement?.id || document.activeElement?.getAttribute("data-open-project") || document.activeElement?.textContent?.trim().slice(0, 40) || null,
      camera: css(".lab-camera", "transform"),
      header: css("header", "transform"),
      heading: vis(document.querySelector(".lab-hero-heading")),
      info: vis(p),
      title: p?.querySelector("h2")?.textContent ?? null,
      summary: p?.querySelector("h2 + p")?.textContent ?? null,
      projects: p ? [...p.querySelectorAll(".lab-hero-project")].map((b) => b.textContent) : [],
      pressed: p ? [...p.querySelectorAll(".lab-hero-project[aria-pressed=true]")].map((b) => b.textContent) : [],
      detail: p?.querySelector("[data-project-detail]")?.textContent ?? null,
      openProject: (() => { const b = p?.querySelector("[data-open-project]"); return b ? { disabled: b.getAttribute("aria-disabled"), desc: document.getElementById(b.getAttribute("aria-describedby"))?.textContent } : null; })(),
      runningAnimations: document.getAnimations().filter((a) => !(a instanceof CSSTransition) && a.playState === "running").length,
      fx: [...document.querySelectorAll(".lab-fx")].map((e) => getComputedStyle(e).display).join(","),
    };
  })()`);

/** Opacity of each station's lights and label (for hover / selection effects). */
export const lightState = (page) =>
  page.eval(`(() => {
    const o = (sel) => { const e = document.querySelector(sel); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
    const ids = ${JSON.stringify(STATION_IDS)};
    return Object.fromEntries(ids.map((id) => [id, {
      platform: o('[data-platform-light="' + id + '"]'),
      connection: o('[data-connection-light="' + id + '"]'),
      pulse: o('.lab-energy [data-pass=core] [data-connection="' + id + '"]'),
      label: o('#station-' + id),
    }]).concat([["orbit", o(".lab-orbit")]]));
  })()`);

/**
 * Does the scaled plate still cover the whole viewport (no exposed edge)?
 * Returns the plate rect and the worst gap in CSS px (<= 0 means covered).
 */
export const plateCoverage = (page) =>
  page.eval(`(() => {
    const r = document.querySelector('[data-layer="plate"]').getBoundingClientRect();
    const gap = Math.max(r.left, r.top, innerWidth - r.right, innerHeight - r.bottom);
    return { left: +r.left.toFixed(2), top: +r.top.toFixed(2), right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2), gap: +gap.toFixed(2) };
  })()`);

/**
 * Overlaps between the open hero info and any visible in-scene label
 * (icon, title, chips). Each hit names the label part and the hero row.
 */
export const heroOverlaps = (page, pad = 2) =>
  page.eval(`(() => {
    const p = document.querySelector("[data-station-panel][data-open]");
    if (!p) return [];
    // Drawn extents (line boxes), not the block boxes, which span the slot.
    const drawn = (e) => { const g = document.createRange(); g.selectNodeContents(e); const r = g.getBoundingClientRect(); return r.width ? r : e.getBoundingClientRect(); };
    const rows = [...p.querySelectorAll("h2, h2 + p, ul, [data-open-row], [data-project-detail], :scope > button, span.block")]
      .map((e) => ({ name: e.tagName + (e.textContent ? ":" + e.textContent.trim().slice(0, 18) : ""), r: drawn(e) }));
    const parts = [...document.querySelectorAll(".lab-station")].filter((s) => +getComputedStyle(s).opacity > 0.05)
      .flatMap((s) => [...s.querySelectorAll(".lab-station-icon, .lab-station-title, ul")].map((e) => ({ name: s.dataset.station + " " + e.className.split(" ")[0], r: e.getBoundingClientRect() })));
    const hit = (a, b) => a.left < b.right + ${pad} && b.left < a.right + ${pad} && a.top < b.bottom + ${pad} && b.top < a.bottom + ${pad};
    return rows.flatMap((row) => parts.filter((part) => hit(row.r, part.r)).map((part) => part.name + " x " + row.name));
  })()`);

/** Hotspot polygons: does the centre of each station's box hit its own hotspot? */
export const hotspotHits = (page) =>
  page.eval(`(() => [...document.querySelectorAll("[data-hotspot]")].map((h) => {
    const r = h.getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return h.dataset.hotspot + ":" + (e?.closest("[data-hotspot]")?.dataset.hotspot ?? e?.closest("[data-station]")?.dataset.station ?? "none");
  }))()`);
