// DIVIX — control panel sections (declarative SECTIONS format consumed by
// shared/ui/panelBuilder.js). Pure data + option-map imports; panelBuilder.js
// handles all DOM construction and event wiring. app.js (Task 10) supplies
// applyChange (dispatches on `regen` tags / button ids) and refreshVisibility
// (toggles the conditional-visibility control ids noted below).
//
// Three parts of the original panel are intentionally NOT expressible here and
// live outside SECTIONS:
//   1. Preset dropdown — built by buildPresetSection() from panelBuilder.js,
//      called directly in app.js.
//   2. Dynamic color-swatch picker (N per-swatch use-toggle + select-active
//      buttons) — no generic panelBuilder control type fits; app.js builds it
//      with raw DOM.
//   3. PNG / MP4 / SVG export buttons — they live in template.html's footer,
//      wired in app.js, not as panel controls.

import {
  RATIO_TYPES,
  SLOT_TYPES,
  SHAPE_TYPES,
  COLOR_STYLE_TYPES,
  FORM_FILL_MODES,
  SPLIT_TYPES,
  TRANSFORM_TYPES,
  ORDER_TYPES,
} from './state.js';

// One-off UI-only option set with no state.js equivalent (matches ritmo's
// local-constant convention, e.g. SORT_OPTIONS). Values match cnv.color.mode.
const BG_MODES = {
  Custom: 'custom',
  'Use Palette Color': 'palette',
  Transparent: 'transparent',
};

// Builds one of the four near-identical transform sections (Scale / X Move /
// Y Move / Rotate). Only Amplitude differs: Scale spans -1..1, the others
// 0.01..1 (ui.js:517-522 vs 596-601/675-680/754-759). `key` is the form.* sub-
// object; `randomId` wires to randomize.js's randomizeTransform(form[key], false)
// in Task 10 (the `false` = includeOff off, matching the reference per-axis
// buttons at ui.js:569/648/727/806).
function transformSection({ title, key, randomId, ampMin }) {
  return {
    title,
    controls: [
      { id: `dx-${key}-type`, type: 'select', label: 'Motion Type', path: `form.${key}.type`, options: TRANSFORM_TYPES, regen: 'transform' },
      { id: `dx-${key}-order`, type: 'select', label: 'Effect Order', path: `form.${key}.order`, options: ORDER_TYPES },
      { id: `dx-${key}-amp`, type: 'slider', label: 'Amplitude', path: `form.${key}.amp`, min: ampMin, max: 1, step: 0.01 },
      { id: `dx-${key}-freq`, type: 'slider', label: 'Frequency', path: `form.${key}.freq`, min: 0, max: 1, step: 0.01 },
      { id: `dx-${key}-cycle`, type: 'slider', label: 'Cycles', path: `form.${key}.cycle`, min: 0, max: 20, step: 1 },
      { id: `dx-${key}-speed`, type: 'slider', label: 'Speed', path: `form.${key}.speed`, min: 0, max: 1, step: 0.01 },
      { id: `dx-${key}-phase`, type: 'slider', label: 'Phase', path: `form.${key}.phase`, min: -0.5, max: 0.5, step: 0.01 },
      { id: `dx-${key}-seed`, type: 'slider', label: 'Noise Seed', path: `form.${key}.seed`, min: 0, max: 1000, step: 1, regen: 'seed' },
      { id: randomId, type: 'button', label: 'Get Random Values' },
    ],
  };
}

