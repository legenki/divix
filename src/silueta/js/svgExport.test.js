import { describe, it, expect } from 'vitest';
import { buildSVG, buildGridSVG } from './svgExport.js';
import { wrapText } from './gridLayout.js';

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

  it('escapes special characters in text and attribute values', () => {
    const svg = buildSVG({
      w, h, maskInfo,
      render: { effect: 'pixelate', granularity: 10, color: '"><script>' },
      layoutItems: [{ role: 'main', x: 4, y: 52, size: 52, text: 'A & B < C >' }],
      fontFamily: 'Bad"Font',
    });
    // Raw injection sequences must not survive into the output.
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('A & B < C >');
    // Escaped forms are present instead.
    expect(svg).toContain('A &amp; B &lt; C &gt;');
    expect(svg).toContain('&quot;');
  });
});

describe('buildGridSVG', () => {
  const mw = 8, mh = 8;
  const full = new Uint8Array(mw * mh).fill(1);
  const imageBlock = (extra = {}) => ({
    kind: 'image', x: 0, y: 0, w: 100, h: 100, col: 0, row: 0, cw: 1, ch: 1,
    mask: { mask: full, w: mw, h: mh }, ...extra,
  });
  const main = { font: 'Syne', fontSize: 40, lineHeight: 1, color: '#111111', wght: 700 };
  const small = { font: 'Syne', fontSize: 10, lineHeight: 1.25, wght: 400 };
  const base = { w: 200, h: 200, main, small, pad: 6, wrap: wrapText };

  it('emits circles for the circle shape', () => {
    const svg = buildGridSVG({
      ...base, blocks: [imageBlock()],
      render: { effect: 'halftone', granularity: 20, color: '#000', shape: 'circle' },
    });
    expect(svg).toContain('<circle ');
    expect(svg).not.toContain('<rect x=');
  });

  it('emits rects for the square shape', () => {
    const svg = buildGridSVG({
      ...base, blocks: [imageBlock()],
      render: { effect: 'pixelate', granularity: 20, color: '#000', shape: 'square' },
    });
    expect(svg).toContain('<rect x=');
    expect(svg).not.toContain('<circle ');
  });

  it('falls back to circles for a custom shape', () => {
    const svg = buildGridSVG({
      ...base, blocks: [imageBlock()],
      render: { effect: 'halftone', granularity: 20, color: '#000', shape: 'custom' },
    });
    expect(svg).toContain('<circle ');
  });

  it('emits no silhouette cells when the effect is none', () => {
    const svg = buildGridSVG({
      ...base, blocks: [imageBlock()],
      render: { effect: 'none', granularity: 20, color: '#000', shape: 'circle' },
    });
    expect(svg).not.toContain('<circle ');
    expect(svg).not.toContain('<rect x=');
  });

  it('wraps a headline into multiple <text> runs', () => {
    const svg = buildGridSVG({
      ...base,
      blocks: [{ kind: 'main', x: 0, y: 0, w: 80, h: 120, text: 'REMIX LAYOUT SMART GRAPHICS' }],
      render: { effect: 'none', granularity: 20, color: '#000', shape: 'circle' },
    });
    expect((svg.match(/<text /g) || []).length).toBeGreaterThan(1);
  });

  it('carries variable-font axes onto text', () => {
    const svg = buildGridSVG({
      ...base,
      blocks: [{ kind: 'main', x: 0, y: 0, w: 200, h: 60, text: 'HI' }],
      render: { effect: 'none', granularity: 20, color: '#000', shape: 'circle' },
    });
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain('font-variation-settings=');
  });
});
