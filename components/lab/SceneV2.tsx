import type { CSSProperties } from "react";
import { SCENE, u } from "@/lib/scene";
import { ArcadeScreen } from "./ArcadeScreen";
import { EngineeringFloor, EngineeringV2 } from "./EngineeringV2";
import { V2_ENVIRONMENT, V2_OBJECTS, V2_PLAYGROUND_SCREEN, type V2Object } from "./scene-v2-data";

/**
 * M1.4D (experimental, /lab-v2 only): the lab assembled from independent
 * layers instead of the approved plate.
 *
 *   environment   public/scene/v2/environment/lab-background.png (no stations)
 *   shadows       one soft contact ellipse under each base (.lab-v2-shadow);
 *                 floor-anchored, so Playground's stays put when it lifts
 *   objects       the five stations and the central A, back to front, each
 *                 the full-frame PNG with one uniform scale and a translation
 *                 fitted to the approved base (scripts/v2-fit.py). M1.4E: the
 *                 central A is the approved one, recovered from the plate
 *   foreground    M1.4E: books, mug and table, steam and the lower-right plant,
 *                 recovered from the plate, in front of everything, static
 *
 * Playground sits in the existing lift wrapper (.lab-lift[data-lift]), so the
 * existing hover lift (18 px, x1.01, after the energy's arrival) and the
 * reduced-motion rules apply unchanged; its arcade screen rides with it,
 * aimed at the new cabinet's screen. Nothing here is used by the homepage.
 */

const FRAME = { x: 0, y: 0, w: SCENE.width, h: SCENE.height };

function place(o: V2Object): CSSProperties {
  return {
    left: 0,
    top: 0,
    width: u(SCENE.width),
    height: u(SCENE.height),
    transformOrigin: "0 0",
    transform: `translate(${u(o.tx)}, ${u(o.ty)}) scale(${o.scale})`,
  };
}

function Layer({ o }: { o: V2Object }) {
  // eslint-disable-next-line @next/next/no-img-element -- full-frame layer, placed in scene px, no optimisation
  return <img src={o.src} alt="" draggable={false} data-gate="" data-v2-object={o.id} className="absolute max-w-none select-none" style={place(o)} />;
}

/**
 * M1.4G: the floor's own lighting and grounding (scripts/m14g-floor.py), all
 * floor-anchored and under every station, so each station occludes its ring
 * and reflection as the approved artwork does:
 *   floor-light   the approved floor rings around the five bases (extracted
 *                 along fitted ellipses) and the four static stations'
 *                 reflections in the polished floor (plus-lighter)
 *   contact       a restrained contact shadow along each recovered station's
 *                 own bottom edge (replaces M1.4D's generic ellipses)
 *   tone          optional (?floor=approved): the v2 floor brought towards the
 *                 approved one's darker, warmer atmosphere (multiply, floor
 *                 mask only: no architecture, windows or mountains)
 * Playground's reflection (PlaygroundReflection) drops with its lift.
 *
 * M1.4G.1 (scripts/m14g-floor.py, /scene/v2/m14g1): Playground's floor light
 * follows its power. Its reflection at rest has no strip in it (the strip's
 * reflection only comes with the powered strips), its ring is unlit metal
 * until the energy arrives (PlaygroundRing), and the room's lamp reflection
 * just in front of its base is occluded by the station (playground-occlusion).
 * Floor light keeps the approved hue (no cyan subtraction residue): the
 * floor-light layer, and Creative Studio's own light layer at its strip end.
 */
const M14G = "/scene/v2/m14g";
const M14G1 = "/scene/v2/m14g1";
/**
 * M1.4H.1: Engineering powers on (EngineeringV2). Its share of the floor light
 * (ring, spill, reflections) follows its strips (EngineeringFloor), so the
 * floor light is M1.4G.1's without that share (every other pixel identical).
 */
const M14H1 = "/scene/v2/m14h1";
const FLOOR_TONE = "rgb(236 222 212)";

function FloorLayer({ src, name, blend }: { src: string; name: string; blend?: CSSProperties["mixBlendMode"] }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- full-frame floor layer at the scene's geometry
    <img
      src={src}
      alt=""
      draggable={false}
      data-gate=""
      data-v2-floor={name}
      className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
      style={blend ? { mixBlendMode: blend } : undefined}
    />
  );
}

