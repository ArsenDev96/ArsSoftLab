import { ExploreCue } from "@/components/lab/ExploreCue";
import { LabHero } from "@/components/lab/LabHero";
import { LabScene } from "@/components/lab/LabScene";
import { LabStateProvider } from "@/components/lab/LabState";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { PROJECT_PARAM, resolveLabLocation, STATION_PARAM } from "@/lib/lab-url";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * A deep link (`/?station=…&project=…`) is resolved here, on the server, so
 * the page is rendered already in that state: no flash of the default lab,
 * no camera move on load and nothing for hydration to disagree about.
 */
export default async function LabPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const initial = resolveLabLocation(query[STATION_PARAM], query[PROJECT_PARAM]);

  return (
    <>
      <a
        href="#lab-stations"
        className="sr-only z-50 rounded-md bg-lab-ink px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        Skip to lab stations
      </a>
      <SiteHeader activeHref="/" />
      <main className="relative h-svh w-full overflow-hidden bg-lab-ink">
        <LabStateProvider initial={initial}>
          <LabScene />
          <LabHero />
          <ExploreCue />
        </LabStateProvider>
      </main>
    </>
  );
}
