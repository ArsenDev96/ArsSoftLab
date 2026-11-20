import { MouseIcon } from "@/components/ui/icons";
import { u } from "@/lib/scene";

/** Bottom-centre "Explore the Lab" cue. Becomes the scroll/camera trigger in M1.2. */
export function ExploreCue() {
  const rule = (side: "left" | "right", width: number) => (
    <span
      aria-hidden="true"
      className="absolute top-1/2 block -translate-y-1/2"
      style={{
        [side === "left" ? "right" : "left"]: `calc(100% + ${u(side === "left" ? 43 : 42)})`,
        width: u(width),
        height: u(1.5),
        background: `linear-gradient(${side === "left" ? "90deg" : "270deg"}, rgb(255 255 255 / 0.15), rgb(255 255 255 / 0.6))`,
      }}
    />
  );

  return (
    <a
      href="#lab-stations"
      className="lab-explore lab-transition absolute z-20 flex -translate-x-1/2 flex-col items-center rounded-lg text-lab-text hover:text-amber-glow"
      style={{ left: `calc(50% + ${u(2.5)})`, bottom: u(54.5) }}
    >
      <MouseIcon style={{ width: u(22.5), height: u(35), translate: `${u(-1)} 0` }} />
      <span className="relative whitespace-nowrap" style={{ marginTop: u(11), fontSize: u(15.5), lineHeight: u(18.6) }}>
        {rule("left", 64)}
        Explore the Lab
        {rule("right", 74)}
      </span>
    </a>
  );
}
