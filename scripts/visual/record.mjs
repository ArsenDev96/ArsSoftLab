// Real-time WebM recording of a page (M1.3F, shared since M1.3G): Chrome's
// screencast frames, captured as they are rendered (no frame stepping), are
// resampled to a steady frame rate at their own timestamps and encoded by
// Chrome (MediaRecorder, VP9).

import { writeFileSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

/**
 * @param {object} o
 * @param {string} o.url
 * @param {number} o.width
 * @param {number} o.height
 * @param {(page: any) => Promise<void>} o.prepare  runs before capture starts (e.g. park the pointer)
 * @param {(page: any) => Promise<void>} o.act      the recorded interaction
 * @param {string} o.out                             .webm path
 * @param {(page: any) => Promise<void>} [o.setup]  runs before navigation (e.g. request interception, M1.4A)
 * @param {(page: any) => Promise<{x:number,y:number,w:number,h:number,scale?:number}>} [o.crop]
 *        after prepare: a viewport rect (CSS px) to encode instead of the whole frame, scaled (M1.4E.2)
 */
export async function recordWebm({ url, width, height, prepare, act, out, setup, crop, fps = 30, bitrate = 3.5e6 }) {
  const page = await launch({ width, height, gpu: true });
  const frames = [];
  let rect = null;
  try {
    if (setup) await setup(page);
    await page.goto(url);
    await prepare(page);
    if (crop) rect = await crop(page);
    page.on((m) => {
      if (m.method !== "Page.screencastFrame") return;
      frames.push({ t: m.params.metadata.timestamp, data: m.params.data });
      page.send("Page.screencastFrameAck", { sessionId: m.params.sessionId }).catch(() => {});
    });
    await page.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
    await sleep(900);
    await act(page);
    await page.send("Page.stopScreencast");
  } finally {
    await page.close();
  }
  const t0 = frames[0].t;
  const dur = frames.at(-1).t - t0;
  const seq = [];
  for (let k = 0, j = 0; k <= dur * fps; k++) {
    const t = t0 + k / fps;
    while (j + 1 < frames.length && frames[j + 1].t <= t) j++;
    seq.push(j);
  }
  const enc = await launch({ width: 800, height: 600 });
  try {
    await enc.eval(`window.__src = []; true`);
    for (const f of frames) await enc.eval(`window.__src.push(${JSON.stringify(f.data)}); true`);
    const size = await enc.eval(`(async () => {
      const seq = ${JSON.stringify(seq)};
      const bmps = new Map();
      const get = async (j) => { if (!bmps.has(j)) bmps.set(j, await createImageBitmap(await (await fetch("data:image/jpeg;base64," + window.__src[j])).blob())); return bmps.get(j); };
      const first = await get(seq[0]);
      const rect = ${JSON.stringify(rect)}; const f = first.width / ${width};
      const src = rect ? [rect.x * f, rect.y * f, rect.w * f, rect.h * f] : [0, 0, first.width, first.height];
      const c = document.createElement("canvas"); c.width = Math.round(rect ? rect.w * (rect.scale ?? 1) : first.width); c.height = Math.round(rect ? rect.h * (rect.scale ?? 1) : first.height);
      c.width -= c.width % 2; c.height -= c.height % 2;
      const g = c.getContext("2d");
      const stream = c.captureStream(0); const track = stream.getVideoTracks()[0];
      const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: ${bitrate} });
      const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((r) => (rec.onstop = r));
      rec.start();
      const start = performance.now();
      for (let i = 0; i < seq.length; i++) {
        g.drawImage(await get(seq[i]), ...src, 0, 0, c.width, c.height);
        track.requestFrame();
        const due = start + ((i + 1) * 1000) / ${fps};
        await new Promise((r) => setTimeout(r, Math.max(0, due - performance.now())));
      }
      rec.stop(); await done;
      const buf = new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
      let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      window.__webm = btoa(s); return window.__webm.length;
    })()`);
    let b64 = "";
    for (let i = 0; i < size; i += 1 << 20) b64 += await enc.eval(`window.__webm.slice(${i}, ${i + (1 << 20)})`);
    writeFileSync(out, Buffer.from(b64, "base64"));
    return { frames: frames.length, seconds: +dur.toFixed(1), fps };
  } finally {
    await enc.close();
  }
}
