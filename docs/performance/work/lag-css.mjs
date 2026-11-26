// The three diagnostic experiments, injected per page only (see lag-probe.mjs).
export const CSS = {
  base: "",
  A: '[data-v2-ground="engineering"]{display:none!important}',
  B: '[data-v2-floor]:not([data-v2-floor^="contact"]):not([data-v2-floor="tone"]):not([data-v2-floor*="ring"]):not([data-v2-floor*="occlusion"]){display:none!important}',
  C: "*,*::before,*::after{filter:none!important;backdrop-filter:none!important}",
};
