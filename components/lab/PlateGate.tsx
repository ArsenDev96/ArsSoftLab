"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    /** Set once this document's gate is open, or its inline script is opening it. */
    __labGate?: 1;
  }
}

const OPEN_CSS = ".lab-plate-gate{opacity:1}";
/** The layers are shown by then, whatever the images do. */
const FALLBACK_MS = 4000;

/**
 * The plate layer is shown only once the plate *and* the unpowered overlay
 * have decoded, so the strips never flash fully lit while the page loads.
 * Runs as the HTML is parsed (not after hydration); without scripts, or
 * after 4 s at the latest, the layer is shown anyway.
 */
const gateJs = (selector: string, each: string) => `(function(){window.__labGate=1;var d=0,l=document.currentScript&&document.currentScript.parentElement;function show(){if(d)return;d=1;var s=document.createElement("style");s.textContent="${OPEN_CSS}";document.head.appendChild(s)}setTimeout(show,${FALLBACK_MS});if(!l)return show();Promise.all([].slice.call(l.querySelectorAll("${selector}")).map(function(i){${each}return new Promise(function(r){if(i.complete)r();else{i.addEventListener("load",r);i.addEventListener("error",r)}}).then(function(){return i.decode?i.decode().catch(function(){}):0})})).then(show)})();`;

const IMG = "img[data-gate]";
/** M1.4I.2 (/lab-v2): the layers drawn from crops are SVG images (SceneImage), awaited through an Image of the same file. */
const IMG_OR_SVG = `${IMG},image[data-gate]`;
/** Whether a SceneImage draws its crop here (SceneImage.tsx, CROPS_HERE) or the full-frame file. */
const CROPS_HERE_JS = 'CSS.supports("object-view-box","none")';
const VIA_IMAGE = `if(!i.src){var n=new Image();n.src=i.getAttribute(${CROPS_HERE_JS}?"href":"data-full");i=n}`;
const GATE_JS = gateJs(IMG, "");
const GATE_JS_SVG = gateJs(IMG_OR_SVG, VIA_IMAGE);
/** The file an element shows, as an image that can be decoded. */
function asImage(el: Element): HTMLImageElement {
  if (el instanceof HTMLImageElement) return el;
  const img = new Image();
  img.src = el.getAttribute(CSS.supports("object-view-box", "none") ? "href" : "data-full") ?? "";
  return img;
}

/**
 * M1.4I.1A: the inline script only runs when the browser parses it from the
 * server's HTML. After a client-side navigation React creates the element,
 * and a script created that way never executes, so a document that did not
 * start on a lab page opens the gate from the effect instead: same condition,
 * same fallback. Once open, the gate stays open for the whole document (the
 * rule lives in <head>), so later mounts do nothing.
 */
export function PlateGate({ svgImages = false }: { svgImages?: boolean }) {
  const script = useRef<HTMLScriptElement>(null);

  useEffect(() => {
    const root = script.current?.parentElement;
    if (window.__labGate || !root) return;
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.__labGate = 1;
      const style = document.createElement("style");
      style.textContent = OPEN_CSS;
      document.head.appendChild(style);
    };
    const timer = window.setTimeout(show, FALLBACK_MS);
    // decode() waits for the load, and rejects if it fails.
    Promise.allSettled([...root.querySelectorAll(svgImages ? IMG_OR_SVG : IMG)].map((el) => asImage(el).decode())).then(show);
    // Left before it opened: the next mount starts over.
    return () => {
      done = true;
      window.clearTimeout(timer);
    };
  }, [svgImages]);

  return (
    <>
      {/* On the client the type makes it an inert data block: it could not run
          there, and React would log an error for it. */}
      <script
        ref={script}
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: svgImages ? GATE_JS_SVG : GATE_JS }}
      />
      <noscript>
        <style>{OPEN_CSS}</style>
      </noscript>
    </>
  );
}
