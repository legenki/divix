# Silueta Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `silueta` divix workspace — a poster/typography composition engine that extracts photo silhouettes, renders them as Pixelate/Halftone, and lays out text that weaves through or tiles around the forms; exports SVG/PNG/MP4.

**Architecture:** Three decoupled layers sharing one contract (a low-res object mask): `extract.js` (CPU threshold + connected components), `render.js` (WEBGL pixelate/halftone silhouette buffer, reusing difuso's halftone shader), and `layout.js` (CPU grid text placement + contour avoidance). `app.js` wires them to p5 lifecycle, the shared panel builder, persistence, and SVG/PNG/MP4 export.

**Tech Stack:** p5.js 2.2.3 (instance mode, WEBGL), vite, vitest, shared divix utils (panelBuilder, persistence, presetIO, exportMedia, svgDownload, dirtyLoop, debounce, panelGuard).

**Reference spec:** `docs/superpowers/specs/2026-07-21-silueta-workspace-design.md`

**Reference implementation to mirror:** the `difuso` workspace (`src/difuso/`) — buffer pipeline, panel wiring, presets, export, dirty-loop, pixel-density discipline.

---

## File Structure

```
src/silueta/
  template.html          tab panel (aside #sl-controls + footer) + <main #silueta-canvas>
  js/
    state.js             state objects + option maps (Task 2)
    extract.js           downscale → threshold → dilate → connected components (Task 3)
    layout.js            grid + main/small text placement + contour avoidance (Task 4)
    shaders.js           PIXELATE_FRAG + re-export of difuso halftone shader (Task 5)
    render.js            WEBGL buffer + shader dispatch + mask gating (Task 6)
    svgExport.js         analytic vector rebuild (Task 8)
    controls.js          SECTIONS declaration (Task 7)
    app.js               p5 lifecycle, wiring, presets, export (Task 9)
    extract.test.js      unit tests for extract.js (Task 3)
    layout.test.js       unit tests for layout.js (Task 4)
public/assets/silueta/
    default.webp         bundled demo image (Task 10)
    presets.json         starter presets (Task 10)
```

Shared files modified:
- `src/shared/ui/panelBuilder.js` — add `textarea` control type (Task 1).
- `src/js/main.js` — register workspace (Task 11).
- `index.html` — add tab + view include (Task 11).

---

## Task 1: Add `textarea` control type to the shared panel builder

The Main Text field is multiline; panelBuilder only has single-line `text`. Add a reusable `textarea` branch.

**Files:**
- Modify: `src/shared/ui/panelBuilder.js` (add branch in `buildControl`, handle in `syncUIFromState`)
- Test: `src/shared/utils/panelBuilder.test.js` (existing file — add a test)

- [ ] **Step 1: Read the existing test file to match its style and imports**

Run: `sed -n '1,40p' src/shared/utils/panelBuilder.test.js`
Expected: see how it constructs a builder and asserts on generated DOM (jsdom is configured in devDeps).

- [ ] **Step 2: Write the failing test**

The file's top import is `import { getByPath, setByPath, buildPresetSection } from '../ui/panelBuilder.js';` and it uses `import { describe, it, expect } from 'vitest';`. Extend both so `createPanelBuilder` and `vi` are available:

```js
import { describe, it, expect, vi } from 'vitest';
import { getByPath, setByPath, buildPresetSection, createPanelBuilder } from '../ui/panelBuilder.js';
```

Then add this new `describe` block (the file already declares `// @vitest-environment jsdom` at the top, so `window`/`document` are available):

```js
describe('textarea control', () => {
  it('renders a textarea and writes state on input', () => {
    const state = { layout: { main: { text: 'HELLO' } } };
    const applyChange = vi.fn();
    const builder = createPanelBuilder({ state, applyChange, refreshVisibility: () => {} });
    const row = builder.buildControl({ id: 'sl-main-text', type: 'textarea', label: 'Main Text', path: 'layout.main.text' });
    const ta = row.querySelector('textarea');
    expect(ta).not.toBeNull();
    expect(ta.value).toBe('HELLO');
    ta.value = 'WORLD';
    ta.dispatchEvent(new window.Event('input'));
    expect(state.layout.main.text).toBe('WORLD');
    expect(applyChange).toHaveBeenCalled();
  });
});
```

If the existing test file does not already import `vi`, add it to the top-level import from `vitest` (e.g. `import { describe, it, expect, vi } from 'vitest';`). Verify jsdom `window`/`document` globals are available (they are — other tests in this file build DOM).

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/shared/utils/panelBuilder.test.js -t "textarea"`
Expected: FAIL — `row.querySelector('textarea')` is null (no textarea branch yet).

- [ ] **Step 4: Implement the `textarea` branch**

In `src/shared/ui/panelBuilder.js`, inside `buildControl`, immediately AFTER the existing `else if (ctrl.type === 'text') { … }` block, add:

```js
} else if (ctrl.type === 'textarea') {
  const header = el('div', { className: 'parameter-header' },
    el('span', { className: 'parameter-label', textContent: ctrl.label }),
  );
  const input = el('textarea', {
    class: 'grafema-text-input',
    id: ctrl.id,
    rows: String(ctrl.rows || 3),
    style: 'resize:vertical; min-height:52px; font:inherit;',
  });
  input.value = String(val);
  row.appendChild(header);
  row.appendChild(input);
  input.addEventListener('input', (e) => {
    setByPath(state, ctrl.path, e.target.value);
    applyChange(ctrl);
  });
```

In `syncUIFromState`, extend the `select`/`text` value-writeback branch so `textarea` is handled the same way. Change:

```js
} else if (ctrl.type === 'select' || ctrl.type === 'text') {
  el.value = val;
```

to:

```js
} else if (ctrl.type === 'select' || ctrl.type === 'text' || ctrl.type === 'textarea') {
  el.value = val;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/shared/utils/panelBuilder.test.js -t "textarea"`
Expected: PASS.

- [ ] **Step 6: Run the full panelBuilder test file (no regressions)**

Run: `npx vitest run src/shared/utils/panelBuilder.test.js`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui/panelBuilder.js src/shared/utils/panelBuilder.test.js
git commit -m "feat(panel): add reusable textarea control type"
```

---

## Task 2: Silueta state module

**Files:**
- Create: `src/silueta/js/state.js`

- [ ] **Step 1: Create the state module**

Create `src/silueta/js/state.js`:

```js
// SILUETA — poster/typography workspace state and option maps.
// State objects are mutated in place by the panel, presets and the sketch;
// initial values are the tool's default preset. See the design spec at
// docs/superpowers/specs/2026-07-21-silueta-workspace-design.md.

export const cnv = {
  width: 960,
  height: 1280,
  maxSize: 9999,
  scale: 0.68,
  ratio: '3:4',
  preset: 'User Preset',
  density: { base: 1, export: 2000 },
};

export const render = {
  effect: 'none',        // 'none' | 'pixelate' | 'halftone'
  granularity: 11,       // px block/dot size, 10..28
  color: '#B8B8B8',      // flat silhouette color (used when effect !== 'none')
  keepOriginal: false,   // keep source texture/color inside cells
};

export const extract = {
  threshold: 233,        // 0..255 brightness cut; below = object
  merge: true,           // dilate before labeling so nearby blobs fuse
};

export const layout = {
  mode: 'mixed',         // 'mixed' | 'overlay'
  seed: 1234,
  font: { mode: 'list', name: 'Inter' },
  main: {
    text: 'REMIX LAYOUT.\nSMART GRAPHICS.',
    fontSize: 52,
    lineHeight: 0.9,
    color: '#111111',
  },
  small: {
    enabled: true,
    text: 'Experimental image processing and typography layout engine.',
    fontSize: 10,
  },
};

export const rec = {
  type: 'image',
  frameRate: 30,
  quality: 75,
  format: 'mp4',
  frame: 0,
};

// --- Option maps (label → value for the panel UI) ---

export const RATIO_TYPES = {
  '1:1': '1:1',
  '4:5': '4:5',
  '3:4': '3:4',
  '2:3': '2:3',
  '9:16': '9:16',
};

export const RESOLUTIONS = {
  '1:1': { width: 1280, height: 1280 },
  '4:5': { width: 1024, height: 1280 },
  '3:4': { width: 960, height: 1280 },
  '2:3': { width: 960, height: 1440 },
  '9:16': { width: 1080, height: 1920 },
};

export const EFFECT_TYPES = {
  'None (Original)': 'none',
  'Pixelate': 'pixelate',
  'Halftone': 'halftone',
};

export const LAYOUT_MODES = {
  'Semantic image-text mixed': 'mixed',
  'Original overlay': 'overlay',
};
```

- [ ] **Step 2: Verify it imports cleanly**

Run: `node --input-type=module -e "import('./src/silueta/js/state.js').then(m => console.log(Object.keys(m).join(',')))"`
Expected: prints `cnv,render,extract,layout,rec,RATIO_TYPES,RESOLUTIONS,EFFECT_TYPES,LAYOUT_MODES`.

- [ ] **Step 3: Commit**

```bash
git add src/silueta/js/state.js
git commit -m "feat(silueta): add workspace state and option maps"
```

---

## Task 3: Extraction layer (threshold → dilate → connected components)

Pure functions over a flat grayscale/brightness array. No p5 draw calls, no DOM — fully unit-testable, mirroring `map2.test.js`'s stub-and-assert style.

**Files:**
- Create: `src/silueta/js/extract.js`
- Test: `src/silueta/js/extract.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/silueta/js/extract.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/silueta/js/extract.test.js`
Expected: FAIL — module `./extract.js` not found.

- [ ] **Step 3: Implement `extract.js`**

Create `src/silueta/js/extract.js`:

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/silueta/js/extract.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/silueta/js/extract.js src/silueta/js/extract.test.js
git commit -m "feat(silueta): add extraction layer (threshold, dilate, components)"
```

---

## Task 4: Layout engine (grid + placement + contour avoidance)

Pure functions: given canvas dims, the mask, and layout state, return a list of draw items (`{ type:'text', x, y, size, text, role }`). No p5/DOM. Deterministic via a seeded PRNG passed in.

**Files:**
- Create: `src/silueta/js/layout.js`
- Test: `src/silueta/js/layout.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/silueta/js/layout.test.js`:

```js
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
  });

  it('when disabled, stays on the requested cell even if masked', () => {
    const item = placeSmallText({ maskInfo, grid: g, col: 1, row: 1, enabled: false, text: 'x', size: 10 });
    expect(item.col).toBe(1);
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/silueta/js/layout.test.js`
Expected: FAIL — module `./layout.js` not found.

- [ ] **Step 3: Implement `layout.js`**

Create `src/silueta/js/layout.js`:

```js
// SILUETA — layout engine. Pure, deterministic (a PRNG is passed in, never
// created here). Given canvas dims + the extraction mask + layout state, it
// returns a flat list of draw items the renderer paints. No p5/DOM. See the
// design spec §3 Layer 3.
//
// Draw item shape: { role: 'main'|'small', x, y, size, text, col, row }
//   x,y are canvas pixels (top-left baseline anchor); the renderer applies the
//   actual font/baseline. col,row are the grid cell (kept for avoidance tests).

/** Build an implicit grid. cols is derived from the caller; rows follow the aspect. */
export function makeGrid(w, h, cols) {
  const cellW = w / cols;
  const rows = Math.max(1, Math.round(h / cellW));
  const cellH = h / rows;
  return { w, h, cols, rows, cellW, cellH };
}

/** True if the given grid cell's center falls on a masked (object) pixel. */
export function cellIsMasked(maskInfo, grid, col, row) {
  const { mask, w: mw, h: mh } = maskInfo;
  const cx = (col + 0.5) * grid.cellW;
  const cy = (row + 0.5) * grid.cellH;
  const mx = Math.min(mw - 1, Math.max(0, Math.floor((cx / grid.w) * mw)));
  const my = Math.min(mh - 1, Math.max(0, Math.floor((cy / grid.h) * mh)));
  return mask[my * mw + mx] === 1;
}

/**
 * Place one small-caption item. When `enabled`, if the requested cell is masked
 * it searches outward (increasing Chebyshev radius) for the nearest unmasked
 * cell and lands there. When disabled, stays on the requested cell.
 */
export function placeSmallText({ maskInfo, grid, col, row, enabled, text, size }) {
  let tc = col, tr = row;
  if (enabled && cellIsMasked(maskInfo, grid, col, row)) {
    outer:
    for (let radius = 1; radius < Math.max(grid.cols, grid.rows); radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue; // ring only
          const nc = col + dc, nr = row + dr;
          if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows) continue;
          if (!cellIsMasked(maskInfo, grid, nc, nr)) { tc = nc; tr = nr; break outer; }
        }
      }
    }
  }
  return {
    role: 'small',
    col: tc,
    row: tr,
    x: tc * grid.cellW + 2,
    y: tr * grid.cellH + size,
    size,
    text,
  };
}

