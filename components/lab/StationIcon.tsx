import type { CSSProperties } from "react";
import { BriefcaseIcon, CapIcon, CodeIcon, GamepadIcon, PaletteIcon } from "@/components/ui/icons";
import type { StationAccent, StationIconName } from "@/data/zones";
import { u } from "@/lib/scene";

const ICONS = {
  cap: { Icon: CapIcon, w: 46, h: 34.5 },
  code: { Icon: CodeIcon, w: 47, h: 33 },
  gamepad: { Icon: GamepadIcon, w: 46, h: 34.5 },
  palette: { Icon: PaletteIcon, w: 39, h: 39 },
  briefcase: { Icon: BriefcaseIcon, w: 39, h: 35 },
} as const;

const ACCENTS: Record<StationAccent, { color: string; glow: string }> = {
  amber: { color: "#ffc66e", glow: "rgb(255 170 70 / 0.75)" },
  cyan: { color: "#62ecfa", glow: "rgb(60 220 245 / 0.85)" },
  violet: { color: "#ee8cf7", glow: "rgb(220 90 245 / 0.85)" },
};

export function StationIcon({
  name,
  accent,
  style,
}: {
  name: StationIconName;
  accent: StationAccent;
  style?: CSSProperties;
}) {
  const { Icon, w, h } = ICONS[name];
  const { color, glow } = ACCENTS[accent];
  return (
    <Icon
      style={{
        width: u(w),
        height: u(h),
        color,
        filter: `drop-shadow(0 0 ${u(2)} ${glow}) drop-shadow(0 0 ${u(6)} ${glow})`,
        ...style,
      }}
    />
  );
}
