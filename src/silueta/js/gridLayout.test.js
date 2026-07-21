import { describe, it, expect } from 'vitest';
import {
  makeGrid, fits, findSlot, splitFragments, wrapText, composeGrid,
} from './gridLayout.js';

// Deterministic PRNG so every assertion is stable.
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const IMAGES = Array.from({ length: 7 }, (_, i) => ({ key: `img${i}`, img: {}, w: 100, h: 100 }));
const MAIN = 'REMIX LAYOUT. SMART GRAPHICS. EDGE DETECTION.';
const SMALL = 'Experimental image processing and typography layout engine.';

describe('makeGrid', () => {
  it('keeps cells roughly square for a portrait canvas', () => {
    const g = makeGrid(960, 1280, 10);
    const ratio = g.cellW / g.cellH;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.7);
  });

  it('gives a tall canvas more rows than a square one', () => {
    const tall = makeGrid(1080, 1920, 10);
    const square = makeGrid(1280, 1280, 10);
    expect(tall.rows / tall.cols).toBeGreaterThan(square.rows / square.cols);
  });

  it('densifies the grid as the element count grows', () => {
    const few = makeGrid(960, 1280, 4);
    const many = makeGrid(960, 1280, 24);
    expect(many.cols * many.rows).toBeGreaterThan(few.cols * few.rows);
  });

  it('always has capacity for the requested elements', () => {
    for (const n of [1, 6, 12, 20]) {
      const g = makeGrid(960, 1280, n);
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(n);
    }
  });
});

describe('fits / findSlot', () => {
  const grid = { cols: 4, rows: 4, cellW: 10, cellH: 10, w: 40, h: 40 };
  const empty = () => Array.from({ length: 4 }, () => new Array(4).fill(false));

  it('rejects blocks that overflow the grid', () => {
    expect(fits(empty(), grid, 3, 0, 2, 1)).toBe(false); // needs cols 3..4
    expect(fits(empty(), grid, 0, 3, 1, 2)).toBe(false); // needs rows 3..4
  });

  it('rejects overlap with an occupied cell', () => {
    const occ = empty();
    occ[1][1] = true;
    expect(fits(occ, grid, 1, 1, 1, 1)).toBe(false);
    expect(fits(occ, grid, 0, 0, 2, 2)).toBe(false); // covers (1,1)
    expect(fits(occ, grid, 2, 2, 2, 2)).toBe(true);
  });

  it('degrades a 2x2 request to a smaller footprint when space is tight', () => {
    const occ = empty();
    // Leave only single isolated cells free.
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) occ[r][c] = true;
    occ[2][3] = false;
    const slot = findSlot(occ, grid, 2, 2);
    expect(slot).toEqual({ col: 3, row: 2, cw: 1, ch: 1 });
  });

  it('returns null when the grid is full', () => {
    const occ = empty();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) occ[r][c] = true;
    expect(findSlot(occ, grid, 1, 1)).toBeNull();
  });
});

describe('splitFragments', () => {
  it('splits copy into short display fragments', () => {
    const out = splitFragments('REMIX LAYOUT. SMART GRAPHICS.');
    expect(out).toContain('REMIX LAYOUT.');
    expect(out).toContain('SMART GRAPHICS.');
  });

  it('caps fragment length in words', () => {
    const out = splitFragments('one two three four five six seven eight', 3);
    for (const f of out) expect(f.split(' ').length).toBeLessThanOrEqual(3);
  });

  it('returns an empty list for blank input', () => {
    expect(splitFragments('   ')).toEqual([]);
  });
});

describe('wrapText', () => {
  it('wraps to the requested character width', () => {
    const lines = wrapText(SMALL, 20);
    expect(lines.length).toBeGreaterThan(1);
    // Only a single over-long word may exceed the limit.
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(28);
  });
});

