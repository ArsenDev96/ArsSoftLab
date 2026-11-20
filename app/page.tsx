import { ExploreCue } from "@/components/lab/ExploreCue";
import { LabHero } from "@/components/lab/LabHero";
import { LabScene } from "@/components/lab/LabScene";
import { LabStateProvider } from "@/components/lab/LabState";
import { SiteHeader } from "@/components/ui/SiteHeader";

export default function LabPage() {
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
        <LabStateProvider>
          <LabScene />
          <LabHero />
          <ExploreCue />
        </LabStateProvider>
      </main>
    </>
  );
}
