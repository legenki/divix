import { describe, it, expect } from 'vitest';
import { createMap2 } from './map2.js';

// Minimal p5 stub — only the math functions map2 calls.
const p = {
  pow: Math.pow,
  cos: Math.cos,
  sin: Math.sin,
  sqrt: Math.sqrt,
  PI: Math.PI,
};

const map2 = createMap2(p);

describe('map2 Linear', () => {
  it('maps start1 to start2', () => {
    expect(map2(0, 0, 100, 0, 200, 'Linear', 0)).toBeCloseTo(0);
  });

  it('maps stop1 to stop2', () => {
    expect(map2(100, 0, 100, 0, 200, 'Linear', 0)).toBeCloseTo(200);
  });

  it('maps midpoint linearly', () => {
    expect(map2(50, 0, 100, 0, 200, 'Linear', 0)).toBeCloseTo(100);
  });
});

describe('map2 Quadratic IN', () => {
  it('returns start2 at t=0', () => {
    expect(map2(0, 0, 1, 0, 1, 'Quadratic', 0)).toBeCloseTo(0);
  });

  it('returns stop2 at t=1', () => {
    expect(map2(1, 0, 1, 0, 1, 'Quadratic', 0)).toBeCloseTo(1);
  });

  it('is less than Linear at midpoint (ease-in is slow start)', () => {
    const quad = map2(0.5, 0, 1, 0, 1, 'Quadratic', 0);
    expect(quad).toBeLessThan(0.5);
  });
});

describe('map2 Quadratic OUT', () => {
  it('is greater than Linear at midpoint (ease-out is fast start)', () => {
    const quad = map2(0.5, 0, 1, 0, 1, 'Quadratic', 1);
    expect(quad).toBeGreaterThan(0.5);
  });
});

describe('map2 Exponential OUT (CMYK-scale easing used by dither.js)', () => {
  // dither.js computes CMYKscale = map2(scale, min, max, 500, 5, 'Exponential', 1).
  it('returns start2 at value = start1', () => {
    expect(map2(3, 3, 24, 500, 5, 'Exponential', 1)).toBeCloseTo(500);
  });

  it('lands just above stop2 at value = stop1 (exp ease-out has a tiny residual)', () => {
    // Exponential OUT is c*(-2^(-10*t/d)+1)+b; at t=d that leaves a ~2^-10
    // residual of the (500..5) range, so it approaches but never exactly
    // reaches stop2 — expect ~5.48, i.e. within 1 of stop2.
    const v = map2(24, 3, 24, 500, 5, 'Exponential', 1);
    expect(v).toBeGreaterThan(5);
    expect(v).toBeLessThan(6);
  });

  it('eases out (drops fast then flattens toward stop2)', () => {
    const mid = map2(13.5, 3, 24, 500, 5, 'Exponential', 1);
    // Ease-out over a descending range: already well below the linear midpoint.
    expect(mid).toBeLessThan((500 + 5) / 2);
  });
});

describe('map2 edge cases', () => {
  it('returns 0 for unknown type', () => {
    expect(map2(0.5, 0, 1, 0, 1, 'Unknown', 0)).toBe(0);
  });
});
