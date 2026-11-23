// Offline WebM from still frames (M1.4H.2): every frame is encoded (Chrome's VideoEncoder, VP8, not real time) and
// muxed at its exact timestamp, so a slow machine drops nothing. record.mjs stays the real-time recorder.

import { launch } from "./cdp.mjs";

const num = (n) => {
  const b = [];
  do {
    b.unshift(n & 255);
    n = Math.floor(n / 256);
  } while (n > 0);
  return Buffer.from(b);
};
/** An EBML element; sizes are always written in 8 bytes. */
function el(id, ...parts) {
  const body = Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : typeof p === "string" ? Buffer.from(p) : num(p))));
  const size = Buffer.alloc(8);
  size.writeBigUInt64BE(BigInt(body.length) | (1n << 56n));
  return Buffer.concat([num(id), size, body]);
}
const float = (v) => {
  const b = Buffer.alloc(8);
  b.writeDoubleBE(v);
  return b;
};

function mux({ width, height, frames, durationMs }) {
  const header = el(0x1a45dfa3, el(0x4286, 1), el(0x42f7, 1), el(0x42f2, 4), el(0x42f3, 8), el(0x4282, "webm"), el(0x4287, 2), el(0x4285, 2));
  const info = el(0x1549a966, el(0x2ad7b1, 1000000), el(0x4489, float(durationMs)), el(0x4d80, "m14h2"), el(0x5741, "m14h2"));
  const track = el(0x1654ae6b, el(0xae, el(0xd7, 1), el(0x73c5, 1), el(0x9c, 0), el(0x86, "V_VP8"), el(0x83, 1), el(0xe0, el(0xb0, width), el(0xba, height))));
  const clusters = [];
  let cur = null;
  for (const f of frames) {
    if (!cur || f.key || f.t - cur.t > 30000) clusters.push((cur = { t: f.t, blocks: [] }));
    const h = Buffer.alloc(4);
    h[0] = 0x81;
    h.writeInt16BE(f.t - cur.t, 1);
    h[3] = f.key ? 0x80 : 0;
    cur.blocks.push(el(0xa3, h, f.data));
  }
  const body = clusters.map((c) => el(0x1f43b675, el(0xe7, c.t), ...c.blocks));
  return Buffer.concat([header, el(0x18538067, info, track, ...body)]);
}

/**
 * @param {object} o
 * @param {string[]} o.images      base64 JPEGs, all the same size
 * @param {[number, number][]} o.sequence  [image index, how long it shows (ms)]
 * @param {string} o.origin        a secure origin to run the encoder on (VideoEncoder needs one; localhost is)
 */
export async function encodeWebm({ images, sequence, origin, bitrate = 8e6 }) {
  const page = await launch({ width: 900, height: 700 });
  try {
    await page.goto(origin);
    await page.eval(`(window.__src = [], 1)`);
    for (const s of images) await page.eval(`(window.__src.push(${JSON.stringify(s)}), 1)`);
    const n = await page.eval(`(async () => {
      const seq = ${JSON.stringify(sequence)};
      const load = async (s) => createImageBitmap(await (await fetch("data:image/jpeg;base64," + s)).blob());
      const first = await load(window.__src[0]);
      const w = first.width - first.width % 2, h = first.height - first.height % 2;
      const c = new OffscreenCanvas(w, h);
      const g = c.getContext("2d");
      window.__out = []; let err = null;
      const enc = new VideoEncoder({
        output: (ch) => { const b = new Uint8Array(ch.byteLength); ch.copyTo(b); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); window.__out.push({ t: Math.round(ch.timestamp / 1000), key: ch.type === "key", data: btoa(s) }); },
        error: (e) => { err = e.message; },
      });
      enc.configure({ codec: "vp8", width: w, height: h, bitrate: ${bitrate}, framerate: 60, latencyMode: "quality" });
      let t = 0; let last = -1, bmp = first;
      for (let i = 0; i < seq.length; i++) {
        const [f, ms] = seq[i];
        if (f !== last) { bmp = await load(window.__src[f]); last = f; }
        g.drawImage(bmp, 0, 0);
        const vf = new VideoFrame(c, { timestamp: Math.round(t * 1000) });
        enc.encode(vf, { keyFrame: i % 120 === 0 }); vf.close();
        t += ms;
        while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
      }
      await enc.flush(); enc.close();
      if (err) throw new Error(err);
      window.__meta = { width: w, height: h, durationMs: t };
      return window.__out.length;
    })()`);
    const frames = [];
    for (let i = 0; i < n; i++) {
      const f = await page.eval(`window.__out[${i}]`);
      frames.push({ t: f.t, key: f.key, data: Buffer.from(f.data, "base64") });
    }
    const meta = await page.eval("window.__meta");
    return { file: mux({ ...meta, frames }), frames: n, seconds: +(meta.durationMs / 1000).toFixed(2), width: meta.width, height: meta.height };
  } finally {
    await page.close();
  }
}
