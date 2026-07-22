// SILUETA — poster/typography workspace state and option maps.
// State objects are mutated in place by the panel, presets and the sketch;
// initial values are the tool's default preset. See the design spec at
// docs/superpowers/specs/2026-07-21-silueta-workspace-design.md.

export const cnv = {
  width: 960,
  height: 1280,
  maxSize: 9999,
  scale: 0.68,
  ratio: '3:4',
  preset: 'User Preset',
  density: { base: 1, export: 2000 },
};

export const render = {
  effect: 'none',        // 'none' | 'pixelate' | 'halftone'
  granularity: 11,       // px block/dot size, 10..28
  color: '#B8B8B8',      // flat silhouette color (used when effect !== 'none')
  keepOriginal: false,   // keep source texture/color inside cells
  // Stamp drawn in each cell: 'circle' | 'square' | 'custom' (uploaded SVG).
  shape: 'circle',
  shapeName: '',         // filename of the uploaded SVG, for the panel label
};

export const extract = {
  threshold: 233,        // 0..255 brightness cut; below = object
  merge: true,           // dilate before labeling so nearby blobs fuse
};

export const layout = {
  mode: 'mixed',         // 'mixed' | 'overlay'
  seed: 1234,
  // How many blocks of each kind the grid composer places. Images are drawn
  // from the enabled entries of the media library.
  counts: { images: 5, main: 2, small: 4 },
  // Auto copy: when on, `autoText` is the single source of words and the
  // algorithm decides which phrases are set large and which small (short
  // phrases shout, long sentences whisper). Sizes stay manual either way.
  autoCopy: true,
  autoText:
    'REMIX LAYOUT. SMART GRAPHICS. EDGE DETECTION. Silhouettes are extracted from the source photograph, rasterised into pixel and halftone forms, then composed against a responsive grid where type and image negotiate the same space. VISUAL REBUILD. Experimental image processing and typography layout engine.',
  main: {
    text: 'REMIX LAYOUT. SMART GRAPHICS. EDGE DETECTION. VISUAL REBUILD.',
    fontSize: 52,
    lineHeight: 0.9,
    color: '#111111',
    // Variable-font style; axes not supported by the family are ignored.
    font: 'Bricolage Grotesque',
    wght: 700,
    wdth: 100,
    opsz: 48,
  },
  small: {
    enabled: true,
    text: 'Experimental image processing and typography layout engine. Silhouettes are extracted from the source photograph, rasterised into pixel and halftone forms, then composed against a responsive grid where type and image negotiate the same space.',
    fontSize: 10,
    lineHeight: 1.25,
    font: 'Roboto Flex',
    wght: 400,
    wdth: 100,
    opsz: 14,
  },
};

export const rec = {
  type: 'image',
  frameRate: 30,
  quality: 75,
  format: 'mp4',
  frame: 0,
};

// --- Option maps (label → value for the panel UI) ---

export const RATIO_TYPES = {
  '1:1': '1:1',
  '4:5': '4:5',
  '3:4': '3:4',
  '2:3': '2:3',
  '9:16': '9:16',
};

export const RESOLUTIONS = {
  '1:1': { width: 1280, height: 1280 },
  '4:5': { width: 1024, height: 1280 },
  '3:4': { width: 960, height: 1280 },
  '2:3': { width: 960, height: 1440 },
  '9:16': { width: 1080, height: 1920 },
};

export const EFFECT_TYPES = {
  'None (Original)': 'none',
  'Pixelate': 'pixelate',
  'Halftone': 'halftone',
};

export const LAYOUT_MODES = {
  'Semantic image-text mixed': 'mixed',
  'Original overlay': 'overlay',
};
