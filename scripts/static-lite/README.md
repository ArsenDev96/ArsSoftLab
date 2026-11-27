# Lite's static images

Lite mode (`/lab-v2?render=lite`, `components/lab/LabSceneStatic.tsx`) draws the laboratory from six images in `public/scene/static-lite/`:
- `plate.webp`: the whole scene at rest;
- `on-<station>.webp`: each station's powered pixels.

They are baked from the layered Lite scene. The manifest, `components/lab/static-lite-manifest.json`, records their checksums, sprite boxes, the source commit and the fingerprints of every source they depend on.

## Is a re-bake needed?

```bash
npm run static-lite:check
```

- **Exit 0:** the images are current.
- **Exit 1:** it lists what changed.
  - A changed **image**: the image file itself was edited.
  - A changed **source**: artwork under `public/scene/v2/`, or the code that composes the layered scene (`--list` shows all of it).

It needs Node only and reads files only: no browser, and it is not part of `next build`. Run it before committing scene changes, or in CI.

**Not watched:**
- `app/globals.css`, which is shared site-wide. A change there to a scene class needs a manual re-bake.
- State, URL, camera and project-text modules, which draw nothing in the resting scene.

## Re-baking (development only; never automatic)

1. Start a development server. The layered source scene, `/lab-v2?render=lite&lite=layered`, exists only in development:

   ```bash
   npx next dev -p 3002
   ```

2. Capture the layered scene at 1672 × 941, at rest and with each station powered. This needs Chrome (`scripts/visual/cdp.mjs`):

   ```bash
   node scripts/static-lite/bake.mjs
   ```

3. Build the images (Python, with Pillow and NumPy), then record the sources and the commit:

   ```bash
   python scripts/static-lite/bake.py
   node scripts/static-lite/check.mjs --write
   ```

4. Review the result against the layered scene before committing: rest, each station hovered, and a selection. New images change Lite's appearance and need the same approval as artwork.

**To test the bake without touching the approved images:**

```bash
python scripts/static-lite/bake.py --out <temp dir>
```

It prints the checksums to compare with the manifest. The manifest is only updated when writing to `public/`.
