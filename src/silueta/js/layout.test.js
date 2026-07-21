import { describe, it, expect } from 'vitest';
import { makeGrid, cellIsMasked, placeSmallText, computeLayout } from './layout.js';

// Deterministic PRNG stub (LCG) so tests are stable without alea.
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

describe('makeGrid', () => {
  it('divides the canvas into rows x cols cells', () => {
    const g = makeGrid(100, 200, 4); // cols=4
    expect(g.cols).toBe(4);
    expect(g.cellW).toBeCloseTo(25);
    expect(g.rows).toBeGreaterThan(0);
    expect(g.cellH).toBeGreaterThan(0);
  });
});

describe('cellIsMasked', () => {
  it('is true when the cell center falls on a masked pixel', () => {
    const w = 4, h = 4;
    const mask = new Uint8Array(w * h);
    mask[1 * w + 1] = 1;
    const maskInfo = { mask, w, h };
    // Canvas 40x40, grid cell at col1,row1 spans [10,20)x[10,20); center (15,15)
    // maps to mask pixel (1,1) → masked.
    const g = makeGrid(40, 40, 4);
    expect(cellIsMasked(maskInfo, g, 1, 1)).toBe(true);
    expect(cellIsMasked(maskInfo, g, 0, 0)).toBe(false);
  });
});

describe('placeSmallText (contour avoidance)', () => {
  const w = 4, h = 4;
  const mask = new Uint8Array(w * h);
  mask[1 * w + 1] = 1; // one masked cell
  const maskInfo = { mask, w, h };
  const g = makeGrid(40, 40, 4);

  it('when enabled, does not land the caption on a masked cell', () => {
    const item = placeSmallText({ maskInfo, grid: g, col: 1, row: 1, enabled: true, text: 'x', size: 10 });
    // Should have moved off (1,1); its target cell must be unmasked.
    expect(cellIsMasked(maskInfo, g, item.col, item.row)).toBe(false);
    expect(item.placed).toBe(true);
  });

  it('when disabled, stays on the requested cell even if masked', () => {
    const item = placeSmallText({ maskInfo, grid: g, col: 1, row: 1, enabled: false, text: 'x', size: 10 });
    expect(item.col).toBe(1);
    expect(item.row).toBe(1);
    expect(item.placed).toBe(true); // avoidance off → always "placed"
  });

  it('flags placed=false when the whole grid is masked and avoidance is on', () => {
    const fullMask = new Uint8Array(w * h).fill(1); // every cell masked
    const info = { mask: fullMask, w, h };
    const item = placeSmallText({ maskInfo: info, grid: g, col: 1, row: 1, enabled: true, text: 'x', size: 10 });
    expect(item.placed).toBe(false);   // no free cell exists
    expect(item.col).toBe(1);          // falls back to the requested cell
    expect(item.row).toBe(1);
  });
});

describe('computeLayout (determinism + roles)', () => {
  const w = 8, h = 8;
  const maskInfo = { mask: new Uint8Array(w * h), w, h, components: [] };
  const state = {
    mode: 'mixed',
    main: { text: 'AB\nCD', fontSize: 52, lineHeight: 0.9, color: '#111' },
    small: { enabled: true, text: 'caption', fontSize: 10 },
  };

  it('is deterministic for the same seed', () => {
    const a = computeLayout({ w: 400, h: 500, maskInfo, state, rand: lcg(42) });
    const b = computeLayout({ w: 400, h: 500, maskInfo, state, rand: lcg(42) });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('emits main-text items for each main line', () => {
    const items = computeLayout({ w: 400, h: 500, maskInfo, state, rand: lcg(1) });
    const mains = items.filter((it) => it.role === 'main');
    expect(mains.length).toBe(2); // 'AB' and 'CD'
  });

  it('emits a small-text item when small.text is non-empty', () => {
    const items = computeLayout({ w: 400, h: 500, maskInfo, state, rand: lcg(1) });
    expect(items.some((it) => it.role === 'small')).toBe(true);
  });
});
