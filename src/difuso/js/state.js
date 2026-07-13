// DIFUSO — workspace state and option maps (ported from the original tool).
// State objects are mutated in place by the panel, presets and the sketch;
// their initial values are the tool's default preset.

// --- Runtime state (mutated by panel/presets/sketch) ---

export const cnv = {
  width: 640,
  height: 640,
  maxSize: 9999,
  uiSize: 167,
  scale: 0.98,
  ratio: "1:1",
  preset: "User Preset",
  density: {
    base: 2,
    export: 2000
  },
  sens: {
    x: 0.5,
    y: 0.25,
    scale: 0.003
  },
  windowColor: 40
};

export const ascii = {
  font: "",
  fontname: "Public Pixel",
  text: "",
  cols: 1,
  rows: 1,
  scale: 8,
  maxScale: 256,
  box: [],
  ratio: 1,
  color: {
    limit: 4,
    mode: "chars",
    char: "#000000",
    bg: "#ffffff"
  }
};

export const dither = {
  type: "none",
  matrix: "bayer8",
  noise: "noise64",
  texture: 1,
  step: 16,
  contrast: 1,
  brightness: 1,
  scale: 1,
  halftone: {
    scale: 5,
    scaleMin: 3,
    scaleMax: 24,
    smooth: 2,
    x: 1,
    y: 1,
    z: 1
  }
};

export const gradient = {
  type: "gradient",
  saturation: 1,
  palette: 1,
  reverse: false,
  color: {
    0: "#3c2706",
    1: "#7A5649",
    2: "#CC3904",
    3: "#e5cf0a",
    4: "#FAF5C6"
  },
  use: {
    0: true,
    1: true,
    2: true,
    3: true,
    4: true
  }
};

// `rec.type` default is changed from the original's "object" (3D) to "image"
// — Difuso opens on an image by default; users opt into 3D by uploading a
// .obj/.stl model (see objects.js), which sets rec.type to 'object' itself.
export const rec = {
  type: "image",
  buffer: undefined,
  video: undefined,
  capture: false,
  format: "mp4",
  frame: 0,
  quality: 75,
  status: "Loading ...",
  frameRate: 30
};

// `obj` and `motion` drive the 3D Object mode (rec.type === 'object'). Ported
// from reference/dithr/scripts/var.js's obj/motion blocks.
export const obj = {
  model: undefined,
  state: "",
  canvas: "#ffffff",
  transparent: false,
  camera: "ortho",
  rotation: {
    x: 0,
    y: 0
  },
  translate: {
    x: 0,
    y: 0
  },
  scale: {
    default: 2.5,
    factor: 2.5,
    min: 1,
    max: 10
  },
  light: {
    ambient: 50,
    specular: 200,
    shininess: 12,
    one: {
      color: "#ff0000",
      x: 0,
      y: 1,
      z: -1
    },
    two: {
      color: "#00ff00",
      x: -0.1,
      y: 0,
      z: -0.1
    },
    three: {
      color: "#0000ff",
      x: 0.5,
      y: 0,
      z: -0.5
    }
  }
};

export const motion = {
  active: true,
  frame: 0,
  rotate: {
    type: "constant",
    angle: {
      x: 45,
      y: 45,
      z: 45
    },
    speed: {
      x: 0,
      y: 0.1,
      z: 0
    }
  },
  translate: {
    level: {
      x: 0.25,
      y: 0.25,
      z: 0.25
    },
    speed: {
      x: 0,
      y: 0,
      z: 0
    }
  }
};

// --- Option maps (read-only; label → value lookups for the panel UI) ---

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
  "2:1": { width: 1920, height: 960 },
  "16:9": { width: 1920, height: 1080 },
  "3:2": { width: 1440, height: 960 },
  "4:3": { width: 1280, height: 960 },
  "5:4": { width: 1280, height: 1024 },
  "1:1": { width: 1280, height: 1280 },
  "4:5": { width: 1024, height: 1280 },
  "3:4": { width: 960, height: 1280 },
  "2:3": { width: 960, height: 1440 },
  "9:16": { width: 1080, height: 1920 },
  "1:2": { width: 960, height: 1920 }
};

