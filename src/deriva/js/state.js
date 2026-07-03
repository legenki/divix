// DRIFT (Deriva) - Global State and Constants

export const SHAPE_TYPES = {
  Rectangle: "rect",
  Ellipse: "ellipse"
};

export const BG_MODES = {
  Custom: "custom",
  Transparent: "transparent"
};

export const TREND_TYPES = ["pos", "neg", "random", "toggle"];
export const TREND_TOGGLE = ["pos", "neg"];
export const MOVE_TYPES = ["none", "const", "sin", "cos", "noise"];
export const OFFSET_TYPES = ["none", "sin", "cos", "noise"];
export const ROTATE_TYPES = ["none", "const", "sin", "cos", "noise"];
export const SCALE_TYPES = ["none", "sin", "cos", "noise"];
export const OPACITY_TYPES = ["none", "const", "sin", "cos", "noise"];
export const TINT_TYPES = ["none", "const", "sin", "cos", "noise"];

export const RANDOM_TYPES = {
  off: "off",
  random: "random",
  button: "button"
};

export const INITIAL_STATE = {
  preset: "User Preset",
  mouseOver: false,
  show: true,
  showCursor: true,
  border: 1,
  strokeWidth: 2,
  stroke: "#000000aa",
  fill: "#ffffff33",
  bg: {
    mode: "custom",
    custom: "#FFFFFF"
  },
  image: {
    x: 0,
    y: 0,
    preview: false,
    size: 2560
  },
  settings: {
    margin: 0.9,
    ui: 167,
    color: 70,
    sens: 1.75
  }
};

export const FORM_STATE = {
  type: "rect",
  rendering: "canvas",
  content: "preview",
  run: true,
  startup: 10,
  startupTimeout: 250,
  amount: {
    num: 25,
    min: 1,
    max: 100,
    active: ""
  },
  size: {
    x: 100,
    y: 100,
    min: 25,
    max: { width: 400, height: 400 }
  },
  frame: {
    value: "off",
    width: 2,
    color: "#FFFFFF88"
  },
  mouse: { x: 0, y: 0 },
  coords: { x: 0, y: 0 }
};

export const ANIM_STATE = {
  move: {
    x: {
      type: "sin",
      level: 100,
      rate: 2,
      trend: { type: "random", toggle: "pos" },
      random: { type: "button", level: "button", rate: "button" }
    },
    y: {
      type: "noise",
      level: 100,
      rate: 2.5,
      trend: { type: "random", toggle: "neg" },
      random: { type: "button", level: "button", rate: "button" }
    }
  },
  offset: {
    x: {
      type: "sin",
      level: 5,
      rate: 1.5,
      trend: { type: "random", toggle: "pos" },
      random: { type: "button", level: "button", rate: "button" }
    },
    y: {
      type: "sin",
      level: 5,
      rate: 2,
      trend: { type: "random", toggle: "neg" },
      random: { type: "button", level: "button", rate: "button" }
    }
  },
  rotate: {
    type: "none",
    level: 45,
    rate: 2,
    trend: { type: "random", toggle: "pos" },
    random: { type: "button", level: "button", rate: "button" }
  },
  scale: {
    type: "none",
    level: 1.2,
    rate: 1.5,
    trend: { type: "random", toggle: "pos" },
    random: { type: "button", level: "button", rate: "button" }
  },
  opacity: {
    type: "none",
    level: 75,
    rate: 3,
    random: { type: "button", level: "button", rate: "button" }
  },
  tint: {
    type: "none",
    level: 25,
    color: "#FFFFFF",
    rate: 4,
    random: { type: "button", color: "button", level: "button", rate: "button" }
  }
};

export const MAPPING = {
  move: {
    level: { min: 0.01, max: 1 },
    rate: {
      const: { min: 0.4, max: 12 },
      noise: { min: 0.01, max: 0.25 },
      geom: { min: 1, max: 10 }
    }
  },
  offset: {
    level: { min: 0.01, max: 0.25 },
    rate: {
      noise: { min: 0.01, max: 0.15 },
      geom: { min: 1, max: 10 }
    }
  },
  rotate: {
    level: {},
    rate: {
      noise: { min: 0.01, max: 0.5 },
      geom: { min: 0.25, max: 5 }
    }
  },
  scale: {
    level: { min: 0.1, max: 1 },
    rate: {
      noise: { min: 0.002, max: 0.05 },
      geom: { min: 0.005, max: 0.05 }
    }
  },
  opacity: {
    level: { min: 25, max: 255 },
    rate: {
      noise: { min: 0.001, max: 0.01 },
      geom: { min: 0.002, max: 0.02 }
    }
  },
  tint: {
    level: { min: 5, max: 255 },
    rate: {
      noise: { min: 0.001, max: 0.01 },
      geom: { min: 0.002, max: 0.02 }
    }
  }
};

export const REC_STATE = {
  buffer: undefined,
  type: "mp4",
  mult: 1,
  quality: 85,
  capture: false,
  video: false,
  image: false,
  frame: 0,
  frameRate: 60,
  length: {
    value: 5,
    min: 1,
    max: 60
  }
};

// Global active states mutated during runtime
export const cnv = JSON.parse(JSON.stringify(INITIAL_STATE));
export const form = JSON.parse(JSON.stringify(FORM_STATE));
export const anim = JSON.parse(JSON.stringify(ANIM_STATE));
export const rec = JSON.parse(JSON.stringify(REC_STATE));

export const g = {
  texture: {
    // Fallback only — used when the random Unsplash fetch in setup() fails.
    // (Was pointing at Bandada's local texture.webp by copy-paste mistake.)
    default: "https://images.unsplash.com/photo-1707343844152-6d33a0bb32c3?q=80&w=2560&auto=format&fit=crop",
    data: null
  },
  ctx: null,
  preview: null,
  alphaImg: null
};
