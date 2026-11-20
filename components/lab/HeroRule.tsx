import { u } from "@/lib/scene";

/** Amber rule under the hero heading, shared with the station information. */
export function HeroRule({ marginTop }: { marginTop: number }) {
  return (
    <span
      aria-hidden="true"
      className="block rounded-full"
      style={{
        marginTop: u(marginTop),
        width: u(60),
        height: u(3),
        background: "linear-gradient(90deg, #ffd88e, #f7b25c 60%, rgb(247 178 92 / 0))",
        boxShadow: `0 0 ${u(8)} rgb(255 170 80 / 0.55)`,
      }}
    />
  );
}
