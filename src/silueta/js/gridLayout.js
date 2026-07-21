// SILUETA — grid composition engine. Distributes image, headline and caption
// blocks over a responsive column/row grid using deterministic bin-packing.
// Pure: no p5, no DOM, and the PRNG is always passed in, so the same seed and
// inputs give the same poster (preview === PNG === SVG).
//
// The grid is nominally 4x6 but responds to two things:
//   * Canvas Ratio — a taller poster gets more rows, a wider one more columns,
//     so cells stay roughly square instead of stretching with the canvas.
//   * Element count — more elements densify the grid so blocks keep breathing
//     room rather than overflowing a fixed 4x6.
//
// Blocks occupy 1x1, 2x1 or 2x2 cells. Packing is first-fit over a boolean
// occupancy map, scanning row-major, so output is stable and gap-free.
//
// Block: { kind: 'image'|'main'|'small', col, row, cw, ch, x, y, w, h, ... }

/** Nominal grid used at 3:4 with a mid element count. */
export const BASE_COLS = 4;
export const BASE_ROWS = 6;

/**
 * Derive a responsive grid from the canvas aspect and how many blocks must fit.
 * Keeps cells near-square: a 9:16 poster gains rows, a 1:1 poster loses them.
 *
 * @param {number} w canvas width in px
 * @param {number} h canvas height in px
 * @param {number} count number of blocks to place
 * @returns {{cols:number, rows:number, cellW:number, cellH:number, w:number, h:number}}
 */
export function makeGrid(w, h, count) {
  const aspect = h / Math.max(1, w); // >1 = portrait
  // Columns grow slightly for wide canvases, rows follow the aspect so that
  // cellW ≈ cellH. Both are clamped to keep the composition legible.
  let cols = Math.round(BASE_COLS / Math.sqrt(Math.max(0.4, aspect)) * 1.0);
  cols = Math.min(7, Math.max(3, cols));
  let rows = Math.max(3, Math.round((cols * aspect)));

  // Size the grid to the demand: blocks average ~1.6 cells (a mix of 1x1, 2x1
  // and 2x2), and the packer spreads them over the whole grid, so the capacity
  // should track the block count rather than exceed it — an oversized grid
  // leaves the bottom of the poster empty.
  const need = Math.max(1, count) * 1.6;
  let guard = 0;
  while (cols * rows < need && guard < 16) {
    if (rows / cols < aspect) rows += 1;
    else cols += 1;
    guard += 1;
  }
  // Shrink an over-large grid back down for small compositions.
  while (cols > 3 && rows > 3 && (cols - 1) * rows >= need && (rows - 1) * cols >= need && guard < 24) {
    if (rows / cols > aspect) rows -= 1;
    else cols -= 1;
    guard += 1;
  }
  rows = Math.min(14, rows);
  cols = Math.min(8, cols);

  return { cols, rows, cellW: w / cols, cellH: h / rows, w, h };
}

/** Fresh occupancy map: occ[row][col] === true when taken. */
function makeOccupancy(grid) {
  return Array.from({ length: grid.rows }, () => new Array(grid.cols).fill(false));
}

/** True when a cw x ch block fits at (col,row) without overlap or overflow. */
export function fits(occ, grid, col, row, cw, ch) {
  if (col < 0 || row < 0 || col + cw > grid.cols || row + ch > grid.rows) return false;
  for (let r = row; r < row + ch; r++) {
    for (let c = col; c < col + cw; c++) {
      if (occ[r][c]) return false;
    }
  }
  return true;
}

function occupy(occ, col, row, cw, ch) {
  for (let r = row; r < row + ch; r++) {
    for (let c = col; c < col + cw; c++) occ[r][c] = true;
  }
}

/**
 * Find a slot for a block, trying the requested size then degrading to smaller
 * footprints so a crowded grid still places it instead of dropping it.
 *
 * Placement is *scattered*, not first-fit: candidate slots are scored by how
 * far they sit from already-placed blocks, and the best-scoring slot wins.
 * Plain first-fit packs everything into the top-left and leaves the bottom of
 * the poster empty, which reads as a broken layout rather than a composition.
 *
 * @param {Function} [rand] PRNG for tie-breaking; omit for deterministic first-fit
 * @returns {{col:number,row:number,cw:number,ch:number}|null}
 */