/**
 * Compute the full draw-item list.
 * @param {object} opts { w, h, maskInfo, state, rand }
 *   rand: () => number in [0,1) — deterministic PRNG supplied by the caller.
 * @returns {Array} draw items
 */
export function computeLayout({ w, h, maskInfo, state, rand }) {
  const items = [];

  // Grid resolution scales with main font size: bigger type → fewer columns.
  const cols = Math.max(3, Math.round(w / (state.main.fontSize * 1.6)));
  const grid = makeGrid(w, h, cols);

  // --- Main text: one item per non-empty line, stacked from the top with a
  // jittered horizontal offset so lines don't form a rigid left column. ---
  const mainLines = String(state.main.text).split('\n').filter((s) => s.trim().length);
  const lineStep = state.main.fontSize * state.main.lineHeight;
  let y = state.main.fontSize;
  for (const line of mainLines) {
    const jitter = Math.floor(rand() * grid.cols * 0.4) * grid.cellW * 0.25;
    items.push({
      role: 'main',
      col: 0,
      row: Math.floor(y / grid.cellH),
      x: 4 + jitter,
      y,
      size: state.main.fontSize,
      text: line,
    });
    y += lineStep;
  }

  // --- Small caption(s): scatter a few copies over free cells, avoiding masks
  // when enabled. Count kept small and deterministic. ---
  const smallText = String(state.small.text).trim();
  if (smallText) {
    const copies = state.mode === 'mixed' ? 4 : 2;
    for (let n = 0; n < copies; n++) {
      const col = Math.floor(rand() * grid.cols);
      const row = Math.floor(rand() * grid.rows);
      items.push(placeSmallText({
        maskInfo,
        grid,
        col,
        row,
        enabled: state.small.enabled,
        text: smallText,
        size: state.small.fontSize,
      }));
    }
  }

  return items;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/silueta/js/layout.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/silueta/js/layout.js src/silueta/js/layout.test.js
git commit -m "feat(silueta): add layout engine (grid, placement, avoidance)"
```

---

## Task 5: Silhouette shaders

Add the pixelate fragment shader; re-export difuso's halftone shader + vert so render.js has one import surface.

**Files:**
- Create: `src/silueta/js/shaders.js`

- [ ] **Step 1: Create `shaders.js`**

Create `src/silueta/js/shaders.js`:

```js
// SILUETA — silhouette shaders. PIXELATE_FRAG is new (a true block-average
// pixelate; difuso has no averaging pixelate). Halftone is reused verbatim from
// difuso by re-export, so the two workspaces can't drift. All paired with
// difuso's DITHER_VERT (full-buffer quad, no varying tex coords).

export { HALFTONE_FRAG, DITHER_VERT } from '../../difuso/js/shaders.js';

// Block-average pixelate. Samples the block center for each u_size×u_size block
// so each block is one flat color. u_flatColor (>0) replaces the sampled color
// with u_color (flat silhouette); u_flatColor == 0 keeps the source color
// (Keep original image content). Alpha is preserved so the mask gate (applied
// on the buffer via a separate masked blit) keeps background transparent.
export const PIXELATE_FRAG = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform float u_size;
  uniform float u_flatColor;   // 1.0 = use u_color, 0.0 = keep source color
  uniform vec3 u_color;        // flat silhouette color (0..1 rgb)

  void main() {
    vec2 coord = vec2(gl_FragCoord.x, 1.0 - gl_FragCoord.y);
    vec2 block = (floor(coord / u_size) + 0.5) * u_size;
    vec4 src = texture2D(u_texture, block / u_resolution);
    vec3 rgb = mix(src.rgb, u_color, u_flatColor);
    gl_FragColor = vec4(rgb, src.a);
  }
`;
```

- [ ] **Step 2: Verify imports resolve (the re-export path is correct)**

Run: `node --input-type=module -e "import('./src/difuso/js/shaders.js').then(m => console.log('HALFTONE_FRAG' in m, 'DITHER_VERT' in m))"`
Expected: prints `true true` (confirms the names re-exported by silueta exist in difuso).

- [ ] **Step 3: Commit**

```bash
git add src/silueta/js/shaders.js
git commit -m "feat(silueta): add pixelate shader, re-export halftone"
```

---

## Task 6: Render layer (WEBGL silhouette buffer + mask gating)

Owns the WEBGL buffer that draws the silhouette. Mirrors difuso's buffer/shader/pixel-density discipline. The mask gate is applied by drawing the shader result, then multiplying by an upsampled mask image (destination-in blend) so only object pixels survive.

**Files:**
- Create: `src/silueta/js/render.js`

- [ ] **Step 1: Create `render.js`**

Create `src/silueta/js/render.js`:

```js
// SILUETA — silhouette render layer (WEBGL). Textures the source image, runs the
// pixelate/halftone/original shader into an offscreen buffer, then gates the
// result with the (upsampled) object mask so background is transparent.
// Buffer/pixel-density discipline mirrors difuso (see the difuso pixel-density
// memory: p.pixelDensity() must match the buffer's density or the shader tiles).

import { PIXELATE_FRAG, HALFTONE_FRAG, DITHER_VERT } from './shaders.js';

function hexToRgb01(hex) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * @param {object} deps { p, state }
 * @returns render controller with buildShaders/render/dispose.
 */
export function createRender({ p, state }) {
  const { render, cnv } = state;
  let sil = null;      // WEBGL shader-output buffer
  let masked = null;   // P2D buffer holding the final masked silhouette (RGBA)
  let pixelateShader = null;
  let halftoneShader = null;
  let maskImg = null;  // p5.Image built from the extraction mask (for gating)

  function buildBuffers(w, h, density) {
    dispose();
    sil = p.createGraphics(w, h, p.WEBGL);
    sil.pixelDensity(density);
    sil.noStroke();
    pixelateShader = sil.createShader(DITHER_VERT, PIXELATE_FRAG);
    halftoneShader = sil.createShader(DITHER_VERT, HALFTONE_FRAG);

    masked = p.createGraphics(w, h); // P2D
    masked.pixelDensity(density);
    masked.noStroke();
  }

  /**
   * Build a p5.Image (white where object, transparent where background) from a
   * flat mask, sized to the mask's own resolution. Used as the gate.
   */
  function setMask(maskInfo) {
    const { mask, w: mw, h: mh } = maskInfo;
    maskImg = p.createImage(mw, mh);
    maskImg.loadPixels();
    for (let i = 0; i < mw * mh; i++) {
      const on = mask[i] ? 255 : 0;
      const j = i * 4;
      maskImg.pixels[j] = 255;
      maskImg.pixels[j + 1] = 255;
      maskImg.pixels[j + 2] = 255;
      maskImg.pixels[j + 3] = on;
    }
    maskImg.updatePixels();
  }

  function drawFullQuad(buf) {
    buf.push();
    buf.rectMode(p.CORNER);
    buf.rect(-buf.width / 2, -buf.height / 2, buf.width, buf.height);
    buf.pop();
  }

  /**
   * Render the current silhouette into `masked` (P2D, RGBA with transparent bg).
   * @param {p5.Image} sourceTex  resized source image (fits the buffer)
   * @returns {p5.Graphics} the masked buffer (caller blits it to the canvas)
   */
  function renderSilhouette(sourceTex) {
    const w = sil.width, h = sil.height;
    const density = sil.pixelDensity();

    sil.clear();

    if (render.effect === 'none') {
      // Pass-through: draw the source as-is (still gets mask-gated below).
      sil.push();
      sil.texture(sourceTex);
      sil.rectMode(p.CORNER);
      sil.rect(-w / 2, -h / 2, w, h);
      sil.pop();
    } else if (render.effect === 'pixelate') {
      sil.shader(pixelateShader);
      pixelateShader.setUniform('u_texture', sourceTex);
      pixelateShader.setUniform('u_resolution', [w * density, h * density]);
      pixelateShader.setUniform('u_size', render.granularity * density);
      pixelateShader.setUniform('u_flatColor', render.keepOriginal ? 0 : 1);
      pixelateShader.setUniform('u_color', hexToRgb01(render.color));
      drawFullQuad(sil);
    } else {
      // halftone — reuse difuso's HALFTONE_FRAG uniform set (neutral b/c/s).
      sil.shader(halftoneShader);
      halftoneShader.setUniform('u_texture', sourceTex);
      halftoneShader.setUniform('u_resolution', [w * density, h * density]);
      halftoneShader.setUniform('u_size', render.granularity * density);
      halftoneShader.setUniform('u_smooth', 2);
      halftoneShader.setUniform('u_brightness', 1);
      halftoneShader.setUniform('u_contrast', 1);
      halftoneShader.setUniform('u_saturation', render.keepOriginal ? 0 : 1);
      halftoneShader.setUniform('u_density', density);
      halftoneShader.setUniform('u_halfscale', [1, 1, 1]);
      drawFullQuad(sil);
    }

    // Gate with the mask: draw the shader output, then keep only where the mask
    // is opaque (destination-in). masked ends up transparent on the background.
    masked.clear();
    masked.push();
    masked.image(sil, 0, 0, masked.width, masked.height);
    if (maskImg) {
      masked.blendMode(p.REMOVE); // destination-out of the inverse == keep inside mask
      // REMOVE subtracts alpha; to KEEP inside the mask we instead multiply.
      masked.blendMode(p.MULTIPLY);
      masked.image(maskImg, 0, 0, masked.width, masked.height);
    }
    masked.pop();
    masked.blendMode(p.BLEND);

    // For a flat silhouette (effect !== none, keepOriginal false) recolor is
    // already baked by the shader; MULTIPLY by white mask preserves it.
    return masked;
  }

  function dispose() {
    for (const g of [sil, masked]) {
      if (g && typeof g.remove === 'function') {
        try { g.remove(); } catch { /* instance-mode remove may throw */ }
      }
    }
    sil = null; masked = null;
  }

  return { buildBuffers, setMask, renderSilhouette, dispose, get size() { return sil ? { w: sil.width, h: sil.height } : null; } };
}
```

> **Implementation note for the executor:** the mask-gating blend is the one part
> that must be verified visually (blend-mode semantics differ subtly across p5
> renderers). In Task 12's browser verification, confirm the background is
> paper-white and only the object is rendered. If `MULTIPLY` with a white/transparent
> mask does not gate correctly on the P2D buffer, switch the gate to a manual
> `masked.loadPixels()` alpha copy from `maskImg` (same result, no blend-mode
> dependency). Keep the public interface (`renderSilhouette` returns the masked
> buffer) unchanged either way.

- [ ] **Step 2: Lint the new file**

Run: `npx eslint src/silueta/js/render.js --max-warnings 0`
Expected: no errors. (Runtime correctness is verified in Task 12 via the browser.)

- [ ] **Step 3: Commit**

```bash
git add src/silueta/js/render.js
git commit -m "feat(silueta): add WEBGL silhouette render layer with mask gating"
```

---

## Task 7: Controls declaration

**Files:**
- Create: `src/silueta/js/controls.js`

- [ ] **Step 1: Create `controls.js`**

Create `src/silueta/js/controls.js`:

```js
// SILUETA — control panel sections (declarative SECTIONS consumed by
// shared/ui/panelBuilder.js). app.js supplies applyChange (dispatches on the
// `regen` tag) and refreshVisibility (the sl-sil-color enable/disable gate).
//
// regen tags:
//   'canvas'  — cnv.ratio changed: resize buffers, re-extract, re-layout.
//   'render'  — silhouette buffer params (effect/granularity/color/keepOriginal).
//   'effect'  — render.effect changed (same as 'render' plus visibility refresh).
//   'extract' — extract.threshold/merge: re-run extraction (invalidates render + layout).
//   'layout'  — layout-only params: re-run layout.js, mask unchanged.

import { RATIO_TYPES, EFFECT_TYPES, LAYOUT_MODES } from './state.js';

export const SECTIONS = [
  {
    title: 'Preview',
    controls: [
      { id: 'sl-scale', type: 'slider', label: 'Canvas Display', path: 'cnv.scale', min: 0.3, max: 1, step: 0.01 },
      { id: 'sl-ratio', type: 'select', label: 'Canvas Ratio', path: 'cnv.ratio', options: RATIO_TYPES, regen: 'canvas' },
    ],
  },
  {
    title: 'Silhouette',
    controls: [
      { id: 'sl-effect', type: 'select', label: 'Visual Effect', path: 'render.effect', options: EFFECT_TYPES, regen: 'effect' },
      { id: 'sl-granularity', type: 'slider', label: 'Processing Granularity (px)', path: 'render.granularity', min: 10, max: 28, step: 1, regen: 'render' },
      // sl-sil-color: DISABLED (not hidden) when render.effect === 'none' (app.js refreshVisibility).
      { id: 'sl-sil-color', type: 'color', label: 'Silhouette Color', path: 'render.color', regen: 'render' },
    ],
  },
  {
    title: 'Layout',
    controls: [
      { id: 'sl-mode', type: 'select', label: 'Main Layout Mode', path: 'layout.mode', options: LAYOUT_MODES, regen: 'layout' },
      { id: 'sl-main-text', type: 'textarea', label: 'Main Text Content', path: 'layout.main.text', rows: 3, regen: 'layout' },
      { id: 'sl-main-size', type: 'slider', label: 'Main Font Size', path: 'layout.main.fontSize', min: 40, max: 120, step: 1, regen: 'layout' },
      { id: 'sl-main-lh', type: 'slider', label: 'Main Line Height', path: 'layout.main.lineHeight', min: 0.7, max: 1.4, step: 0.05, regen: 'layout' },
    ],
  },
  {
    title: 'Small Text',
    controls: [
      { id: 'sl-small-enabled', type: 'check', label: 'Contour-Avoidance Small Text', path: 'layout.small.enabled', regen: 'layout' },
      { id: 'sl-small-text', type: 'textarea', label: 'Small Text', path: 'layout.small.text', rows: 2, regen: 'layout' },
      { id: 'sl-small-size', type: 'slider', label: 'Small Font Size', path: 'layout.small.fontSize', min: 8, max: 24, step: 1, regen: 'layout' },
    ],
  },
  {
    title: 'Extraction',
    controls: [
      { id: 'sl-keep-original', type: 'check', label: 'Keep Original Image Content', path: 'render.keepOriginal', regen: 'render' },
      { id: 'sl-threshold', type: 'slider', label: 'Brightness Threshold', path: 'extract.threshold', min: 0, max: 255, step: 1, regen: 'extract' },
      { id: 'sl-merge', type: 'check', label: 'Cross-line Connected Component Merge', path: 'extract.merge', regen: 'extract' },
    ],
  },
  {
    title: 'Export',
    controls: [
      { id: 'sl-export-size', type: 'slider', label: 'Export Size (px)', path: 'cnv.density.export', min: 500, max: 4000, step: 100 },
      { id: 'sl-export-quality', type: 'slider', label: 'Export Quality', path: 'rec.quality', min: 0, max: 100, step: 5 },
    ],
  },
];
```

- [ ] **Step 2: Verify it imports cleanly**

Run: `node --input-type=module -e "import('./src/silueta/js/controls.js').then(m => console.log('sections:', m.SECTIONS.length))"`
Expected: prints `sections: 6`.

- [ ] **Step 3: Commit**

```bash
git add src/silueta/js/controls.js
git commit -m "feat(silueta): add control panel sections"
```

---

## Task 8: SVG export (analytic vector rebuild)

**Files:**
- Create: `src/silueta/js/svgExport.js`

- [ ] **Step 1: Create `svgExport.js`**

Create `src/silueta/js/svgExport.js`:

```js
// SILUETA — analytic SVG export. Rebuilds the composition as real vector: a
// background rect, silhouette cells (<rect> for pixelate, <circle> for
// halftone) sampled from the mask grid, and every layout draw item as <text>.
// No raster embed. Downloaded via the shared saveSVG util.

import { saveSVG } from '../../shared/utils/svgDownload.js';
import { timestamp } from '../../shared/utils/datetime.js';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * @param {object} opts
 *   { w, h, maskInfo, render, layoutItems, fontFamily }
 *   render: state.render ({ effect, granularity, color, keepOriginal })
 *   layoutItems: output of computeLayout()
 */
export function buildSVG({ w, h, maskInfo, render, layoutItems, fontFamily }) {
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
  parts.push(`<rect width="${w}" height="${h}" fill="#ffffff"/>`);

  // Silhouette cells: walk the mask at the granularity grid; one shape per
  // filled cell. Cell size in canvas px = granularity.
  if (render.effect !== 'none' && maskInfo) {
    const { mask, w: mw, h: mh } = maskInfo;
    const cell = Math.max(2, render.granularity);
    const fill = render.color;
    parts.push(`<g fill="${fill}">`);
    for (let cy = 0; cy < h; cy += cell) {
      for (let cx = 0; cx < w; cx += cell) {
        // Sample the mask at the cell center.
        const mx = Math.min(mw - 1, Math.floor(((cx + cell / 2) / w) * mw));
        const my = Math.min(mh - 1, Math.floor(((cy + cell / 2) / h) * mh));
        if (!mask[my * mw + mx]) continue;
        if (render.effect === 'halftone') {
          const r = cell * 0.42;
          parts.push(`<circle cx="${(cx + cell / 2).toFixed(1)}" cy="${(cy + cell / 2).toFixed(1)}" r="${r.toFixed(1)}"/>`);
        } else {
          parts.push(`<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}"/>`);
        }
      }
    }
    parts.push('</g>');
  }

  // Text items.
  for (const it of layoutItems) {
    const size = it.size;
    const fill = it.role === 'main' ? '#111111' : '#333333';
    const weight = it.role === 'main' ? '700' : '400';
    parts.push(
      `<text x="${it.x.toFixed(1)}" y="${it.y.toFixed(1)}" font-family="${esc(fontFamily)}" ` +
      `font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(it.text)}</text>`
    );
  }

  parts.push('</svg>');
  return parts.join('\n');
}