// Reduced from the source tool's fontTypes — the "[CCFont]" attribution-header
// entry ("-- Attribution Only Fonts: --") was a divider label in the original
// Tweakpane font dropdown, not a real selectable font, so it is dropped here.
export const FONT_TYPES = {
  "3X3 Mono": "assets/font/font_3X3Mono-drx1V.ttf",
  Atascii: "assets/font/font_atascii.ttf",
  "Bescii Mono": "assets/font/font_Bescii-Mono.ttf",
  "CPC 464": "assets/font/font_cpc464.ttf",
  "Home Video": "assets/font/font_HomeVideo.ttf",
  Lexis: "assets/font/font_lexis.ttf",
  "Public Pixel": "assets/font/font_PublicPixel.ttf",
  Ursa: "assets/font/font_UrsaFont.ttf",
  "CL Stingray 8x16 Bold": "assets/font/font_Px437_CL_Stingray_8x16_bold.ttf",
  "CompaqThin 8x16": "assets/font/font_Px437_CompaqThin_8x16.ttf",
  EpsonMGA: "assets/font/font_Px437_EpsonMGA.ttf",
  "EverexME 5x8": "assets/font/font_Px437_EverexME_5x8.ttf",
  "HP 100LX 6x8": "assets/font/font_Px437_HP_100LX_6x8.ttf",
  "HP 100LX 10x11": "assets/font/font_Px437_HP_100LX_10x11.ttf",
  "IBM DOS ISO8": "assets/font/font_Px437_IBM_DOS_ISO8.ttf",
  "Master 512 Bold": "assets/font/font_Px437_Master_512_bold.ttf",
  "Master 512 M7 Bold": "assets/font/font_Px437_Master_512-M7_bold.ttf",
  "ToshibaTx L1 8x8": "assets/font/font_Px437_ToshibaTxL1_8x8.ttf",
  "PxPlus IBM VGA 9x14": "assets/font/font_PxPlus_IBM_VGA_9x14.ttf"
};


