// scripts/convert-divix-presets.mjs — one-shot (but reproducible) converter:
// reference/splitx/scripts/allpresets.js → public/assets/divix/presets.json
//
// The reference file is a sequence of `var <name> = {...}` declarations (21
// presets). We execute it in an isolated vm context and collect the results
// keyed by the human-readable preset labels used throughout the app.
//
// PRESET_TYPES below MUST match src/divix/js/state.js's PRESET_TYPES export
// (same keys, same order) — that file is the source of truth for preset
// naming/order in the ported app.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const srcPath = path.join(repoRoot, "reference/splitx/scripts/allpresets.js");
const src = fs.readFileSync(srcPath, "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: srcPath });

// Mirrors PRESET_TYPES from src/divix/js/state.js (without the
// '** User Preset **' sentinel, which has no corresponding data object).
const PRESET_TYPES = {
  "Split Vibration": "splitVibration",
  "Lotus Metamorphosis": "lotusMetamorphosis",
  "Star Trails": "starTrails",
  "Wall Art Dynamics": "wallArtDynamics",
  "Radical Vortex": "radicalVortex",
  "Hypnotic Garden": "hypnoticGarden",
  "Hype The Type": "hypeTheType",
  "Butterfly Effect": "butterflyEffect",
  "Cutout Progression": "cutoutProgression",
  "Funky Beats": "funkyBeats",
  "Cross Transition": "crossTransition",
  "Jelly Airflow": "jellyAirflow",
  OMG: "omgType",
  "Star Force Credits": "starForceCredits",
  "Glowing Vessel": "glowingVessel",
  "Blossom Geomerty": "blossomGeomerty",
  "Matrix Drawing": "matrixDrawing",
  "Pool Vibration": "poolVibration",
  "Unfolding Circles": "unfoldingCircles",
  "Prismatic Mandala": "prismaticMandala",
  "Drop The SVG": "dropTheSVG",
};

const out = {};
for (const [label, varName] of Object.entries(PRESET_TYPES)) {
  if (!(varName in ctx)) throw new Error(`preset ${varName} not found in allpresets.js`);
  out[label] = ctx[varName];
}

const outDir = path.join(repoRoot, "public/assets/divix");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "presets.json"), JSON.stringify(out, null, 2));
console.log(`Wrote ${Object.keys(out).length} presets`);
