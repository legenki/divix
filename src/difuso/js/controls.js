// DIFUSO — control panel sections (declarative SECTIONS format consumed by
// shared/ui/panelBuilder.js). Pure data + option-map imports; panelBuilder.js
// handles all DOM construction and event wiring. app.js (Task 10) supplies
// applyChange (dispatches on `regen` tags / button ids) and refreshVisibility
// (toggles the conditional-visibility control ids noted inline below).
//
// Conditional visibility: panelBuilder.js has NO declarative visibility field.
// Rows that must show/hide based on state are noted with a `// <id>: visible
// when ...` comment; app.js (Task 10) implements this in refreshVisibility()
// via document.querySelector('[data-control-id="..."]').style.display = ...,
// matching DIVIX's precedent.
//
// Three parts of the original panel are intentionally NOT expressible here and
// live outside SECTIONS (matching DIVIX's precedent):
//   1. Preset dropdown — built by buildPresetSection() from panelBuilder.js,
//      called directly in app.js.
//   2. Dynamic 5-swatch palette picker (per-swatch use-toggle + color pair,
//      gradient.use.0..4 / gradient.color.0..4; reference PALETTE folder
//      ui.js:739-850) — no generic panelBuilder control type fits the coupled
//      toggle+color-per-slot layout, so app.js builds it with raw DOM.
//   3. PNG / MP4 export buttons + the df-mp4-length select and df-export-status
//      monitor — they live in template.html's footer, wired in app.js, not as
//      panel controls.
//
// Also intentionally excluded (verified against reference/dithr/scripts/ui.js):
//   - LICENSE tab, Fullscreen Mode, Show Poster, Browser Color. Re-read of
//     ui.js:117-162 confirms image/video mode has NO separate canvas-background
//     mechanism — image/video sources have no Back Color / Transparency
//     control; those only apply in Object mode (df-obj-canvas-color /
//     df-obj-transparent below).
//   - Upload Media / Upload Custom Texture buttons — file-upload triggers wired
//     directly in app.js (Task 10), not SECTIONS controls. The dither.type
//     'custom' (custom-texture) mode is likewise omitted — dither.js throws on
//     it — as are the 'none' and 'custom' entries (both commented out in the
//     reference itself at ui.js:463/469).
//   - Video File Format selector (rec.format webm/gif/webp/png) — shared
//     exportMedia.js only supports PNG and MP4 (footer buttons).
//   - Export Length — the footer df-mp4-length <select> (template.html) sets
//     recVideo.seconds directly (matching DIVIX's dx-mp4-length pattern), NOT
//     a slider. There is no separate rec.length field to mirror.

import { FONT_TYPES, RATIO_TYPES } from './state.js';

// Local UI-only option maps with no direct state.js export (matches DIVIX's
// BG_MODES local-constant convention). Values match the state fields they drive.

// dither.type — the LIVE options only. 'none' and 'custom' are commented out in
// the reference itself (ui.js:463/469); 'custom' additionally throws in
// dither.js's buildDitherTexture, so neither is offered here.
const DITHER_TYPES = {
  'ASCII Characters': 'ascii',
  'Halftone Basic': 'halftone',
  'Halftone CMYK': 'halftoneCMYK',
  'Bayer Matrix': 'matrix',
  'Noise Textures': 'noise',
};

// dither.matrix — values cross-checked against dither.js's MATRIX_TABLE keys
// (pixel/diagonal/checker/grid/bayer2/bayer4/bayer8/bayer16). ui.js:481-490.
const MATRIX_TYPES = {
  Pixel: 'pixel',
  Diagonal: 'diagonal',
  Checker: 'checker',
  Grid: 'grid',
  '2x2 Bayer': 'bayer2',
  '4x4 Bayer': 'bayer4',
  '8x8 Bayer': 'bayer8',
  '16x16 Bayer': 'bayer16',
};

// dither.noise — texture-tile sizes; values match dither.js's noiseTextures
// keys. ui.js:499-504.
const NOISE_TYPES = {
  '16x16 Pixels': 'noise16',
  '32x32 Pixels': 'noise32',
  '64x64 Pixels': 'noise64',
  '128x128 Pixels': 'noise128',
};

