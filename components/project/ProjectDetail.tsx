import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { HeroRule } from "@/components/lab/HeroRule";
import { Monogram } from "@/components/ui/Monogram";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { getProject, projectSummary, type Project, type ProjectDetail as Detail } from "@/data/projects";
import { NAV_ITEMS, SITE, type NavItem } from "@/data/site";
import { getZone } from "@/data/zones";
import { LAB_HOME } from "@/lib/lab-url";
import { LAB_V2_PATH, labV2Href, projectPageHref } from "@/lib/lab-v2-pages";

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
export function ProjectDetail({ project, view }: { project: Project & { detail: Detail }; view: string }) {
  const { detail } = project;
  const zone = getZone(project.zone);
  const backHref = labV2Href({ station: project.zone, project: project.id }, view);
  const labHref = labV2Href(LAB_HOME, view);

  const sections: { id: string; title: string; body: ReactNode }[] = [];
  sections.push({ id: "overview", title: "Overview", body: <Overview project={project} /> });
  if (detail.problem || detail.solution) {
    sections.push({ id: "problem", title: "Problem and solution", body: <ProblemSolution detail={detail} /> });
  }
  if (detail.contributions?.length) {
    sections.push({ id: "contributions", title: "Engineering contributions", body: <Contributions items={detail.contributions} /> });
  }
  if (detail.stack?.length) {
    sections.push({ id: "stack", title: "Technology stack", body: <Stack items={detail.stack} /> });
  }
  if (detail.media?.length) {
    sections.push({ id: "media", title: "Screenshots", body: <Media items={detail.media} /> });
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

  // The site's navigation, pointing into the experimental lab instead of the homepage.
  const nav: NavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    href: item.href === "/" ? labHref : `${LAB_V2_PATH}${view ? `?${view}` : ""}${item.href}`,
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
          <header className="grid gap-10 pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-end lg:gap-16 lg:pb-20">
            <div>
              <p className="flex items-center gap-3 text-[12px] leading-none font-medium tracking-[0.26em] text-lab-text uppercase">
                <span
                  aria-hidden="true"
                  className="block size-1.5 rounded-full bg-cyan-glow shadow-[0_0_10px_rgb(85_230_246/0.65)]"
                />
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
            <Section key={s.id} id={s.id} index={i + 1} title={s.title}>
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

/** Status, category and role: a short definition list beside the title. */
function Facts({ detail }: { detail: Detail }) {
  const rows = [
    detail.status ? { term: "Status", value: detail.status, status: true } : null,
    detail.category ? { term: "Category", value: detail.category } : null,
    detail.role ? { term: "Role", value: detail.role } : null,
  ].filter((r) => r !== null);
  if (!rows.length) return null;

  return (
    <dl className="relative overflow-hidden rounded-2xl bg-[linear-gradient(180deg,rgb(255_255_255/0.045),rgb(255_255_255/0.015))] px-6 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.09)] sm:px-7">
      <span
        aria-hidden="true"
        className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_197_108/0.55),transparent)]"
      />
      {rows.map((r, i) => (
        <div key={r.term} className={`py-5 ${i > 0 ? "border-t border-white/[0.07]" : ""}`}>
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

/** A numbered section: its heading in the left column on wide screens, its content on the right. */
function Section({ id, index, title, children }: { id: string; index: number; title: string; children: ReactNode }) {
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
    </section>
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

/** Only real assets with alt text (none yet for SQLOrbit). */
function Media({ items }: { items: NonNullable<Detail["media"]> }) {
  return (
    <div className="grid gap-6">
      {items.map((m) => (
        <figure key={m.src}>
          <Image
            src={m.src}
            alt={m.alt}
            width={m.width}
            height={m.height}
            sizes="(min-width: 1024px) 820px, 100vw"
            className="h-auto w-full rounded-xl shadow-[0_0_0_1px_rgb(255_255_255/0.09)]"
          />
          {m.caption ? <figcaption className="mt-3 text-[14px] text-lab-subtle">{m.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
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
