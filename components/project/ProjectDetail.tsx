import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { HeroRule } from "@/components/lab/HeroRule";
import { ScreenshotViewer } from "@/components/project/ScreenshotViewer";
import { Monogram } from "@/components/ui/Monogram";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { getProject, projectSummary, type Project, type ProjectDetail as Detail } from "@/data/projects";
import { NAV_ITEMS, SITE, type NavItem } from "@/data/site";
import { getZone, type StationAccent } from "@/data/zones";
import { LAB_HOME } from "@/lib/lab-url";
import { LAB_V2_PATH, labV2ExperienceHref, labV2Href, projectPageHref } from "@/lib/lab-v2-pages";

/**
 * M1.4L.2: a project's detail page, in the lab's visual language without the
 * scene: the lab ink, the hero's eyebrow, light heading weights and amber
 * rule, hairline borders, one restrained warm light at the top.
 *
 * Reusable: everything comes from `project.detail`, and each block renders
 * only when its content exists (no placeholders). The page is static: no
 * animation beyond the shared colour transitions (off with reduced motion).
 *
 * `view` is the lab's view query (render, floor) the visitor came with, so
 * every way back to the lab returns to the same mode.
 */
/** The eyebrow's dot in the station's accent (M1.4L.3B; Engineering's cyan as before). */
const ACCENT_DOT: Record<StationAccent, string> = {
  cyan: "bg-cyan-glow shadow-[0_0_10px_rgb(85_230_246/0.65)]",
  amber: "bg-amber-glow shadow-[0_0_10px_rgb(255_197_108/0.6)]",
  violet: "bg-violet-glow shadow-[0_0_10px_rgb(229_124_243/0.6)]",
};