export const SECTIONS = [
  {
    title: 'Export',
    controls: [
      // PNG/MP4/SVG trigger buttons and the export-status monitor live in the
      // footer (template.html), not here.
      { id: 'dx-export-size', type: 'slider', label: 'Export Size', path: 'cnv.density.export', min: 2, max: 10, step: 0.25 },
      { id: 'dx-export-quality', type: 'slider', label: 'Export Quality', path: 'rec.quality', min: 0, max: 100, step: 5 },
    ],
  },
  {
    title: 'Options',
    controls: [
      { id: 'dx-margin', type: 'slider', label: 'Canvas Margins', path: 'cnv.settings.margin', min: 0.5, max: 1, step: 0.01 },
      { id: 'dx-wheel-sens', type: 'slider', label: 'Wheel Sens', path: 'cnv.event.sens', min: 0.1, max: 2, step: 0.1 },
    ],
  },
  {
    title: 'Canvas',
    controls: [
      { id: 'dx-ratio', type: 'select', label: 'Canvas Ratio', path: 'cnv.ratio', options: RATIO_TYPES, regen: 'canvas' },
      { id: 'dx-bg-mode', type: 'select', label: 'Background', path: 'cnv.color.mode', options: BG_MODES },
      // dx-bg-custom: visible when cnv.color.mode === 'custom' (Task 10 refreshVisibility).
      { id: 'dx-bg-custom', type: 'color', label: 'Canvas Color', path: 'cnv.color.custom' },
      // dx-bg-slot: visible when cnv.color.mode === 'palette' (Task 10 refreshVisibility).
      { id: 'dx-bg-slot', type: 'select', label: 'Palette Color', path: 'cnv.color.slot', options: SLOT_TYPES },
    ],
  },
  {
    title: 'Shape',
    controls: [
      // Custom-shape drag-and-drop info blade (ui.js:276-282) has no panelBuilder
      // equivalent; Task 10 may add an instructional note outside SECTIONS.
      { id: 'dx-shape-type', type: 'select', label: 'Choose Type', path: 'form.type', options: SHAPE_TYPES, regen: 'shape' },
      { id: 'dx-shape-count', type: 'slider', label: 'Shape Count', path: 'form.count.base', min: 2, max: 200, step: 1 },
      { id: 'dx-sequence', type: 'slider', label: 'Scale Sequence', path: 'form.sequence', min: -1, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Color',
    controls: [
      { id: 'dx-color-type', type: 'select', label: 'Styling Type', path: 'form.color.type', options: COLOR_STYLE_TYPES },
      // dx-stroke-width: visible when form.color.type === 'stroke' (Task 10 refreshVisibility).
      { id: 'dx-stroke-width', type: 'slider', label: 'Stroke Width', path: 'form.stroke.width', min: 0.5, max: 10, step: 0.1 },
      { id: 'dx-color-mode', type: 'select', label: 'Drawing Mode', path: 'form.color.mode', options: FORM_FILL_MODES },
      // The dynamic color-swatch picker (toggle/select per palette slot) is
      // built directly in app.js — see the header note; it is NOT a SECTIONS control.
    ],
  },
  {
    title: 'Transform',
    controls: [
      { id: 'dx-split-type', type: 'select', label: 'Split Mask', path: 'split.type', options: SPLIT_TYPES, regen: 'split' },
      { id: 'dx-scale', type: 'slider', label: 'Scale', path: 'cnv.scale.value', min: 0.25, max: 5, step: 0.01 },
      { id: 'dx-rotation', type: 'slider', label: 'Rotation', path: 'cnv.rotation.value', min: -180, max: 180, step: 1 },
      // Position is a 2D point in the reference; split into two sliders.
      { id: 'dx-pos-x', type: 'slider', label: 'Position X', path: 'cnv.position.x', min: -1, max: 1, step: 0.01 },
      { id: 'dx-pos-y', type: 'slider', label: 'Position Y', path: 'cnv.position.y', min: -1, max: 1, step: 0.01 },
      // Transition is also a 2D point; split into two sliders.
      { id: 'dx-trans-x', type: 'slider', label: 'Transition X', path: 'form.transition.x', min: -1, max: 1, step: 0.01 },
      { id: 'dx-trans-y', type: 'slider', label: 'Transition Y', path: 'form.transition.y', min: -1, max: 1, step: 0.01 },
      { id: 'dx-canvas-random', type: 'button', label: 'Get Random Values' },
      { id: 'dx-canvas-reset', type: 'button', label: 'Reset to Default' },
    ],
  },
  transformSection({ title: 'Scale', key: 'scale', randomId: 'dx-rand-scale', ampMin: -1 }),
  transformSection({ title: 'X Move', key: 'xmove', randomId: 'dx-rand-xmove', ampMin: 0.01 }),
  transformSection({ title: 'Y Move', key: 'ymove', randomId: 'dx-rand-ymove', ampMin: 0.01 }),
  transformSection({ title: 'Rotate', key: 'rotate', randomId: 'dx-rand-rotate', ampMin: 0.01 }),
];