/** Build + download the SVG. */
export function exportSVG(opts) {
  const svg = buildSVG(opts);
  saveSVG(svg, `silueta-${timestamp()}.svg`);
  return svg;
}
```

- [ ] **Step 2: Add a smoke test**

Create `src/silueta/js/svgExport.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildSVG } from './svgExport.js';

describe('buildSVG', () => {
  const w = 40, h = 40;
  const mw = 4, mh = 4;
  const mask = new Uint8Array(mw * mh);
  mask[1 * mw + 1] = 1; // one masked cell
  const maskInfo = { mask, w: mw, h: mh };
  const layoutItems = [
    { role: 'main', x: 4, y: 52, size: 52, text: 'HELLO' },
    { role: 'small', x: 10, y: 20, size: 10, text: 'caption' },
  ];

  it('emits a <text> element per layout item', () => {
    const svg = buildSVG({ w, h, maskInfo, render: { effect: 'pixelate', granularity: 10, color: '#B8B8B8' }, layoutItems, fontFamily: 'Inter' });
    expect((svg.match(/<text /g) || []).length).toBe(2);
  });

  it('emits rects for pixelate and circles for halftone', () => {
    const px = buildSVG({ w, h, maskInfo, render: { effect: 'pixelate', granularity: 10, color: '#000' }, layoutItems: [], fontFamily: 'Inter' });
    const ht = buildSVG({ w, h, maskInfo, render: { effect: 'halftone', granularity: 10, color: '#000' }, layoutItems: [], fontFamily: 'Inter' });
    expect(px).toContain('<rect x=');
    expect(ht).toContain('<circle ');
  });

  it('emits no silhouette cells when effect is none', () => {
    const svg = buildSVG({ w, h, maskInfo, render: { effect: 'none', granularity: 10, color: '#000' }, layoutItems: [], fontFamily: 'Inter' });
    expect(svg).not.toContain('<circle ');
    // background rect is allowed; ensure no silhouette <rect x= cells
    expect(svg).not.toContain('<rect x=');
  });
});
```

- [ ] **Step 3: Run the SVG tests**

Run: `npx vitest run src/silueta/js/svgExport.test.js`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/silueta/js/svgExport.js src/silueta/js/svgExport.test.js
git commit -m "feat(silueta): add analytic SVG export"
```