export function ProjectDetail({ project, view }: { project: Project & { detail: Detail }; view: string }) {
  const { detail } = project;
  const zone = getZone(project.zone);
  const backHref = labV2Href({ station: project.zone, project: project.id }, view);
  const labHref = labV2Href(LAB_HOME, view);

  const sections: { id: string; title: string; body: ReactNode; wide?: ReactNode }[] = [];
  // M1.4L.3B: extra text sections, after the Overview, the contributions or (M1.4L.4B) the stack; one of them may hold
  // the screenshots: under its text at full width, or (M1.4L.4B) as its only content, in the content column.
  const media = detail.media?.length ? <Media items={detail.media} notes={detail.mediaNotes} /> : null;
  const extra = (after: NonNullable<NonNullable<Detail["sections"]>[number]["after"]>) =>
    (detail.sections ?? [])
      .filter((s) => (s.after ?? "overview") === after)
      .forEach((s) => {
        const textless = !s.paragraphs?.length && !s.items?.length;
        sections.push(
          s.showMedia && textless
            ? { id: s.id, title: s.title, body: media }
            : { id: s.id, title: s.title, body: <TextSection section={s} />, wide: s.showMedia ? media : undefined },
        );
      });
  const mediaInSection = Boolean(media && detail.sections?.some((s) => s.showMedia));

  sections.push({ id: "overview", title: "Overview", body: <Overview project={project} /> });
  extra("overview");
  if (detail.problem || detail.solution) {
    sections.push({ id: "problem", title: "Problem and solution", body: <ProblemSolution detail={detail} /> });
  }
  if (detail.contributions?.length) {
    sections.push({ id: "contributions", title: "Engineering contributions", body: <Contributions items={detail.contributions} /> });
  }
  extra("contributions");
  if (detail.stack?.length) {
    sections.push({ id: "stack", title: "Technology stack", body: <Stack items={detail.stack} /> });
  }
  extra("stack");
  if (media && !mediaInSection) {
    sections.push({ id: "media", title: "Screenshots", body: media });
  }
  if (detail.links?.length) {
    sections.push({ id: "links", title: "Links", body: <Links items={detail.links} /> });
  }
  const related = (detail.related ?? []).map(getProject);
  if (related.length) {
    sections.push({
      id: "related",
      title: related.length > 1 ? "Related projects" : "Related project",
      body: <Related projects={related} view={view} />,
    });
  }

  // The site's navigation, pointing into the experimental lab instead of the homepage. M1.4P: Experience opens the
  // Experience station (its deep link, as in the lab's own header) instead of the in-scene anchor.
  const nav: NavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    href:
      item.href === "/"
        ? labHref
        : item.icon === "experience"
          ? labV2ExperienceHref(view)
          : `${LAB_V2_PATH}${view ? `?${view}` : ""}${item.href}`,
  }));
  const projectsNav = nav.find((item) => item.icon === "projects")?.href;

  return (
    <div data-project-page={project.id} className="relative min-h-svh overflow-x-clip bg-lab-ink">
      <a
        href="#project-content"
        className="sr-only z-50 rounded-md bg-lab-ink px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <Backdrop />

      <div className="hidden lg:block">
        <SiteHeader activeHref={projectsNav} nav={nav} />
      </div>
      <CompactHeader labHref={labHref} />

      <main id="project-content" className="relative mx-auto w-full max-w-[1180px] px-6 pt-12 pb-20 sm:px-10 lg:px-14 lg:pt-[150px] lg:pb-28">
        <BackLink href={backHref} />

        <article aria-labelledby="project-title" className="mt-10 lg:mt-14">
          <header
            className={`grid gap-10 pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] ${factRows(detail).length > LONG_FACTS ? "lg:items-start" : "lg:items-end"} lg:gap-16 lg:pb-20`}
          >
            <div>
              <p className="flex items-center gap-3 text-[12px] leading-none font-medium tracking-[0.26em] text-lab-text uppercase">
                <span aria-hidden="true" className={`block size-1.5 rounded-full ${ACCENT_DOT[zone.accent]}`} />
                {zone.title}
                <span aria-hidden="true" className="text-amber">
                  ·
                </span>
                Project
              </p>
              <h1
                id="project-title"
                className="mt-6 text-[clamp(3rem,7.2vw,5.75rem)] leading-[0.95] font-[390] tracking-[-0.025em] text-lab-heading"
              >
                {project.name}
              </h1>
              <p className="mt-6 max-w-[30ch] text-[clamp(1.25rem,2.2vw,1.75rem)] leading-[1.32] font-[360] text-lab-muted">
                {detail.tagline}
              </p>
              <HeroRule marginTop={30} />
            </div>

            <Facts detail={detail} />
          </header>

          {sections.map((s, i) => (
            <Section key={s.id} id={s.id} index={i + 1} title={s.title} wide={s.wide}>
              {s.body}
            </Section>
          ))}
        </article>

        <footer className="mt-4 flex flex-col items-start gap-4 border-t border-white/[0.08] pt-10 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <BackLink href={backHref} />
          <p className="text-[13px] text-lab-subtle">
            {zone.title} station <span aria-hidden="true">·</span> {SITE.brand}
          </p>
        </footer>
      </main>
    </div>
  );
}

/** One warm light from the upper left and a faint trace of the station's cyan: no scene, no image. */
function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[min(1000px,120svh)]">
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_12%_0%,rgb(244_162_76/0.11),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(45%_45%_at_92%_8%,rgb(85_230_246/0.045),transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-lab-ink" />
    </div>
  );
}

/** Below 1024 px the lab's header (laid out for the scene's frame) gives way to the brand and a way back to the lab. */
function CompactHeader({ labHref }: { labHref: string }) {
  return (
    <header className="relative z-30 flex items-center justify-between gap-4 px-6 pt-5 sm:px-10 lg:hidden">
      <Link href="/" aria-label={`${SITE.owner} — ${SITE.brand} home`} className="flex items-center gap-3 rounded-lg">
        <Monogram className="h-9 w-[37.5px] shrink-0" />
        <span className="flex flex-col">
          <span className="text-[17px] leading-none font-[460] text-lab-text">{SITE.owner}</span>
          <span className="mt-1.5 text-[10px] leading-none tracking-[0.3em] text-lab-muted uppercase">{SITE.role}</span>
        </span>
      </Link>
      <Link
        href={labHref}
        className="lab-transition rounded-full px-4 py-2 text-[14px] leading-none text-lab-text shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)] hover:bg-white/5"
      >
        Lab
      </Link>
    </header>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="lab-transition inline-flex items-center gap-2.5 rounded-md text-[15px] text-lab-muted hover:text-amber-glow"
    >
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
        <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
      Back to the lab
    </Link>
  );
}

