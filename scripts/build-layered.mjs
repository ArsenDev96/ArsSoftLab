#!/usr/bin/env node
// M1.3I: build the experimental 2.5D scene (NEXT_PUBLIC_LAB_LAYERED=on) into
// .next-layered/ (git-ignored), beside the default .next/ build. Next.js adds
// that folder to tsconfig.json's `include` while building; the tracked
// tsconfig.json is restored afterwards (next-env.d.ts is restored by the
// next default build).
//
//   npm run build:layered
//   NEXT_DIST_DIR=.next-layered npx next start -p 3001

import { copyFileSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";

copyFileSync("tsconfig.json", "tsconfig.json.layered-bak");
let status = 1;
try {
  const r = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NEXT_DIST_DIR: ".next-layered", NEXT_PUBLIC_LAB_LAYERED: "on" },
  });
  status = r.status ?? 1;
} finally {
  renameSync("tsconfig.json.layered-bak", "tsconfig.json");
}
process.exit(status);