---

## Task 9: App orchestration (p5 lifecycle + wiring)

Ties everything together, mirroring difuso's `app.js` structure: buffers, dirty-loop, panel, presets, persistence, PNG/MP4/SVG export.

**Files:**
- Create: `src/silueta/js/app.js`

- [ ] **Step 1: Create `app.js`**

Create `src/silueta/js/app.js`:

```js
// SILUETA — poster/typography workspace. Orchestrates the three layers:
// extract.js (mask) → render.js (WEBGL silhouette) → layout.js (text), and
// composites paper bg → masked silhouette → text onto the visible canvas.
// Structure mirrors difuso/js/app.js (buffers, dirty-loop, panel, presets,
// export). See docs/superpowers/specs/2026-07-21-silueta-workspace-design.md.

import * as state from './state.js';
import { SECTIONS } from './controls.js';
import { extractFromBrightness } from './extract.js';
import { computeLayout } from './layout.js';
import { createRender } from './render.js';
import { exportSVG } from './svgExport.js';

import { createPersistence } from '../../shared/utils/persistence.js';
import { timestamp } from '../../shared/utils/datetime.js';
import { downloadPresetJSON, openPresetFile } from '../../shared/utils/presetIO.js';
import { deepMerge } from '../../shared/utils/deepMerge.js';
import { exportMP4 } from '../../shared/utils/exportMedia.js';
import { debounce } from '../../shared/utils/debounce.js';
import { createDirtyLoop } from '../../shared/utils/dirtyLoop.js';
import {
  createPanelBuilder,
  buildPresetSection,
  openSections,
} from '../../shared/ui/panelBuilder.js';

const STORAGE_KEY = 'silueta-tool';
const ANALYSIS_EDGE = 120; // long-edge px of the mask analysis buffer
const FONT_FAMILY = 'Inter, system-ui, sans-serif';

const { cnv, render, extract, layout, rec, RESOLUTIONS } = state;

export function siluetaSketch(p) {
  let canvasContainer;
  let sourceImage = null;   // full-res uploaded/default image
  let resizedSource = null; // source fit to the silhouette buffer
  let maskInfo = null;      // { mask, labels, components, w, h }
  let layoutItems = [];
  let isReady = false;
  let PRESETS = {};
  const recVideo = { active: false, seconds: 4 };
  const dirty = createDirtyLoop(p);
  const renderer = createRender({ p, state });

  const panel = createPanelBuilder({
    state,
    applyChange,
    refreshVisibility,
    onSliderInput: () => dirty.markDirty(),
  });

  // ---- Deterministic PRNG (LCG) seeded from layout.seed for reproducibility. ----
  function makeRand(seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  // ---- Canvas sizing (poster ratio, independent of source aspect). ----
  function computeCanvasSize() {
    const res = RESOLUTIONS[cnv.ratio] || RESOLUTIONS['3:4'];
    const maxW = Math.min(window.innerWidth * 0.85, cnv.maxSize);
    const maxH = Math.min(window.innerHeight * 0.85, cnv.maxSize);
    const fit = Math.min(maxW / res.width, maxH / res.height);
    cnv.width = Math.max(2, Math.round((res.width * fit) / 2) * 2);
    cnv.height = Math.max(2, Math.round((res.height * fit) / 2) * 2);
  }

  // ---- Fit the source into a buffer-sized image (contain). ----
  function buildResizedSource() {
    if (!sourceImage) return;
    const r = Math.min(cnv.width / sourceImage.width, cnv.height / sourceImage.height);
    let nw = Math.max(2, Math.floor(sourceImage.width * r));
    let nh = Math.max(2, Math.floor(sourceImage.height * r));
    nw -= nw % 2; nh -= nh % 2;
    // Draw the source centered on a white canvas the size of the buffer, so the
    // mask coordinate space matches the silhouette buffer 1:1.
    const g = p.createImage(cnv.width, cnv.height);
    g.loadPixels();
    for (let i = 0; i < g.pixels.length; i++) g.pixels[i] = 255; // white
    g.updatePixels();
    const fitted = p.createImage(nw, nh);
    fitted.copy(sourceImage, 0, 0, sourceImage.width, sourceImage.height, 0, 0, nw, nh);
    g.copy(fitted, 0, 0, nw, nh, (cnv.width - nw) >> 1, (cnv.height - nh) >> 1, nw, nh);
    resizedSource = g;
  }

  // ---- Extraction: downscale resizedSource → brightness → mask + components. ----
  function runExtract() {
    if (!resizedSource) return;
    const scale = ANALYSIS_EDGE / Math.max(resizedSource.width, resizedSource.height);
    const aw = Math.max(1, Math.round(resizedSource.width * scale));
    const ah = Math.max(1, Math.round(resizedSource.height * scale));
    const small = p.createImage(aw, ah);
    small.copy(resizedSource, 0, 0, resizedSource.width, resizedSource.height, 0, 0, aw, ah);
    small.loadPixels();
    const brightness = new Uint8Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) {
      const j = i * 4;
      brightness[i] = (small.pixels[j] * 0.299 + small.pixels[j + 1] * 0.587 + small.pixels[j + 2] * 0.114) | 0;
    }
    const areaFloor = Math.max(2, Math.round(aw * ah * 0.002));
    maskInfo = extractFromBrightness(brightness, aw, ah, {
      threshold: extract.threshold,
      merge: extract.merge,
      areaFloor,
    });
    renderer.setMask(maskInfo);
  }

  // ---- Layout. ----
  function runLayout() {
    if (!maskInfo) { layoutItems = []; return; }
    layoutItems = computeLayout({
      w: cnv.width,
      h: cnv.height,
      maskInfo,
      state: layout,
      rand: makeRand(layout.seed),
    });
  }

  // ---- Full rebuild: size → resize source → extract → buffers → layout. ----
  function rebuildAll() {
    computeCanvasSize();
    buildResizedSource();
    renderer.buildBuffers(cnv.width, cnv.height, cnv.density.base);
    runExtract();
    runLayout();
    dirty.markDirty();
  }

  // ---- Compose the visible frame. ----
  function drawCanvas() {
    p.clear();
    p.push();
    // WEBGL origin is canvas center; shift left to center in the free area left
    // of the 290px panel (same discipline as difuso).
    p.translate(-145, 0);

    // Paper background.
    p.push();
    p.fill(255);
    p.noStroke();
    p.rectMode(p.CENTER);
    p.rect(0, 0, cnv.width, cnv.height);
    p.pop();

    // Masked silhouette.
    if (resizedSource) {
      const masked = renderer.renderSilhouette(resizedSource);
      p.image(masked, 0, 0, cnv.width, cnv.height);
    }

    // Text on top.
    drawText();
    p.pop();
  }

  function drawText() {
    p.push();
    p.textFont('Inter');
    p.textAlign(p.LEFT, p.BASELINE);
    // Convert top-left canvas coords to WEBGL center-origin.
    const ox = -cnv.width / 2;
    const oy = -cnv.height / 2;
    for (const it of layoutItems) {
      if (it.role === 'main') {
        p.fill(layout.main.color);
        p.textStyle(p.BOLD);
      } else {
        p.fill('#333333');
        p.textStyle(p.NORMAL);
      }
      p.textSize(it.size);
      p.text(it.text, ox + it.x, oy + it.y);
    }
    p.pop();
  }

  // ---- Change dispatch. ----
  function applyChange(ctrl) {
    switch (ctrl.regen) {
      case 'canvas': rebuildAll(); break;
      case 'extract': runExtract(); runLayout(); break;
      case 'effect': /* fallthrough to render + visibility */ // eslint-disable-line no-fallthrough
      case 'render': /* buffer params only */ break;
      case 'layout': runLayout(); break;
    }
    refreshVisibility();
    dirty.markDirty();
    saveState();
  }

  function refreshVisibility() {
    const colorEl = document.getElementById('sl-sil-color');
    if (colorEl) colorEl.disabled = render.effect === 'none';
  }

  function syncUIFromState() {
    panel.syncUIFromState(SECTIONS);
    refreshVisibility();
  }

  // ---- Panel. ----
  function buildUI() {
    const root = document.getElementById('sl-controls');
    if (!root) return;
    root.innerHTML = '';
    buildPresetSection(root, {
      idPrefix: 'sl',
      presets: PRESETS,
      onExport: exportPreset,
      onImport: importPreset,
    });
    panel.buildSections(root, SECTIONS);
    openSections(root, [1, 2]); // Silhouette + Layout open by default
    refreshVisibility();
  }

  // ---- Persistence. ----
  function serializeState() {
    return {
      cnv: { ratio: cnv.ratio, scale: cnv.scale, density: { export: cnv.density.export } },
      render: JSON.parse(JSON.stringify(render)),
      extract: JSON.parse(JSON.stringify(extract)),
      layout: JSON.parse(JSON.stringify(layout)),
      rec: { quality: rec.quality },
    };
  }
  const { saveState, loadState } = createPersistence(STORAGE_KEY, 'silueta', serializeState, (data) => {
    if (data.cnv) deepMerge(cnv, data.cnv);
    if (data.render) deepMerge(render, data.render);
    if (data.extract) deepMerge(extract, data.extract);
    if (data.layout) deepMerge(layout, data.layout);
    if (data.rec) deepMerge(rec, data.rec);
  });

  function applyPreset(preset) {
    if (!preset) return;
    if (preset.cnv) deepMerge(cnv, preset.cnv);
    if (preset.render) deepMerge(render, preset.render);
    if (preset.extract) deepMerge(extract, preset.extract);
    if (preset.layout) deepMerge(layout, preset.layout);
    rebuildAll();
    syncUIFromState();
    saveState();
  }
  function exportPreset() { downloadPresetJSON(`silueta-preset-${timestamp()}.json`, serializeState()); }
  function importPreset() { openPresetFile((d) => applyPreset(d), () => setStatus('Invalid preset file')); }

  // ---- Export. ----
  function setStatus(msg) {
    const el = document.getElementById('sl-export-status');
    if (el) el.innerText = msg;
  }

  function withHighRes(fn) {
    const savedBase = cnv.density.base;
    try {
      const maxEdge = Math.max(cnv.width, cnv.height);
      const target = cnv.density.export || 2000;
      const d = Math.max(1, target / maxEdge);
      cnv.density.base = d;
      p.pixelDensity(d);
      renderer.buildBuffers(cnv.width, cnv.height, d);
      renderer.setMask(maskInfo);
      fn(d);
    } finally {
      cnv.density.base = savedBase;
      p.pixelDensity(savedBase);
      renderer.buildBuffers(cnv.width, cnv.height, savedBase);
      renderer.setMask(maskInfo);
      drawCanvas();
    }
  }

  function doExportPNG() {
    withHighRes((d) => {
      drawCanvas();
      const w = Math.floor(cnv.width * d);
      const h = Math.floor(cnv.height * d);
      const copy = document.createElement('canvas');
      copy.width = w; copy.height = h;
      copy.getContext('2d').drawImage(p.canvas, 0, 0, w, h);
      const link = document.createElement('a');
      link.download = `silueta-${timestamp()}.png`;
      link.href = copy.toDataURL('image/png');
      link.click();
    });
  }

  function doExportSVG() {
    exportSVG({
      w: cnv.width,
      h: cnv.height,
      maskInfo,
      render,
      layoutItems,
      fontFamily: FONT_FAMILY,
    });
  }

  function doExportMP4() {
    const sel = document.getElementById('sl-mp4-length');
    recVideo.seconds = sel ? parseInt(sel.value, 10) || 4 : 4;
    const baseSeed = layout.seed;
    let frame = 0;
    return exportMP4({
      p, prefix: 'silueta', cnv, rec, recVideo,
      drawComposite: drawCanvas,
      beforeDraw: (n) => {
        // Subtle seeded drift so the clip has motion: re-jitter the layout each
        // frame from a moving seed.
        frame = n;
        layout.seed = baseSeed + frame;
        runLayout();
        return Promise.resolve();
      },
      setStatus,
      getCanvas: () => p.canvas,
      getSize: () => ({ w: Math.floor(cnv.width * cnv.density.base), h: Math.floor(cnv.height * cnv.density.base) }),
    }).finally(() => { layout.seed = baseSeed; runLayout(); dirty.markDirty(); });
  }

  function bindFooter() {
    document.getElementById('sl-btn-save-svg')?.addEventListener('click', doExportSVG);
    document.getElementById('sl-btn-save-png')?.addEventListener('click', doExportPNG);
    document.getElementById('sl-btn-save-mp4')?.addEventListener('click', doExportMP4);
    document.getElementById('sl-preset')?.addEventListener('change', (e) => {
      const preset = PRESETS[e.target.value];
      if (preset) applyPreset(preset);
    });
  }

  function bindDragDrop() {
    if (!canvasContainer) return;
    canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
    canvasContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) loadImageFile(file);
    });
  }

  function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        sourceImage = await p.loadImage(ev.target.result);
        rebuildAll();
      } catch (err) {
        console.warn('[silueta] image load failed:', err);
        setStatus('Image load failed');
      }
    };
    reader.readAsDataURL(file);
  }

  // ---- p5 lifecycle. ----
  p.setup = () => {
    canvasContainer = document.getElementById('silueta-canvas');
    if (!canvasContainer) return;
    const canvas = p.createCanvas(
      canvasContainer.clientWidth || window.innerWidth,
      canvasContainer.clientHeight || window.innerHeight,
      p.WEBGL
    );
    canvas.parent(canvasContainer);
    p.pixelDensity(cnv.density.base);
    p.imageMode(p.CENTER);
    p.rectMode(p.CENTER);
    p.noStroke();
    p.frameRate(rec.frameRate);

    const restored = loadState();

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}assets/silueta/presets.json`).then((r) => r.json()).then((d) => { PRESETS = d; }).catch(() => {}),
      p.loadImage(`${import.meta.env.BASE_URL}assets/silueta/default.webp`).then((img) => { sourceImage = img; }).catch((e) => console.warn('[silueta] default image load failed:', e)),
    ]).finally(() => {
      rebuildAll();
      buildUI();
      bindFooter();
      bindDragDrop();
      if (restored) syncUIFromState();
      isReady = true;
      dirty.markDirty();
    });
  };

  p.draw = () => {
    if (!isReady) return;
    const live = recVideo.active || dirty.needsDraw();
    if (!live) { dirty.afterDraw(); return; }
    drawCanvas();
    dirty.consume();
    if (!recVideo.active) dirty.afterDraw();
  };

  const onResize = debounce(() => {
    if (!canvasContainer) return;
    p.resizeCanvas(canvasContainer.clientWidth || window.innerWidth, canvasContainer.clientHeight || window.innerHeight);
    if (isReady) rebuildAll();
  }, 200);
  p.windowResized = () => onResize();
}

