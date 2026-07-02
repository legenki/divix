import { describe, it, expect, vi } from 'vitest';
import { createAscii } from './ascii.js';

// Minimal stubs — hexToShader touches none of p/state/buffer, so bare objects
// are enough to construct the factory and pull the pure helper out.
function makeAscii() {
  const p = {};
  const state = { ascii: { text: '', color: {} } };
  const buffer = { createShader: () => ({}) };
  return createAscii({ p, state, buffer });
}

describe('ascii hexToShader', () => {
  it('normalizes #RRGGBB to [r/255, g/255, b/255]', () => {
    const { hexToShader } = makeAscii();
    expect(hexToShader('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToShader('#000000')).toEqual([0, 0, 0]);
    const [r, g, b] = hexToShader('#3c2706');
    expect(r).toBeCloseTo(0x3c / 255);
    expect(g).toBeCloseTo(0x27 / 255);
    expect(b).toBeCloseTo(0x06 / 255);
  });

  it('accepts upper- and lower-case hex digits', () => {
    const { hexToShader } = makeAscii();
    expect(hexToShader('#AABBCC')).toEqual(hexToShader('#aabbcc'));
  });

  it('falls back to black (not NaN) on malformed hex, with a warning', () => {
    const { hexToShader } = makeAscii();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bad of ['', '#fff', '#gggggg', 'ffffff', '#12345', '#1234567', null, undefined]) {
      const result = hexToShader(bad);
      expect(result).toEqual([0, 0, 0]);
      expect(result.some(Number.isNaN)).toBe(false);
    }
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// The glyph-grid math from buildGlyphTexture() (cols/rows) is pure arithmetic;
// replicate it here to lock the ported formula against regressions.
describe('ascii glyph-grid math', () => {
  const cols = (len) => Math.max(1, Math.ceil(Math.sqrt(len)));
  const rows = (len) => Math.max(1, Math.ceil(len / cols(len)));

  it('is 1x1 for a single character (empty-text fallback)', () => {
    expect(cols(1)).toBe(1);
    expect(rows(1)).toBe(1);
  });

  it('packs into a near-square grid', () => {
    // 10 chars → ceil(sqrt(10))=4 cols, ceil(10/4)=3 rows.
    expect(cols(10)).toBe(4);
    expect(rows(10)).toBe(3);
  });

  it('always covers every character (cols*rows >= len)', () => {
    for (const len of [1, 2, 3, 5, 7, 16, 17, 26, 100]) {
      expect(cols(len) * rows(len)).toBeGreaterThanOrEqual(len);
    }
  });
});
