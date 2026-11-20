// Probes for the M1.2.2 independent station layer (Engineering).

export const LAYER = '[data-station-layer="engineering"]';
export const HOTSPOT = '[data-hotspot="engineering"]';

/** Scene-px box that the lift may change: station, shadow spill and labels. */
export const LIFT_REGION = { x0: 240, y0: 300, x1: 640, y1: 572 };

export const hasLayer = (page) => page.eval(`!!document.querySelector('${LAYER}')`);

/**
 * Current lift state. `labelErr` is the distance (CSS px) between where the
 * label anchor actually is and where the station's own transform puts that
 * scene point; 0 means the labels move rigidly with the cut-out.
 */
export const liftState = (page) =>
  page.eval(`(() => {
    const layer = document.querySelector('${LAYER}');
    const wrap = layer?.querySelector('.lab-lift');
    const label = document.querySelector('#station-engineering');
    if (!wrap || !label) return null;
    const cs = getComputedStyle(wrap);
    const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform);
    const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
    // Work in the layer's own CSS px; k converts to viewport px, so this
    // also holds while the camera scales the scene.
    const frame = layer.getBoundingClientRect();
    const k = frame.width / layer.offsetWidth;
    const stations = label.offsetParent.getBoundingClientRect();
    // Untransformed label anchor (fractional; offsetLeft/Top would round),
    // in the cut-out's own (untransformed) box.
    const ax = (stations.x - frame.x) / k + parseFloat(getComputedStyle(label).left);
    const ay = (stations.y - frame.y) / k + parseFloat(getComputedStyle(label).top);
    const q = new DOMMatrix().translate(ox, oy).multiply(m).translate(-ox, -oy).transformPoint(new DOMPoint(ax, ay));
    const p = { x: q.x * k, y: q.y * k };
    const r = label.getBoundingClientRect();
    const op = (sel) => getComputedStyle(layer.querySelector(sel)).opacity;
    return {
      visible: getComputedStyle(layer).visibility,
      ready: layer.hasAttribute('data-ready'),
      transform: cs.transform,
      scale: +m.a.toFixed(4),
      ty: +m.f.toFixed(2),
      labelTransform: getComputedStyle(label).transform,
      labelErr: +Math.hypot(frame.x + p.x - r.x, frame.y + p.y - r.y).toFixed(3),
      shadow: op('.lab-lift-shadow') + '/' + getComputedStyle(layer.querySelector('.lab-lift-shadow')).display,
      light: op('.lab-lift-light'),
      // Nothing static between the cut-out and the scene may clip it, or the
      // lifted top edge is cut off at the layer box.
      groupClips: getComputedStyle(layer).overflow !== 'visible',
    };
  })()`);

/** LIFT_REGION in screen px (for excluding it from whole-frame comparisons). */
export const liftRegionOnScreen = (page, pad = 4) =>
  page.eval(`(() => {
    const r = document.querySelector('[data-layer="plate"]').getBoundingClientRect();
    const k = r.width / 1672;
    const R = ${JSON.stringify(LIFT_REGION)};
    return [Math.floor(r.x + R.x0 * k) - ${pad}, Math.floor(r.y + R.y0 * k) - ${pad},
            Math.ceil(r.x + R.x1 * k) + ${pad}, Math.ceil(r.y + R.y1 * k) + ${pad}];
  })()`);

/** Press Tab until the element with `id` has focus (real keyboard focus, so :focus-visible applies). */
export async function tabTo(page, id, max = 80) {
  for (let i = 0; i < max; i++) {
    if ((await page.eval("document.activeElement?.id || ''")) === id) return true;
    await page.key("Tab", "Tab", 9);
  }
  return false;
}