export { siluetaSketch as default };
```

- [ ] **Step 2: Lint the file**

Run: `npx eslint src/silueta/js/app.js --max-warnings 0`
Expected: no errors. (The `no-fallthrough` on the intentional `effect→render` case is disabled inline.)

- [ ] **Step 3: Commit**

```bash
git add src/silueta/js/app.js
git commit -m "feat(silueta): add app orchestration (lifecycle, wiring, export)"
```

---

## Task 10: Template + assets

**Files:**
- Create: `src/silueta/template.html`
- Create: `public/assets/silueta/default.webp` (copy an existing demo image)
- Create: `public/assets/silueta/presets.json`

- [ ] **Step 1: Create the template**

Create `src/silueta/template.html`:

```html
<div class="app-container">
  <aside class="sidebar secuencia-panel right-sidebar">
    <div class="sidebar-content" id="sl-controls"></div>
    <footer class="sidebar-footer">
      <button id="sl-btn-save-svg" class="btn btn-accent">Export as SVG</button>
      <button id="sl-btn-save-png" class="btn btn-secondary">Export as PNG</button>
      <div class="btn-group">
        <button id="sl-btn-save-mp4" class="btn btn-secondary">Export as MP4</button>
        <select id="sl-mp4-length" class="grafema-select" style="width:auto;min-width:64px" title="Video length">
          <option value="2">2s</option>
          <option value="4" selected>4s</option>
          <option value="6">6s</option>
          <option value="8">8s</option>
          <option value="10">10s</option>
        </select>
      </div>
      <div id="sl-export-status" class="export-status"></div>
    </footer>
  </aside>
  <main class="canvas-viewport" id="silueta-canvas">
    <!-- p5.js canvas injected here -->
  </main>
