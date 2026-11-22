import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A separate build directory lets an experimental build (M1.3H:
  // NEXT_PUBLIC_PLAYGROUND_LAYERED=on) be served next to the default one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
