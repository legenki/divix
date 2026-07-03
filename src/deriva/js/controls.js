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
    title: "Canvas",
    controls: [
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
        path: "form.rendering",
        options: [
          { value: "canvas", label: "Single Canvas" },
          { value: "layer", label: "Separate Layers" }
        ],
        regen: "render"
      },
      {
        id: "dr-show-img",
        type: 'check',
        label: "Image Display (I)",
        path: "cnv.show"
      },
      {
        id: "dr-bg-mode",
        type: "select",
        label: "Background",
        path: "cnv.bg.mode",
        options: Object.keys(BG_MODES).map((k) => ({ label: k, value: BG_MODES[k] })),
        regen: "ui"
      },
      {
        id: "dr-bg-color",
        type: "color",
        label: "Canvas Color",
        path: "cnv.bg.custom"
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
    title: "Forms",
    controls: [
      {
        id: "dr-form-content",
        type: "select",
        label: "Use Content",
        path: "form.content",
        options: [
          { value: "preview", label: "Preview Image" },
          { value: "live", label: "Live Image" }
        ]
      },
      {
        id: "dr-form-type",
        type: "select",
        label: "Mask Type (M)",
        path: "form.type",
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
        path: "form.amount.num",
        min: 1,
        max: 100,
        step: 1,
        regen: "amount"
      },
      {
        id: "dr-form-sizex",
        type: "range",
        label: "Horizontal Size",
        path: "form.size.x",
        min: 10,
        max: 100,
        step: 1
      },
      {
        id: "dr-form-sizey",
        type: "range",
        label: "Vertical Size",
        path: "form.size.y",
        min: 10,
        max: 100,
        step: 1
      },
      {
        id: "dr-form-frame",
        type: "select",
        label: "Frame",
        path: "form.frame.value",
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
        path: "form.frame.width",
        min: 0.5,
        max: 10,
        step: 0.1
      },
      {
        id: "dr-form-frame-c",
        type: "color",
        label: "Frame Color",
        path: "form.frame.color"
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
    title: "Anim: Move",
    controls: [
      {
        id: "dr-mx-type",
        type: "select",
        label: "Horiz Type",
        path: "anim.move.x.type",
        options: MOVE_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-mx-level",
        type: "range",
        label: "Horiz Level",
        path: "anim.move.x.level",
        min: 1, max: 200, step: 1
      },
      {
        id: "dr-mx-rate",
        type: "range",
        label: "Horiz Rate",
        path: "anim.move.x.rate",
        min: 1, max: 10, step: 0.1
      },
      {
        id: "dr-my-type",
        type: "select",
        label: "Vert Type",
        path: "anim.move.y.type",
        options: MOVE_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-my-level",
        type: "range",
        label: "Vert Level",
        path: "anim.move.y.level",
        min: 1, max: 200, step: 1
      },
      {
        id: "dr-my-rate",
        type: "range",
        label: "Vert Rate",
        path: "anim.move.y.rate",
        min: 1, max: 10, step: 0.1
      }
    ]
  },
  {
    id: "anim_offset",
    title: "Anim: Offset",
    controls: [
      {
        id: "dr-ox-type",
        type: "select",
        label: "Horiz Offset Type",
        path: "anim.offset.x.type",
        options: OFFSET_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-ox-level",
        type: "range",
        label: "Horiz Level",
        path: "anim.offset.x.level",
        min: 1, max: 25, step: 0.5
      },
      {
        id: "dr-ox-rate",
        type: "range",
        label: "Horiz Rate",
        path: "anim.offset.x.rate",
        min: 1, max: 10, step: 0.1
      },
      {
        id: "dr-oy-type",
        type: "select",
        label: "Vert Offset Type",
        path: "anim.offset.y.type",
        options: OFFSET_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-oy-level",
        type: "range",
        label: "Vert Level",
        path: "anim.offset.y.level",
        min: 1, max: 25, step: 0.5
      },
      {
        id: "dr-oy-rate",
        type: "range",
        label: "Vert Rate",
        path: "anim.offset.y.rate",
        min: 1, max: 10, step: 0.1
      }
    ]
  },
  {
    id: "anim_transform",
    title: "Anim: Rotate/Scale",
    controls: [
      {
        id: "dr-r-type",
        type: "select",
        label: "Rotate Type",
        path: "anim.rotate.type",
        options: ROTATE_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-r-level",
        type: "range",
        label: "Rotate Level",
        path: "anim.rotate.level",
        min: 5, max: 180, step: 5
      },
      {
        id: "dr-r-rate",
        type: "range",
        label: "Rotate Rate",
        path: "anim.rotate.rate",
        min: 1, max: 10, step: 0.1
      },
      {
        id: "dr-s-type",
        type: "select",
        label: "Scale Type",
        path: "anim.scale.type",
        options: SCALE_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-s-level",
        type: "range",
        label: "Scale Level",
        path: "anim.scale.level",
        min: 1.1, max: 2, step: 0.01
      },
      {
        id: "dr-s-rate",
        type: "range",
        label: "Scale Rate",
        path: "anim.scale.rate",
        min: 1, max: 10, step: 0.1
      }
    ]
  },
  {
    id: "anim_color",
    title: "Anim: Style",
    controls: [
      {
        id: "dr-op-type",
        type: "select",
        label: "Opacity Type",
        path: "anim.opacity.type",
        options: OPACITY_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-op-level",
        type: "range",
        label: "Opacity Level",
        path: "anim.opacity.level",
        min: 10, max: 100, step: 1
      },
      {
        id: "dr-op-rate",
        type: "range",
        label: "Opacity Rate",
        path: "anim.opacity.rate",
        min: 1, max: 10, step: 0.1
      },
      {
        id: "dr-t-type",
        type: "select",
        label: "Tint Type",
        path: "anim.tint.type",
        options: TINT_TYPES.map(k => ({ label: `(${k})`, value: k })),
        regen: "ui"
      },
      {
        id: "dr-t-color",
        type: "color",
        label: "Tint Color",
        path: "anim.tint.color"
      },
      {
        id: "dr-t-level",
        type: "range",
        label: "Tint Level",
        path: "anim.tint.level",
        min: 1, max: 100, step: 1
      },
      {
        id: "dr-t-rate",
        type: "range",
        label: "Tint Rate",
        path: "anim.tint.rate",
        min: 1, max: 10, step: 0.1
      }
    ]
  },
  {
    id: "export",
    title: "Export",
    controls: [
      {
        id: "dr-export-len",
        type: "range",
        label: "Export Length (s)",
        path: "rec.length.value",
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
