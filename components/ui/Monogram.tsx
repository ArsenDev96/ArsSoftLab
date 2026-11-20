import { useId, type SVGProps } from "react";

/**
 * The ArsSoftLab "A" monogram as drawn in the reference header:
 * a capped apex, split right leg, dripping crossbar and a small node.
 */
export function Monogram(props: SVGProps<SVGSVGElement>) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 48 46" fill="none" aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={gradientId} x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffbf6a" />
          <stop offset="1" stopColor="#ef9440" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${gradientId})`} strokeWidth={4.1} strokeLinecap="round" strokeLinejoin="round">
        {/* apex cap */}
        <path d="M21.6 8.6h6.6" strokeWidth={4.6} />
        {/* left leg */}
        <path d="M23.4 9.6 8 39.6" />
        {/* right leg, upper and lower segments */}
        <path d="M27.4 9.6 34.6 26.6" />
        <path d="M36.2 31.4 40.6 39.6" />
        {/* crossbar with drip */}
        <path d="M17.8 30.4c4.4-.3 10.4-1.4 16.6-2.2" />
        <path d="M23.2 30.4c.9 1.4 1.4 2.6 1.6 3.6" strokeWidth={2.6} />
      </g>
      <circle cx="40.4" cy="29" r="1.9" fill={`url(#${gradientId})`} />
    </svg>
  );
}
