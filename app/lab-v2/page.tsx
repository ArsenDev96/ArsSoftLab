import type { Metadata } from "next";
import { ExploreCue } from "@/components/lab/ExploreCue";
import { LabHero } from "@/components/lab/LabHero";
import { LabScene } from "@/components/lab/LabScene";
import { LabStateProvider } from "@/components/lab/LabState";
import { RenderModeSelector } from "@/components/lab/RenderModeSelector";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { PROJECT_PARAM, resolveLabLocation, STATION_PARAM } from "@/lib/lab-url";

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
  // M1.4G (optional, until reviewed): `?floor=approved` tones the v2 floor towards the approved atmosphere.
  const floorTone = query.floor === "approved";
  // M1.4K.4 (prototype): `?render=lite` is a lighter rendering for software compositing and weak GPUs. Full is the default.
  const lite = query.render === "lite";

  return (
    <>
      <a
        href="#lab-stations"
        className="sr-only z-50 rounded-md bg-lab-ink px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        Skip to lab stations
      </a>
      {/* M1.4K.5B: Cinematic / Lite, in the header's row (clear of every station, label and chip). */}
      <SiteHeader activeHref="/" utilities={<RenderModeSelector mode={lite ? "lite" : "full"} />} />
      <main className="relative h-svh w-full overflow-hidden bg-lab-ink">
        <LabStateProvider initial={initial}>
          <LabScene variant="v2" floorTone={floorTone} lite={lite} />
          <LabHero />
          <ExploreCue />
        </LabStateProvider>
      </main>
    </>
  );
}
