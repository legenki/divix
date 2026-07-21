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

/** Build + download the SVG. */
export function exportSVG(opts) {
  const svg = buildSVG(opts);
  saveSVG(svg, `silueta-${timestamp()}.svg`);
  return svg;
}
