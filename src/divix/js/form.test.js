import { describe, it, expect } from 'vitest';
import { paletteLerp } from './form.js';

describe('paletteLerp', () => {
  const stops = [
    ['#000000', 0],
    ['#ffffff', 1],
  ];

  it('returns the low color at t=0 and high at t=1', () => {
    expect(paletteLerp(stops, 0)).toBe('#000000');
    expect(paletteLerp(stops, 1)).toBe('#ffffff');
  });

  it('interpolates the midpoint', () => {
    // Halfway between black and white → mid gray.
    expect(paletteLerp(stops, 0.5)).toBe('#808080');
  });

  it('clamps out-of-range t (guards against noise === 1 overflow)', () => {
    expect(paletteLerp(stops, 2)).toBe('#ffffff');
    expect(paletteLerp(stops, -1)).toBe('#000000');
  });

  it('selects the correct bracketing stops with three colors', () => {
    const three = [
      ['#000000', 0],
      ['#ff0000', 0.5],
      ['#0000ff', 1],
    ];
    expect(paletteLerp(three, 0.5)).toBe('#ff0000');
    expect(paletteLerp(three, 0.25)).toBe('#800000');
  });

  it('returns black for empty input and normalizes a single stop', () => {
    expect(paletteLerp([], 0.5)).toBe('#000000');
    expect(paletteLerp([['#abc', 0]], 0.5)).toBe('#aabbcc');
  });

  it('falls back to black on an invalid hex instead of producing NaN', () => {
    expect(paletteLerp([['not-a-color', 0], ['#ffffff', 1]], 0)).toBe('#000000');
  });
});