function FloorTone() {
  const mask = `url(${M14G}/floor-mask.png)`;
  return (
    <div
      aria-hidden="true"
      data-v2-floor="tone"
      className="pointer-events-none absolute inset-0"
      style={{ background: FLOOR_TONE, mixBlendMode: "multiply", maskImage: mask, WebkitMaskImage: mask, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
    />
  );
}

/**
 * M1.4G.1: what follows Playground's power uses the strips' own timing (the
 * unpowered-strip overlay, PG_STRIP_CSS): up when the energy arrives
 * (--arrive-now), down 160 ms after the pointer leaves.
 */
const PG_POWER_CSS =
  ".lab-v2-power-lit{opacity:0;transition:opacity 240ms var(--ease-glow) 160ms}" +
  ':is([data-lab-hover="playground"],[data-lab-selected="playground"]) .lab-v2-power-lit{opacity:1;transition:opacity 260ms var(--ease-glow) var(--arrive-now)}';

/**
 * M1.4G: Playground's reflection, on the floor under the station. A point h px
 * above the floor is mirrored h px below it, so as the station rises the
 * reflection drops by the same amount (18 px at full lift, on the lift's own
 * progress --lp) and fades a little with the distance. The strips' share
 * (-lit) comes up with the strips themselves (when the energy arrives) and
 * goes with them. The whole group adds its light (plus-lighter).
 */
const PG_REFLECTION_MOTION: CSSProperties = { transform: "translateY(calc(var(--u) * 18 * var(--lp)))", opacity: "calc(1 - 0.3 * var(--lp))" };

function PlaygroundReflection() {
  return (
    <>
      <style>{PG_POWER_CSS}</style>
      {/* M1.4G.1: the station's mirrored silhouette dims the room's lamp reflection just in front of its base. */}
      <div aria-hidden="true" data-zone="playground" data-depth="playground" data-v2-occlusion="playground" className="lab-depth pointer-events-none absolute inset-0" style={PG_REFLECTION_MOTION}>
        <FloorLayer src={`${M14G1}/playground-occlusion.png`} name="playground-occlusion" />
      </div>
      <div
        aria-hidden="true"
        data-zone="playground"
        data-depth="playground"
        data-v2-reflection="playground"
        className="lab-depth pointer-events-none absolute inset-0"
        style={{ ...PG_REFLECTION_MOTION, mixBlendMode: "plus-lighter" }}
      >
        <FloorLayer src={`${M14G1}/playground-reflection.png`} name="playground-reflection" />
        {/* plus-lighter on the fading span itself (its opacity isolates it), so it adds to the rest reflection */}
        <span className="lab-v2-power-lit absolute inset-0" style={{ mixBlendMode: "plus-lighter" }}>
          <FloorLayer src={`${M14G1}/playground-reflection-lit.png`} name="playground-reflection-lit" />
        </span>
      </div>
    </>
  );
}

/**
 * M1.4G.1: Playground's floor ring, fixed to the floor (it never lifts): unlit
 * metal at rest, its amber added when the energy arrives, with the strips.
 */
function PlaygroundRing() {
  return (
    <div aria-hidden="true" data-zone="playground" data-v2-ring="playground" className="pointer-events-none absolute inset-0">
      <FloorLayer src={`${M14G1}/playground-ring.png`} name="playground-ring" blend="plus-lighter" />
      <span className="lab-v2-power-lit absolute inset-0" style={{ mixBlendMode: "plus-lighter" }}>
        <FloorLayer src={`${M14G1}/playground-ring-lit.png`} name="playground-ring-lit" />
      </span>
    </div>
  );
}

/**
 * M1.4E: recovered from the approved artwork (scripts/m14e-extract.py), full
 * frame at the plate's own geometry, so no transform. `light` layers hold
 * light only (rings, glows, reflection, steam) and are added to what is
 * beneath them (plus-lighter), so no plate floor is pasted onto the v2 floor.
 * No connection is in any of them (cut from the line-free plate).
 */
const M14E = "/scene/v2/m14e";
const HUB = [
  { src: `${M14E}/hub.png`, light: false },
  { src: `${M14E}/hub-light.png`, light: true },
];
const FOREGROUND = [
  { id: "steam", src: `${M14E}/fg-steam.png`, light: true },
  { id: "table", src: `${M14E}/fg-table.png`, light: false },
  { id: "plant", src: `${M14E}/fg-plant.png`, light: false },
];

/**
 * M1.4F: Creative Studio and Experience recovered from the approved artwork
 * (scripts/m14f-extract.py): the approved camera angle, platform depth,
 * stone, objects and lit strips, full frame at the plate's geometry like the
 * hub. `-light` is the strips' approved light on the floor, added
 * (plus-lighter). They replace the generated station images (files untouched)
 * in the same depth order; the generic contact ellipse stays under each.
 */
const M14F = "/scene/v2/m14f";
/**
 * M1.4F.1: Engineering and Educational, recovered the same way
 * (scripts/m14f1-extract.py). Their holograms (the chart and cube, the globe,
 * its glow and the orbit) are split into a solid part (in the station layer)
 * and their light (in `-light`, with the strips' floor light), so the v2 room
 * shows through the glass. The recovered Engineering has no baked code icon:
 * the HTML icon is the only one.
 */
const M14F1 = "/scene/v2/m14f1";
const RECOVERED_STATIONS: Partial<Record<V2Object["id"], string>> = {
  creative: `${M14F}/creative`,
  experience: `${M14F}/experience`,
  engineering: `${M14F1}/engineering`,
  educational: `${M14F1}/educational`,
};
/** M1.4G.1: Creative Studio's light layer with its strip end's cyan subtraction residue re-hued (M1.4F's file untouched). */
const RECOVERED_LIGHT: Partial<Record<V2Object["id"], string>> = { creative: `${M14G1}/creative-light.png` };

function Recovered({ src, light, name }: { src: string; light: boolean; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- full-frame layer at the plate's geometry, no optimisation
    <img
      src={src}
      alt=""
      draggable={false}
      data-gate=""
      data-v2-recovered={name}
      className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
      style={light ? { mixBlendMode: "plus-lighter" } : undefined}
    />
  );
}

/**
 * M1.4E.1: Playground's grounding, on the floor (never lifted). Both ellipses
 * are the base's measured footprint (its ground contour fitted as an ellipse,
 * scripts/m14e1-playground.py: centre 1217.5, 522.8; radii 157, 23.7; mean
 * error 0.3 px) and follow the lift's own progress --lp (0 at rest, 1 lifted;
 * the lift's curve and arrival delay; held at 0 with reduced motion):
 *   contact   a thin dark rim just under the base's ground edge; eases off
 *             as the station leaves the floor
 *   ambient   soft occlusion under the platform that spreads (wider, deeper)
 *             and darkens with height, densest under the base, so the open
 *             gap darkens towards the platform and the floor stays visible
 */
const PG_FOOT = { cx: 1217.5, cy: 522.8, rx: 157, ry: 23.7 };

function PlaygroundGround() {
  const f = PG_FOOT;
  const ell = (rx: number, ry: number, cy: number): CSSProperties => ({ left: u(f.cx - rx), top: u(cy - ry), width: u(2 * rx), height: u(2 * ry) });
  return (
    <div aria-hidden="true" data-zone="playground" data-depth="playground" className="lab-depth pointer-events-none absolute inset-0" data-v2-ground="playground">
      <div
        className="lab-v2-shadow lab-v2-shadow-ambient absolute"
        style={{
          ...ell(f.rx, f.ry, f.cy),
          transformOrigin: "50% 50%",
          transform: "translateY(calc(var(--u) * 3 * var(--lp))) scale(calc(0.96 + 0.12 * var(--lp)), calc(0.85 + 0.62 * var(--lp)))",
          opacity: "calc(0.9 * var(--lp))",
          background: "radial-gradient(closest-side, rgb(6 4 3 / 0.9), rgb(6 4 3 / 0.8) 40%, rgb(6 4 3 / 0.5) 68%, rgb(6 4 3 / 0.2) 86%, transparent)",
        }}
      />
      <div
        className="lab-v2-shadow lab-v2-shadow-contact absolute"
        style={{
          ...ell(f.rx + 3, f.ry + 2.5, f.cy + 1.5),
          opacity: "calc(0.9 - 0.6 * var(--lp))",
          background: "radial-gradient(closest-side, transparent 86%, rgb(5 3 2 / 0.6) 92%, rgb(5 3 2 / 0.35) 96%, transparent)",
        }}
      />
    </div>
  );
}

/**
 * M1.4E.1: Playground's strips as they look unpowered (derived from the
 * station asset itself), over the lit strips; they fade out only once the
 * energy has arrived (--arrive-now, set on the lift wrapper), so the order is
 * A -> spark -> line charges -> strips light -> station rises. On leave the
 * station lowers first, then the strips go dark.
 */
const PG_STRIP_OFF = "/scene/v2/m14e1/playground-strip-off.png";
const PG_STRIP_CSS =
  ".lab-v2-strip-off{opacity:1;transition:opacity 240ms var(--ease-glow) 160ms}" +
  ':is([data-lab-hover="playground"],[data-lab-selected="playground"]) .lab-v2-strip-off{opacity:0;transition:opacity 260ms var(--ease-glow) var(--arrive-now)}';

export function SceneV2({ floorTone = false }: { floorTone?: boolean } = {}) {
  return (
    <div className="absolute inset-0" data-scene-variant="v2">
      {/* eslint-disable-next-line @next/next/no-img-element -- the environment at the scene's own geometry */}
      <img
        src={V2_ENVIRONMENT}
        alt="A cinematic stone laboratory at dusk: snow-capped mountains through tall arched windows, five stone platforms arranged around a glowing A monogram."
        draggable={false}
        data-gate=""
        className="absolute inset-0 h-full w-full max-w-none select-none"
      />
      {/* M1.4G: the floor's tone (optional), rings and reflections, contact shadows. The hub carries its approved contact. */}
      {floorTone && <FloorTone />}
      <FloorLayer src={`${M14H1}/floor-light.png`} name="light" blend="plus-lighter" />
      <EngineeringFloor />
      <PlaygroundRing />
      <PlaygroundReflection />
      <FloorLayer src={`${M14G}/contact.png`} name="contact" />
      {/* M1.4E.1: Playground's own height-responsive grounding. */}
      <PlaygroundGround />
      {V2_OBJECTS.map((o) =>
        o.id === "hub" ? (
          // M1.4E: the approved central A replaces the generated one, in the same depth order.
          <div key={o.id} className="pointer-events-none absolute inset-0" data-v2-hub="recovered">
            {HUB.map((l, i) => (
              <Recovered key={i} src={l.src} light={l.light} name={l.light ? "hub-light" : "hub"} />
            ))}
          </div>
        ) : o.id === "playground" ? (
          <div
            key={o.id}
            className="lab-lift pointer-events-none absolute inset-0"
            data-lift="playground"
            style={{ transformOrigin: `${u(o.base.cx)} ${u(o.base.bottom)}` }}
          >
            <Layer o={o} />
            <style>{PG_STRIP_CSS}</style>
            {/* eslint-disable-next-line @next/next/no-img-element -- the station's own frame, placed like the station */}
            <img src={PG_STRIP_OFF} alt="" draggable={false} data-gate="" className="lab-v2-strip-off absolute max-w-none select-none" style={place(o)} />
            <div aria-hidden="true" data-zone="playground" className="lab-activation pointer-events-none absolute inset-0">
              <ArcadeScreen id="playground" quad={V2_PLAYGROUND_SCREEN} box={FRAME} />
            </div>
          </div>
        ) : o.id === "engineering" ? (
          // M1.4H.1: the recovered Engineering, split so it can power on.
          <EngineeringV2 key={o.id} />
        ) : RECOVERED_STATIONS[o.id] ? (
          <div key={o.id} className="pointer-events-none absolute inset-0" data-v2-station={o.id} data-v2-station-source="approved">
            <Recovered src={`${RECOVERED_STATIONS[o.id]}.png`} light={false} name={o.id} />
            <Recovered src={RECOVERED_LIGHT[o.id] ?? `${RECOVERED_STATIONS[o.id]}-light.png`} light name={`${o.id}-light`} />
          </div>
        ) : (
          <Layer key={o.id} o={o} />
        ),
      )}
      {/* M1.4E: foreground details from the approved artwork, in front of every station; they never move. */}
      <div className="pointer-events-none absolute inset-0" data-v2-foreground="">
        {FOREGROUND.map((l) => (
          <Recovered key={l.id} src={l.src} light={l.light} name={l.id} />
        ))}
      </div>
    </div>
  );
}
