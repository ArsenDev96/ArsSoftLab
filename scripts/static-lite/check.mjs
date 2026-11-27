// Lite's flattened scene: are its six images still current?
//   node scripts/static-lite/check.mjs           exit 0 if current; 1 (with the reasons) if an image or a source changed
//   node scripts/static-lite/check.mjs --list    the sources being watched
//   node scripts/static-lite/check.mjs --write   after a bake: record the sources' fingerprints and the commit
//
// Lite (LabSceneStatic) shows images baked from the layered Lite scene (`?render=lite&lite=layered`, development only;
// see bake.mjs). They go stale when what that scene draws changes. Watched:
//   artwork   every file under public/scene/v2/
//   code      SceneV2, ChargeLine and EnergySurge (the layered scene's three layers) and the modules they import from
//             this repo, followed recursively; plus LabScene.tsx itself (the stage; not its imports, which are mostly
//             the homepage's plate scene)
// Not watched: app/globals.css (shared with the whole site; a change there to a scene class needs a manual re-bake),
// and the modules in SKIP (state, URLs, camera shots and project text: nothing drawn in the resting scene).
// Node and the file system only: no browser, nothing at build time. Text files are hashed with LF line endings, so a
// Windows checkout (CRLF) and a Unix one agree.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST = join(ROOT, "components", "lab", "static-lite-manifest.json");
const ASSETS = join(ROOT, "public", "scene", "static-lite");
const ENTRY = ["components/lab/SceneV2.tsx", "components/lab/ChargeLine.tsx", "components/lab/EnergySurge.tsx"];
const ALSO = ["components/lab/LabScene.tsx"];
/** Imported by the scene for state, URLs, the camera or project text, but draw nothing in it: not followed. */
const SKIP = new Set(["components/lab/LabState.tsx", "data/projects.ts", "lib/lab-url.ts", "lib/camera.ts"]);
const ARTWORK = "public/scene/v2";
const TEXT = /\.(tsx?|mjs|js|json|css)$/;

const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const hashFile = (p) => { const b = readFileSync(join(ROOT, p)); return sha(TEXT.test(p) ? Buffer.from(b.toString("utf8").replace(/\r\n/g, "\n")) : b); };

function resolve(from, spec) {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? join(ROOT, dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"]) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return rel(p);
  }
  return null;
}
function code() {
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f) || SKIP.has(f)) return;
    seen.add(f);
    for (const m of readFileSync(join(ROOT, f), "utf8").matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g)) {
      const r = resolve(f, m[1]);
      if (r && !r.endsWith(".json")) walk(r);
    }
  };
  ENTRY.forEach(walk);
  ALSO.forEach((f) => seen.add(f));
  return [...seen];
}
function artwork(dir = join(ROOT, ARTWORK)) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? artwork(join(dir, e.name)) : [rel(join(dir, e.name))]));
}
const sources = () => Object.fromEntries([...code(), ...artwork()].sort().map((p) => [p, hashFile(p)]));

const args = process.argv.slice(2);
if (args.includes("--list")) {
  const c = code().sort(), a = artwork();
  console.log(`${c.length} code files:\n  ${c.join("\n  ")}\n${a.length} artwork files under ${ARTWORK}/`);
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
if (args.includes("--write")) {
  manifest.source.commit = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
  manifest.sources = sources();
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Recorded ${Object.keys(manifest.sources).length} sources at ${manifest.source.commit.slice(0, 7)}.`);
  process.exit(0);
}

const problems = [];
for (const [file, a] of Object.entries(manifest.assets)) {
  const p = join(ASSETS, file);
  if (!existsSync(p)) problems.push(`missing image: public/scene/static-lite/${file}`);
  else if (sha(readFileSync(p)) !== a.sha256) problems.push(`image changed since the bake: public/scene/static-lite/${file}`);
}
const now = sources(), then = manifest.sources;
for (const [p, h] of Object.entries(now)) if (!(p in then)) problems.push(`new source: ${p}`); else if (then[p] !== h) problems.push(`source changed: ${p}`);
for (const p of Object.keys(then)) if (!(p in now)) problems.push(`source removed: ${p}`);

if (!problems.length) {
  console.log(`Lite's static images are current (${Object.keys(manifest.assets).length} images, ${Object.keys(now).length} sources, baked at ${manifest.source.commit.slice(0, 7)}).`);
  process.exit(0);
}
console.error(`Lite's static images may be stale:\n  ${problems.join("\n  ")}\n\nRe-bake them (scripts/static-lite/README.md), review the result, then run with --write.`);
process.exit(1);
