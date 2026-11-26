import type { ProjectId } from "@/data/projects";
import { HERO } from "@/data/site";
import { u } from "@/lib/scene";
import { HeroRule } from "./HeroRule";
import { LAB_ZONES } from "@/data/zones";
import { StationPanel } from "./StationPanel";

/**
 * "INSIDE MY LAB" intro copy, anchored top-left as in the reference.
 *
 * The heading slot doubles as the station information area. While a station
 * is selected, the heading block fades out and that station's info fades in
 * at the same position (see .lab-hero-heading / .lab-station-info). The
 * eyebrow stays.
 *
 * `projectPages` (M1.4L.2, `/lab-v2` only): projects whose "Open project"
 * links to a page. Without it (the homepage) every project keeps its own
 * `href`, and "Coming soon" where it has none.
 */
export function LabHero({ projectPages }: { projectPages?: Partial<Record<ProjectId, string>> } = {}) {
  return (
    <section
      id="lab-intro"
      aria-labelledby="lab-intro-title"
      className="lab-hero pointer-events-none absolute z-20"
      style={{ left: u(121), top: u(119) }}
    >
      <p
        className="leading-none font-medium uppercase text-lab-text"
        style={{ fontSize: u(12), letterSpacing: u(3.15) }}
      >
        {HERO.eyebrow}
      </p>

      <div className="relative" style={{ marginTop: u(13.6) }}>
        <div className="lab-hero-heading">
          <h1
            id="lab-intro-title"
            className="font-[390] text-lab-heading"
            style={{ fontSize: u(40.5), lineHeight: u(43.5), letterSpacing: u(-0.1) }}
          >
            {HERO.lines.map((line, i) => (
              <span key={line} className="block">
                {line}
                {i === HERO.lines.length - 1 ? (
                  <>
                    {" "}
                    <span
                      className="font-medium"
                      style={{
                        color: "#f6ac51",
                        background: "linear-gradient(180deg, #ffc36a 0%, #f6a94e 55%, #ec9342 100%)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        filter: "drop-shadow(0 0 10px rgb(255 160 70 / 0.25))",
                      }}
                    >
                      {HERO.highlight}
                    </span>
                  </>
                ) : null}
              </span>
            ))}
          </h1>
          <HeroRule marginTop={18} />
        </div>

        {LAB_ZONES.map((zone) => (
          // Passed only when set, so the homepage's server payload stays exactly as before.
          <StationPanel key={zone.id} zoneId={zone.id} {...(projectPages ? { projectPages } : null)} />
        ))}
      </div>
    </section>
  );
}
