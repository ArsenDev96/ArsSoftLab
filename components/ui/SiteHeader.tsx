import Link from "next/link";
import type { ReactNode } from "react";
import { NAV_ITEMS, SITE, type NavIconName, type NavItem } from "@/data/site";
import { u } from "@/lib/scene";
import { Monogram } from "./Monogram";
import { SearchTrigger } from "./SearchTrigger";
import { ExperienceIcon, HomeIcon, ProjectsIcon, SendIcon, UserIcon } from "./icons";

const NAV_ICONS: Record<NavIconName, typeof HomeIcon> = {
  home: HomeIcon,
  projects: ProjectsIcon,
  experience: ExperienceIcon,
  user: UserIcon,
};

/**
 * Positions are reference pixels; see reference/approved-lab-design.png.
 * `utilities` (M1.4K.5B, /lab-v2): extra controls before the search, in the header's own row; none elsewhere.
 * `nav` (M1.4L.2, /lab-v2 project pages): the same entries pointing into `/lab-v2`; the site's own by default.
 */
export function SiteHeader({
  activeHref = "/",
  utilities,
  nav = NAV_ITEMS,
}: {
  activeHref?: string;
  utilities?: ReactNode;
  nav?: readonly NavItem[];
}) {
  return (
    <header className="lab-header-scrim pointer-events-none absolute inset-x-0 top-0 z-30" style={{ height: u(78) }}>
      {/* Brand */}
      <Link
        href="/"
        className="pointer-events-auto absolute flex items-start rounded-lg"
        style={{ left: u(58), top: u(15) }}
        aria-label={`${SITE.owner} — ${SITE.brand} home`}
      >
        <Monogram style={{ width: u(48), height: u(46) }} />
        <span className="flex flex-col" style={{ marginLeft: u(22) }}>
          <span
            className="leading-none font-[460] text-lab-text"
            style={{ fontSize: u(21.4), marginTop: u(3.3) }}
          >
            {SITE.owner}
          </span>
          <span
            className="leading-none uppercase text-lab-muted"
            style={{ fontSize: u(11.5), letterSpacing: u(3.45), marginTop: u(5.4) }}
          >
            {SITE.role}
          </span>
        </span>
      </Link>

      {/* Primary navigation */}
      <nav
        aria-label="Primary"
        className="pointer-events-auto absolute"
        style={{ left: `calc(50% + ${u(597 - 836)})`, top: u(13) }}
      >
        <ul className="flex items-start">
          {nav.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const active = item.href === activeHref;
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "lab-transition relative flex items-center rounded-full",
                    active ? "text-lab-text" : "text-[#d7d7d9] hover:text-lab-text",
                  ].join(" ")}
                  style={{
                    height: u(47),
                    paddingInline: u(active ? 28 : 25.5),
                    paddingBottom: u(12),
                    gap: u(9),
                    fontSize: u(16),
                    ...(active ? activePill : null),
                  }}
                >
                  <Icon
                    className={active ? "text-[#f7bb67]" : undefined}
                    style={{ width: u(21), height: u(21), marginTop: u(1) }}
                  />
                  <span className="leading-none">{item.label}</span>
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute rounded-full"
                      style={{
                        left: u(18),
                        right: u(16),
                        bottom: u(5),
                        height: u(3),
                        background:
                          "linear-gradient(90deg, rgb(255 190 100 / 0.15), #ffd27f 30%, #ffe3a8 55%, #f6b05a 80%, rgb(255 170 80 / 0.1))",
                        boxShadow: `0 0 ${u(8)} rgb(255 175 80 / 0.85), 0 0 ${u(18)} rgb(255 150 60 / 0.45)`,
                      }}
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Utilities */}
      <div className="pointer-events-auto absolute flex items-start" style={{ right: u(48), top: u(17) }}>
        {utilities}
        <SearchTrigger />
        <Link
          href={SITE.contactHref}
          className="lab-transition flex items-center justify-center rounded-full font-medium text-lab-text hover:brightness-125"
          style={{
            marginLeft: u(36),
            width: u(148),
            height: u(43),
            gap: u(10),
            fontSize: u(16.5),
            border: `${u(1.6)} solid transparent`,
            background:
              "linear-gradient(180deg, rgb(52 34 24 / 0.92), rgb(30 20 16 / 0.92)) padding-box, linear-gradient(100deg, #f3a253 0%, #ffd29a 45%, #f0b07a 70%, #d9a3c0 100%) border-box",
            boxShadow: `0 0 ${u(14)} rgb(255 160 70 / 0.35), inset 0 0 ${u(12)} rgb(255 160 80 / 0.12)`,
          }}
        >
          <SendIcon className="text-[#fbcf86]" style={{ width: u(23), height: u(23) }} />
          <span className="leading-none">Let&rsquo;s Talk</span>
        </Link>
      </div>
    </header>
  );
}

const activePill = {
  background:
    "radial-gradient(120% 90% at 50% 100%, rgb(255 170 80 / 0.16), transparent 60%), linear-gradient(180deg, rgb(255 255 255 / 0.07), rgb(255 255 255 / 0.03))",
  boxShadow:
    "inset 0 0 0 1px rgb(255 255 255 / 0.09), inset 0 1px 0 rgb(255 255 255 / 0.06), 0 6px 24px rgb(0 0 0 / 0.35)",
} as const;
