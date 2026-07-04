// BANDADA — control panel sections (declarative SECTIONS format).

import {
  RATIO_TYPES,
  CANVAS_BACK_MODES,
  EDGE_MODES,
  RENDER_MODES,
  SHAPE_SKEW_MODES,
  COLOR_STYLES,
  SHAPE_TYPES,
} from './state.js';

export const SECTIONS = [
  {
    title: 'Export',
    controls: [
      { id: 'bd-export-size', type: 'slider', label: 'Export Size (px)', path: 'cnv.density.export', min: 500, max: 4000, step: 100 },
      { id: 'bd-export-length', type: 'slider', label: 'Video Length', path: 'rec.length.value', min: 1, max: 60, step: 1 },
      { id: 'bd-export-quality', type: 'slider', label: 'Image Quality', path: 'rec.quality', min: 0, max: 100, step: 5 },
      // bd-btn-save-mp4, bd-btn-save-png go to footer.
    ],
  },
  {
    title: 'Options',
    controls: [
      { id: 'bd-margin', type: 'slider', label: 'Browser Margins', path: 'cnv.settings.margin', min: 0, max: 1, step: 0.01, regen: 'canvas' },
      { id: 'bd-mouse-force', type: 'slider', label: 'Mouse Force', path: 'cnv.mouseForce.value', min: 1, max: 100, step: 1 },
    ],
  },
  {
    title: 'Canvas',
    controls: [
      { id: 'bd-ratio', type: 'select', label: 'Canvas Ratio', path: 'cnv.ratio', options: RATIO_TYPES, regen: 'canvas' },
      { id: 'bd-edge-mode', type: 'select', label: 'Edge Behavior', path: 'params.edge.mode', options: EDGE_MODES, regen: 'edge' },
      // Repel settings visible when edge.mode === 'repel'
      { id: 'bd-edge-offset', type: 'slider', label: 'Edge Offset', path: 'params.edge.offset.value', min: 0, max: 0.5, step: 0.01 },
      { id: 'bd-edge-ease', type: 'slider', label: 'Repel Easing', path: 'params.edge.ease.value', min: 0, max: 1, step: 0.01 },
      { id: 'bd-bg-mode', type: 'select', label: 'Background', path: 'cnv.bg.mode', options: CANVAS_BACK_MODES, regen: 'canvas' },
      { id: 'bd-bg-color', type: 'color', label: 'Canvas Color', path: 'cnv.bg.color' },
    ],
  },
  {
    title: 'Shape',
    controls: [
      { id: 'bd-shape-type', type: 'select', label: 'Shape Type', path: 'params.shape', options: SHAPE_TYPES, regen: 'shape' },
      { id: 'bd-boids-count', type: 'slider', label: 'Boids Count', path: 'params.boids.value', min: 50, max: 3000, step: 50, regen: 'boids' },
      { id: 'bd-shape-scale', type: 'slider', label: 'Shape Scale', path: 'params.scale.value', min: 0.4, max: 10, step: 0.05 },
      { id: 'bd-shape-scale-random', type: 'slider', label: 'Scale Randomization', path: 'params.scale.random.value', min: 0, max: 1, step: 0.1 },
      { id: 'bd-skew-mode', type: 'select', label: 'Skew Mode', path: 'params.skew.mode', options: SHAPE_SKEW_MODES, regen: 'skew' },
      // Visible when skew.mode !== 'none'
      { id: 'bd-skew-level', type: 'slider', label: 'Skew Level', path: 'params.skew.value', min: 0, max: 0.9, step: 0.05 },
      { id: 'bd-skew-reaction', type: 'slider', label: 'Skew Reaction', path: 'params.skew.reaction', min: 0, max: 0.5, step: 0.01 },
    ],
  },
  {
    title: 'Color',
    controls: [
      { id: 'bd-render-mode', type: 'select', label: 'Render Mode', path: 'params.render', options: RENDER_MODES, regen: 'color' },
      { id: 'bd-fill-style', type: 'select', label: 'Fill Style', path: 'params.fill.style', options: COLOR_STYLES, regen: 'color' },
      // Visible when render == vector && fill.style != none
      { id: 'bd-fill-reaction', type: 'slider', label: 'Reaction Rate', path: 'params.fill.reaction', min: 0, max: 0.5, step: 0.01 },
      { id: 'bd-fill-start', type: 'color', label: 'Start Color', path: 'params.fill.0' },
      { id: 'bd-fill-end', type: 'color', label: 'End Color', path: 'params.fill.1' },
      
      { id: 'bd-stroke-style', type: 'select', label: 'Stroke Style', path: 'params.stroke.style', options: COLOR_STYLES, regen: 'color' },
      // Visible when render == vector && stroke.style != none
      { id: 'bd-stroke-width', type: 'slider', label: 'Stroke Width', path: 'params.stroke.width.value', min: 0.25, max: 2, step: 0.05 },
      { id: 'bd-stroke-reaction', type: 'slider', label: 'Reaction Rate', path: 'params.stroke.reaction', min: 0, max: 0.5, step: 0.01 },
      { id: 'bd-stroke-start', type: 'color', label: 'Start Color', path: 'params.stroke.0' },
      { id: 'bd-stroke-end', type: 'color', label: 'End Color', path: 'params.stroke.1' },
    ],
  },
  {
    title: 'Flocking',
    controls: [
      { id: 'bd-accuracy', type: 'slider', label: 'Move Accuracy', path: 'params.accuracy.value', min: 0, max: 10, step: 0.2 },
      { id: 'bd-vision', type: 'slider', label: 'Boid Vision', path: 'params.vision.value', min: 0, max: 25, step: 0.5, regen: 'flock' },
      
      { id: 'bd-alignment', type: 'slider', label: 'Alignment Force', path: 'params.alignment.value', min: 0, max: 4, step: 0.05 },
      { id: 'bd-bias', type: 'slider', label: 'Alignment Bias', path: 'params.bias.value', min: 0.1, max: 4, step: 0.05 },
      { id: 'bd-cohesion', type: 'slider', label: 'Cohesion Force', path: 'params.cohesion.value', min: 0, max: 4, step: 0.05 },
      { id: 'bd-separation', type: 'slider', label: 'Separation Force', path: 'params.separation.value', min: 0, max: 4, step: 0.05 },
      { id: 'bd-steering', type: 'slider', label: 'Steering Force', path: 'params.steering.value', min: 0, max: 0.5, step: 0.01 },
      { id: 'bd-steering-reaction', type: 'slider', label: 'Turning Reaction', path: 'params.steering.reaction', min: 0, max: 0.5, step: 0.01 },
      
      { id: 'bd-speed', type: 'slider', label: 'Boids Speed', path: 'params.speed.value.max', min: 0, max: 5, step: 0.05 },
      { id: 'bd-drag', type: 'slider', label: 'Velocity Drag', path: 'params.drag.value', min: 0, max: 0.1, step: 0.005 },
      { id: 'bd-angle-noise', type: 'slider', label: 'Noise Angle', path: 'params.angle.value', min: 0, max: 10, step: 0.5 },
    ],
  },
  {
    title: 'Simulation',
    controls: [
      { id: 'bd-seed', type: 'slider', label: 'Random Seed', path: 'seed.value', min: 0, max: 10000, step: 1, regen: 'sim' },
    ],
  },
];
