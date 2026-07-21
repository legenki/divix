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
