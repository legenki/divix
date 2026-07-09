// SONDEO — Global State and Constants

export const ANIMATION_TYPES = {
  None: "none",
  Linear: "linear",
  Periodic: "periodic",
  "Noise-Based": "noise"
};

export const INITIAL_STATE = {
  mode: "scan",
  easing: 0.06,
  frame: 0,
  sideMode: "short",
  aniTab: 0,
  maxSimplex: 1000,
  bg: "#FF000000",
  mouse: { x: 0, y: 0 },
  cmouse: { x: 0, y: 0 },
  mouseOver: false,
  imgLoad: "loading image ..."
};

export const CNV_STATE = {
  width: 640,
  height: 640,
  maxWidth: 9999,
  maxHeight: 9999,
  multSide: 0.48,
  multLayer: 0.85,
  multWidth: 0,
  multHeight: 0.85,
  density: 2,
  densityMin: 2,
  densityMax: 4,
  canvasOver: false,
  mouseOver: false,
  offSide: 4,
  gap: 2,
  uiSize: -145,
  bgSource: "#FFFFFFFF",
  bgResult: "#FFFFFF00",
  stroke: "#000000FF"
};

export const LAYOUT_STATE = {
  mode: "layer",
  width: 0,
  height: 0,
  maskWidth: 0
};

export const SCALING_STATE = {
  type: "none",
  area: { min: 0, max: 100 },
  frame: 0,
  base: 100,
  start: 100,
  value: 0,
  linear: 85,
  period: 85,
  cycle: 5,
  transition: "Sinusoidal",
  phase: 0,
  ease: 2,
  noise: 12,
  freq: 0.1,
  seed: Math.floor(Math.random() * 1000)
};

export const ROTATION_STATE = {
  type: "none",
  area: { min: 0, max: 100 },
  frame: 0,
  base: 0,
  start: 0,
  value: 0,
  linear: 90,
  period: 8,
  cycle: 4,
  transition: "Sinusoidal",
  phase: 0.5,
  ease: 2,
  noise: 6,
  freq: 0.1,
  seed: Math.floor(Math.random() * 1000)
};

export const SHIFT_STATE = {
  type: { x: "none", y: "none" },
  xArea: { min: 0, max: 100 },
  yArea: { min: 0, max: 100 },
  frame: { x: 0, y: 0 },
  base: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  value: { x: 0, y: 0 },
  size: { x: 0, y: 0 },
  linear: { x: 60, y: 60 },
  period: { x: 6, y: 6 },
  cycle: { x: 5, y: 5 },
  transition: { x: "Sinusoidal", y: "Sinusoidal" },
  phase: { x: 0, y: 0 },
  ease: { x: 2, y: 2 },
  noise: { x: 6, y: 6 },
  freq: { x: 0.12, y: 0.12 },
  seed: {
    x: Math.floor(Math.random() * 1000),
    y: Math.floor(Math.random() * 1000)
  }
};

export const SCAN_STATE = {
  type: "horizontal",
  action: false,
  position: 0,
  ratio: 1,
  speed: 2,
  width: 100,
  height: 100,
  area: { x1: 0, y1: 0, x2: 0, y2: 0 },
  frame: { x1: 0, y1: 0, x2: 0, y2: 0 },
  line: { x1: 0, y1: 0, x2: 0, y2: 0 },
  lineColor: "#FF0000FF"
};

export const MAAP_STATE = {
  bool: true,
  raw: { x: 0, y: 0 },
  mouse: { x: 0, y: 0 },
  delta: { x: 0, y: 0 },
  on: { x: 0, y: 0 },
  off: { x: 0, y: 0 },
  translate: { x: 0, y: 0 },
  shade: { mult: 0.98, x: 0, y: 0 },
  pos: { x: 0, y: 0 },
  remaind: { x: 0, y: 0 }
};

export const GRAIN_STATE = {
  type: "none",
  opacity: 0.25,
  coarse: 0.2,
  offset: 0,
  frame: 0,
  xoff: 0,
  yoff: 0
};

export const SHADE_STATE = {
  apply: "none",
  type: "light/dark",
  level: 0.25,
  angle: 6,
  mult: 25,
  xoff: 0,
  frame: 0,
  freq: 0.4,
  freqFine: 0.04,
  freqMult: 0,
  color: "#FFFFFFFF",
  pos: { x: 0, y: 0 },
  seed: Math.floor(Math.random() * 1000)
};

export const MASK_STATE = {
  first: true,
  draw: false,
  min: 50,
  x1: 0, y1: 0, x2: 0, y2: 0,
  fill: "#E6DCDCE5",
  stroke: "#FF0000FF",
  scanColor: "#FF0000F2"
};

// Mutable runtime state
export const params = JSON.parse(JSON.stringify(INITIAL_STATE));
export const cnv = JSON.parse(JSON.stringify(CNV_STATE));
export const layout = JSON.parse(JSON.stringify(LAYOUT_STATE));
export const scaling = JSON.parse(JSON.stringify(SCALING_STATE));
export const rotation = JSON.parse(JSON.stringify(ROTATION_STATE));
export const shift = JSON.parse(JSON.stringify(SHIFT_STATE));
export const scan = JSON.parse(JSON.stringify(SCAN_STATE));
export const maap = JSON.parse(JSON.stringify(MAAP_STATE));
export const grain = JSON.parse(JSON.stringify(GRAIN_STATE));
export const shade = JSON.parse(JSON.stringify(SHADE_STATE));
export const maask = JSON.parse(JSON.stringify(MASK_STATE));

export const g = {
  ctx: null,
  source: null,
  result: null,
  texture: {
    default: "https://images.unsplash.com/photo-1707343844152-6d33a0bb32c3?q=80&w=2560&auto=format&fit=crop",
    data: null
  },
  coverImg: null,
  readyToDraw: false,
  noiseOffset: 0
};
