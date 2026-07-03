import { g } from './state.js';

export function lerpAngle(a, b, t) {
  const TAU = Math.PI * 2;
  const PI = Math.PI;
  const delta = ((((b - a) % TAU) + TAU + PI) % TAU) - PI;
  return a + delta * t;
}

export function easeOutQuad(x) {
  return 1 - (1 - x) * (1 - x);
}

export function randomObjectValue(p, obj, excludeIndices = []) {
  const values = Object.values(obj);
  let filtered = values.filter((_, idx) => !excludeIndices.includes(idx));
  if (filtered.length === 0) {
    filtered = values;
  }
  const randomIndex = Math.floor(p.random(filtered.length));
  return filtered[randomIndex];
}

export function snapGrid(value, axis, minAxis, maxAxis) {
  const axisValue = axis / g.gridFactor;
  const gridValue = Math.min(Math.round(value / axisValue) * axisValue, maxAxis);
  return gridValue < minAxis ? minAxis : gridValue;
}
