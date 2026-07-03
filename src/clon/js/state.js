export const cnv = {
  width: 640,
  height: 640,
  maxWidth: 640,
  maxHeight: 640,
  mouseOver: false,
  density: 1,
  source: true,
  result: true,
  cursor: true,
  tooltips: true,
  bg: {
    mode: "custom",
    custom: "#FFFFFF"
  },
  image: {
    size: "",
    max: 2560
  },
  mouse: {
    x: 0,
    y: 0,
    px: 0,
    py: 0
  },
  size: {
    x: 512,
    y: 512,
    min: 5,
    width: 400,
    height: 400
  },
  settings: {
    margin: 0.9,
    ui: 167,
    color: 40,
    sens: 1.25
  }
};

export const preview = {
  ready: true,
  select: false,
  size: {
    x: 0,
    y: 0
  },
  buffer: {
    x: 0,
    y: 0
  },
  mod: {
    x: 0,
    y: 0
  },
  coords: {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0
  },
  stroke: "#000000",
  fill: "#FFFFFF2A"
};

export const form = {
  coords: {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0
  },
  size: {
    x: 0,
    y: 0
  }
};

export const area = {
  coords: {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0
  },
  size: {
    x: 512,
    y: 512
  },
  rotation: {
    amount: 0,
    add: 90
  }
};

export const mode = {
  draw: "canvas",
  select: "free",
  last: "free",
  shape: "rect",
  shapeType: ["rect", "ellipse", "triangle"],
  shapeAngle: 0
};

export const grid = {
  update: true,
  snap: true,
  show: true,
  color: "black",
  opacity: 0.5,
  width: 1.5,
  size: 1000,
  cell: 0,
  mult: 1,
  sync: true,
  x: 20,
  y: 20,
  ui: {
    x: 3,
    y: 3,
    min: 2,
    max: 8
  },
  mod: {
    x: 0,
    y: 0
  }
};

export const BG_MODES = {
  Custom: "custom",
  Transparent: "transparent"
};

export const GRID_COLORS = {
  Black: "black",
  White: "white",
  Red: "red",
  Blue: "blue"
};

export const SHAPE_TYPES = {
  Rectangle: "rect",
  Ellipse: "ellipse",
  Triangle: "triangle"
};

export const DRAW_MODES = {
  Canvas: "canvas",
  Area: "area"
};

export const SELECT_MODES = {
  Free: "free",
  "1:1": "square",
  Grid: "grid"
};

export const g = {
  result: null,
  preview: null,
  buffer: null,
  area: null,
  grid: null,
  backup: null,
  imgSource: null,
  alphaImg: null
};

export const SYS = {
  mouseLocked: false,
  shiftLocked: false,
  mxLocked: false,
  myLocked: false,
  isDrop: false,
  isLoadImage: false
};
