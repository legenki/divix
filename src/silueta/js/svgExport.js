// SILUETA — analytic SVG export. Rebuilds the composition as real vector: a
// background rect, silhouette cells (<rect> for pixelate, <circle> for
// halftone) sampled from the mask grid, and every layout draw item as <text>.
// No raster embed. Downloaded via the shared saveSVG util.

import { saveSVG } from '../../shared/utils/svgDownload.js';
import { timestamp } from '../../shared/utils/datetime.js';

// Escape a value for safe insertion into SVG element content OR a quoted
// attribute value: & < > and both quote characters are handled, so the same
// helper is safe for `fill="${esc(...)}"` and `>${esc(...)}<`.
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    parts.push(`<g fill="${esc(fill)}">`);
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

/**
 * Grid-composition SVG: every packed block becomes vector. Image blocks emit
 * their silhouette cells (rect for pixelate, circle for halftone) in the
 * block's own coordinate space; text blocks emit real <text> runs, so the
 * poster stays editable rather than being flattened to a raster.
 *
 * @param {object} opts
 *   { w, h, blocks, render, main, small, pad, wrap }
 *   blocks: gridLayout output, image blocks carrying `mask` ({mask,w,h})
 *   main/small: style blocks from state.layout (font, sizes, axes, color)
 *   wrap: (text, charsPerLine) => string[] — caption wrapper (gridLayout.wrapText)
 */
export function buildGridSVG({ w, h, blocks = [], render, main, small, pad = 6, wrap }) {
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
  parts.push(`<rect width="${w}" height="${h}" fill="#ffffff"/>`);

  const axisStyle = (s) => {
    const axes = [];
    for (const tag of ['wght', 'wdth', 'opsz']) {
      if (s?.[tag] != null) axes.push(`"${tag}" ${s[tag]}`);
    }
    return axes.length ? ` font-variation-settings="${esc(axes.join(', '))}"` : '';
  };

  for (const b of blocks) {
    const bx = b.x + pad;
    const by = b.y + pad;
    const bw = Math.max(1, b.w - pad * 2);
    const bh = Math.max(1, b.h - pad * 2);

    if (b.kind === 'image' && b.mask && render.effect !== 'none') {
      const { mask, w: mw, h: mh } = b.mask;
      const cell = Math.max(2, render.granularity);
      parts.push(`<g fill="${esc(render.color)}">`);
      for (let cy = 0; cy < bh; cy += cell) {
        for (let cx = 0; cx < bw; cx += cell) {
          const mx = Math.min(mw - 1, Math.floor(((cx + cell / 2) / bw) * mw));
          const my = Math.min(mh - 1, Math.floor(((cy + cell / 2) / bh) * mh));
          if (!mask[my * mw + mx]) continue;
          if (render.effect === 'halftone') {
            parts.push(
              `<circle cx="${(bx + cx + cell / 2).toFixed(1)}" cy="${(by + cy + cell / 2).toFixed(1)}" r="${(cell * 0.42).toFixed(1)}"/>`
            );
          } else {
            parts.push(
              `<rect x="${(bx + cx).toFixed(1)}" y="${(by + cy).toFixed(1)}" width="${cell}" height="${cell}"/>`
            );
          }
        }
      }
      parts.push('</g>');
    } else if (b.kind === 'main') {
      // Mirror the canvas shrink-to-fit with an average-advance estimate.
      const est = Math.max(6, Math.min(main.fontSize, bh));
      const size = Math.min(est, (bw / Math.max(1, b.text.length)) * 1.9);
      parts.push(
        `<text x="${bx.toFixed(1)}" y="${(by + size * 0.85).toFixed(1)}" ` +
        `font-family="${esc(main.font)}" font-size="${size.toFixed(1)}" ` +
        `fill="${esc(main.color)}"${axisStyle(main)}>${esc(b.text)}</text>`
      );
    } else if (b.kind === 'small') {
      const size = small.fontSize;
      const lineH = size * 1.25;
      const charsPerLine = Math.max(6, Math.floor(bw / (size * 0.5)));
      const maxLines = Math.max(1, Math.floor(bh / lineH));
      const lines = (wrap ? wrap(b.text, charsPerLine) : [b.text]).slice(0, maxLines);
      lines.forEach((line, i) => {
        parts.push(
          `<text x="${bx.toFixed(1)}" y="${(by + size + i * lineH).toFixed(1)}" ` +
          `font-family="${esc(small.font)}" font-size="${size}" ` +
          `fill="#333333"${axisStyle(small)}>${esc(line)}</text>`
        );
      });
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

/** Build + download the SVG (legacy single-image composition). */
export function exportSVG(opts) {
  const svg = buildSVG(opts);
  saveSVG(svg, `silueta-${timestamp()}.svg`);
  return svg;
}

/** Build + download the grid composition SVG. */
export function exportGridSVG(opts) {
  const svg = buildGridSVG(opts);
  saveSVG(svg, `silueta-${timestamp()}.svg`);
  return svg;
}
