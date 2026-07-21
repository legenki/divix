import { describe, it, expect } from 'vitest';
import { buildMask, dilate, connectedComponents, extractFromBrightness } from './extract.js';

// A 4x4 brightness grid (0..255). Two dark blobs on a light field:
//   (0,0) and (3,3) corners are dark (< threshold), everything else light.
const W = 4, H = 4;
const LIGHT = 250, DARK = 20;
function grid(darkCells) {
  const a = new Uint8Array(W * H).fill(LIGHT);
  for (const [x, y] of darkCells) a[y * W + x] = DARK;
  return a;
}

describe('buildMask', () => {
  it('marks pixels below threshold as object (1)', () => {
    const b = grid([[0, 0], [3, 3]]);
    const mask = buildMask(b, W, H, 233);
    expect(mask[0]).toBe(1);          // (0,0) dark → object
    expect(mask[3 * W + 3]).toBe(1);  // (3,3) dark → object
    expect(mask[1]).toBe(0);          // light → background
  });
});

describe('dilate', () => {
  it('grows the mask by one cell (4-neighborhood)', () => {
    const mask = new Uint8Array(W * H);
    mask[1 * W + 1] = 1; // single object pixel at (1,1)
    const out = dilate(mask, W, H);
    expect(out[1 * W + 1]).toBe(1);   // self
    expect(out[0 * W + 1]).toBe(1);   // up
    expect(out[2 * W + 1]).toBe(1);   // down
    expect(out[1 * W + 0]).toBe(1);   // left
    expect(out[1 * W + 2]).toBe(1);   // right
    expect(out[0 * W + 0]).toBe(0);   // diagonal not grown (4-neighborhood)
  });
});

describe('connectedComponents', () => {
  it('labels two separated blobs as two components', () => {
    const mask = buildMask(grid([[0, 0], [3, 3]]), W, H, 233);
    const { components } = connectedComponents(mask, W, H, 1);
    expect(components.length).toBe(2);
  });

  it('merges adjacent blobs into one after dilation', () => {
    // (1,1) and (2,1) are adjacent → already one component
    const mask = buildMask(grid([[1, 1], [2, 1]]), W, H, 233);
    const { components } = connectedComponents(mask, W, H, 1);
    expect(components.length).toBe(1);
  });

  it('discards components below the area floor', () => {
    const mask = buildMask(grid([[0, 0]]), W, H, 233);
    const { components } = connectedComponents(mask, W, H, 5); // floor 5 > area 1
    expect(components.length).toBe(0);
  });

  it('component carries bbox and centroid', () => {
    const mask = buildMask(grid([[1, 1], [2, 1]]), W, H, 233);
    const { components } = connectedComponents(mask, W, H, 1);
    const c = components[0];
    expect(c.bbox).toEqual({ x0: 1, y0: 1, x1: 2, y1: 1 });
    expect(c.centroid.x).toBeCloseTo(1.5);
    expect(c.centroid.y).toBeCloseTo(1);
    expect(c.area).toBe(2);
  });
});

describe('extractFromBrightness (integration)', () => {
  it('produces mask + components with merge toggle', () => {
    const b = grid([[1, 1], [2, 1], [0, 0], [3, 3]]);
    const merged = extractFromBrightness(b, W, H, { threshold: 233, merge: true, areaFloor: 1 });
    const raw = extractFromBrightness(b, W, H, { threshold: 233, merge: false, areaFloor: 1 });
    expect(merged.mask.length).toBe(W * H);
    // Merge (dilation) can only reduce or keep the component count, never increase it.
    expect(merged.components.length).toBeLessThanOrEqual(raw.components.length);
  });
});
