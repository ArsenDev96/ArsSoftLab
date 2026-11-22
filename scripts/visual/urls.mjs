// Probes for M1.3B part 2: URL deep-linking (?station=…&project=…).

/** The address as the app sees it: path + query (no origin, no hash). */
export const here = (page) => page.eval(`location.pathname + location.search`);

export const historyLength = (page) => page.eval(`history.length`);

/** Canonical lab URL for a selection. */
export const labUrl = (station, project) =>
  station ? `/?station=${station}${project ? `&project=${project}` : ""}` : "/";

/**
 * Records, from the very start of every document, which CSS transitions
 * start (to prove a deep link loads without a camera move) and whether the
 * document was reloaded (a per-document token).
 */
export async function instrument(page) {
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__labDoc = Math.random().toString(36).slice(2);
      window.__labTransitions = [];
      window.__labHistory = { push: 0, replace: 0 };
      for (const k of ["push", "replace"]) {
        const orig = history[k + "State"];
        history[k + "State"] = function (...a) { window.__labHistory[k]++; return orig.apply(this, a); };
      }
      document.addEventListener("transitionrun", (e) => {
        const t = e.target;
        const name = t.classList?.contains("lab-camera") ? "camera"
          : t.classList?.contains("lab-focus-vignette") ? "vignette"
          : t.classList?.contains("lab-station-info") ? "info:" + t.dataset.stationPanel
          : t.classList?.contains("lab-hero-heading") ? "heading"
          : null;
        if (name) window.__labTransitions.push(name + "/" + e.propertyName);
      }, true);
    `,
  });
}

export const transitionsSinceLoad = (page) => page.eval(`window.__labTransitions ?? null`);
export const docToken = (page) => page.eval(`window.__labDoc ?? null`);
/** pushState / replaceState calls made by this document so far. */
export const historyCalls = (page) => page.eval(`({ ...window.__labHistory })`);

/**
 * Collects console errors and uncaught exceptions (React reports hydration
 * mismatches as console errors / recoverable errors). Call `take()` to read
 * and reset.
 */
export function watchErrors(page) {
  let errors = [];
  page.on((m) => {
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "assert")) {
      errors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
    } else if (m.method === "Runtime.exceptionThrown") {
      errors.push((m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
    } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && m.params.entry.source !== "network") {
      errors.push(m.params.entry.text.slice(0, 300));
    }
  });
  page.send("Log.enable").catch(() => {});
  return {
    take() {
      const e = errors;
      errors = [];
      return e;
    },
  };
}

/**
 * Invalid / non-canonical URLs and what they must normalize to. The rule:
 * keep the longest valid prefix of station -> project; matching is
 * case-insensitive; other parameters are kept.
 */
export const INVALID_URLS = [
  { url: "/?station=nope", station: null, project: null, canonical: "/" },
  { url: "/?station=nope&project=sqlorbit", station: null, project: null, canonical: "/" },
  { url: "/?project=sqlorbit", station: null, project: null, canonical: "/" },
  { url: "/?project=nope", station: null, project: null, canonical: "/" },
  { url: "/?station=&project=", station: null, project: null, canonical: "/" },
  { url: "/?station=__proto__&project=constructor", station: null, project: null, canonical: "/" },
  { url: "/?station=engineering&project=arimap", station: "engineering", project: null, canonical: "/?station=engineering" },
  { url: "/?station=playground&project=nope", station: "playground", project: null, canonical: "/?station=playground" },
  { url: "/?station=Engineering&project=SQLOrbit", station: "engineering", project: "sqlorbit", canonical: "/?station=engineering&project=sqlorbit" },
  { url: "/?project=koreez&station=experience", station: "experience", project: "koreez", canonical: "/?station=experience&project=koreez" },
  { url: "/?station=creative&station=experience", station: "creative", project: null, canonical: "/?station=creative" },
  { url: "/?station=educational&project=armat&project=arimap", station: "educational", project: "armat", canonical: "/?station=educational&project=armat" },
  { url: "/?ref=share&station=educational", station: "educational", project: null, canonical: "/?station=educational&ref=share" },
];