// 30 built-in color palettes, ported from the source tool's `colorPalette`.
// Indexing choice: kept as the original's 1-based numeric-string keys (an
// object, not a 0-indexed array) because `gradient.palette` is a 1..30 slider
// value that must map directly onto these keys — `COLOR_PALETTES[gradient.palette]`
// works with no off-by-one conversion anywhere else in the port (controls.js,
// app.js). NOTE: this is an intentional exception, not a repeat of an existing
// pattern — divix/js/state.js's `palette.array`/`palette.index` is 0-indexed;
// don't "fix" this to match that later. Being an object (not an array), it also
// has no `.length` — use `Object.keys(COLOR_PALETTES).length` to count entries.
// Each entry: { use: bool[5], color: hex[5], reverse: bool }.
export const COLOR_PALETTES = {
  1: {
    use: [true, true, true, true, true],
    color: ["#2e3336", "#358e7e", "#e57e3a", "#f883d6", "#CAD2D6"],
    reverse: false
  },
  2: {
    use: [true, true, true, true, true],
    color: ["#2c426f", "#403d3d", "#db622d", "#d14e9b", "#CCC5C5"],
    reverse: false
  },
  3: {
    use: [true, true, true, true, true],
    color: ["#303134", "#e15934", "#355ccd", "#348443", "#d2b58a"],
    reverse: false
  },
  4: {
    use: [true, true, true, true, true],
    color: ["#2d2d2d", "#616f59", "#e8e0df", "#eeb2d0", "#e25d57"],
    reverse: false
  },
  5: {
    use: [true, true, true, true, false],
    color: ["#353f37", "#744498", "#2f8088", "#fb8727", "#ece7f4"],
    reverse: false
  },
  6: {
    use: [true, true, true, true, false],
    color: ["#363534", "#45936f", "#d28581", "#f2dc18", "#dae3ff"],
    reverse: false
  },
  7: {
    use: [true, false, false, true, true],
    color: ["#3d3f43", "#77609f", "#9ca558", "#5286b5", "#cccbd5"],
    reverse: false
  },
  8: {
    use: [true, true, true, false, false],
    color: ["#2f2727", "#2169d8", "#ff3b0e", "#a7723b", "#f4caf0"],
    reverse: false
  },
  9: {
    use: [false, true, true, true, false],
    color: ["#0e301e", "#4e3fe4", "#2fa257", "#d2cfbf", "#9d7d37"],
    reverse: false
  },
  10: {
    use: [true, true, true, true, true],
    color: ["#3c2706", "#7a5649", "#cc3904", "#e5cf0a", "#faf5c6"],
    reverse: false
  },
  11: {
    use: [true, true, true, true, true],
    color: ["#d27099", "#8f64b0", "#4060a5", "#609dc5", "#9ddbc3"],
    reverse: false
  },
  12: {
    use: [true, true, true, true, true],
    color: ["#117092", "#11c3ef", "#cca8e1", "#e9d13e", "#e7f6fe"],
    reverse: false
  },
  13: {
    use: [true, true, true, true, false],
    color: ["#2a2955", "#6612ff", "#e12955", "#d19ef6", "#fac4ac"],
    reverse: false
  },
  14: {
    use: [true, true, true, true, true],
    color: ["#000000", "#db4b3d", "#ff7b05", "#7dcfa7", "#b2ccff"],
    reverse: false
  },
  15: {
    use: [false, true, true, true, false],
    color: ["#252c32", "#387d1f", "#f0a8ce", "#eee1da", "#eef1df"],
    reverse: false
  },
  16: {
    use: [true, true, true, false, false],
    color: ["#5f5f65", "#ac5cc3", "#db5e51", "#5fa26a", "#a3d4c6"],
    reverse: false
  },
  17: {
    use: [true, true, true, true, false],
    color: ["#050006", "#395e54", "#e55486", "#e77b4d", "#a1b8cf"],
    reverse: false
  },
  18: {
    use: [true, true, true, true, true],
    color: ["#118ab2", "#ef476f", "#f78c6b", "#ffd166", "#06d6a0"],
    reverse: false
  },
  19: {
    use: [true, true, true, true, true],
    color: ["#032472", "#3a678f", "#8D69DE", "#ffa900", "#FFD200"],
    reverse: false
  },
  20: {
    use: [true, true, true, true, true],
    color: ["#401469", "#9d246f", "#df1260", "#398a9b", "#10bbb1"],
    reverse: false
  },
  21: {
    use: [true, true, true, true, false],
    color: ["#8d0805", "#d55f32", "#5396ba", "#8bbdd3", "#ef9fa0"],
    reverse: false
  },
  22: {
    use: [false, true, true, true, true],
    color: ["#5f5050", "#03abc2", "#5dd24f", "#cdff19", "#cdfaff"],
    reverse: false
  },
  23: {
    use: [true, true, true, true, true],
    color: ["#0B3039", "#705771", "#B06683", "#E5B5B7", "#F2F5E7"],
    reverse: false
  },
  24: {
    use: [true, true, true, true, true],
    color: ["#FF5181", "#FFB7BC", "#FFCF49", "#FFA43F", "#5CCAEF"],
    reverse: false
  },
  25: {
    use: [true, true, true, false, true],
    color: ["#3e3700", "#ca2e2c", "#388a85", "#8ca79e", "#ccb000"],
    reverse: false
  },
  26: {
    use: [true, true, true, true, true],
    color: ["#6f4c32", "#cd5845", "#d85da0", "#cdb337", "#C2CCC6"],
    reverse: false
  },
  27: {
    use: [true, true, true, true, true],
    color: ["#c0311e", "#c53a5b", "#202020", "#d54a1f", "#2b5584"],
    reverse: false
  },
  28: {
    use: [true, true, true, true, true],
    color: ["#1B1C19", "#5F2398", "#1CA56E", "#F0E800", "#DEDBC1"],
    reverse: false
  },
  29: {
    use: [true, true, true, true, true],
    color: ["#1b1b2f", "#245a69", "#8198a5", "#b789e5", "#dbc064"],
    reverse: false
  },
  30: {
    use: [true, true, true, true, true],
    color: ["#2B5F8F", "#818014", "#E87031", "#C27E97", "#CC9F7E"],
    reverse: false
  }
};
