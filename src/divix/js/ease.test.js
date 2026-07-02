import { describe, it, expect } from 'vitest';
import { easeFunctions } from './ease.js';

describe('divix easeFunctions', () => {
  it('every easing maps 0→0 and 1→1', () => {
    for (const [name, fn] of Object.entries(easeFunctions)) {
      expect(fn(0), `${name}(0)`).toBeCloseTo(0, 5);
      expect(fn(1), `${name}(1)`).toBeCloseTo(1, 5);
    }
  });
  it('returns finite values across the domain', () => {
    for (const [name, fn] of Object.entries(easeFunctions)) {
      for (let t = 0; t <= 1.0001; t += 0.1) {
        expect(Number.isFinite(fn(t)), `${name}(${t})`).toBe(true);
      }
    }
  });
});