export function findSlot(occ, grid, cw, ch, rand) {
  const candidates = [[cw, ch]];
  if (cw === 2 && ch === 2) candidates.push([2, 1], [1, 2], [1, 1]);
  else if (cw === 2 || ch === 2) candidates.push([1, 1]);

  for (const [tw, th] of candidates) {
    let best = null;
    let bestScore = -Infinity;
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (!fits(occ, grid, col, row, tw, th)) continue;
        if (!rand) return { col, row, cw: tw, ch: th };
        // Prefer slots surrounded by free space, with a little jitter so equal
        // scores don't always resolve to the same corner.
        const score = freedomScore(occ, grid, col, row, tw, th) + rand() * 0.75;
        if (score > bestScore) {
          bestScore = score;
          best = { col, row, cw: tw, ch: th };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Count free cells in the ring around a candidate slot (higher = emptier). */
function freedomScore(occ, grid, col, row, cw, ch) {
  let free = 0;
  for (let r = row - 1; r <= row + ch; r++) {
    for (let c = col - 1; c <= col + cw; c++) {
      if (r < 0 || c < 0 || r >= grid.rows || c >= grid.cols) continue;
      if (r >= row && r < row + ch && c >= col && c < col + cw) continue;
      if (!occ[r][c]) free += 1;
    }
  }
  return free;
}

/**
 * Split a body of copy into display-sized fragments. Sentences (or clauses)
 * become headline blocks; the algorithm keeps them short enough to set large.
 * @param {string} text
 * @param {number} maxWords longest fragment, in words
 */
export function splitFragments(text, maxWords = 4) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  // Split on sentence enders and hard separators, keeping the delimiter with
  // its phrase so "REMIX LAYOUT." stays a unit.
  const chunks = clean.split(/(?<=[.!?。！？])\s+|\s*[|/·—]\s*|\n+/).filter(Boolean);
  const out = [];
  for (const chunk of chunks) {
    const words = chunk.split(' ').filter(Boolean);
    for (let i = 0; i < words.length; i += maxWords) {
      const frag = words.slice(i, i + maxWords).join(' ').trim();
      if (frag) out.push(frag);
    }
  }
  return out;
}

/**
 * Split body copy into sentences so each caption block can carry a different
 * part of it. Falls back to the whole string when there is no punctuation to
 * break on, and merges very short tails into the previous sentence so a stray
 * fragment never becomes its own block.
 */
export function splitSentences(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const parts = clean.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (out.length && part.length < 24) out[out.length - 1] += ` ${part}`;
    else out.push(part);
  }
  return out.length ? out : [clean];
}

/** Wrap a caption into lines that fit `cols` characters, for small blocks. */
export function wrapText(text, charsPerLine) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > charsPerLine && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Build the block list for a poster.
 *
 * @param {object} opts
 * @param {number} opts.w canvas width
 * @param {number} opts.h canvas height
 * @param {Array}  opts.images  active media entries ({ key, img, w, h })
 * @param {number} opts.imageCount how many image blocks to place
 * @param {string} opts.mainText headline copy
 * @param {string} opts.smallText caption copy
 * @param {number} opts.mainCount how many headline blocks
 * @param {number} opts.smallCount how many caption blocks
 * @param {() => number} opts.rand deterministic PRNG in [0,1)
 * @returns {{grid:object, blocks:Array}}
 */
export function composeGrid({
  w, h, images = [], imageCount = 5,
  mainText = '', smallText = '',
  mainCount = 2, smallCount = 4,
  rand = Math.random,
}) {
  const fragments = splitFragments(mainText);
  const nImages = images.length ? Math.max(0, Math.min(imageCount, 24)) : 0;
  const nMain = fragments.length ? Math.max(0, Math.min(mainCount, fragments.length)) : 0;
  const nSmall = String(smallText).trim() ? Math.max(0, smallCount) : 0;

  // Headlines are drawn as overlays on top of the imagery, so they claim no
  // cells; the grid only has to hold the images and captions. The hero and the
  // mid tiles are counted at their real footprint so a big subject doesn't
  // crowd everything else off the page.
  const heroWeight = nImages > 0 ? 8 : 0;      // ~3x3 hero
  const midWeight = Math.min(2, Math.max(0, nImages - 1)) * 4; // 2x2 each
  const smallWeight = Math.max(0, nImages - 3);
  const demand = heroWeight + midWeight + smallWeight + nSmall;

  const grid = makeGrid(w, h, Math.max(1, Math.round(demand / 1.6)));
  const occ = makeOccupancy(grid);
  const blocks = [];

  const place = (cw, ch, make) => {
    const slot = findSlot(occ, grid, cw, ch, rand);
    if (!slot) return false;
    occupy(occ, slot.col, slot.row, slot.cw, slot.ch);
    blocks.push({
      col: slot.col, row: slot.row, cw: slot.cw, ch: slot.ch,
      x: slot.col * grid.cellW,
      y: slot.row * grid.cellH,
      w: slot.cw * grid.cellW,
      h: slot.ch * grid.cellH,
      ...make(slot),
    });
    return true;
  };

  // --- Images first, at deliberately UNEVEN scale. ---
  // The reference poster works because one subject dominates while others are
  // small accents; an even spread of same-size tiles reads as a contact sheet.
  // So sizes are assigned from a fixed ladder rather than sampled randomly:
  // one hero, a couple of mid tiles, the rest small.
  const imageBlocks = [];
  for (let i = 0; i < nImages; i++) {
    const entry = images[i % images.length];
    let cw, ch;
    if (i === 0) {
      // Hero: dominates the page the way the reference's lobster does —
      // roughly two thirds of the width and half the height.
      ch = Math.max(3, Math.round(grid.rows * 0.5));
      cw = Math.max(2, Math.round(grid.cols * 0.66));
    } else if (i === 1) {
      // Second subject: clearly secondary but still substantial.
      ch = 2; cw = 2;
    } else if (i === 2) {
      cw = 2; ch = 1;
    } else {
      // Accents: deliberately tiny, for the scale jump the reference relies on.
      cw = 1; ch = 1;
    }
    if (place(cw, ch, () => ({ kind: 'image', entry }))) {
      imageBlocks.push(blocks[blocks.length - 1]);
    }
  }

  // --- Headlines: laid OVER the images, not beside them. ---
  // In the reference, type crosses the subjects — that overlap is the whole
  // look. Each headline is anchored to an image block and offset so it breaks
  // across the silhouette's edge, then clamped to stay on the canvas.
  for (let i = 0; i < nMain; i++) {
    const text = fragments[i % fragments.length];
    const host = imageBlocks.length ? imageBlocks[i % imageBlocks.length] : null;

    if (host) {
      // Straddle the host: start left of centre and sit low in its box, so the
      // words run across the form rather than floating clear of it.
      const bw = Math.min(w * 0.72, Math.max(w * 0.42, host.w * 1.25));
      const bh = Math.max(grid.cellH * 1.1, host.h * 0.42);
      let x = host.x + host.w * (rand() < 0.5 ? -0.18 : 0.12);
      let y = host.y + host.h * (0.18 + rand() * 0.5);
      x = Math.max(0, Math.min(w - bw, x));
      y = Math.max(0, Math.min(h - bh, y));
      blocks.push({
        kind: 'main', text, overlay: true,
        col: 0, row: 0, cw: 0, ch: 0,
        x, y, w: bw, h: bh,
      });
    } else {
      // No imagery to sit on — fall back to a packed slot.
      place(Math.min(2, grid.cols), 1, () => ({ kind: 'main', text }));
    }
  }

  // --- Captions last: they fill the leftover 1x1 gaps, which is exactly the
  // "text flows into the holes between forms" behaviour the poster wants.
  // Each block gets a DIFFERENT sentence of the copy, rotating through it, so
  // the poster reads as running text broken across the page instead of the
  // same paragraph stamped repeatedly. ---
  const sentences = splitSentences(smallText);
  for (let i = 0; i < nSmall; i++) {
    const text = sentences.length ? sentences[i % sentences.length] : smallText;
    place(1, 1, () => ({ kind: 'small', text }));
  }

  return { grid, blocks };
}
