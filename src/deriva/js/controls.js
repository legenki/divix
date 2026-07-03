// DRIFT (Deriva) — UI Controls

import {
  BG_MODES,
  SHAPE_TYPES,
  TREND_TYPES,
  TREND_TOGGLE,
  MOVE_TYPES,
  OFFSET_TYPES,
  ROTATE_TYPES,
  SCALE_TYPES,
  OPACITY_TYPES,
  TINT_TYPES,
  RANDOM_TYPES
} from './state.js';

export const SECTIONS = [
  {
    id: "canvas",
    title: "CANVAS",
    inputs: [
      {
        id: "dr-img-upload",
        type: "button",
        label: "Upload Custom Image",
        action: "upload"
      },
      {
        id: "dr-img-random",
        type: "button",
        label: "Random Image (Unsplash)",
        action: "randomImage"
      },
      {
        id: "dr-rendering",
        type: "select",
        label: "Rendering as",
        target: "form.rendering",
        options: [
          { value: "canvas", label: "Single Canvas" },
          { value: "layer", label: "Separate Layers" }
        ],
        regen: "render"
      },
      {
        id: "dr-show-img",
        type: "checkbox",
        label: "Image Display (I)",
        target: "cnv.show"
      },
      {
        id: "dr-bg-mode",
        type: "select",
        label: "Background",
        target: "cnv.bg.mode",
        options: Object.keys(BG_MODES).map((k) => ({ label: k, value: BG_MODES[k] })),
        regen: "ui"
      },
      {
        id: "dr-bg-color",
        type: "color",
        label: "Canvas Color",
        target: "cnv.bg.custom"
      },
      {
        id: "dr-clear",
        type: "button",
        label: "Clear All (C)",
        action: "clear"
      }
    ]
  },
  {
    id: "forms",
    title: "FORMS",
    inputs: [
      {
        id: "dr-form-content",
        type: "select",
        label: "Use Content",
        target: "form.content",
        options: [
          { value: "preview", label: "Preview Image" },
          { value: "live", label: "Live Image" }
        ]
      },
      {
        id: "dr-form-type",
        type: "select",
        label: "Mask Type (M)",
        target: "form.type",
        options: [
          { value: "rect", label: "Rectangle" },
          { value: "ellipse", label: "Ellipse" }
        ],
        regen: "ui"
      },
      {
        id: "dr-form-amount",
        type: "range",
        label: "Maximum Forms",
        target: "form.amount.num",
        min: 1,
        max: 100,
        step: 1,
        regen: "amount"
      },
      {
        id: "dr-form-sizex",
        type: "range",
        label: "Horizontal Size",
        target: "form.size.x",
        min: 10,
        max: 100,
        step: 1
      },
      {
        id: "dr-form-sizey",
        type: "range",
        label: "Vertical Size",
        target: "form.size.y",
        min: 10,
        max: 100,
        step: 1
      },
      {
        id: "dr-form-frame",
        type: "select",
        label: "Frame",
        target: "form.frame.value",
        options: [
          { value: "off", label: "Off" },
          { value: "on", label: "On" }
        ],
        regen: "ui"
      },
      {
        id: "dr-form-frame-w",
        type: "range",
        label: "Frame Width",
        target: "form.frame.width",
        min: 0.5,
        max: 10,
        step: 0.1
      },
      {
        id: "dr-form-frame-c",
        type: "color",
        label: "Frame Color",
        target: "form.frame.color"
      },
      {
        id: "dr-form-add",
        type: "button",
        label: "Add Random Form (+)",
        action: "addRandom"
      },
      {
        id: "dr-form-remove",
        type: "button",
        label: "Remove Last Form (-)",
        action: "removeLast"
      }
    ]
  },
  {
    id: "anim_move",
    title: "ANIM: MOVE",
    inputs: [
      {
        id: "dr-mx-type",
        type: "select",
        label: "Horiz Type",
        target: "anim.move.x.type",
        options: MOVE_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-mx-level",
        type: "range",
        label: "Horiz Level",
        target: "anim.move.x.level",
        min: 1, max: 200, step: 1
      },
      {
        id: "dr-mx-rate",
        type: "range",
        label: "Horiz Rate",
        target: "anim.move.x.rate",
        min: 1, max: 10, step: 0.1
      },
      {
        id: "dr-my-type",
        type: "select",
        label: "Vert Type",
        target: "anim.move.y.type",
        options: MOVE_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-my-level",
        type: "range",
        label: "Vert Level",
        target: "anim.move.y.level",
        min: 1, max: 200, step: 1
      },
      {
        id: "dr-my-rate",
        type: "range",
        label: "Vert Rate",
        target: "anim.move.y.rate",
        min: 1, max: 10, step: 0.1
      }
    ]
  },
  {
    id: "anim_offset",
    title: "ANIM: OFFSET",
    inputs: [
      {
        id: "dr-ox-type",
        type: "select",
        label: "Horiz Offset Type",
        target: "anim.offset.x.type",
        options: OFFSET_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-ox-level",
        type: "range",
        label: "Horiz Level",
        target: "anim.offset.x.level",
        min: 1, max: 25, step: 0.5
      },
      {
        id: "dr-ox-rate",
        type: "range",
        label: "Horiz Rate",
        target: "anim.offset.x.rate",
        min: 1, max: 10, step: 0.1
      },
      {
        id: "dr-oy-type",
        type: "select",
        label: "Vert Offset Type",
        target: "anim.offset.y.type",
        options: OFFSET_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-oy-level",
        type: "range",
        label: "Vert Level",
        target: "anim.offset.y.level",
        min: 1, max: 25, step: 0.5
      },
      {
        id: "dr-oy-rate",
        type: "range",
        label: "Vert Rate",
        target: "anim.offset.y.rate",
        min: 1, max: 10, step: 0.1
      }
    ]
  },
  {
    id: "anim_transform",
    title: "ANIM: ROTATE/SCALE",
    inputs: [
      {
        id: "dr-r-type",
        type: "select",
        label: "Rotate Type",
        target: "anim.rotate.type",
        options: ROTATE_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-r-level",
        type: "range",
        label: "Rotate Level",
        target: "anim.rotate.level",
        min: 5, max: 180, step: 5
      },
      {
        id: "dr-r-rate",
        type: "range",
        label: "Rotate Rate",
        target: "anim.rotate.rate",
        min: 1, max: 10, step: 0.1
      },
      {
        id: "dr-s-type",
        type: "select",
        label: "Scale Type",
        target: "anim.scale.type",
        options: SCALE_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-s-level",
        type: "range",
        label: "Scale Level",
        target: "anim.scale.level",
        min: 1.1, max: 2, step: 0.01
      },
      {
        id: "dr-s-rate",
        type: "range",
        label: "Scale Rate",
        target: "anim.scale.rate",
        min: 1, max: 10, step: 0.1
      }
    ]
  },
  {
    id: "anim_color",
    title: "ANIM: STYLE",
    inputs: [
      {
        id: "dr-op-type",
        type: "select",
        label: "Opacity Type",
        target: "anim.opacity.type",
        options: OPACITY_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-op-level",
        type: "range",
        label: "Opacity Level",
        target: "anim.opacity.level",
        min: 10, max: 100, step: 1
      },
      {
        id: "dr-op-rate",
        type: "range",
        label: "Opacity Rate",
        target: "anim.opacity.rate",
        min: 1, max: 10, step: 0.1
      },
      {
        id: "dr-t-type",
        type: "select",
        label: "Tint Type",
        target: "anim.tint.type",
        options: TINT_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-t-color",
        type: "color",
        label: "Tint Color",
        target: "anim.tint.color"
      },
      {
        id: "dr-t-level",
        type: "range",
        label: "Tint Level",
        target: "anim.tint.level",
        min: 1, max: 100, step: 1
      },
      {
        id: "dr-t-rate",
        type: "range",
        label: "Tint Rate",
        target: "anim.tint.rate",
        min: 1, max: 10, step: 0.1
      }
    ]
  },
  {
    id: "export",
    title: "EXPORT",
    inputs: [
      {
        id: "dr-export-len",
        type: "range",
        label: "Export Length (s)",
        target: "rec.length.value",
        min: 1, max: 60, step: 1
      },
      {
        id: "dr-export-mp4",
        type: "button",
        label: "Export MP4",
        action: "exportMP4"
      },
      {
        id: "dr-export-png",
        type: "button",
        label: "Export Image",
        action: "exportPNG"
      }
    ]
  }
];
