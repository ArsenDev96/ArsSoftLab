"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { ProjectMedia } from "@/data/projects";

/**
 * M1.4L.3C: a full-size viewer for a project's screenshots, reusable by any gallery.
 *
 * The gallery stays server-rendered and is passed as `children`. Each image in it is a real link to its full-size
 * file, marked `data-viewer-index="<i>"` (the index into `items`), so without JavaScript a visitor still reaches the
 * image. With JavaScript, a plain click, Enter or Space on such a link opens the viewer instead; modified clicks
 * (new tab, download) keep the browser's behaviour.
 *
 * The viewer is a native modal `<dialog>`: the page behind it is inert, Escape closes it, and it lives in the top
 * layer. On top of that it moves focus to Close, keeps Tab inside, returns focus to the screenshot that opened it,
 * and stops the page scrolling. There is no animation of any kind (open, close or change of image).
 */
export function ScreenshotViewer({
  items,
  notes,
  children,
}: {
  items: ProjectMedia[];
  /** Source and credit lines (for example the map attribution) shown with every image. */
  notes?: string[];
  children: ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLAnchorElement | null>(null);

  const linkFor = (target: EventTarget) =>
    target instanceof Element ? target.closest<HTMLAnchorElement>("a[data-viewer-index]") : null;

  const open = (link: HTMLAnchorElement) => {
    const i = Number(link.dataset.viewerIndex);
    if (!Number.isInteger(i) || !items[i]) return false;
    opener.current = link;
    setIndex(i);
    return true;
  };

  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = linkFor(e.target);
    if (link && open(link)) e.preventDefault();
  };

  // Enter already activates a link (as a click). Space does not, so it is added here; like a button, the viewer
  // opens on key release, so the same key press cannot also reach the Close button that receives focus.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === " " && linkFor(e.target) === e.target) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const link = linkFor(e.target);
    if (e.key === " " && link === e.target && open(link)) e.preventDefault();
  };

  return (
    <div onClick={onClick} onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
      {children}
      {index !== null ? (
        <ViewerDialog
          items={items}
          notes={notes}
          index={index}
          onNavigate={setIndex}
          onClose={() => setIndex(null)}
          opener={opener}
        />
      ) : null}
    </div>
  );
}

const BUTTON =
  "lab-transition inline-flex items-center justify-center rounded-full text-lab-text shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)] hover:bg-white/[0.06]";