describe('composeGrid', () => {
  const base = {
    w: 960, h: 1280, images: IMAGES,
    mainText: MAIN, smallText: SMALL,
    imageCount: 5, mainCount: 2, smallCount: 4,
  };

  it('is deterministic for the same seed', () => {
    const a = composeGrid({ ...base, rand: lcg(7) });
    const b = composeGrid({ ...base, rand: lcg(7) });
    expect(JSON.stringify(a.blocks.map((x) => [x.kind, x.col, x.row, x.cw, x.ch])))
      .toBe(JSON.stringify(b.blocks.map((x) => [x.kind, x.col, x.row, x.cw, x.ch])));
  });

  it('places every requested block kind', () => {
    const { blocks } = composeGrid({ ...base, rand: lcg(1) });
    const kinds = blocks.map((b) => b.kind);
    expect(kinds.filter((k) => k === 'image').length).toBe(5);
    expect(kinds.filter((k) => k === 'main').length).toBe(2);
    expect(kinds.filter((k) => k === 'small').length).toBe(4);
  });

  it('never overlaps two blocks', () => {
    const { grid, blocks } = composeGrid({ ...base, imageCount: 8, smallCount: 6, rand: lcg(3) });
    const seen = new Set();
    for (const b of blocks) {
      for (let r = b.row; r < b.row + b.ch; r++) {
        for (let c = b.col; c < b.col + b.cw; c++) {
          const key = `${r}:${c}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
          expect(c).toBeLessThan(grid.cols);
          expect(r).toBeLessThan(grid.rows);
        }
      }
    }
  });

  it('keeps every block inside the canvas', () => {
    const { blocks } = composeGrid({ ...base, rand: lcg(5) });
    for (const b of blocks) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(960 + 0.01);
      expect(b.y + b.h).toBeLessThanOrEqual(1280 + 0.01);
    }
  });

  it('responds to element count by growing the grid', () => {
    const few = composeGrid({ ...base, imageCount: 2, smallCount: 1, mainCount: 1, rand: lcg(2) });
    const many = composeGrid({ ...base, imageCount: 12, smallCount: 8, mainCount: 3, rand: lcg(2) });
    expect(many.grid.cols * many.grid.rows).toBeGreaterThan(few.grid.cols * few.grid.rows);
  });

  it('emits no image blocks when the library is empty', () => {
    const { blocks } = composeGrid({ ...base, images: [], rand: lcg(1) });
    expect(blocks.some((b) => b.kind === 'image')).toBe(false);
    expect(blocks.some((b) => b.kind === 'main')).toBe(true);
  });

  it('emits no text blocks for blank copy', () => {
    const { blocks } = composeGrid({ ...base, mainText: '', smallText: '  ', rand: lcg(1) });
    expect(blocks.every((b) => b.kind === 'image')).toBe(true);
  });

  it('spreads blocks over the whole poster, not just the top', () => {
    const { grid, blocks } = composeGrid({ ...base, rand: lcg(11) });
    const lowest = Math.max(...blocks.map((b) => b.row + b.ch));
    // Something must reach into the bottom third, otherwise the poster has a
    // large dead area (the first-fit failure mode).
    expect(lowest).toBeGreaterThan(grid.rows * 0.66);
  });

  it('gives images strongly uneven scale (a hero plus small accents)', () => {
    const { blocks } = composeGrid({ ...base, imageCount: 5, rand: lcg(9) });
    const areas = blocks.filter((b) => b.kind === 'image').map((b) => b.w * b.h);
    const biggest = Math.max(...areas);
    const smallest = Math.min(...areas);
    // The reference look depends on real contrast, not a contact sheet.
    expect(biggest / smallest).toBeGreaterThan(3);
  });

  it('lays headlines over the imagery so type crosses the forms', () => {
    const { blocks } = composeGrid({ ...base, imageCount: 4, mainCount: 2, rand: lcg(6) });
    const mains = blocks.filter((b) => b.kind === 'main');
    const imgs = blocks.filter((b) => b.kind === 'image');
    expect(mains.length).toBeGreaterThan(0);
    const overlaps = (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    // Every headline should intersect at least one image block.
    for (const m of mains) {
      expect(imgs.some((im) => overlaps(m, im))).toBe(true);
    }
  });

  it('keeps overlaid headlines inside the canvas', () => {
    const { blocks } = composeGrid({ ...base, imageCount: 4, mainCount: 3, rand: lcg(12) });
    for (const b of blocks.filter((x) => x.kind === 'main')) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(base.w + 0.01);
      expect(b.y + b.h).toBeLessThanOrEqual(base.h + 0.01);
    }
  });

  it('gives caption blocks different sentences, not one repeated paragraph', () => {
    const smallText =
      'First sentence about extraction. Second sentence about halftone rasterisation. ' +
      'Third sentence about the responsive grid. Fourth sentence about typography.';
    const { blocks } = composeGrid({ ...base, smallText, smallCount: 4, rand: lcg(8) });
    const texts = blocks.filter((b) => b.kind === 'small').map((b) => b.text);
    expect(texts.length).toBe(4);
    expect(new Set(texts).size).toBeGreaterThan(1);
  });

  it('uses most of the grid capacity rather than a corner', () => {
    const { grid, blocks } = composeGrid({ ...base, rand: lcg(4) });
    const used = blocks.reduce((n, b) => n + b.cw * b.ch, 0);
    expect(used / (grid.cols * grid.rows)).toBeGreaterThan(0.4);
  });
});
