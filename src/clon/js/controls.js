import { BG_MODES, DRAW_MODES, SELECT_MODES, SHAPE_TYPES, GRID_COLORS } from './state.js';

export const SECTIONS = [
  {
    title: 'DRAW SETTINGS',
    controls: [
      {
        id: 'cl-mode-select',
        type: 'select',
        label: 'Select Data (S)',
        path: 'mode.select',
        options: {
          'Get From Selection': SELECT_MODES.Free,
          'Make And Use Buffer': 'buffer',
          'Erase Mode (E)': 'erase'
        },
        regen: 'tooltips'
      },
      {
        id: 'cl-info-free',
        type: 'html',
        content: '<div class="info-blade">On a click, the data is taken from the selection, and used for a brush as long as the click button is held down.</div>'
      },
      {
        id: 'cl-info-buffer',
        type: 'html',
        content: '<div class="info-blade">At the first click, the data is copied from the selection and used as a brush for further drawing. Cleared by hotkey (A) or changing the Select Data mode.</div>'
      },
      {
        id: 'cl-info-erase',
        type: 'html',
        content: '<div class="info-blade">Erase pixel data from the result canvas based on selection area. Enter this mode with hotkey (E).</div>'
      },
      { type: 'separator' },
      {
        id: 'cl-mode-draw',
        type: 'select',
        label: 'Draw Mode (M)',
        path: 'mode.draw',
        options: {
          'Use Source Image Data': DRAW_MODES.Canvas,
          'Use Canvas Data': 'result'
        },
        regen: 'tooltips'
      },
      {
        id: 'cl-info-draw-source',
        type: 'html',
        content: '<div class="info-blade">The image data for brush will be taken from the source image.</div>'
      },
      {
        id: 'cl-info-draw-result',
        type: 'html',
        content: '<div class="info-blade">The image data for brush and drawing process takes place directly on the canvas.</div>'
      },
      { type: 'separator' },
      {
        id: 'cl-source-img',
        type: 'check',
        label: 'Source Image (I)',
        path: 'cnv.source'
      },
      {
        id: 'cl-bg-mode',
        type: 'select',
        label: 'Background',
        path: 'cnv.bg.mode',
        options: {
          'Custom': BG_MODES.Custom,
          'Transparent': BG_MODES.Transparent
        },
        regen: 'visibility'
      },
      {
        id: 'cl-bg-custom',
        type: 'color',
        label: 'Canvas Color',
        path: 'cnv.bg.custom'
      },
      { type: 'separator' },
      {
        id: 'cl-shape-type',
        type: 'select',
        label: 'Shape Type (T)',
        path: 'mode.shape',
        options: {
          'Rectangle': SHAPE_TYPES.Rectangle,
          'Ellipse': SHAPE_TYPES.Ellipse,
          'Triangle': SHAPE_TYPES.Triangle
        },
        regen: 'clipBuffer'
      },
      {
        id: 'cl-shape-angle',
        type: 'slider',
        label: 'Rotation (R)',
        path: 'mode.shapeAngle',
        min: 0,
        max: 270,
        step: 90,
        regen: 'clipBuffer'
      }
    ]
  },
  {
    title: 'GRID SETTINGS',
    controls: [
      {
        id: 'cl-grid-snap',
        type: 'check',
        label: 'Use Grid (G)',
        path: 'grid.snap',
        regen: 'grid'
      },
      {
        id: 'cl-grid-show',
        type: 'check',
        label: 'Show/Hide (H)',
        path: 'grid.show',
        regen: 'grid'
      },
      { type: 'separator' },
      {
        id: 'cl-grid-sync',
        type: 'check',
        label: 'Sync Values',
        path: 'grid.sync',
        regen: 'gridSync'
      },
      {
        id: 'cl-grid-y',
        type: 'slider',
        label: 'Horizontal (↑↓)',
        path: 'grid.ui.y',
        min: 2,
        max: 8,
        step: 1,
        regen: 'gridUpdate'
      },
      {
        id: 'cl-grid-x',
        type: 'slider',
        label: 'Vertical (←→)',
        path: 'grid.ui.x',
        min: 2,
        max: 8,
        step: 1,
        regen: 'gridUpdate'
      },
      { type: 'separator' },
      {
        id: 'cl-grid-opacity',
        type: 'slider',
        label: 'Grid Opacity',
        path: 'grid.opacity',
        min: 0.1,
        max: 1,
        step: 0.05,
        regen: 'grid'
      },
      {
        id: 'cl-grid-width',
        type: 'slider',
        label: 'Grid Width',
        path: 'grid.width',
        min: 1,
        max: 4,
        step: 0.1,
        regen: 'grid'
      },
      {
        id: 'cl-grid-color',
        type: 'select',
        label: 'Grid Color',
        path: 'grid.color',
        options: {
          'Black': GRID_COLORS.Black,
          'White': GRID_COLORS.White,
          'Red': GRID_COLORS.Red,
          'Blue': GRID_COLORS.Blue
        },
        regen: 'grid'
      }
    ]
  },
  {
    title: 'ACTIONS',
    controls: [
      {
        id: 'cl-btn-undo',
        type: 'button',
        label: 'Undo Last Action (Ctrl/Cmd + Z)',
        action: 'undo'
      },
      {
        id: 'cl-btn-clear',
        type: 'button',
        label: 'Clear Canvas (C)',
        action: 'clear'
      }
    ]
  }
];
