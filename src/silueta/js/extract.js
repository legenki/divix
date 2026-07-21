// SILUETA — extraction layer. Pure functions over a flat brightness array
// (0..255, row-major, length w*h). No p5/DOM: threshold → optional dilate →
// connected-component labeling. Output feeds both render.js (mask gating) and
// layout.js (placement/avoidance). See the design spec §3 Layer 1.

/**
 * Boolean object mask: 1 where brightness < threshold (object), else 0.
 * @param {Uint8Array|number[]} brightness  0..255, length w*h
 * @returns {Uint8Array} length w*h
 */
export function buildMask(brightness, w, h, threshold) {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = brightness[i] < threshold ? 1 : 0;
  return mask;
}

/**
 * One-step 4-neighborhood dilation: a cell becomes 1 if it or any of its
 * up/down/left/right neighbors is 1. Fuses nearby blobs (cross-line merge).
 * @returns {Uint8Array} new mask (input not mutated)
 */
export function dilate(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) { out[i] = 1; continue; }
      if (x > 0 && mask[i - 1]) { out[i] = 1; continue; }
      if (x < w - 1 && mask[i + 1]) { out[i] = 1; continue; }
      if (y > 0 && mask[i - w]) { out[i] = 1; continue; }
      if (y < h - 1 && mask[i + w]) { out[i] = 1; continue; }
    }
  }
  return out;
}

/**
 * Connected-component labeling (4-connectivity, iterative flood fill).
 * Discards components with area < areaFloor.
 * @returns {{ labels: Int32Array, components: Array<{id,area,bbox,centroid}> }}
 *   labels: per-pixel component id (0 = background/discarded), 1-based ids.
 */
export function connectedComponents(mask, w, h, areaFloor = 1) {
  const labels = new Int32Array(w * h); // 0 = unlabeled/background
  const components = [];
  const stack = [];
  let nextId = 1;

  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start] !== 0) continue;

    // Flood fill this blob.
    const id = nextId;
    stack.length = 0;
    stack.push(start);
    labels[start] = id;
    let area = 0;
    let sumX = 0, sumY = 0;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;

    while (stack.length) {
      const p = stack.pop();
      const px = p % w, py = (p / w) | 0;
      area++;
      sumX += px; sumY += py;
      if (px < x0) x0 = px;
      if (py < y0) y0 = py;
      if (px > x1) x1 = px;
      if (py > y1) y1 = py;

      if (px > 0 && mask[p - 1] && labels[p - 1] === 0) { labels[p - 1] = id; stack.push(p - 1); }
      if (px < w - 1 && mask[p + 1] && labels[p + 1] === 0) { labels[p + 1] = id; stack.push(p + 1); }
      if (py > 0 && mask[p - w] && labels[p - w] === 0) { labels[p - w] = id; stack.push(p - w); }
      if (py < h - 1 && mask[p + w] && labels[p + w] === 0) { labels[p + w] = id; stack.push(p + w); }
    }

    if (area < areaFloor) {
      // Too small: erase its labels back to background so it is ignored.
      // (Cheap re-walk of the bbox; blobs below the floor are tiny.)
      for (let yy = y0; yy <= y1; yy++)
        for (let xx = x0; xx <= x1; xx++)
          if (labels[yy * w + xx] === id) labels[yy * w + xx] = 0;
      continue;
    }

    components.push({
      id,
      area,
      bbox: { x0, y0, x1, y1 },
      centroid: { x: sumX / area, y: sumY / area },
    });
    nextId++;
  }

  return { labels, components };
}

/**
 * Full pipeline: mask → optional dilate → components.
 * @param {object} opts { threshold, merge, areaFloor }
 * @returns {{ mask: Uint8Array, labels: Int32Array, components: Array, w, h }}
 */
export function extractFromBrightness(brightness, w, h, { threshold, merge, areaFloor = 1 }) {
  let mask = buildMask(brightness, w, h, threshold);
  if (merge) mask = dilate(mask, w, h);
  const { labels, components } = connectedComponents(mask, w, h, areaFloor);
  return { mask, labels, components, w, h };
}