/** The facts beside the title, in order: status, release milestone, category, role, platforms, languages. */
function factRows(detail: Detail) {
  return [
    detail.status ? { term: "Status", value: detail.status, status: true } : null,
    detail.milestone ? { term: "Release", value: detail.milestone } : null,
    detail.category ? { term: "Category", value: detail.category } : null,
    detail.role ? { term: "Role", value: detail.role } : null,
    detail.platforms?.length ? { term: "Platforms", value: detail.platforms.join(" · ") } : null,
    detail.languages?.length ? { term: "Languages", value: detail.languages.join(" · ") } : null,
  ].filter((r) => r !== null);
}

/**
 * A short definition list beside the title. Up to three rows (SQLOrbit) it is as tall as the title block and both
 * end on one line; a longer list (M1.4L.3B) has tighter rows, and the title aligns with its top instead.
 */
const LONG_FACTS = 3;

function Facts({ detail }: { detail: Detail }) {
  const rows = factRows(detail);
  if (!rows.length) return null;
  const pad = rows.length > LONG_FACTS ? "py-4" : "py-5";

  return (
    <dl className="relative overflow-hidden rounded-2xl bg-[linear-gradient(180deg,rgb(255_255_255/0.045),rgb(255_255_255/0.015))] px-6 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.09)] sm:px-7">
      <span
        aria-hidden="true"
        className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_197_108/0.55),transparent)]"
      />
      {rows.map((r, i) => (
        <div key={r.term} className={`${pad} ${i > 0 ? "border-t border-white/[0.07]" : ""}`}>
          <dt className="text-[11.5px] leading-none tracking-[0.2em] text-lab-subtle uppercase">{r.term}</dt>
          <dd className="mt-2.5 flex items-center gap-2.5 text-[16px] leading-snug text-lab-text">
            {"status" in r ? (
              <span aria-hidden="true" className="block size-2 shrink-0 rounded-full bg-amber shadow-[0_0_8px_rgb(244_162_76/0.7)]" />
            ) : null}
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A numbered section: its heading in the left column on wide screens, its content on the right. `wide` (M1.4L.3B)
 * is a row under both, at the content's full width (the screenshots).
 */
function Section({
  id,
  index,
  title,
  wide,
  children,
}: {
  id: string;
  index: number;
  title: string;
  wide?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `project-${id}`;
  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-7 border-t border-white/[0.08] py-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16 lg:py-[72px]"
    >
      <div>
        <p aria-hidden="true" className="text-[12px] leading-none tracking-[0.2em] text-amber tabular-nums">
          {String(index).padStart(2, "0")}
        </p>
        <h2 id={headingId} className="mt-3 text-[22px] leading-tight font-[460] text-lab-heading">
          {title}
        </h2>
      </div>
      <div className="min-w-0">{children}</div>
      {wide ? <div className="min-w-0 pt-3 lg:col-span-2 lg:pt-0">{wide}</div> : null}
    </section>
  );
}

/** An extra text section (M1.4L.3B): paragraphs, then a short list whose items may lead with a term. */
function TextSection({ section }: { section: NonNullable<Detail["sections"]>[number] }) {
  return (
    <div className="max-w-[760px]">
      {section.paragraphs?.map((p, i) => (
        <p key={p} className={`text-[17px] leading-[1.65] text-lab-muted ${i > 0 ? "mt-5" : ""}`}>
          {p}
        </p>
      ))}
      {section.items?.length ? (
        <ul className={section.paragraphs?.length ? "mt-8" : undefined}>
          {section.items.map((item, i) => (
            <li
              key={item.term ?? item.text}
              className={`grid gap-1.5 py-4 sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-6 ${i > 0 ? "border-t border-white/[0.07]" : "pt-0"} last:pb-0`}
            >
              {item.term ? <span className="text-[16px] leading-[1.55] font-[460] text-lab-heading">{item.term}</span> : null}
              <span className={`text-[16px] leading-[1.55] text-lab-muted ${item.term ? "" : "sm:col-span-2"}`}>{item.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The owner's overview paragraphs (the first as the lead), or the project's one-sentence lab summary. */
function Overview({ project }: { project: Project }) {
  const [lead, ...rest] = project.detail?.overview?.length ? project.detail.overview : [projectSummary(project.id)];
  return (
    <div className="max-w-[680px]">
      <p className="text-[clamp(1.125rem,1.5vw,1.25rem)] leading-[1.6] font-[380] text-lab-heading">{lead}</p>
      {rest.map((p) => (
        <p key={p} className="mt-5 text-[17px] leading-[1.65] text-lab-muted">
          {p}
        </p>
      ))}
    </div>
  );
}

function ProblemSolution({ detail }: { detail: Detail }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {detail.problem ? (
        <div className="rounded-2xl p-6 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.09)] sm:p-7">
          <h3 className="flex items-center gap-2.5 text-[12px] leading-none font-medium tracking-[0.2em] text-lab-subtle uppercase">
            <span aria-hidden="true" className="block h-px w-5 bg-white/35" />
            Problem
          </h3>
          <p className="mt-5 text-[17px] leading-[1.6] text-lab-muted">{detail.problem}</p>
        </div>
      ) : null}
      {detail.solution ? (
        <div className="rounded-2xl bg-[linear-gradient(160deg,rgb(244_162_76/0.075),rgb(244_162_76/0.015)_60%)] p-6 shadow-[inset_0_0_0_1px_rgb(244_162_76/0.24)] sm:p-7">
          <h3 className="flex items-center gap-2.5 text-[12px] leading-none font-medium tracking-[0.2em] text-amber-glow uppercase">
            <span aria-hidden="true" className="block h-px w-5 bg-amber-glow/70" />
            Solution
          </h3>
          <p className="mt-5 text-[17px] leading-[1.6] text-lab-muted">{detail.solution}</p>
        </div>
      ) : null}
    </div>
  );
}

function Contributions({ items }: { items: string[] }) {
  return (
    <ol className="grid max-w-[760px]">
      {items.map((item, i) => (
        <li key={item} className={`flex gap-6 py-5 last:pb-0 ${i > 0 ? "border-t border-white/[0.07]" : "pt-0"}`}>
          <span aria-hidden="true" className="w-7 shrink-0 pt-[5px] text-[13px] leading-none text-amber tabular-nums">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-[17px] leading-[1.55] text-lab-muted">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Stack({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full bg-white/[0.03] px-[18px] py-2.5 text-[15px] leading-none text-lab-text shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)]"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * Only real assets with alt text (none for SQLOrbit). Portrait screens (phone screenshots) form one numbered row
 * (M1.4L.3B); other images stack at full width (M1.4L.4B: numbered too). Either way each opens full size in
 * `ScreenshotViewer`. `notes` (source and required credits) follow in small print.
 */
function Media({ items, notes }: { items: NonNullable<Detail["media"]>; notes?: string[] }) {
  const portrait = items.every((m) => m.height > m.width);
  return (
    <div>
      <ScreenshotViewer items={items} notes={notes}>
        {portrait ? <ScreenRow items={items} /> : <ScreenStack items={items} />}
      </ScreenshotViewer>
      {notes?.length ? (
        <div className="mt-10 grid max-w-[880px] gap-1.5 text-[12.5px] leading-[1.6] text-lab-subtle">
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Phone screens in order, all in view at once (no carousel, no motion): five across on wide screens, every other one
 * set a little lower for an editorial rhythm; three, then two, across on narrower screens. Each keeps its own
 * proportions inside a hairline frame, with a numbered title and one line under it.
 *
 * M1.4L.3C: two across, an odd last screen is centred in its row at the same width (gap-x-4: half the row less half
 * the gap). Each image links to its full-size file, which `ScreenshotViewer` opens in place (`data-viewer-index`).
 */
function ScreenRow({ items }: { items: NonNullable<Detail["media"]> }) {
  const lone = items.length % 2 === 1 ? items.length - 1 : -1;
  return (
    <ol className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-5 lg:gap-x-5">
      {items.map((m, i) => (
        <li
          key={m.src}
          className={
            `${i % 2 === 1 ? "lg:mt-14" : ""} ${i === lone ? "max-sm:col-span-2 max-sm:mx-auto max-sm:w-[calc(50%-0.5rem)]" : ""}`.trim() ||
            undefined
          }
        >
          <figure>
            <a href={m.src} data-viewer-index={i} className="block cursor-zoom-in rounded-[18px]">
              <div className="overflow-hidden rounded-[18px] bg-white/[0.03] shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_24px_48px_-24px_rgb(0_0_0/0.9)]">
                <Image
                  src={m.src}
                  alt={m.alt}
                  width={m.width}
                  height={m.height}
                  sizes="(min-width: 1180px) 200px, (min-width: 1024px) 17vw, (min-width: 640px) 30vw, 46vw"
                  className="block h-auto w-full"
                />
              </div>
              <span className="sr-only"> (view full size)</span>
            </a>
            <ScreenCaption item={m} index={i} />
          </figure>
        </li>
      ))}
    </ol>
  );
}

/**
 * M1.4L.4B: desktop screenshots (wide or tall), one under another at the content column's width, each at its own
 * proportions in a hairline frame, with the same numbered title and caption as `ScreenRow`. Each image links to its
 * full-size file, which `ScreenshotViewer` opens in place.
 */
function ScreenStack({ items }: { items: NonNullable<Detail["media"]> }) {
  return (
    <ol className="grid gap-12 lg:gap-14">
      {items.map((m, i) => (
        <li key={m.src}>
          <figure>
            <a href={m.src} data-viewer-index={i} className="block cursor-zoom-in rounded-xl">
              <Image
                src={m.src}
                alt={m.alt}
                width={m.width}
                height={m.height}
                sizes="(min-width: 1180px) 764px, (min-width: 1024px) calc(100vw - 416px), (min-width: 640px) calc(100vw - 80px), calc(100vw - 48px)"
                className="block h-auto w-full rounded-xl shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_24px_48px_-24px_rgb(0_0_0/0.9)]"
              />
              <span className="sr-only"> (view full size)</span>
            </a>
            <ScreenCaption item={m} index={i} />
          </figure>
        </li>
      ))}
    </ol>
  );
}

/** A screenshot's amber number and title, with its one-line caption under it. */
function ScreenCaption({ item: m, index: i }: { item: NonNullable<Detail["media"]>[number]; index: number }) {
  if (!m.title && !m.caption) return null;
  return (
    <figcaption className="mt-4">
      {m.title ? (
        <span className="flex items-baseline gap-2.5">
          <span aria-hidden="true" className="text-[12px] leading-none text-amber tabular-nums">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-[15px] leading-snug font-[460] text-lab-heading">{m.title}</span>
        </span>
      ) : null}
      {m.caption ? <span className="mt-1.5 block text-[13.5px] leading-[1.5] text-lab-muted">{m.caption}</span> : null}
    </figcaption>
  );
}

/** Only links that exist (none yet for SQLOrbit). External ones open in a new tab and say so. */
function Links({ items }: { items: NonNullable<Detail["links"]> }) {
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-4">
      {items.map((l) => {
        const external = /^https?:\/\//.test(l.href);
        return (
          <li key={l.href}>
            <a
              href={l.href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : null)}
              className="lab-transition inline-flex items-center gap-2 rounded-md text-[16px] text-amber-glow underline decoration-amber/40 underline-offset-[6px] hover:text-lab-text"
            >
              {l.label}
              {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Related projects: to their page if they have one, otherwise to the project
 * in the lab (its one-sentence preview), which is what exists today.
 */
function Related({ projects, view }: { projects: Project[]; view: string }) {
  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {projects.map((p) => {
        const zone = getZone(p.zone);
        const hasPage = Boolean(p.detail);
        const href = hasPage ? projectPageHref(p.slug, view) : labV2Href({ station: p.zone, project: p.id }, view);
        return (
          <li
            key={p.id}
            className="lab-transition relative flex flex-col rounded-2xl p-6 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.09)] has-[a:hover]:bg-white/[0.025] has-[a:hover]:shadow-[inset_0_0_0_1px_rgb(244_162_76/0.35)] sm:p-7"
          >
            <p className="text-[11.5px] leading-none tracking-[0.2em] text-lab-subtle uppercase">
              {zone.title} <span aria-hidden="true">·</span> Project
            </p>
            <h3 className="mt-4 text-[26px] leading-tight font-[420] text-lab-heading">{p.name}</h3>
            <p className="mt-3 text-[16px] leading-[1.55] text-lab-muted">{projectSummary(p.id)}</p>
            <Link
              href={href}
              className="lab-transition mt-6 inline-flex items-center gap-2 self-start rounded-md text-[15px] text-amber-glow after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:text-lab-text"
            >
              {hasPage ? `Open ${p.name}` : `View ${p.name} in the lab`}
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