function ViewerDialog({
  items,
  notes,
  index,
  onNavigate,
  onClose,
  opener,
}: {
  items: ProjectMedia[];
  notes?: string[];
  index: number;
  onNavigate: (i: number) => void;
  onClose: () => void;
  opener: RefObject<HTMLAnchorElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();
  const captionId = useId();
  const item = items[index];
  const count = items.length;
  const go = (delta: number) => onNavigate((index + delta + count) % count);

  // Open as a modal, lock the page's scrolling (the body's overflow is the viewport's here) and move focus in;
  // on close, undo both and return focus to the screenshot that opened the viewer.
  useLayoutEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const body = document.body;
    const before = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    if (!d.open) d.showModal();
    closeButton.current?.focus();
    return () => {
      if (d.open) d.close();
      body.style.overflow = before.overflow;
      body.style.paddingRight = before.paddingRight;
      opener.current?.focus({ preventScroll: true });
    };
  }, [opener]);

  // The neighbours are fetched ahead, so Previous and Next show their image at once.
  useEffect(() => {
    for (const delta of [-1, 1]) new window.Image().src = items[(index + delta + count) % count].src;
  }, [items, index, count]);

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      go(e.key === "ArrowLeft" ? -1 : 1);
    } else if (e.key === "Tab") {
      // Keep Tab within the viewer (the browser would otherwise move on to its own toolbar).
      const d = e.currentTarget;
      const stops = [...d.querySelectorAll<HTMLElement>("button, summary, a[href]")].filter((el) => el.getClientRects().length);
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && active !== d && d.contains(active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // A click on empty space (marked data-viewer-backdrop) closes; the image, text and controls do not. Both the press
  // and the release must be on empty space, so selecting a caption and releasing beside it does not close.
  const isBackdrop = (target: EventTarget) => target instanceof HTMLElement && target.hasAttribute("data-viewer-backdrop");
  const onPointerDown = (e: PointerEvent) => {
    pressedOnBackdrop.current = isBackdrop(e.target);
  };
  const onBackdropClick = (e: MouseEvent) => {
    if (pressedOnBackdrop.current && isBackdrop(e.target)) dialog.current?.close();
    pressedOnBackdrop.current = false;
  };

  const number = String(index + 1).padStart(2, "0");

  return (
    <dialog
      ref={dialog}
      aria-labelledby={item.title ? titleId : undefined}
      aria-label={item.title ? undefined : `Screenshot ${index + 1} of ${count}`}
      aria-describedby={item.caption ? captionId : undefined}
      // A `close` event queued by an earlier close() can arrive after the dialog was opened again (React's development
      // double effects do this); only a dialog that is really closed ends the viewer.
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onClick={onBackdropClick}
      data-viewer-backdrop=""
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden overscroll-contain border-0 bg-lab-ink/[0.98] p-0 text-lab-text backdrop:bg-transparent"
    >
      <div
        data-viewer-backdrop=""
        className="grid size-full grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto_auto] px-4 pt-3 pb-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-6 sm:px-8 sm:pt-5 sm:pb-6"
      >
        <button
          type="button"
          onClick={() => go(-1)}
          className={`${BUTTON} col-start-1 row-start-1 size-11 self-center sm:row-start-2 sm:size-12`}
        >
          <Chevron direction="left" />
          <span className="sr-only">Previous screenshot</span>
        </button>

        <p
          aria-hidden="true"
          className="col-start-2 row-start-1 self-center px-3 text-[13px] leading-none tracking-[0.18em] text-lab-subtle tabular-nums sm:col-span-2 sm:col-start-1 sm:justify-self-start sm:px-0"
        >
          <span className="text-amber-glow">{index + 1}</span> / {count}
        </p>

        <button
          type="button"
          onClick={() => go(1)}
          className={`${BUTTON} col-start-3 row-start-1 size-11 self-center sm:row-start-2 sm:size-12`}
        >
          <Chevron direction="right" />
          <span className="sr-only">Next screenshot</span>
        </button>

        <button
          ref={closeButton}
          type="button"
          onClick={() => dialog.current?.close()}
          className={`${BUTTON} col-start-5 row-start-1 h-11 gap-2 justify-self-end pr-4 pl-3.5 text-[14px] leading-none sm:col-span-2 sm:col-start-2`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="size-4">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          Close
        </button>

        <div data-viewer-backdrop="" className="relative col-span-full row-start-2 mt-3 min-h-0 sm:col-span-1 sm:col-start-2 sm:mt-5">
          {/* The original file, at most its own size, fitted to the space without distortion (never upscaled). */}
          <img
            src={item.src}
            alt={item.alt}
            width={item.width}
            height={item.height}
            decoding="async"
            className="absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full rounded-[18px] shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_24px_48px_-24px_rgb(0_0_0/0.9)]"
          />
        </div>

        <div data-viewer-backdrop="" className="col-span-full row-start-3 mt-3 text-center sm:col-span-1 sm:col-start-2 sm:mt-4">
          <h2 id={titleId} className="inline-flex items-baseline gap-2.5">
            <span aria-hidden="true" className="text-[12px] leading-none text-amber tabular-nums">
              {number}
            </span>
            {item.title ? <span className="text-[16px] leading-snug font-[460] text-lab-heading">{item.title}</span> : null}
          </h2>
          {item.caption ? (
            <p id={captionId} className="mx-auto mt-1 max-w-[52ch] text-[14px] leading-[1.5] text-lab-muted">
              {item.caption}
            </p>
          ) : null}
        </div>

        {notes?.length ? (
          <div data-viewer-backdrop="" className="col-span-full row-start-4 mt-2 sm:col-span-1 sm:col-start-2 sm:mt-3">
            {/* On a phone the credits fold away behind one line, so the image can take the screen's width. */}
            <details className="text-center sm:hidden">
              <summary className="mx-auto w-fit cursor-pointer rounded-md px-1 text-[12.5px] leading-[1.6] text-lab-subtle">
                Image credits
              </summary>
              <Notes notes={notes} className="mt-1.5 grid" />
            </details>
            <Notes notes={notes} className="hidden sm:grid" />
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {`Screenshot ${index + 1} of ${count}${item.title ? `: ${item.title}` : ""}`}
        </p>
      </div>
    </dialog>
  );
}

function Notes({ notes, className }: { notes: string[]; className: string }) {
  return (
    <div className={`mx-auto max-w-[880px] gap-1 text-center text-[12px] leading-[1.55] text-lab-subtle ${className}`}>
      {notes.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
    >
      <path d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
