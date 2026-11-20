import type { CSSProperties, ReactNode } from "react";

/**
 * A full-frame layer of the lab scene.
 *
 * `depth` (0 = far wall, 1 = nearest the camera) is exposed as the CSS
 * variable `--layer-depth` so M1.2 can drive parallax and camera moves from
 * a single transform on each layer without touching its contents.
 */
export function SceneLayer({
  name,
  depth,
  className = "",
  style,
  children,
}: {
  name: string;
  depth: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      data-layer={name}
      className={`absolute inset-0 ${className}`}
      style={{ ["--layer-depth" as string]: depth, ...style }}
    >
      {children}
    </div>
  );
}
