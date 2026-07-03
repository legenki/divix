// BANDADA (Boids) — workspace state and option maps.
// Ported from reference/boids/scripts/var.js

export const PRESET_TYPES = {
  "Default Preset": "defaultPreset",
  "Custom Texture": "customTexture",
  "Coral Stream": "coralStreamPreset",
  "Kate's Magic": "kateMagicPreset",
  "Jelly Geometry": "jellyGeometryPreset",
  "A Bit Of Serenity": "serenityScenePreset",
  "Diffusion Burst": "diffusionBurstPreset",
  "Chain Reaction": "chainReactionPreset",
  "Mirrors Drift": "mirrorsDriftPreset",
  "Severance Effect": "severanceEffectPreset",
  "Bubble Flow": "bubbleFlowPreset",
  "** User Preset **": "User Preset"
};

export const CANVAS_BACK_MODES = {
  "Custom Color": "color",
  "Texture Image": "image",
  Transparent: "alpha"
};

export const EDGE_MODES = {
  "Wrap around": "wrap",
  "Repel from edges": "repel"
};

export const RENDER_MODES = {
  "Vector Graphics": "vector",
  "Textures From Image": "image"
};

export const SHAPE_SKEW_MODES = {
  None: "none",
  "Based on Speed": "speed",
  "Based on Angle": "angle"
};

export const COLOR_STYLES = {
  None: "none",
  "Single Color": "single",
  "Color Interpolation (Random)": "random",
  "Color Interpolation (Speed)": "speed",
  "Color Interpolation (Angle)": "angle"
};

export const SHAPE_TYPES = {
  Mixed: "mixed",
  Ellipse: "ellipse",
  Rectangle: "rect",
  Triangle: "triangle"
};

export const EXPORT_TYPES = {
  "PNG File": "image",
  "MP4 File": "mp4"
};

export const RATIO_TYPES = {
  "2:1": "2:1",
  "16:9": "16:9",
  "3:2": "3:2",
  "4:3": "4:3",
  "5:4": "5:4",
  "1:1": "1:1",
  "4:5": "4:5",
  "3:4": "3:4",
  "2:3": "2:3",
  "9:16": "9:16",
  "1:2": "1:2"
};

export const RESOLUTIONS = {
  "2:1": { width: 640, height: 320 },
  "16:9": { width: 640, height: 360 },
  "3:2": { width: 600, height: 400 },
  "4:3": { width: 512, height: 384 },
  "5:4": { width: 600, height: 480 },
  "1:1": { width: 480, height: 480 },
  "4:5": { width: 480, height: 600 },
  "3:4": { width: 384, height: 512 },
  "2:3": { width: 400, height: 600 },
  "9:16": { width: 360, height: 640 },
  "1:2": { width: 320, height: 640 }
};

// --- Runtime state ---

export const cnv = {
  preset: "User Preset",
  density: {
    base: 3,
    export: 2000
  },
  ratio: "1:1",
  animation: true,
  mouseForce: {
    value: 66,
    min: 1,
    max: 100,
    step: 1
  },
  bg: {
    mode: "image",
    color: "#222222ff"
  },
  settings: {
    margin: 0.85,
    ui: 167,
    color: 70
  }
};

export const texture = {
  default: "assets/bandada/texture.webp",
  url: null,
  user: null,
  data: null,
  temp: null
};

export const seed = {
  value: 3141,
  max: 10000
};

export const params = {
  render: "vector",
  shape: "mixed",
  edge: {
    mode: "wrap",
    offset: { value: 0.1, min: 0, max: 0.5, step: 0.01 },
    ease: { value: 0.5, min: 0, max: 1, step: 0.01 }
  },
  fill: {
    style: "single",
    reaction: 0.1,
    0: "#ff4703aa",
    1: "#7400ffff"
  },
  stroke: {
    style: "single",
    width: { value: 0.75, min: 0.25, max: 2, step: 0.05 },
    reaction: 0.1,
    0: "#ff0000ff",
    1: "#7400ffff"
  },
  boids: { value: 750, min: 50, max: 3000, step: 50 },
  scale: {
    value: 2.2,
    random: { value: 0, min: 0, max: 1, step: 0.1 },
    min: 0.4,
    max: 10,
    step: 0.05
  },
  skew: {
    mode: "none",
    value: 0.6,
    reaction: 0.25,
    min: 0,
    max: 0.9,
    step: 0.05
  },
  accuracy: { value: 5, min: 0, max: 10, step: 0.2 },
  vision: { value: 4.5, min: 0, max: 25, step: 0.5 },
  alignment: { value: 1, min: 0, max: 4, step: 0.05 },
  bias: { value: 2, min: 0.1, max: 4, step: 0.05 },
  cohesion: { value: 0.9, min: 0, max: 4, step: 0.05 },
  separation: { value: 1.25, min: 0, max: 4, step: 0.05 },
  steering: {
    value: 0.15,
    reaction: 0.2,
    min: 0,
    max: 0.5,
    step: 0.01
  },
  speed: {
    value: { min: 0.1, max: 2 },
    min: 0,
    max: 5,
    step: 0.05
  },
  drag: { value: 0.02, min: 0, max: 0.1, step: 0.005 },
  angle: { value: 2.5, min: 0, max: 10, step: 0.5 },
  reaction: { min: 0, max: 0.5, step: 0.01 }
};

export const debug = {
  areas: false,
  buckets: false
};

export const g = {
  frame: 0,
  defaultSize: 10,
  gridFactor: 500,
  shapeTypes: [],
  shapePos: [],
  shapeVelocity: [],
  shapeColor: [],
  ctx: null,
  texture: null,
  width: null,
  height: null,
  mouse: {
    x: 0,
    y: 0,
    force: 0,
    down: false,
    over: false,
    button: 0
  }
};

export const rec = {
  status: "Loading ...",
  type: "mp4",
  restart: false,
  quality: 85,
  capture: false,
  video: false,
  image: false,
  svg: false,
  frame: 0,
  frameRate: 60,
  length: {
    value: 10,
    min: 1,
    max: 60
  }
};
