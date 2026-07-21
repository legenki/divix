// SILUETA — control panel sections (declarative SECTIONS consumed by
// shared/ui/panelBuilder.js). app.js supplies applyChange (dispatches on the
// `regen` tag) and refreshVisibility (the sl-sil-color enable/disable gate).
//
// regen tags:
//   'canvas'  — cnv.ratio changed: resize buffers, re-extract, re-layout.
//   'render'  — silhouette buffer params (effect/granularity/color/keepOriginal).
//   'effect'  — render.effect changed (same as 'render' plus visibility refresh).
//   'extract' — extract.threshold/merge: re-run extraction (invalidates render + layout).
//   'layout'  — layout-only params: re-run layout.js, mask unchanged.

import { RATIO_TYPES, EFFECT_TYPES, LAYOUT_MODES } from './state.js';
import { FONT_LIST } from './fonts.js';
import { SHAPE_TYPES } from './stamp.js';

// Font pickers are built from the shared catalog so main and small text can use
// different families; the axis sliders below them are shown only for axes the
// selected family actually supports (see app.js refreshVisibility).
const FONT_OPTIONS = Object.fromEntries(FONT_LIST.map((f) => [f, f]));

export const SECTIONS = [
  {
    title: 'Preview',
    controls: [
      { id: 'sl-scale', type: 'slider', label: 'Canvas Display', path: 'cnv.scale', min: 0.3, max: 1, step: 0.01 },
      { id: 'sl-ratio', type: 'select', label: 'Canvas Ratio', path: 'cnv.ratio', options: RATIO_TYPES, regen: 'canvas' },
    ],
  },
  {
    title: 'Silhouette',
    controls: [
      { id: 'sl-effect', type: 'select', label: 'Visual Effect', path: 'render.effect', options: EFFECT_TYPES, regen: 'effect' },
      // Cell stamp. Hidden for 'none' (nothing is stamped in Original mode).
      { id: 'sl-shape', type: 'select', label: 'Shape', path: 'render.shape', options: SHAPE_TYPES, regen: 'render' },
      { id: 'sl-shape-upload', type: 'button', label: 'Load SVG Shape', action: 'uploadShape' },
      { id: 'sl-granularity', type: 'slider', label: 'Processing Granularity (px)', path: 'render.granularity', min: 10, max: 28, step: 1, regen: 'render' },
      // sl-sil-color: DISABLED (not hidden) when render.effect === 'none' (app.js refreshVisibility).
      { id: 'sl-sil-color', type: 'color', label: 'Silhouette Color', path: 'render.color', regen: 'render' },
    ],
  },
  {
    title: 'Composition',
    controls: [
      { id: 'sl-mode', type: 'select', label: 'Main Layout Mode', path: 'layout.mode', options: LAYOUT_MODES, regen: 'layout' },
      { id: 'sl-count-images', type: 'slider', label: 'Image Blocks', path: 'layout.counts.images', min: 0, max: 16, step: 1, regen: 'layout' },
      { id: 'sl-count-main', type: 'slider', label: 'Headline Blocks', path: 'layout.counts.main', min: 0, max: 8, step: 1, regen: 'layout' },
      { id: 'sl-count-small', type: 'slider', label: 'Caption Blocks', path: 'layout.counts.small', min: 0, max: 12, step: 1, regen: 'layout' },
      { id: 'sl-shuffle', type: 'button', label: 'Shuffle Composition', action: 'shuffle' },
    ],
  },
  {
    title: 'Main Text',
    controls: [
      { id: 'sl-main-text', type: 'textarea', label: 'Main Text Content', path: 'layout.main.text', rows: 3, regen: 'layout' },
      { id: 'sl-main-font', type: 'select', label: 'Main Font', path: 'layout.main.font', options: FONT_OPTIONS, regen: 'font' },
      { id: 'sl-main-size', type: 'slider', label: 'Main Font Size', path: 'layout.main.fontSize', min: 20, max: 160, step: 1, regen: 'layout' },
      { id: 'sl-main-lh', type: 'slider', label: 'Main Line Height', path: 'layout.main.lineHeight', min: 0.7, max: 2.0, step: 0.05, regen: 'layout' },
      { id: 'sl-main-wght', type: 'slider', label: 'Main Weight', path: 'layout.main.wght', min: 100, max: 1000, step: 1, regen: 'layout' },
      { id: 'sl-main-wdth', type: 'slider', label: 'Main Width', path: 'layout.main.wdth', min: 25, max: 151, step: 1, regen: 'layout' },
      { id: 'sl-main-opsz', type: 'slider', label: 'Main Optical Size', path: 'layout.main.opsz', min: 8, max: 144, step: 1, regen: 'layout' },
    ],
  },
  {
    title: 'Small Text',
    controls: [
      { id: 'sl-small-enabled', type: 'check', label: 'Contour-Avoidance Small Text', path: 'layout.small.enabled', regen: 'layout' },
      { id: 'sl-small-text', type: 'textarea', label: 'Small Text', path: 'layout.small.text', rows: 4, regen: 'layout' },
      { id: 'sl-small-font', type: 'select', label: 'Small Font', path: 'layout.small.font', options: FONT_OPTIONS, regen: 'font' },
      { id: 'sl-small-size', type: 'slider', label: 'Small Font Size', path: 'layout.small.fontSize', min: 6, max: 28, step: 1, regen: 'layout' },
      { id: 'sl-small-lh', type: 'slider', label: 'Small Line Height', path: 'layout.small.lineHeight', min: 0.8, max: 2.2, step: 0.05, regen: 'layout' },
      { id: 'sl-small-wght', type: 'slider', label: 'Small Weight', path: 'layout.small.wght', min: 100, max: 1000, step: 1, regen: 'layout' },
      { id: 'sl-small-wdth', type: 'slider', label: 'Small Width', path: 'layout.small.wdth', min: 25, max: 151, step: 1, regen: 'layout' },
      { id: 'sl-small-opsz', type: 'slider', label: 'Small Optical Size', path: 'layout.small.opsz', min: 8, max: 144, step: 1, regen: 'layout' },
    ],
  },
  {
    title: 'Extraction',
    controls: [
      { id: 'sl-keep-original', type: 'check', label: 'Keep Original Image Content', path: 'render.keepOriginal', regen: 'render' },
      { id: 'sl-threshold', type: 'slider', label: 'Brightness Threshold', path: 'extract.threshold', min: 0, max: 255, step: 1, regen: 'extract' },
      { id: 'sl-merge', type: 'check', label: 'Cross-line Connected Component Merge', path: 'extract.merge', regen: 'extract' },
    ],
  },
  {
    title: 'Export',
    controls: [
      { id: 'sl-export-size', type: 'slider', label: 'Export Size (px)', path: 'cnv.density.export', min: 500, max: 4000, step: 100 },
      { id: 'sl-export-quality', type: 'slider', label: 'Export Quality', path: 'rec.quality', min: 0, max: 100, step: 5 },
    ],
  },
];
