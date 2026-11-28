// M1.4R.2: node sc-bbox.mjs <a.png> <b.png>. Max channel delta, and the bounding box of pixels whose delta is over 2.
import sharp from "sharp";
const [a, b] = process.argv.slice(2);
const raw = async (p) => { const { data, info } = await sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
const A = await raw(a), B = await raw(b);
let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0, max = 0;
for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) { const i = (y * A.w + x) * 3; const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2])); max = Math.max(max, d); if (d > 2) { n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
console.log(n ? `max ${max}, ${n} px > 2, all inside x ${x0}–${x1}, y ${y0}–${y1}` : `max ${max}, none > 2`);
