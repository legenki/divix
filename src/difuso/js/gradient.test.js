import { describe, it, expect } from 'vitest';

// The gradient-ramp color-stop math (buildGradientTexture's colorAmount + stop
// spacing) is pure arithmetic; replicate it here to lock the ported formula and
// its divide-by-zero guard against regressions. The actual buildGradientTexture
// wraps this in 2D-canvas drawing, which isn't unit-testable without a DOM.

function colorStops(useColor) {
  let colorAmount = 0;
  for (const u of useColor) if (u === true) colorAmount++;

  if (colorAmount <= 1) return { flat: true, stops: [] };

  const stops = [];
  let index = 0;
  for (let i = 0; i < useColor.length; i++) {
    if (useColor[i] !== false) {
      stops.push(index);
      index += 1 / (colorAmount - 1);
    }
  }
  return { flat: false, stops };
}

describe('gradient color-stop math', () => {
  it('spans 0..1 across all enabled swatches', () => {
    const { flat, stops } = colorStops([true, true, true, true, true]);
    expect(flat).toBe(false);
    expect(stops[0]).toBeCloseTo(0);
    expect(stops[stops.length - 1]).toBeCloseTo(1);
    expect(stops).toHaveLength(5);
  });

  it('only counts enabled swatches (holes skipped)', () => {
    const { stops } = colorStops([true, false, true, false, true]);
    expect(stops).toHaveLength(3);
    expect(stops[0]).toBeCloseTo(0);
    expect(stops[1]).toBeCloseTo(0.5);
    expect(stops[2]).toBeCloseTo(1);
  });

  it('flags flat fallback when exactly one swatch is enabled (no divide-by-zero)', () => {
    const { flat, stops } = colorStops([true, false, false, false, false]);
    expect(flat).toBe(true);
    expect(stops.every(Number.isFinite)).toBe(true); // no Infinity leaked
  });

  it('flags flat fallback when zero swatches are enabled (no NaN)', () => {
    const { flat } = colorStops([false, false, false, false, false]);
    expect(flat).toBe(true);
  });

  it('produces only finite stops for any valid enabled count', () => {
    for (const use of [
      [true, true, false, false, false],
      [true, true, true, false, false],
      [true, true, true, true, false],
    ]) {
      const { stops } = colorStops(use);
      expect(stops.every(Number.isFinite)).toBe(true);
    }
  });
});
