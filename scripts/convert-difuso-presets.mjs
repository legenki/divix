// scripts/convert-difuso-presets.mjs — one-shot (but reproducible) converter:
// reference/dithr/scripts/allpresets.js → public/assets/difuso/presets.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const srcPath = path.join(repoRoot, 'reference/dithr/scripts/allpresets.js');
const src = fs.readFileSync(srcPath, 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src, ctx);

// Must exactly match PRESET_TYPES in src/difuso/js/state.js (same keys, same
// order) — copied verbatim from there.
const PRESET_TYPES = {
  "ASCII8 Digital Future": "digitalFutureASCII8",
  "ASCII8 Blocky Grain": "blockyGrainASCII8",
  "ASCII8 Gradient Text": "gradientTextASCII8",
  "ASCII8 Camo Texture": "camoTextureASCII8",
  "ASCII16 Black Label": "blackLabelASCII16",
  "ASCII16 Random Wave": "randomWaveASCII16",
  "ASCII16 Shading Filter": "shadingFilterASCII16",
  "ASCII20 Retro Gaming": "retroGamingASCII20",
  "Halftone Basic Neon": "neonBasicHalftone",
  "Halftone Basic Candy": "candyBasicHalftone",
  "Halftone CMYK Original": "originalHalftoneCMYK",
  "Halftone CMYK Gradient": "gradientHalftoneCMYK",
  "Halftone CMYK Pop-Up": "popupHalftoneCMYK",
  "Bayer2 Rough Gradient": "roughGradientBayer2",
  "Bayer4 Fine Grayscale": "fineGrayscaleBayer4",
  "Bayer16 Fine Original": "fineOriginalBayer16",
  "Matrix Fine Checker": "fineCheckerMatrix",
  "Matrix Diagonal Contrast": "diagonalContrastMatrix",
  "Matrix Grid Gradient": "gridGradientMatrix",
  "Noise16 Fine Contrast": "fineContrastNoise16",
  "Noise64 Grainy Repetitive": "grainyRepetitiveNoise64",
  "Noise64 Blue Contrast": "blueContrastNoise64",
  "Noise128 Duotone Gradient": "duotoneGradientNoise128",
  "Noise128 Rough Original": "roughOriginalNoise128"
};

const out = {};
for (const [label, varName] of Object.entries(PRESET_TYPES)) {
  if (!(varName in ctx)) throw new Error(`preset ${varName} not found in allpresets.js`);
  out[label] = ctx[varName];
}
fs.mkdirSync(path.join(repoRoot, 'public/assets/difuso'), { recursive: true });
fs.writeFileSync(
  path.join(repoRoot, 'public/assets/difuso/presets.json'),
  JSON.stringify(out, null, 2)
);
console.log(`Wrote ${Object.keys(out).length} presets`);
