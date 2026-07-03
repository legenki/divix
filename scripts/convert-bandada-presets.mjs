import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const srcPath = path.join(repoRoot, "reference/boids/scripts/presets.js");
const src = fs.readFileSync(srcPath, "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: srcPath });

const PRESET_TYPES = {
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
  "Bubble Flow": "bubbleFlowPreset"
};

const out = {};
for (const [label, varName] of Object.entries(PRESET_TYPES)) {
  if (!(varName in ctx)) throw new Error(`preset ${varName} not found in presets.js`);
  out[label] = ctx[varName];
}

const outDir = path.join(repoRoot, "public/assets/bandada");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "presets.json"), JSON.stringify(out, null, 2));
console.log(`Wrote ${Object.keys(out).length} presets`);
