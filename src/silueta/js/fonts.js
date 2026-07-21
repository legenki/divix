// SILUETA — variable-font catalog, ported from grafema's textura
// (src/textura/js/fonts.js). Silueta draws text on a P2D buffer, which renders
// via CSS font strings, so a font is usable as soon as its FontFace is
// registered in document.fonts — no p5.Font/fontkit parsing needed here.
//
// Variable axes (wght / wdth / opsz) are applied with CSS font-variation-settings
// on the buffer's 2D context, which is what gives the poster its polyvariance:
// the same family can read as a hairline condensed caption or a black display
// headline. AXES below records each family's supported axis ranges; the panel
// only shows sliders for axes the chosen family actually has.

const CDN = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl';

export const FONT_CATALOG = {
  'Bricolage Grotesque': `${CDN}/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf`,
  'Fraunces': `${CDN}/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf`,
  'Syne': `${CDN}/syne/Syne%5Bwght%5D.ttf`,
  'Montserrat': `${CDN}/montserrat/Montserrat%5Bwght%5D.ttf`,
  'Recursive': `${CDN}/recursive/Recursive%5BCASL%2CCRSV%2CMONO%2Cslnt%2Cwght%5D.ttf`,
  'Roboto Flex': `${CDN}/robotoflex/RobotoFlex%5BGRAD%2CXOPQ%2CXTRA%2CYOPQ%2CYTAS%2CYTDE%2CYTFI%2CYTLC%2CYTUC%2Copsz%2Cslnt%2Cwdth%2Cwght%5D.ttf`,
  'Playfair Display': `${CDN}/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf`,
  'Cormorant': `${CDN}/cormorant/Cormorant%5Bwght%5D.ttf`,
  'Alegreya': `${CDN}/alegreya/Alegreya%5Bwght%5D.ttf`,
  'Oswald': `${CDN}/oswald/Oswald%5Bwght%5D.ttf`,
};

export const FONT_LIST = Object.keys(FONT_CATALOG);

/**
 * Per-family variable axis ranges: { tag: [min, default, max] }.
 * Only axes listed here get a slider; a family missing an axis simply has
 * fewer controls (refreshVisibility hides the rest).
 */
export const AXES = {
  'Bricolage Grotesque': { wght: [200, 400, 800], wdth: [75, 100, 100], opsz: [12, 14, 96] },
  'Fraunces': { wght: [100, 400, 900], opsz: [9, 14, 144] },
  'Syne': { wght: [400, 400, 800] },
  'Montserrat': { wght: [100, 400, 900] },
  'Recursive': { wght: [300, 400, 1000] },
  'Roboto Flex': { wght: [100, 400, 1000], wdth: [25, 100, 151], opsz: [8, 14, 144] },
  'Playfair Display': { wght: [400, 400, 900] },
  'Cormorant': { wght: [300, 400, 700] },
  'Alegreya': { wght: [400, 400, 900] },
  'Oswald': { wght: [200, 400, 700] },
};

/** Axis tags silueta exposes, in panel order. */
export const AXIS_TAGS = ['wght', 'wdth', 'opsz'];

/** True when `family` supports the variable axis `tag`. */
export function hasAxis(family, tag) {
  return Boolean(AXES[family] && AXES[family][tag]);
}

/** [min, default, max] for an axis, or null when unsupported. */
export function axisRange(family, tag) {
  return (AXES[family] && AXES[family][tag]) || null;
}

/** family -> Promise<ArrayBuffer>; rejections evicted so retries can succeed. */
const _bufferCache = new Map();

function loadFontBuffer(family) {
  const url = FONT_CATALOG[family];
  if (!url) return Promise.reject(new Error(`Unknown font "${family}"`));
  if (_bufferCache.has(family)) return _bufferCache.get(family);
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Font fetch failed (${res.status}) for "${family}"`);
      return res.arrayBuffer();
    })
    .catch((e) => {
      _bufferCache.delete(family);
      throw e;
    });
  _bufferCache.set(family, promise);
  return promise;
}

/** Families already registered — re-adding piles up duplicate FontFace entries. */
const _registered = new Set();

/**
 * Fetch a catalog family and register it in document.fonts so the P2D text
 * buffer can select it by name. Safe to call repeatedly.
 * @returns {Promise<string>} the family name, once usable
 */
export async function ensureFont(family) {
  if (_registered.has(family)) return family;
  const buffer = await loadFontBuffer(family);
  const face = new FontFace(family, buffer);
  await face.load();
  document.fonts.add(face);
  _registered.add(family);
  return family;
}

/** True when the family is registered and ready to draw with. */
export function isReady(family) {
  return _registered.has(family);
}

/**
 * Build a CSS font-variation-settings string from a style block, keeping only
 * axes the family actually supports (an unsupported axis is ignored by the
 * renderer, but filtering keeps exports and debugging honest).
 * @param {string} family
 * @param {{wght?:number,wdth?:number,opsz?:number}} style
 */
export function variationSettings(family, style) {
  const parts = [];
  for (const tag of AXIS_TAGS) {
    const value = style?.[tag];
    if (value == null || !hasAxis(family, tag)) continue;
    parts.push(`"${tag}" ${value}`);
  }
  return parts.join(', ');
}
