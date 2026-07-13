// scripts/download-difuso-assets.mjs — one-shot (but reproducible) downloader
// for DIFUSO's static binary assets: ASCII fonts, dither noise textures, and
// the default source image.
//
// IMPORTANT: font/texture paths in reference/dithr/scripts/var.js and
// system.js (e.g. "assets/font/font_atascii.ttf") are relative to the
// reference tool's OWN hosting directory, NOT the antlii.github.io domain
// root — https://antlii.github.io/assets/font/... 404s. The correct base is
// https://antlii.github.io/dithr-tool/, confirmed live. The default image
// URL in var.js (defaultImageUrl) is the one exception: it's already a
// fully-qualified domain-root URL and resolves as written.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "public/assets/difuso");

const TOOL_BASE = "https://antlii.github.io/dithr-tool/";

// Mirrors FONT_TYPES from src/difuso/js/state.js (font display name -> path,
// only the path half is needed here).
const FONT_PATHS = [
  "assets/font/font_3X3Mono-drx1V.ttf",
  "assets/font/font_atascii.ttf",
  "assets/font/font_Bescii-Mono.ttf",
  "assets/font/font_cpc464.ttf",
  "assets/font/font_HomeVideo.ttf",
  "assets/font/font_lexis.ttf",
  "assets/font/font_PublicPixel.ttf",
  "assets/font/font_UrsaFont.ttf",
  "assets/font/font_Px437_CL_Stingray_8x16_bold.ttf",
  "assets/font/font_Px437_CompaqThin_8x16.ttf",
  "assets/font/font_Px437_EpsonMGA.ttf",
  "assets/font/font_Px437_EverexME_5x8.ttf",
  "assets/font/font_Px437_HP_100LX_6x8.ttf",
  "assets/font/font_Px437_HP_100LX_10x11.ttf",
  "assets/font/font_Px437_IBM_DOS_ISO8.ttf",
  "assets/font/font_Px437_Master_512_bold.ttf",
  "assets/font/font_Px437_Master_512-M7_bold.ttf",
  "assets/font/font_Px437_ToshibaTxL1_8x8.ttf",
  "assets/font/font_PxPlus_IBM_VGA_9x14.ttf",
];

// Mirrors noiseTexturePaths from reference/dithr/scripts/system.js:22-47.
const NOISE_TEXTURE_PATHS = {
  noise16: [
    "assets/texture/HDR_L_32.png",
    "assets/texture/LDR_LLL1_11.png",
    "assets/texture/HDR_LA_11.png",
    "assets/texture/HDR_LA_6.png",
  ],
  noise32: [
    "assets/texture/HDR_L_30.png",
    "assets/texture/LDR_LLL1_10.png",
    "assets/texture/HDR_LA_4.png",
    "assets/texture/HDR_LA_9.png",
  ],
  noise64: [
    "assets/texture/HDR_L_14.png",
    "assets/texture/LDR_LLL1_6.png",
    "assets/texture/HDR_LA_3.png",
    "assets/texture/HDR_LA_7.png",
  ],
  noise128: [
    "assets/texture/HDR_L_4.png",
    "assets/texture/LDR_LLL1_8.png",
    "assets/texture/HDR_LA_5.png",
    "assets/texture/HDR_LA_12.png",
  ],
};

// Already a fully-qualified domain-root URL in reference/dithr/scripts/var.js.
const DEFAULT_IMAGE_URL = "https://antlii.github.io/assets/images/default-image.webp";

async function download(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
}

async function main() {
  let count = 0;

  const fontsDir = path.join(outDir, "fonts");
  for (const fontPath of FONT_PATHS) {
    const dest = path.join(fontsDir, path.basename(fontPath));
    await download(TOOL_BASE + fontPath, dest);
    count++;
  }

  for (const [tier, texturePaths] of Object.entries(NOISE_TEXTURE_PATHS)) {
    const tierDir = path.join(outDir, "textures", tier);
    for (const texturePath of texturePaths) {
      const dest = path.join(tierDir, path.basename(texturePath));
      await download(TOOL_BASE + texturePath, dest);
      count++;
    }
  }

  await download(DEFAULT_IMAGE_URL, path.join(outDir, "default.webp"));
  count++;

  console.log(`Downloaded ${count} assets`);
}

main().catch((err) => {
  console.error(err);
  throw err;
});
