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
