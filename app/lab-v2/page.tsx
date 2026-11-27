import type { Metadata } from "next";
import { ExploreCue } from "@/components/lab/ExploreCue";
import { LabHero } from "@/components/lab/LabHero";
import { LabScene } from "@/components/lab/LabScene";
import { LabSceneStatic } from "@/components/lab/LabSceneStatic";
import { LabStateProvider } from "@/components/lab/LabState";
import { LabCompactHeader, LabStationDock } from "@/components/lab/MobileLab";
import { RenderModeSelector } from "@/components/lab/RenderModeSelector";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { PROJECT_PARAM, resolveLabLocation, STATION_PARAM } from "@/lib/lab-url";
import { labV2ProjectPages, labViewQuery } from "@/lib/lab-v2-pages";

/** M1.4D: experimental, not linked from anywhere and not indexed. */
export const metadata: Metadata = {
  title: "Lab v2 (experimental)",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * M1.4D: the homepage's lab over the independent v2 layers (LabScene
 * variant "v2"). Same state, deep links (`/lab-v2?station=…&project=…`),
 * hero, labels and keyboard behaviour as `/`; the approved homepage is
 * unchanged.
 */
export default async function LabV2Page({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const initial = resolveLabLocation(query[STATION_PARAM], query[PROJECT_PARAM]);
  // M1.4K.4 (prototype): `?render=lite` is a lighter rendering for software compositing and weak GPUs. Full is the default.
  const lite = query.render === "lite";
  // Static Lite (docs/performance/STATIC-LITE-INTEGRATION.md): Lite is the flattened scene, LabSceneStatic. The layered
  // Lite scene it is baked from (LabScene `lite`) stays reachable on a development server only, as the bake's source:
  // `?render=lite&lite=layered` (scripts/static-lite/bake.mjs). In production that parameter is ignored.
  const layeredLite = lite && query.lite === "layered" && process.env.NODE_ENV === "development";
  // M1.4G's floor tone (towards the approved atmosphere). M1.4K.10: approved as Cinematic's default; Lite keeps the
  // untoned floor. `?floor=approved` / `?floor=original` choose either explicitly in Cinematic. Static Lite has one,
  // untoned, floor: there `floor` has no effect, but stays in the URL (it applies again on switching to Cinematic).
  const floorTone = query.floor === "approved" ? true : query.floor === "original" ? false : !lite;

  return (
    <>
      <a
        href="#lab-stations"
        className="sr-only z-50 rounded-md bg-lab-ink px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        Skip to lab stations
      </a>
      {/* M1.4K.5B: Cinematic / Lite, in the header's row (clear of every station, label and chip).
          M1.4N.2: on narrow and portrait screens CSS swaps this header (a display: contents wrapper, so nothing
          changes on desktop) for LabCompactHeader. */}
      <div className="lab-desktop-header contents">
        <SiteHeader activeHref="/" utilities={<RenderModeSelector mode={lite ? "lite" : "full"} />} />
      </div>
      <LabCompactHeader mode={lite ? "lite" : "full"} />
      {/* M1.4N.2: data-lab-mobile scopes the mobile rules (globals.css) to this page; the homepage has no such attribute. */}
      <main data-lab-mobile="" className="relative h-svh w-full overflow-hidden bg-lab-ink">
        <LabStateProvider initial={initial}>
          {lite && !layeredLite ? <LabSceneStatic /> : <LabScene variant="v2" floorTone={floorTone} lite={lite} />}
          {/* M1.4L.2: "Open project" links to the projects that have a page; the view parameters go with it. */}
          <LabHero projectPages={labV2ProjectPages(labViewQuery(query))} />
          <ExploreCue />
          {/* M1.4N.2: the five stations, in station mode (portrait) only. */}
          <LabStationDock />
        </LabStateProvider>
      </main>
    </>
  );
}