// ascii.color.mode — ui.js:575-579.
const ASCII_COLOR_MODES = {
  'Set Color For Characters': 'chars',
  'Set Color For Background': 'background',
  'Duotone Mode': 'duotone',
};

// gradient.type — ui.js:699-702.
const GRADIENT_TYPES = {
  'Original Colors': 'original',
  'Gradient Map': 'gradient',
};

// FONT_TYPES maps display-label → asset path, but ascii.fontname stores the
// display LABEL (the reference binds the label as both text and value:
// ui.js:524-527 `value: font`), and app.js resolves FONT_TYPES[fontname] → path
// when loading. So the select's option values must be the labels, i.e. an
// identity label→label map derived from FONT_TYPES' keys.
const FONT_NAME_OPTIONS = Object.fromEntries(
  Object.keys(FONT_TYPES).map((name) => [name, name])
);

// `regen` tags (consumed by app.js's applyChange in Task 10). Chosen meanings:
//   'canvas'        — canvas ratio changed; resize the canvas + buffers.
//   'ditherType'    — dither.type changed; re-pick the shader path AND rebuild
//                     whatever generated texture the new type needs.
//   'ditherTexture' — rebuild the Bayer/noise pattern tile (dither.js
//                     buildDitherTexture): matrix/scale/noise/texture changes.
//   'gradientType'  — gradient.type changed; re-pick original vs gradient-map
//                     compositing path.
//   'gradientPalette' — gradient.palette changed; app.js calls
//                     gradient.applySelectedPalette() (copies palette → working
//                     state + rebuilds ramp + should re-sync the swatch UI).
//   'gradientTexture' — rebuild only the gradient ramp (gradient.reverse toggle).
// Choose Font (ascii.fontname) deliberately has NO regen tag: font loading is
// async (ascii.js loadFont returns a Promise) and doesn't fit the synchronous
// regen dispatch. app.js wires it via a dedicated change listener that resolves
// FONT_TYPES[fontname] → URL and calls ascii.loadFont(url). (DIVIX has no async-
// effect control precedent in its SECTIONS; this is the simpler, documented
// option per the task's guidance.)

