import type { SVGProps } from "react";

/**
 * Inline line icons matching the reference's rounded 1.6px stroke style.
 * All icons are decorative (aria-hidden); the surrounding control carries
 * the accessible name.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.2 12 3.8l8 6.4V19a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19z" />
      <path d="M9.4 20.6v-4.3a2.6 2.6 0 0 1 5.2 0v4.3" />
    </Svg>
  );
}

export function ProjectsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 6.2c0-.9.7-1.6 1.6-1.6h3.1c1.2 0 2.2.7 2.8 1.6.6-.9 1.6-1.6 2.8-1.6h3.1c.9 0 1.6.7 1.6 1.6v12.2c0 .9-.7 1.6-1.6 1.6H6.1c-.9 0-1.6-.7-1.6-1.6z" />
      <path d="M12 6.2v4.6" />
    </Svg>
  );
}

export function ExperienceIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="7" width="16" height="13" rx="3" />
      <path d="M9 7V5.6c0-.9.7-1.6 1.6-1.6h2.8c.9 0 1.6.7 1.6 1.6V7" />
      <path d="M9 11.2h6M12 11.2v5.2" />
    </Svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20.2c.6-3.6 3.6-6 7.5-6s6.9 2.4 7.5 6" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.6 15.6 4.6 4.6" />
    </Svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 3.5 3 10.6l7.2 2.6 2.6 7.3z" />
      <path d="M10.2 13.2 21 3.5" />
    </Svg>
  );
}

export function MouseIcon(props: IconProps) {
  return (
    <Svg viewBox="0 0 16 24" strokeWidth={1.3} {...props}>
      <rect x="1.2" y="1.2" width="13.6" height="21.6" rx="6.8" />
      <path d="M8 1.6v7.2M1.4 9h13.2" />
    </Svg>
  );
}

/* --------------------------------------------------------------------------
   Station icons
-------------------------------------------------------------------------- */

export function CapIcon(props: IconProps) {
  return (
    <Svg viewBox="0 0 48 36" strokeWidth={3.1} {...props}>
      <path d="M3 13.5 24 4l21 9.5L24 23z" />
      <path d="M11 17.4v8.4c0 2.7 5.8 5.2 13 5.2s13-2.5 13-5.2v-8.4" />
      <path d="M45 13.5v9" />
    </Svg>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <Svg viewBox="0 0 48 34" strokeWidth={3.2} {...props}>
      <path d="M13 7 3 17l10 10" />
      <path d="M35 7l10 10-10 10" />
      <path d="M28 3 20 31" />
    </Svg>
  );
}

export function GamepadIcon(props: IconProps) {
  return (
    <Svg viewBox="0 0 48 36" strokeWidth={3.1} {...props}>
      <path d="M13.5 5h21c5 0 9.2 3.5 10.1 8.4l1.7 9.5c.7 4.1-3 7.6-7 6.5a6 6 0 0 1-2.9-1.8L33 24H15l-3.4 3.6a6 6 0 0 1-2.9 1.8c-4 1.1-7.7-2.4-7-6.5l1.7-9.5C4.3 8.5 8.5 5 13.5 5z" />
      <path d="m14.5 11 3.5 3.5-3.5 3.5-3.5-3.5z" />
      <path d="m33.5 11 3.5 3.5-3.5 3.5-3.5-3.5z" />
    </Svg>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <Svg viewBox="0 0 40 40" strokeWidth={3} {...props}>
      <path d="M20 3.5C10.2 3.5 3 10.7 3 19.7 3 28.9 10.4 36.5 19 36.5c2.6 0 3.6-1.7 3.6-3.3 0-1.2-.6-2-1.1-2.7-.5-.7-.9-1.3-.9-2.2 0-1.8 1.4-3 3.2-3H28c5.3 0 9-3.6 9-8.5C37 9.8 29.6 3.5 20 3.5z" />
      <circle cx="11.5" cy="20" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="12.4" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="21.5" cy="9.6" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="28.8" cy="13" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function BriefcaseIcon(props: IconProps) {
  return (
    <Svg viewBox="0 0 40 36" strokeWidth={3} {...props}>
      <rect x="3" y="9.5" width="34" height="24" rx="3.5" />
      <path d="M14 9.5V6.2c0-1.5 1.2-2.7 2.7-2.7h6.6c1.5 0 2.7 1.2 2.7 2.7v3.3" />
      <path d="M3 19.5h13.5M23.5 19.5H37" />
      <rect x="16.5" y="17" width="7" height="5.4" rx="1.2" />
    </Svg>
  );
}
