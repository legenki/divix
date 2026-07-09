// SONDEO — UI Controls

import { ANIMATION_TYPES } from './state.js';

export const SECTIONS = [
  {
    id: "scan",
    title: "Scan & Mask",
    controls: [
      {
        id: "sn-upload",
        type: "button",
        label: "Upload Image",
        action: "upload",
      },
      {
        id: "sn-use-result",
        type: "button",
        label: "Use Scan Result",
        action: "useResult"
      },
      {
        id: "sn-start-scan",
        type: "button",
        label: "Start / Stop Scan (Space)",
        action: "startScan"
      },
      {
        id: "sn-reset-scan",
        type: "button",
        label: "Restart Scan (R)",
        action: "resetScan"
      },
      {
        id: "sn-scan-dir",
        type: "select",
        label: "Scan Direction",
        path: "scan.type",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" }
        ],
        regen: "scan"
      },
      {
        id: "sn-scan-speed",
        type: "range",
        label: "Offset / Speed",
        path: "scan.speed",
        min: 1, max: 50, step: 1,
        regen: "speed"
      },
      {
        id: "sn-mask-mode",
        type: "button",
        label: "Mask Mode (M)",
        action: "toggleMask"
      },
      {
        id: "sn-reset-mask",
        type: "button",
        label: "Reset Mask (Shift+M)",
        action: "resetMask"
      },
      {
        id: "sn-mask-fill",
        type: "color",
        label: "Fill Color",
        path: "maask.fill"
      },
      {
        id: "sn-mask-stroke",
        type: "color",
        label: "Stroke Color",
        path: "maask.stroke"
      }
    ]
  },
  {
    id: "layout",
    title: "Layout & Settings",
    controls: [
      {
        id: "sn-layout-mode",
        type: "select",
        label: "Layouts (L)",
        path: "layout.mode",
        options: [
          { value: "side", label: "Side to Side" },
          { value: "layer", label: "As Layers" }
        ],
        regen: "layout"
      },
      {
        id: "sn-scan-area",
        type: "color",
        label: "Outscan Area",
        path: "maask.scanColor"
      },
      {
        id: "sn-width-control",
        type: "select",
        label: "Width Control",
        path: "params.sideMode",
        options: [
          { value: "full", label: "Full Browser Width" },
          { value: "short", label: "Exclude UI Size" }
        ],
        regen: "layout"
      },
      {
        id: "sn-mouse-ease",
        type: "range",
        label: "Mouse Easing",
        path: "params.easing",
        min: 0.01, max: 0.2, step: 0.01
      }
    ]
  },
  {
    id: "transform",
    title: "Transform Controls",
    controls: [
      {
        id: "sn-base-shift-x",
        type: "range",
        label: "Base Shift (X)",
        path: "shift.base.x",
        min: -100, max: 100, step: 1
      },
      {
        id: "sn-base-shift-y",
        type: "range",
        label: "Base Shift (Y)",
        path: "shift.base.y",
        min: -100, max: 100, step: 1
      },
      {
        id: "sn-base-scale",
        type: "range",
        label: "Base Scale",
        path: "scaling.base",
        min: 50, max: 200, step: 1
      },
      {
        id: "sn-base-rotate",
        type: "range",
        label: "Base Rotation",
        path: "rotation.base",
        min: -180, max: 180, step: 1
      },
      {
        id: "sn-reset-transform",
        type: "button",
        label: "Reset Transformations (T)",
        action: "resetTransform"
      }
    ]
  },
  {
    id: "animation",
    title: "Animation",
    controls: [
      {
        id: "sn-anim-shift-x",
        type: "select",
        label: "Shift (X) Type",
        path: "shift.type.x",
        options: Object.keys(ANIMATION_TYPES).map(k => ({ label: k, value: ANIMATION_TYPES[k] })),
        regen: "ui"
      },
      {
        id: "sn-anim-shift-y",
        type: "select",
        label: "Shift (Y) Type",
        path: "shift.type.y",
        options: Object.keys(ANIMATION_TYPES).map(k => ({ label: k, value: ANIMATION_TYPES[k] })),
        regen: "ui"
      },
      {
        id: "sn-anim-scale",
        type: "select",
        label: "Scale Type",
        path: "scaling.type",
        options: Object.keys(ANIMATION_TYPES).map(k => ({ label: k, value: ANIMATION_TYPES[k] })),
        regen: "ui"
      },
      {
        id: "sn-anim-rotate",
        type: "select",
        label: "Rotate Type",
        path: "rotation.type",
        options: Object.keys(ANIMATION_TYPES).map(k => ({ label: k, value: ANIMATION_TYPES[k] })),
        regen: "ui"
      },
      {
        id: "sn-stop-anim",
        type: "button",
        label: "Turn Off All Animations",
        action: "stopAnimations"
      }
    ]
  },
  {
    id: "effects",
    title: "Effects",
    controls: [
      {
        id: "sn-shade-apply",
        type: "select",
        label: "Apply Shade To",
        path: "shade.apply",
        options: [
          { value: "none", label: "None" },
          { value: "mouse", label: "Mouse: Drag" },
          { value: "aShiftX", label: "Shift X: Animation" },
          { value: "aShiftY", label: "Shift Y: Animation" },
          { value: "aScale", label: "Scale: Animation" },
          { value: "aRotate", label: "Rotate: Animation" }
        ],
        regen: "ui"
      },
      {
        id: "sn-shade-type",
        type: "select",
        label: "Shade Mode",
        path: "shade.type",
        options: [
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "light/dark", label: "Light/Dark" },
          { value: "dark/light", label: "Dark/Light" },
          { value: "alpha", label: "Alpha" }
        ]
      },
      {
        id: "sn-shade-level",
        type: "range",
        label: "Shade Level",
        path: "shade.level",
        min: 0, max: 1, step: 0.01
      },
      {
        id: "sn-shade-angle",
        type: "range",
        label: "Folds Multiplier",
        path: "shade.angle",
        min: 1, max: 25, step: 1
      },
      {
        id: "sn-shade-freq",
        type: "range",
        label: "Noise Freq",
        path: "shade.freq",
        min: 0, max: 1, step: 0.05
      },
      {
        id: "sn-shade-freq-fine",
        type: "range",
        label: "Freq Details",
        path: "shade.freqFine",
        min: 0, max: 0.1, step: 0.01
      },
      {
        id: "sn-grain-type",
        type: "select",
        label: "Grain Mode",
        path: "grain.type",
        options: [
          { value: "none", label: "Off" },
          { value: "uniform", label: "Uniform" },
          { value: "shade", label: "Shade-Bias" }
        ],
        regen: "ui"
      },
      {
        id: "sn-grain-opacity",
        type: "range",
        label: "Grain Opacity",
        path: "grain.opacity",
        min: 0.05, max: 1, step: 0.05
      },
      {
        id: "sn-grain-coarse",
        type: "range",
        label: "Coarseness",
        path: "grain.coarse",
        min: 1, max: 4, step: 1
      }
    ]
  },
  {
    id: "export",
    title: "Export",
    controls: [
      {
        id: "sn-export-bg",
        type: "color",
        label: "Background",
        path: "cnv.bgResult"
      },
      {
        id: "sn-export-png",
        type: "button",
        label: "Download Result (D)",
        action: "exportPNG"
      }
    ]
  }
];