export const SECTIONS = [
  {
    title: 'Dither',
    controls: [
      { id: 'df-dither-type', type: 'select', label: 'Dither Type', path: 'dither.type', options: DITHER_TYPES, regen: 'ditherType' },
      // df-dither-matrix: visible when dither.type === 'matrix' (Task 10 refreshVisibility).
      { id: 'df-dither-matrix', type: 'select', label: 'Matrix Type', path: 'dither.matrix', options: MATRIX_TYPES, regen: 'ditherTexture' },
      // df-dither-noise: visible when dither.type === 'noise' (Task 10 refreshVisibility).
      { id: 'df-dither-noise', type: 'select', label: 'Texture Size', path: 'dither.noise', options: NOISE_TYPES, regen: 'ditherTexture' },
      // df-dither-texture: visible when dither.type === 'noise' (Task 10 refreshVisibility).
      { id: 'df-dither-texture', type: 'slider', label: 'Choose Texture', path: 'dither.texture', min: 1, max: 4, step: 1, regen: 'ditherTexture' },
      // df-ascii-font: visible when dither.type === 'ascii' (Task 10 refreshVisibility).
      // No regen tag — async font load wired via a dedicated listener (see header).
      { id: 'df-ascii-font', type: 'select', label: 'Choose Font', path: 'ascii.fontname', options: FONT_NAME_OPTIONS },
      // df-ascii-text: visible when dither.type === 'ascii' (Task 10 refreshVisibility).
      { id: 'df-ascii-text', type: 'text', label: 'ASCII Chars', path: 'ascii.text' },
      // df-ascii-scale: visible when dither.type === 'ascii' (Task 10 refreshVisibility).
      { id: 'df-ascii-scale', type: 'slider', label: 'ASCII Scale', path: 'ascii.scale', min: 4, max: 64, step: 4 },
      // df-ascii-color-mode: visible when dither.type === 'ascii' (Task 10 refreshVisibility).
      { id: 'df-ascii-color-mode', type: 'select', label: 'Base Colors', path: 'ascii.color.mode', options: ASCII_COLOR_MODES },
      // df-ascii-char: visible when dither.type === 'ascii' AND ascii.color.mode is 'chars' or 'duotone' (Task 10 refreshVisibility).
      { id: 'df-ascii-char', type: 'color', label: 'Characters', path: 'ascii.color.char' },
      // df-ascii-bg: visible when dither.type === 'ascii' AND ascii.color.mode is 'background' or 'duotone' (Task 10 refreshVisibility).
      { id: 'df-ascii-bg', type: 'color', label: 'Background', path: 'ascii.color.bg' },
      // df-dither-scale: visible when dither.type is 'matrix' or 'noise' (Task 10 refreshVisibility).
      { id: 'df-dither-scale', type: 'slider', label: 'Dither Scale', path: 'dither.scale', min: 1, max: 24, step: 1, regen: 'ditherTexture' },
      // df-halftone-scale: visible when dither.type is 'halftone' or 'halftoneCMYK' (Task 10 refreshVisibility).
      // min/max are the reference's dither.halftone.scaleMin/scaleMax, which are
      // literal 3/24 in state.js — inlined as literals (SECTIONS data is static).
      { id: 'df-halftone-scale', type: 'slider', label: 'Scale Level', path: 'dither.halftone.scale', min: 3, max: 24, step: 0.1 },
      // df-halftone-smooth: visible when dither.type === 'halftone' ONLY (NOT
      // halftoneCMYK). Verified in halftone.js: applyBasic sets u_smooth from
      // dither.halftone.smooth (L67); applyCMYK never reads .smooth — so the
      // control has no effect in CMYK mode and is hidden there (Task 10).
      { id: 'df-halftone-smooth', type: 'slider', label: 'Color Smooth', path: 'dither.halftone.smooth', min: 0.5, max: 5, step: 0.1 },
    ],
  },
  {
    title: 'Levels',
    controls: [
      // df-dither-step: visible when dither.type is 'matrix' or 'noise' only.
      // Verified against the effect modules: dither.js apply() derives u_steps
      // from dither.step (L155/170); halftone.js never reads dither.step; ascii.js
      // uses its OWN ascii.color.limit-1 for u_steps (L264). So Posterization
      // drives ONLY the ordered-dither path — hidden for ascii AND both halftone
      // modes (narrower than "not ascii"). (Task 10 refreshVisibility.)
      { id: 'df-dither-step', type: 'slider', label: 'Posterization', path: 'dither.step', min: 1, max: 256, step: 1 },
      // df-ascii-limit: visible when dither.type === 'ascii' only — ASCII's own
      // step-count (ascii.color.limit), distinct from Posterization above (Task 10).
      { id: 'df-ascii-limit', type: 'slider', label: 'Color Limiter', path: 'ascii.color.limit', min: 2, max: 16, step: 1 },
      // Brightness/Contrast feed every dither.type's shader (dither.js/halftone.js/
      // ascii.js all read dither.brightness/contrast) — always visible.
      { id: 'df-brightness', type: 'slider', label: 'Brightness', path: 'dither.brightness', min: 0.5, max: 1.5, step: 0.01 },
      { id: 'df-contrast', type: 'slider', label: 'Contrast', path: 'dither.contrast', min: 0.5, max: 4, step: 0.01 },
    ],
  },
  {
    title: 'Colors',
    controls: [
      { id: 'df-gradient-type', type: 'select', label: 'Color Type', path: 'gradient.type', options: GRADIENT_TYPES, regen: 'gradientType' },
      // df-gradient-saturation: visible when gradient.type === 'original' only.
      // Visibility gate ADDED (the reference ui.js does not gate it). Justified by
      // the shared saturation formula in dither.js/halftone.js/ascii.js:
      //   saturation = gradient.type !== 'original' ? 1 : map(gradient.saturation,0,1,1,0)
      // i.e. the slider has ZERO effect unless type === 'original'. Hiding it in
      // 'gradient' mode matches its actual effect (a genuine UX fix consistent
      // with the reference's intent). (Task 10 refreshVisibility.)
      { id: 'df-gradient-saturation', type: 'slider', label: 'Saturation', path: 'gradient.saturation', min: 0, max: 1, step: 0.01 },
      // df-gradient-palette: visible when gradient.type === 'gradient' only. max 30
      // = Object.keys(COLOR_PALETTES).length (verified: keys "1".."30" in state.js).
      { id: 'df-gradient-palette', type: 'slider', label: 'Select Palette', path: 'gradient.palette', min: 1, max: 30, step: 1, regen: 'gradientPalette' },
      // df-gradient-reverse: visible when gradient.type === 'gradient' only (Task 10).
      { id: 'df-gradient-reverse', type: 'check', label: 'Reverse Palette', path: 'gradient.reverse', regen: 'gradientTexture' },
      // The dynamic 5-swatch palette picker (gradient.use.0..4 / gradient.color.0..4)
      // is built directly in app.js — see the header note; NOT a SECTIONS control.
    ],
  },
  {
    title: 'Export',
    controls: [
      // PNG/MP4 trigger buttons, the df-mp4-length <select> and df-export-status
      // monitor live in the footer (template.html), not here.
      // Export Size range (min 1, max 5, step 1) is DIFUSO's own (ui.js:895-897) —
      // deliberately NOT DIVIX's 2-10/0.25 range.
      // df-canvas-ratio: visible only when rec.type === 'object' (Task 6
      // refreshVisibility). image/video stay source-driven for sizing
      // (calculateCanvasSize in app.js); only object mode needs a fixed
      // target resolution since there's no source image/video to size from.
      { id: 'df-canvas-ratio', type: 'select', label: 'Canvas Ratio', path: 'cnv.ratio', options: RATIO_TYPES, regen: 'canvas' },
      { id: 'df-export-size', type: 'slider', label: 'Export Size (px)', path: 'cnv.density.export', min: 500, max: 4000, step: 100 },
      { id: 'df-export-quality', type: 'slider', label: 'Export Quality', path: 'rec.quality', min: 0, max: 100, step: 5 },
    ],
  },
  {
    title: '3D Object',
    // Whole section shown/hidden as a single unit when rec.type === 'object'
    // (Task 6 refreshVisibility) — not per-row visibility like the
    // dither-type-dependent rows above. One section, not split into
    // Lighting/Motion sub-sections (per design decision).
    controls: [
      { id: 'df-obj-upload', type: 'button', label: 'Upload 3D Model', action: 'uploadModel' },
      { id: 'df-obj-camera', type: 'select', label: 'Camera', path: 'obj.camera', options: { Orthographic: 'ortho', Perspective: 'perspective' }, regen: 'objectCamera' },
      { id: 'df-obj-transparent', type: 'check', label: 'Transparent Background', path: 'obj.transparent' },
      { id: 'df-obj-canvas-color', type: 'color', label: 'Background Color', path: 'obj.canvas' },
      { id: 'df-obj-scale-factor', type: 'slider', label: 'Scale', path: 'obj.scale.factor', min: 1, max: 10, step: 0.1 },
      { id: 'df-obj-translate-x', type: 'slider', label: 'Translate X', path: 'obj.translate.x', min: -1, max: 1, step: 0.01 },
      { id: 'df-obj-translate-y', type: 'slider', label: 'Translate Y', path: 'obj.translate.y', min: -1, max: 1, step: 0.01 },
      { id: 'df-obj-reset-coords', type: 'button', label: 'Reset Position / Rotation / Scale', action: 'resetObjectCoordinates' },

      { id: 'df-light-ambient', type: 'slider', label: 'Ambient Light', path: 'obj.light.ambient', min: 0, max: 255, step: 1 },
      { id: 'df-light-specular', type: 'slider', label: 'Specular', path: 'obj.light.specular', min: 0, max: 255, step: 1 },
      { id: 'df-light-shininess', type: 'slider', label: 'Shininess', path: 'obj.light.shininess', min: 1, max: 100, step: 1 },
      { id: 'df-light-one-color', type: 'color', label: 'Light 1 Color', path: 'obj.light.one.color' },
      { id: 'df-light-one-x', type: 'slider', label: 'Light 1 X', path: 'obj.light.one.x', min: -1, max: 1, step: 0.01 },
      { id: 'df-light-one-y', type: 'slider', label: 'Light 1 Y', path: 'obj.light.one.y', min: -1, max: 1, step: 0.01 },
      { id: 'df-light-one-z', type: 'slider', label: 'Light 1 Z', path: 'obj.light.one.z', min: -1, max: 1, step: 0.01 },
      { id: 'df-light-two-color', type: 'color', label: 'Light 2 Color', path: 'obj.light.two.color' },
      { id: 'df-light-two-x', type: 'slider', label: 'Light 2 X', path: 'obj.light.two.x', min: -1, max: 1, step: 0.01 },
      { id: 'df-light-two-y', type: 'slider', label: 'Light 2 Y', path: 'obj.light.two.y', min: -1, max: 1, step: 0.01 },
      { id: 'df-light-two-z', type: 'slider', label: 'Light 2 Z', path: 'obj.light.two.z', min: -1, max: 1, step: 0.01 },
      { id: 'df-light-three-color', type: 'color', label: 'Light 3 Color', path: 'obj.light.three.color' },
      { id: 'df-light-three-x', type: 'slider', label: 'Light 3 X', path: 'obj.light.three.x', min: -1, max: 1, step: 0.01 },
      { id: 'df-light-three-y', type: 'slider', label: 'Light 3 Y', path: 'obj.light.three.y', min: -1, max: 1, step: 0.01 },
      { id: 'df-light-three-z', type: 'slider', label: 'Light 3 Z', path: 'obj.light.three.z', min: -1, max: 1, step: 0.01 },
      { id: 'df-light-reset', type: 'button', label: 'Reset Lights', action: 'resetLights' },

      { id: 'df-motion-active', type: 'check', label: 'Enable Motion', path: 'motion.active' },
      { id: 'df-motion-rotate-type', type: 'select', label: 'Rotate Motion Type', path: 'motion.rotate.type', options: { Constant: 'constant', Oscillate: 'oscillate' } },
      { id: 'df-motion-rotate-angle-x', type: 'slider', label: 'Rotate Angle X', path: 'motion.rotate.angle.x', min: 0, max: 180, step: 1 },
      { id: 'df-motion-rotate-angle-y', type: 'slider', label: 'Rotate Angle Y', path: 'motion.rotate.angle.y', min: 0, max: 180, step: 1 },
      { id: 'df-motion-rotate-angle-z', type: 'slider', label: 'Rotate Angle Z', path: 'motion.rotate.angle.z', min: 0, max: 180, step: 1 },
      { id: 'df-motion-rotate-speed-x', type: 'slider', label: 'Rotate Speed X', path: 'motion.rotate.speed.x', min: -1, max: 1, step: 0.01 },
      { id: 'df-motion-rotate-speed-y', type: 'slider', label: 'Rotate Speed Y', path: 'motion.rotate.speed.y', min: -1, max: 1, step: 0.01 },
      { id: 'df-motion-rotate-speed-z', type: 'slider', label: 'Rotate Speed Z', path: 'motion.rotate.speed.z', min: -1, max: 1, step: 0.01 },
      { id: 'df-motion-translate-level-x', type: 'slider', label: 'Translate Level X', path: 'motion.translate.level.x', min: 0, max: 1, step: 0.01 },
      { id: 'df-motion-translate-level-y', type: 'slider', label: 'Translate Level Y', path: 'motion.translate.level.y', min: 0, max: 1, step: 0.01 },
      { id: 'df-motion-translate-level-z', type: 'slider', label: 'Translate Level Z', path: 'motion.translate.level.z', min: 0, max: 1, step: 0.01 },
      { id: 'df-motion-translate-speed-x', type: 'slider', label: 'Translate Speed X', path: 'motion.translate.speed.x', min: -1, max: 1, step: 0.01 },
      { id: 'df-motion-translate-speed-y', type: 'slider', label: 'Translate Speed Y', path: 'motion.translate.speed.y', min: -1, max: 1, step: 0.01 },
      { id: 'df-motion-translate-speed-z', type: 'slider', label: 'Translate Speed Z', path: 'motion.translate.speed.z', min: -1, max: 1, step: 0.01 },
      { id: 'df-motion-reset', type: 'button', label: 'Reset Motion', action: 'resetObjectMotions' },
    ],
  },
];