</div>
```

- [ ] **Step 2: Provide the default image**

Reuse difuso's default image so the workspace has something to show on first load (replaceable later with a seafood image).

Run: `cp public/assets/difuso/default.webp public/assets/silueta/default.webp`
(First: `mkdir -p public/assets/silueta`.)
Expected: file exists — verify with `ls -la public/assets/silueta/`.

- [ ] **Step 3: Create starter presets**

Create `public/assets/silueta/presets.json`:

```json
{
  "pixelMixed": {
    "render": { "effect": "pixelate", "granularity": 12, "color": "#B8B8B8", "keepOriginal": false },
    "extract": { "threshold": 233, "merge": true },
    "layout": { "mode": "mixed", "main": { "text": "REMIX LAYOUT.\nSMART GRAPHICS.", "fontSize": 52, "lineHeight": 0.9 }, "small": { "enabled": true } }
  },
  "halftoneMixed": {
    "render": { "effect": "halftone", "granularity": 18, "color": "#587282", "keepOriginal": false },
    "extract": { "threshold": 233, "merge": true },
    "layout": { "mode": "mixed", "main": { "text": "PIXEL ART.\n网点 对齐.", "fontSize": 56, "lineHeight": 0.9 }, "small": { "enabled": true } }
  },
  "pixelOverlay": {
    "render": { "effect": "pixelate", "granularity": 16, "color": "#687282", "keepOriginal": true },
    "extract": { "threshold": 233, "merge": true },
    "layout": { "mode": "overlay", "main": { "text": "SMART\nGRAPHICS", "fontSize": 61, "lineHeight": 0.9 }, "small": { "enabled": true } }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/silueta/template.html public/assets/silueta/
git commit -m "feat(silueta): add template, default image, starter presets"
```

---

## Task 11: Register the workspace

**Files:**
- Modify: `src/js/main.js` (add to `workspaces[]`)
- Modify: `index.html` (tab button + view include, widen switcher for 6 tabs)

- [ ] **Step 1: Register in `main.js`**

In `src/js/main.js`, in the `workspaces` array literal, add a `silueta` row after the `clon` row (keep the `.map(...)` that follows intact):

```js
  { name: 'clon',    load: () => import('../clon/js/app.js').then((m) => m.clonSketch),       containerId: 'clon-canvas',    animated: true, shortcut: 'KeyC' },
  { name: 'silueta', load: () => import('../silueta/js/app.js').then((m) => m.siluetaSketch), containerId: 'silueta-canvas', animated: true, shortcut: 'KeyL' },
```

- [ ] **Step 2: Add the tab button in `index.html`**

In `index.html`, inside `<div class="app-switcher" role="tablist">`, after the `tab-clon` button, add:

```html
      <button id="tab-silueta" class="switcher-tab" data-target="silueta" role="tab" aria-selected="false" aria-controls="app-silueta">SILUETA</button>
```

- [ ] **Step 3: Add the view include in `index.html`**

In `index.html`, after the `app-clon` view `<div>...</div>`, add:

```html
    <div id="app-silueta" class="app-view" role="tabpanel" aria-labelledby="tab-silueta" style="width:100%; height:100%; display:none;">
      <!--#include file="src/silueta/template.html"-->
    </div>
```

- [ ] **Step 4: Widen the switcher capsule for a 6th tab**

In `index.html`, the switcher wrapper uses `left:calc((100vw - 290px) / 2)` sized for 5 tabs. Change `290px` to `350px` (5 → 6 tabs, ~60px per tab) in that inline style so the capsule stays centered:

```html
  <div style="position:fixed; top:16px; left:calc((100vw - 350px) / 2); transform:translateX(-50%); z-index:1000; display:flex; gap:8px;">
```

- [ ] **Step 5: Build to verify the include resolves and the bundle compiles**

Run: `npm run build`
Expected: build succeeds; output includes a `silueta` chunk (grep the build log or `ls dist/assets` for a silueta-*.js). If the build fails on the include, re-check the `<!--#include file="src/silueta/template.html"-->` path.

- [ ] **Step 6: Commit**

```bash
git add src/js/main.js index.html
git commit -m "feat(silueta): register workspace (tab, view, shortcut)"
```

---

## Task 12: Browser verification + full test/lint pass

No new files — this task verifies the running workspace and closes out the plan. Follows the harness verification workflow.

- [ ] **Step 1: Full unit-test suite**

Run: `npm test`
Expected: all tests PASS (extract, layout, svgExport, panelBuilder, plus the pre-existing difuso/divix tests — no regressions).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 3: Start the dev server and open the workspace**

Use the Browser pane: `preview_start` with the dev server, then navigate to the app and click the **SILUETA** tab (or `Alt+L`).

- [ ] **Step 4: Verify no console/runtime errors**

Use `read_console_messages` (onlyErrors). Expected: no errors. The canvas shows the default image as a silhouette on a white poster with text.

- [ ] **Step 5: Exercise every control and confirm it matches the demo**

For each, change the control and confirm the canvas updates (screenshot between key states):
- Effect: None → Pixelate → Halftone (silhouette blocks/dots appear; None shows the plain image).
- Granularity 10 → 28 (blocks/dots grow).
- Silhouette Color (picker is disabled in None; changes the flat color otherwise).
- Main Layout Mode: mixed vs overlay (text weaves vs tiles).
- Main Text / font size / line height (text updates).
- Contour-Avoidance toggle (small captions move off the silhouette when on).
- Threshold slider (more/less of the image counts as object).
- Cross-line merge toggle (nearby blobs fuse).
- Keep Original toggle (cells keep source color vs flat).

**Critical check (from Task 6's note):** confirm the background is paper-white and only the object is rendered. If the silhouette fills the whole canvas (mask gate not working), apply the manual alpha-copy fallback described in Task 6's implementation note, then re-verify.

- [ ] **Step 6: Verify exports**

- Click **Export as PNG** → a `silueta-*.png` downloads; open it and confirm it matches the canvas at higher resolution.
- Click **Export as SVG** → a `silueta-*.svg` downloads; open it in a browser/editor and confirm text is selectable vector and cells are shapes.
- Click **Export as MP4** (2s) → an `.mp4` downloads and plays with subtle motion.

- [ ] **Step 7: Screenshot proof + commit any fixes**

Capture a final screenshot of a Pixelate + mixed composition for the record. If Step 5/6 required code fixes, commit them:

```bash
git add -A
git commit -m "fix(silueta): browser-verification fixes"
```

- [ ] **Step 8: Final full pass**

Run: `npm test && npm run lint && npm run build`
Expected: all green.

---

## Self-Review (completed by plan author)

**Spec coverage:** every spec section maps to a task —
- §3 Layer 1 (extraction) → Task 3; Layer 2 (render) → Tasks 5–6; Layer 3 (layout) → Task 4.
- §4 state model → Task 2. §5 controls (incl. new `textarea`) → Tasks 1, 7. §6 file layout → Tasks 2–10.
- §7 registration → Task 11. §8 compositing → Task 9. §9 export (PNG/MP4/SVG) → Tasks 8, 9. §10 testing → Tasks 3, 4, 8, 12.

**Placeholder scan:** no TBD/TODO/"handle edge cases"; every code step has full code; every command has expected output.

**Type consistency:** `extractFromBrightness` → `{ mask, labels, components, w, h }` consumed identically by `render.setMask`, `computeLayout`, and `buildSVG`. `computeLayout` returns items `{ role, x, y, size, text, col, row }` consumed by `drawText` and `buildSVG`. `createRender` exposes `buildBuffers/setMask/renderSilhouette/dispose` — all called in app.js. `siluetaSketch` is exported both named and default; `main.js` imports `m.siluetaSketch` (named) — consistent.

**Known risk carried into execution:** the mask-gating blend (Task 6) is the one runtime-only unknown; Task 6 documents a deterministic fallback and Task 12 Step 5 gates on it.
```