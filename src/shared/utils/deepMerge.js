export function deepMerge(target, src) {
  if (!src || typeof src !== 'object') return;
  for (const key of Object.keys(src)) {
    const v = src[key];
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], v);
    } else if (Array.isArray(v)) {
      target[key] = JSON.parse(JSON.stringify(v));
    } else {
      target[key] = v;
    }
  }
}
