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
      { id: 'sl-granularity', type: 'slider', label: 'Processing Granularity (px)', path: 'render.granularity', min: 10, max: 28, step: 1, regen: 'render' },
      // sl-sil-color: DISABLED (not hidden) when render.effect === 'none' (app.js refreshVisibility).
      { id: 'sl-sil-color', type: 'color', label: 'Silhouette Color', path: 'render.color', regen: 'render' },
    ],
  },
  {
    title: 'Layout',
    controls: [
      { id: 'sl-mode', type: 'select', label: 'Main Layout Mode', path: 'layout.mode', options: LAYOUT_MODES, regen: 'layout' },
      { id: 'sl-main-text', type: 'textarea', label: 'Main Text Content', path: 'layout.main.text', rows: 3, regen: 'layout' },
      { id: 'sl-main-size', type: 'slider', label: 'Main Font Size', path: 'layout.main.fontSize', min: 40, max: 120, step: 1, regen: 'layout' },
      { id: 'sl-main-lh', type: 'slider', label: 'Main Line Height', path: 'layout.main.lineHeight', min: 0.7, max: 1.4, step: 0.05, regen: 'layout' },
    ],
  },
  {
    title: 'Small Text',
    controls: [
      { id: 'sl-small-enabled', type: 'check', label: 'Contour-Avoidance Small Text', path: 'layout.small.enabled', regen: 'layout' },
      { id: 'sl-small-text', type: 'textarea', label: 'Small Text', path: 'layout.small.text', rows: 2, regen: 'layout' },
      { id: 'sl-small-size', type: 'slider', label: 'Small Font Size', path: 'layout.small.fontSize', min: 8, max: 24, step: 1, regen: 'layout' },
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
