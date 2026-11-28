import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A separate build directory lets an experimental build (M1.3H:
  // NEXT_PUBLIC_PLAYGROUND_LAYERED=on) be served next to the default one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // M1.4R: Cinematic scene artwork may be reused from the browser cache for a day instead of being
  // revalidated on every visit. Safe only while a changed image gets a new path and files under
  // public/scene/v2 are never overwritten in place (docs/m1.4l/SCENE-CACHE-PROTOTYPE.md). Static Lite
  // (public/scene/static-lite, re-baked in place) and every other path keep Next's default.
  // Production only: `next dev` keeps the default, so artwork rewritten during iteration shows on reload.
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/scene/v2/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
