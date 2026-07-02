# Divix — Этап 2: воркспейс DIFUSO (порт DITHR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный порт воркспейса DIFUSO (бывший DITHR) на новый UI Divix: dithering/ASCII/halftone-эффекты на изображениях и видео через WebGL-шейдеры, с изолированной версией p5 2.2.3.

**Architecture:** Vite-чанк `src/difuso/` со своим импортом `p5` 2.2.3 (ESM, изолирован от глобального `window.p5` 1.11.2 остальных воркспейсов). Рендер-модули разложены по типу эффекта (dither/ascii/halftone/gradient), каждый — фабрика `{ p, state, buffers }` → API, как в DIVIX. Панель — SECTIONS + panelBuilder. 3D-модели и poster-брендинг оригинала не переносятся (см. спек).

**Tech Stack:** Vite 8, p5 2.2.3 (npm-зависимость, ESM-импорт только в difuso-чанке), WebGL2 fragment/vertex шейдеры (портируются как строковые константы), h264-mp4-encoder (лениво), vitest, eslint.

**Спек:** `docs/superpowers/specs/2026-07-02-difuso-workspace-design.md`

**Референс:** `reference/dithr/scripts/*.js` (не в git). Живой оригинал для сверки: https://antlii.github.io/dithr-tool/

---

### Task 1: Установка p5 2.2.3 как npm-зависимости

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Добавить зависимость**

```bash
cd /Users/andy/Documents/GitHub/divix
npm install p5@2.2.3
```

Expected: `package.json`'s `dependencies` теперь содержит `"p5": "2.2.3"`. `package-lock.json` обновлён.

- [ ] **Step 2: Проверить отсутствие конфликта с глобальным p5**

```bash
grep -n '"p5"' package.json
```

Убедиться, что глобальный `public/lib/p5.min.js` (1.11.2, используемый в `index.html` для остальных пяти воркспейсов) НЕ тронут — эта npm-зависимость используется только через `import p5 from 'p5'` внутри difuso-чанка, никогда не через `<script>`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(difuso): add p5 2.2.3 as npm dependency for isolated import"
```

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

### Task 2: state.js

**Files:**
- Create: `src/difuso/js/state.js`
- Reference: `reference/dithr/scripts/var.js` (469 строк)

- [ ] **Step 1: Создать state.js**

Перенести из `var.js` (прочитать файл целиком, значения копировать дословно — это дефолтный пресет инструмента):

```js
// DIFUSO — workspace state and option maps (ported from the original tool).
// State objects are mutated in place by the panel, presets and the sketch;
// their initial values are the tool's default preset.

// --- Runtime state (mutated by panel/presets/sketch) ---

export const cnv = { /* из const cnv, БЕЗ cnv.poster (poster-брендинг не переносится) */ };
export const ascii = { /* из const ascii — font/fontname/text/cols/rows/scale/maxScale/box/ratio/color */ };
export const dither = { /* из const dither — type/matrix/noise/texture/step/contrast/brightness/scale/halftone */ };
export const gradient = { /* из const gradient — type/saturation/palette/reverse/color/use */ };
export const rec = { /* из const rec, БЕЗ obj-специфичных производных; type default остаётся 'object' в оригинале — ЗДЕСЬ default сменить на 'image', т.к. 3D не переносится в этом срезе */ };

// --- Option maps (read-only; label → value lookups for the panel UI) ---

export const RATIO_TYPES = { /* из ratioTypes */ };
export const RESOLUTIONS = { /* из resolutions */ };
export const FONT_TYPES = { /* из fontTypes, БЕЗ [CCFont] attribution-заголовка (это разделитель в Tweakpane-списке шрифтов, не настоящий шрифт — не переносится) */ };
export const PRESET_TYPES = { /* из presetTypes, БЕЗ '** User Preset **' */ };

// 30 встроенных цветовых палитр (index 1..30 в оригинале — здесь массив с 0-based
// доступом через (index - 1), либо сохранить 1-based ключи как строки, как в
// оригинале — решить по факту при портировании COLOR_PALETTES, чтобы не ломать
// прямое сравнение с gradient.palette (1..30) на панели).
export const COLOR_PALETTES = { /* из let colorPalette — 30 записей, каждая { use: bool[5], color: hex[5], reverse: bool } */ };
```

Не переносить: `defaultImageUrl`, `defaultFontUrl`, `watermarkImageUrl`, `license`, `tool`, `obj` (весь 3D-блок), `motion` (3D-анимация камеры/объекта), DOM/runtime-переменные (`canvas`, `img`, `imgHQ`, `gImg`, `dithBuffer`, `gradBuffer`, `dTexture`, `gTexture`, `asciiTexture`, `customTexture`, `regularFont`, `encoder`, `ditherShader`, `halftoneShader`, `gradientShader`, `originalPalette`, `capture`, `isDraw`, `isDrop`, `isReady`, `isClickUI`, `imageExport`, `noise16`/`32`/`64`/`128`, `models`), `CCFont` (см. выше).

- [ ] **Step 2: Верификация переноса данных**

Написать одноразовый node-скрипт (в /private/tmp, не в репозиторий), исполняющий `reference/dithr/scripts/var.js` в vm-контексте и сравнивающий JSON.stringify каждого перенесённого объекта/словаря против state.js (с поправкой на явно задокументированные отличия: `rec.type` default, отсутствие `poster`/`obj`/`motion`/`[CCFont]`-ключа). Приложить результат в отчёт — 30 записей `COLOR_PALETTES` и 15 записей `FONT_TYPES` должны совпасть точно.

- [ ] **Step 3: lint + commit**

```bash
./node_modules/.bin/eslint src --max-warnings 0
git add src/difuso/js/state.js
git commit -m "feat(difuso): workspace state and option maps"
```

(НЕ используй `npm run lint` — rtk-прокси на этой машине даёт ложные результаты.)

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

### Task 3: Ассеты — пресеты, шрифты, шумовые текстуры, дефолтное изображение

**Files:**
- Create: `public/assets/difuso/presets.json`
- Create: `public/assets/difuso/fonts/*.ttf` (15 файлов)
- Create: `public/assets/difuso/textures/noise16/*.png`, `noise32/*.png`, `noise64/*.png`, `noise128/*.png` (4 файла в каждой из 4 папок = 16 файлов)
- Create: `public/assets/difuso/default-image.webp`
- Create: `scripts/convert-difuso-presets.mjs`
- Reference: `reference/dithr/scripts/allpresets.js` (6263 строки, 23 пресета), `reference/dithr/scripts/system.js:15-47` (пути ассетов)

- [ ] **Step 1: Написать конвертер пресетов**

```js
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

// Имена и порядок — presetTypes из reference/dithr/scripts/var.js (без '** User Preset **')
const PRESET_TYPES = {
  'ASCII8 Digital Future': 'digitalFutureASCII8',
  'ASCII8 Blocky Grain': 'blockyGrainASCII8',
  'ASCII8 Gradient Text': 'gradientTextASCII8',
  'ASCII8 Camo Texture': 'camoTextureASCII8',
  'ASCII16 Black Label': 'blackLabelASCII16',
  'ASCII16 Random Wave': 'randomWaveASCII16',
  'ASCII16 Shading Filter': 'shadingFilterASCII16',
  'ASCII20 Retro Gaming': 'retroGamingASCII20',
  'Halftone Basic Neon': 'neonBasicHalftone',
  'Halftone Basic Candy': 'candyBasicHalftone',
  'Halftone CMYK Original': 'originalHalftoneCMYK',
  'Halftone CMYK Gradient': 'gradientHalftoneCMYK',
  'Halftone CMYK Pop-Up': 'popupHalftoneCMYK',
  'Bayer2 Rough Gradient': 'roughGradientBayer2',
  'Bayer4 Fine Grayscale': 'fineGrayscaleBayer4',
  'Bayer16 Fine Original': 'fineOriginalBayer16',
  'Matrix Fine Checker': 'fineCheckerMatrix',
  'Matrix Diagonal Contrast': 'diagonalContrastMatrix',
  'Matrix Grid Gradient': 'gridGradientMatrix',
  'Noise16 Fine Contrast': 'fineContrastNoise16',
  'Noise64 Grainy Repetitive': 'grainyRepetitiveNoise64',
  'Noise64 Blue Contrast': 'blueContrastNoise64',
  'Noise128 Duotone Gradient': 'duotoneGradientNoise128',
  'Noise128 Rough Original': 'roughOriginalNoise128',
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
```

ВАЖНО: список `PRESET_TYPES` в этом скрипте должен точно совпасть с `PRESET_TYPES`, перенесённым в `src/difuso/js/state.js` в Task 2 (тот же порядок, те же 23 ключа минус User Preset). Если расхождение — доверять `state.js` как источнику истины и поправить конвертер.

- [ ] **Step 2: Запустить и проверить**

```bash
node scripts/convert-difuso-presets.mjs
node -e "const p=JSON.parse(require('fs').readFileSync('./public/assets/difuso/presets.json','utf8')); console.log(Object.keys(p).length, Object.keys(p)[0], Object.keys(p)[22]);"
```

Expected: `Wrote 23 presets`, затем `23 ASCII8 Digital Future Noise128 Rough Original`.

- [ ] **Step 3: Скачать 15 шрифтов**

```bash
mkdir -p public/assets/difuso/fonts
node -e "
const state = require('fs').readFileSync('src/difuso/js/state.js', 'utf8');
// Ручная сверка: список путей ниже взят из reference/dithr/scripts/var.js FONT_TYPES —
// сверить каждое имя файла с state.js's FONT_TYPES перед скачиванием.
"
for f in font_3X3Mono-drx1V font_atascii font_Bescii-Mono font_cpc464 font_HomeVideo font_lexis font_PublicPixel font_UrsaFont font_Px437_CL_Stingray_8x16_bold font_Px437_CompaqThin_8x16 font_Px437_EpsonMGA font_Px437_EverexME_5x8 font_Px437_HP_100LX_6x8 font_Px437_HP_100LX_10x11 font_Px437_IBM_DOS_ISO8 font_Px437_Master_512_bold font_Px437_Master_512-M7_bold font_Px437_ToshibaTxL1_8x8 font_PxPlus_IBM_VGA_9x14; do
  curl -sf "https://antlii.github.io/assets/font/${f}.ttf" -o "public/assets/difuso/fonts/${f}.ttf" || echo "MISSING: $f"
done
ls public/assets/difuso/fonts | wc -l
```

Expected: 15 (сверить точное имя каждого файла с `FONT_TYPES` в `reference/dithr/scripts/var.js:296-315` — список выше составлен по этим строкам, но перепроверить один-в-один перед скачиванием, т.к. опечатка в имени файла даёт молчаливый 404).

- [ ] **Step 4: Скачать 16 шумовых текстур**

```bash
mkdir -p public/assets/difuso/textures/{noise16,noise32,noise64,noise128}
# noise16
for f in HDR_L_32 LDR_LLL1_11 HDR_LA_11 HDR_LA_6; do
  curl -sf "https://antlii.github.io/assets/texture/${f}.png" -o "public/assets/difuso/textures/noise16/${f}.png"
done
# noise32
for f in HDR_L_30 LDR_LLL1_10 HDR_LA_4 HDR_LA_9; do
  curl -sf "https://antlii.github.io/assets/texture/${f}.png" -o "public/assets/difuso/textures/noise32/${f}.png"
done
# noise64
for f in HDR_L_14 LDR_LLL1_6 HDR_LA_3 HDR_LA_7; do
  curl -sf "https://antlii.github.io/assets/texture/${f}.png" -o "public/assets/difuso/textures/noise64/${f}.png"
done
# noise128
for f in HDR_L_4 LDR_LLL1_8 HDR_LA_5 HDR_LA_12; do
  curl -sf "https://antlii.github.io/assets/texture/${f}.png" -o "public/assets/difuso/textures/noise128/${f}.png"
done
find public/assets/difuso/textures -name '*.png' | wc -l
```

Expected: 16. Пути взяты из `reference/dithr/scripts/system.js:22-47` (`noiseTexturePaths`) — сверить точное совпадение имён файлов перед скачиванием.

- [ ] **Step 5: Дефолтное изображение**

```bash
curl -sf "https://antlii.github.io/assets/images/default-image.webp" -o public/assets/difuso/default-image.webp
file public/assets/difuso/default-image.webp
```

Expected: валидный webp-файл (не HTML-страница 404).

- [ ] **Step 6: Commit**

```bash
git add scripts/convert-difuso-presets.mjs public/assets/difuso
git commit -m "feat(difuso): presets JSON (23), fonts, noise textures, default image"
```

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

### Task 4: matrices.js — таблицы Bayer/pixel/checker/grid/diagonal

**Files:**
- Create: `src/difuso/js/matrices.js`
- Reference: `reference/dithr/scripts/matrice.js` (503 строки)

- [ ] **Step 1: Портировать числовые матрицы**

Прочитать `reference/dithr/scripts/matrice.js` целиком. Перенести дословно числовые константы `pixelMatrice`, `gridMatrice`, `checkerMatrice`, `diagonalMatrice`, `bayerMatrice2`, `bayerMatrice4`, `bayerMatrice8`, `bayerMatrice16` (строки 166+ и далее) как именованные экспорты:

```js
// DIFUSO — ordered-dither matrix tables (ported verbatim from the original tool).
// Each is a flat array of threshold values consumed by the dither texture
// builder to produce a tileable ordered-dither pattern.

export const PIXEL_MATRIX = [ /* … */ ];
export const GRID_MATRIX = [ /* … */ ];
export const CHECKER_MATRIX = [ /* … */ ];
export const DIAGONAL_MATRIX = [ /* … */ ];
export const BAYER_MATRIX_2 = [ /* … */ ];
export const BAYER_MATRIX_4 = [ /* … */ ];
export const BAYER_MATRIX_8 = [ /* … */ ];
export const BAYER_MATRIX_16 = [ /* … */ ];
```

- [ ] **Step 2: Верификация**

Node vm-скрипт сравнивающий каждый массив против `reference/dithr/scripts/matrice.js`'s исходные константы (та же техника, что в Task 2/Задаче 5 DIVIX) — числа должны совпасть побайтово, ни одна опечатка в длинной числовой таблице не допустима.

- [ ] **Step 3: lint + commit**

```bash
./node_modules/.bin/eslint src --max-warnings 0
git add src/difuso/js/matrices.js
git commit -m "feat(difuso): port ordered-dither matrix tables"
```

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

### Task 5: shaders.js — GLSL-шейдерные строки

**Files:**
- Create: `src/difuso/js/shaders.js`
- Reference: `reference/dithr/scripts/shader.js` (374 строки)

Шейдеры в оригинале — обычный GLSL ES 1.0 (`precision highp float`, `varying`/`attribute`, `texture2D`, `gl_FragColor`) — не специфичен для конкретной версии p5.js на уровне языка шейдеров, только JS-обвязка (`p.createShader()`/`.setUniform()`) зависит от версии p5. Портировать шейдерный код **дословно, без изменений синтаксиса** — риск несовместимости проверяется на этапе Task 9 (сборка app.js) через реальный `p.createShader()` вызов, не путём переписывания GLSL заранее.

- [ ] **Step 1: Перенести все 7 шейдерных строк**

```js
// DIFUSO — GLSL shader source strings (ported verbatim from the original tool).
// Plain GLSL ES 1.0; JS-side wiring (createShader/setUniform) happens in the
// effect modules (dither.js, ascii.js, halftone.js, gradient.js), not here.

export const ASCII_FRAG = `/* дословно из const asciiFrag, reference/dithr/scripts/shader.js:5-64 */`;
export const DITHER_FRAG = `/* дословно из const dithFrag, shader.js:70-103 */`;
export const HALFTONE_FRAG = `/* дословно из const halfFrag, shader.js:105-141 */`;
export const GRADIENT_FRAG = `/* дословно из const gradFrag, shader.js:143-158 */`;
export const CMYK_HALFTONE_FRAG = `/* дословно из const cmykFrag, shader.js:165-351 (включая snoise/permute-функции — весь блок) */`;
export const DITHER_VERT = `/* дословно из const dithVert, shader.js:353-361 */`;
export const GRADIENT_VERT = `/* дословно из const gradVert, shader.js:363-373 */`;
```

- [ ] **Step 2: Верификация побайтового совпадения**

Node-скрипт, читающий обе версии строк (referenced файл распарсить простым regex на `const \w+Frag\s*=\s*\`([\s\S]*?)\`` или через vm.runInContext) и сравнивающий посимвольно с экспортами `shaders.js`. Разница в один символ в GLSL — то же самое, что разница в один символ в SVG-пути DIVIX (Task 5 Этапа 1): молча ломает рендер без ошибки сборки.

- [ ] **Step 3: lint + commit**

```bash
./node_modules/.bin/eslint src --max-warnings 0
git add src/difuso/js/shaders.js
git commit -m "feat(difuso): port GLSL shader source strings verbatim"
```

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

### Task 6: source.js — загрузка изображения и видео

**Files:**
- Create: `src/difuso/js/source.js`
- Reference: `reference/dithr/scripts/main.js` (образная логика `rec.type === 'video'` ветки, строки 1-100 уже прочитаны в ходе брейншторма), `reference/dithr/scripts/media.js` (217 строк — upload-обработчики)

- [ ] **Step 1: Прочитать референс**

Открыть `reference/dithr/scripts/media.js` целиком — там обработчики drag-drop/file-input для image/video (obj/stl-ветки пропустить, не переносятся). Открыть `reference/dithr/scripts/main.js` полностью для контекста, как `gImg`(источник-текстура) используется per-frame в `drawCanvas()`.

- [ ] **Step 2: Портировать фабрику**

```js
// DIFUSO — source media loading (image upload/drag-drop, video upload).
// 3D model (.obj/.stl) loading is intentionally out of scope for this port
// (see docs/superpowers/specs/2026-07-02-difuso-workspace-design.md).

export function createSource({ p, state, defaultImageUrl }) {
  // loadDefaultImage(): fetch public/assets/difuso/default-image.webp via p.loadImage
  // loadImageFile(file): FileReader → p.loadImage from data URL
  // loadVideoFile(file): object URL → HTML5 <video> element, p5 createVideo-эквивалент
  //   в p5 2.x (сверить точное API при реализации — источник текстуры для WEBGL-шейдеров)
  // getCurrentTexture(): () => p5.Image | HTMLVideoElement — то, что шейдерные
  //   модули читают как u_texture/u_imageTexture uniform
  return { loadDefaultImage, loadImageFile, loadVideoFile, getCurrentTexture };
}
```

Известный баг-класс к защите (по духу проекта — фикс багов оригинала, не слепое копирование): в оригинале `img = createImage(1, 1)` — заглушка 1×1 пикселя до реальной загрузки; если рендер-цикл запустится до готовности источника, деление на `img.width`/`img.height` в шейдерных uniform'ах даст `Infinity`/`NaN`. Гейтить draw-цикл до готовности источника (тот же паттерн, что `isReady` в DIVIX).

- [ ] **Step 3: lint + commit**

```bash
./node_modules/.bin/eslint src --max-warnings 0
git add src/difuso/js/source.js
git commit -m "feat(difuso): image and video source loading"
```

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

### Task 7: dither.js, halftone.js — ordered-dither и halftone/CMYK-эффекты

**Files:**
- Create: `src/difuso/js/dither.js`
- Create: `src/difuso/js/halftone.js`
- Reference: `reference/dithr/scripts/matrice.js:1-140` (`createDitherTexture`/`makeNoiseTexture`/`makeBayerTexture`), `reference/dithr/scripts/main.js` (`drawCanvas()` — как `dithBuffer.shader(ditherShader)` вызывается с uniform'ами)

- [ ] **Step 1: dither.js — фабрика**

```js
// DIFUSO — ordered-dither effect (Bayer matrix / noise texture modes).
// Wraps DITHER_FRAG + DITHER_VERT from shaders.js and the matrix tables from
// matrices.js into a reusable shader instance + per-frame uniform updates.

import { DITHER_FRAG, DITHER_VERT } from './shaders.js';
import {
  PIXEL_MATRIX, GRID_MATRIX, CHECKER_MATRIX, DIAGONAL_MATRIX,
  BAYER_MATRIX_2, BAYER_MATRIX_4, BAYER_MATRIX_8, BAYER_MATRIX_16,
} from './matrices.js';

export function createDither({ p, state, noiseTextures }) {
  // noiseTextures: { noise16: p5.Image[4], noise32: [...], noise64: [...], noise128: [...] }
  //   — загруженные через source.js/app.js изображения из public/assets/difuso/textures/
  let shaderInstance = null;
  let ditherTexture = null; // p5.Graphics — построена из матрицы или шумовой картинки

  function buildShader() { /* p.createShader(DITHER_VERT, DITHER_FRAG) — один раз */ }
  function buildDitherTexture() {
    // switch (state.dither.matrix / state.dither.noise) — портировать makeBayerTexture()/
    // makeNoiseTexture() из reference/dithr/scripts/matrice.js:19-140, заменяя p5-глобали
    // (createGraphics, pixelDensity, noSmooth) на p.* эквиваленты
  }
  function apply(buffer, sourceTexture) {
    // buffer.shader(shaderInstance); shaderInstance.setUniform(...) per DITHER_FRAG's
    // uniform list (u_texture, u_dither_tex, u_resolution, u_dither_size, u_density,
    // u_scale, u_steps, u_contrast, u_saturation, u_brightness) — значения из state.dither
  }
  return { buildShader, buildDitherTexture, apply };
}
```

- [ ] **Step 2: halftone.js — фабрика (basic + CMYK)**

```js
// DIFUSO — halftone effect: basic RGB dot-pattern (HALFTONE_FRAG) and CMYK
// screen-print simulation (CMYK_HALFTONE_FRAG). dither.type === 'halftone' uses
// the basic shader; 'halftoneCMYK' uses the CMYK shader — distinct uniform sets.

import { HALFTONE_FRAG, CMYK_HALFTONE_FRAG, DITHER_VERT, GRADIENT_VERT } from './shaders.js';

export function createHalftone({ p, state }) {
  let basicShaderInstance = null;
  let cmykShaderInstance = null;

  function buildShaders() { /* два p.createShader() вызова, один раз каждый */ }
  function applyBasic(buffer, sourceTexture) {
    // u_texture, u_resolution, u_size (= state.dither.halftone.scale),
    // u_smooth (= state.dither.halftone.smooth), u_brightness, u_contrast,
    // u_saturation, u_density, u_halfscale (vec3 — RGB per-channel scale factor,
    // сверить откуда берётся в оригинале при портировании drawCanvas())
  }
  function applyCMYK(buffer, sourceTexture) {
    // u_texture, u_resolution, u_brightness, u_contrast, u_saturation,
    // u_size (= state.dither.halftone.scale)
  }
  return { buildShaders, applyBasic, applyCMYK };
}
```

- [ ] **Step 3: lint + commit**

```bash
./node_modules/.bin/eslint src --max-warnings 0
git add src/difuso/js/dither.js src/difuso/js/halftone.js
git commit -m "feat(difuso): port dither and halftone/CMYK shader modules"
```

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

### Task 8: ascii.js, gradient.js — ASCII-текстура и палитровый градиент

**Files:**
- Create: `src/difuso/js/ascii.js`
- Create: `src/difuso/js/gradient.js`
- Reference: `reference/dithr/scripts/ascii.js` (85 строк — весь файл), `reference/dithr/scripts/gradient.js` (76 строк — весь файл)

- [ ] **Step 1: ascii.js — фабрика**

Портировать `updateFont`, `getASCIITextureText`, `createASCIITexture`, `getGlyphBox`, `hexToShader` из `reference/dithr/scripts/ascii.js` целиком (весь файл, уже прочитан в ходе брейншторма) как методы фабрики:

```js
// DIFUSO — ASCII-art effect: builds a glyph-atlas texture from a loaded TTF
// font, then the shader (ASCII_FRAG) samples characters by grayscale value.

import { ASCII_FRAG, DITHER_VERT } from './shaders.js';

export function createAscii({ p, state }) {
  let shaderInstance = null;
  let glyphTexture = null; // p5.Graphics glyph atlas
  let loadedFont = null;

  async function loadFont(fontUrl) {
    // p.loadFont() — SVERIT точный API p5 2.x (callback vs Promise) при реализации,
    // не предполагать заранее (см. риск в спеке)
  }
  function measureGlyphBox() { /* getGlyphBox() port — max glyph width/height via textBounds */ }
  function buildGlyphTexture() { /* createASCIITexture() port */ }
  function buildShader() { /* p.createShader(DITHER_VERT, ASCII_FRAG) */ }
  function apply(buffer, sourceTexture) {
    // uniform list from ASCII_FRAG: u_asciiTexture, u_imageTexture, u_asciiCols,
    // u_asciiRows, u_totalChars, u_gridCells, u_gridOffset, u_gridSize, u_charColor,
    // u_bgColor, u_charColorMode, u_bgColorMode, u_brightness, u_contrast,
    // u_saturation, u_steps — grid math ported from reference main.js's ascii branch
    // in drawCanvas() (already read during brainstorming: modX/modY/gridSize/gridCells
    // computation using state.ascii.scale/ratio and sourceTexture dimensions)
  }
  return { loadFont, measureGlyphBox, buildGlyphTexture, buildShader, apply };
}
```

Известный баг-класс к защите: `hexToShader` парсит `#RRGGBB` через `parseInt(hex.slice(...), 16)` без валидации формата — если `state.ascii.color.char`/`.bg` когда-либо содержит невалидный hex (например от битого preset JSON), результат — `NaN` в GLSL uniform, шейдер молча рендерит чёрный/мусорный кадр. Добавить guard с фолбэком на `#000000`/`#ffffff`, аналогично `getInterpolatedRGBColor`'s fallback в DIVIX (Task 8 Этапа 1).

- [ ] **Step 2: gradient.js — фабрика**

Портировать `applyPalette`, `createGradient`, `createGradientTexture` из `reference/dithr/scripts/gradient.js` целиком (весь файл, уже прочитан):

```js
// DIFUSO — gradient-map post-processing: maps the dither/ascii/halftone stage's
// grayscale output through a horizontal color-ramp texture built from the
// selected palette (state.gradient.palette indexes into COLOR_PALETTES).

import { GRADIENT_FRAG, GRADIENT_VERT } from './shaders.js';

export function createGradient({ p, state, palettes }) {
  // palettes = COLOR_PALETTES from state.js (30 entries)
  let shaderInstance = null;
  let gradientTexture = null; // p5.Graphics — horizontal linear-gradient strip

  function applySelectedPalette() {
    // applyPalette() port: copies palettes[state.gradient.palette].{color,use,reverse}
    // into state.gradient.{color,use,reverse} (a working-copy pattern, same as
    // DIVIX's palette.temp derived from palette.array — see form.js's
    // syncPaletteTemp equivalent), then calls buildGradientTexture()
  }
  function buildGradientTexture() {
    // createGradient()+createGradientTexture() port: count enabled colors
    // (state.gradient.use), build a canvas 2D linear gradient of width
    // colorAmount*16, height 1, via gTexture.drawingContext.createLinearGradient
    // Guard: colorAmount could be 0 or 1 if all-but-one swatches are disabled —
    // reference divides by (colorAmount - 1) for the stop-position index math,
    // which is a divide-by-zero at colorAmount <= 1. Add a guard (fall back to
    // a flat single-color texture) — this is exactly the class of bug the
    // project has already found and fixed twice in DIVIX (empty-palette guards).
  }
  function buildShader() { /* p.createShader(GRADIENT_VERT, GRADIENT_FRAG) */ }
  function apply(buffer, grayscaleSourceTexture) {
    // u_texture (grayscale output from prior stage), u_gradient (gradientTexture)
  }
  return { applySelectedPalette, buildGradientTexture, buildShader, apply };
}
```

- [ ] **Step 3: lint + commit**

```bash
./node_modules/.bin/eslint src --max-warnings 0
git add src/difuso/js/ascii.js src/difuso/js/gradient.js
git commit -m "feat(difuso): port ASCII glyph-atlas and gradient-map modules"
```

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

### Task 9: controls.js — SECTIONS для panelBuilder

**Files:**
- Create: `src/difuso/js/controls.js`
- Modify: `src/difuso/template.html` (текущая заглушка из Task 4 Этапа 0)
- Reference: `reference/dithr/scripts/ui.js` (1113 строк — точные диапазоны min/max/step ниже уже сверены построчно в ходе брейншторма с конкретными номерами строк)

Исключённые из панели секции (не переносятся, см. спек): весь `PRESETS`-таб кроме списка пресетов (Import/Export уже есть в `buildPresetSection` — переиспользуется как есть, тот же паттерн DIVIX), `LICENSE`-таб, Fullscreen-кнопка, `cnv.poster.show`-переключатель (poster не переносится), `cnv.windowColor` (перекраска хрома страницы — не применимо к фиксированной оболочке Divix), весь `OBJECT`-фолдер (3D — camera/motion/lights, `ui.js:166-435`), `Upload Custom Texture` кнопка (`custom`-режим dither не входит в `dither.type`-опции панели ниже — см. `ui.js:462-470`, `'custom'` там уже закомментирован в самом оригинале).

- [ ] **Step 1: Выписать полный SECTIONS**

```js
// DIFUSO — control panel sections (declarative SECTIONS format consumed by
// shared/ui/panelBuilder.js). Ranges mirror the original tool's Tweakpane UI.
// Not expressible as static SECTIONS data (built directly in app.js, see its
// header comment): the preset dropdown (buildPresetSection), the 5-swatch
// gradient palette picker (dynamic use/color pairs, same pattern as DIVIX's
// palette section), PNG/MP4 export trigger buttons (footer, template.html).
import {
  RATIO_TYPES, FONT_TYPES,
} from './state.js';

const DITHER_TYPES = {
  'ASCII Characters': 'ascii',
  'Halftone Basic': 'halftone',
  'Halftone CMYK': 'halftoneCMYK',
  'Bayer Matrix': 'matrix',
  'Noise Textures': 'noise',
};

const MATRIX_TYPES = {
  Pixel: 'pixel', Diagonal: 'diagonal', Checker: 'checker', Grid: 'grid',
  '2x2 Bayer': 'bayer2', '4x4 Bayer': 'bayer4', '8x8 Bayer': 'bayer8', '16x16 Bayer': 'bayer16',
};

const NOISE_SIZE_TYPES = {
  '16x16 Pixels': 'noise16', '32x32 Pixels': 'noise32',
  '64x64 Pixels': 'noise64', '128x128 Pixels': 'noise128',
};

const ASCII_COLOR_MODES = {
  'Set Color For Characters': 'chars',
  'Set Color For Background': 'background',
  'Duotone Mode': 'duotone',
};

const GRADIENT_TYPES = { 'Original Colors': 'original', 'Gradient Map': 'gradient' };

export const SECTIONS = [
  {
    title: 'Canvas',
    controls: [
      { id: 'df-ratio', type: 'select', label: 'Canvas Ratio', path: 'cnv.ratio', options: RATIO_TYPES, regen: 'canvas' },
      { id: 'df-scale', type: 'slider', label: 'Content Scale', path: 'cnv.scale', min: 0.5, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Dither',
    controls: [
      { id: 'df-dither-type', type: 'select', label: 'Dither Type', path: 'dither.type', options: DITHER_TYPES, regen: 'ditherType' },
      // dx-matrix-type: visible when dither.type === 'matrix' (Task 10 refreshVisibility)
      { id: 'df-matrix-type', type: 'select', label: 'Matrix Type', path: 'dither.matrix', options: MATRIX_TYPES, regen: 'ditherTexture' },
      // df-noise-size / df-noise-texture: visible when dither.type === 'noise'
      { id: 'df-noise-size', type: 'select', label: 'Texture Size', path: 'dither.noise', options: NOISE_SIZE_TYPES, regen: 'ditherTexture' },
      { id: 'df-noise-texture', type: 'slider', label: 'Choose Texture', path: 'dither.texture', min: 1, max: 4, step: 1, regen: 'ditherTexture' },
      // df-ascii-*: visible when dither.type === 'ascii' (ui.js:521-598)
      { id: 'df-ascii-font', type: 'select', label: 'Choose Font', path: 'ascii.fontname', options: FONT_TYPES, regen: 'asciiFont' },
      { id: 'df-ascii-text', type: 'text', label: 'ASCII Chars', path: 'ascii.text', regen: 'asciiTexture' },
      { id: 'df-ascii-scale', type: 'slider', label: 'ASCII Scale', path: 'ascii.scale', min: 4, max: 64, step: 4 },
      { id: 'df-ascii-color-mode', type: 'select', label: 'Base Colors', path: 'ascii.color.mode', options: ASCII_COLOR_MODES },
      // df-ascii-char-color: visible when color.mode is 'chars' or 'duotone'
      { id: 'df-ascii-char-color', type: 'color', label: 'Characters', path: 'ascii.color.char' },
      // df-ascii-bg-color: visible when color.mode is 'background' or 'duotone'
      { id: 'df-ascii-bg-color', type: 'color', label: 'Background', path: 'ascii.color.bg' },
      { id: 'df-dither-scale', type: 'slider', label: 'Dither Scale', path: 'dither.scale', min: 1, max: 24, step: 1, regen: 'ditherTexture' },
      // df-halftone-*: visible when dither.type is 'halftone' or 'halftoneCMYK'
      { id: 'df-halftone-scale', type: 'slider', label: 'Scale Level', path: 'dither.halftone.scale', min: 3, max: 24, step: 0.1 },
      { id: 'df-halftone-smooth', type: 'slider', label: 'Color Smooth', path: 'dither.halftone.smooth', min: 0.5, max: 5, step: 0.1 },
    ],
  },
  {
    title: 'Levels',
    controls: [
      { id: 'df-step', type: 'slider', label: 'Posterization', path: 'dither.step', min: 1, max: 256, step: 1 },
      // df-ascii-limit: visible when dither.type === 'ascii'
      { id: 'df-ascii-limit', type: 'slider', label: 'Color Limiter', path: 'ascii.color.limit', min: 2, max: 16, step: 1 },
      { id: 'df-brightness', type: 'slider', label: 'Brightness', path: 'dither.brightness', min: 0.5, max: 1.5, step: 0.01 },
      { id: 'df-contrast', type: 'slider', label: 'Contrast', path: 'dither.contrast', min: 0.5, max: 4, step: 0.01 },
    ],
  },
  {
    title: 'Colors',
    controls: [
      { id: 'df-gradient-type', type: 'select', label: 'Color Type', path: 'gradient.type', options: GRADIENT_TYPES, regen: 'gradientType' },
      { id: 'df-gradient-saturation', type: 'slider', label: 'Saturation', path: 'gradient.saturation', min: 0, max: 1, step: 0.01 },
      { id: 'df-gradient-palette', type: 'slider', label: 'Select Palette', path: 'gradient.palette', min: 1, max: 30, step: 1, regen: 'gradientPalette' },
      { id: 'df-gradient-reverse', type: 'check', label: 'Reverse Palette', path: 'gradient.reverse', regen: 'gradientTexture' },
    ],
  },
];
```

**Обязательно перепроверить** каждый min/max/step/label по `reference/dithr/scripts/ui.js` при реализации (диапазоны выше взяты из строк 128-737, уже прочитанных в ходе брейншторма, но глазами свериться ещё раз перед коммитом — та же дисциплина, что в Task 9 Этапа 1). Динамический 5-swatch палитра-пикер (`gradient.use`/`gradient.color`, `ui.js:749-...`) НЕ выражается статичными SECTIONS — строится напрямую в app.js (Task 10), тем же паттерном, что палитра в DIVIX.

- [ ] **Step 2: Обновить template.html**

Прочитать текущий `src/difuso/template.html` (заглушка из Task 4 Этапа 0). Заменить на структуру, аналогичную `src/divix/template.html` (сайдбар с `#df-controls`, футер с `df-btn-save-png`/`df-btn-save-mp4`+`df-mp4-length`/`df-export-status`, `main.canvas-viewport#difuso-canvas`). SVG-экспорта нет (в оригинале отсутствует) — кнопки Export as SVG в футере НЕ добавлять.

- [ ] **Step 3: lint + commit**

```bash
./node_modules/.bin/eslint src --max-warnings 0
git add src/difuso/js/controls.js src/difuso/template.html
git commit -m "feat(difuso): declarative control panel sections"
```

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

### Task 10: app.js — сборка воркспейса

**Files:**
- Create: `src/difuso/js/app.js` (заменяет заглушку из Task 4 Этапа 0)
- Modify: `src/js/main.js` (workspace registry — уточнить загрузку difuso-чанка)
- Reference: `reference/dithr/scripts/main.js` (278 строк — весь draw-пайплайн), `reference/dithr/scripts/system.js`

- [ ] **Step 1: Сверить контракт с main.js**

Прочитать `src/js/main.js` целиком (уже знаком по Этапу 0). Текущий `initApp(ws)` делает `ws.instance = new p5(sketch, container)`, где `sketch` — то, что `ws.load()` резолвит (именованный экспорт вида `divixSketch(p)`), и `p5` — глобальный конструктор. Для difuso это не сработает буквально (двойное создание p5-инстанса — один раз внутри `difusoSketch` со своим импортированным `p5`, второй раз снаружи через глобальный `new p5(...)`).

Правильный контракт: `difusoSketch` остаётся функцией вида `(p) => { p.setup = ...; p.draw = ...; }` (тот же shape, что и все остальные воркспейсы), но САМ файл `src/difuso/js/app.js` импортирует `p5` из npm и НЕ полагается на глобальный `window.p5` нигде внутри себя (только полагается на то, что main.js создаст инстанс через ГЛОБАЛЬНЫЙ `p5`, который в эту версию НЕ знает про WEBGL 2.x API различия). Это создаёт противоречие: если main.js создаёт `new p5(sketch, container)` через глобальный (1.11.2) конструктор, WebGL-код внутри `sketch` всё равно исполняется под p5 1.11.2 рантаймом, а не 2.2.3 — импорт `p5` из npm в app.js был бы бесполезен, если сам инстанс создаётся не через него.

**Разрешение:** `src/js/main.js`'s `initApp()` нужно расширить, чтобы конкретно для difuso инстанс создавался через p5-конструктор, экспортированный САМИМ difuso-чанком, а не через глобальный `p5`. Добавить в `Workspace`-registry опциональное поле `usesOwnP5: true` (или аналогичное), и в `initApp()`:

```js
// main.js — initApp(), внутри .then(([sketch]) => { ... })
if (ws.usesOwnP5) {
  // sketch здесь — не просто функция(p), а { sketch: fn, P5: конструктор },
  // т.е. load() для difuso резолвится в объект, а не голую функцию — уточнить
  // экспорт app.js под этот контракт (см. Step 2 ниже)
  ws.instance = new sketch.P5(sketch.sketch, container);
} else {
  ws.instance = new p5(sketch, container); // существующий путь для остальных пяти
}
```

Это единственная правка, вносимая в `src/js/main.js` в рамках этого воркспейса — небольшая, обратно совместимая (остальные пять воркспейсов не затронуты, `usesOwnP5` не задан → старый путь).

- [ ] **Step 2: Экспорт из app.js под новый контракт**

```js
// В src/difuso/js/app.js, в конце файла:
function difusoSketch(p) {
  // … весь p.setup/p.draw/… как обычно, но `p` здесь — инстанс СВОЕГО p5 2.2.3
}

export const difuso = { sketch: difusoSketch, P5: p5 };
```

И в `src/js/main.js`'s workspace-registry для difuso:

```js
{ name: 'difuso', load: () => import('../difuso/js/app.js').then((m) => m.difuso), containerId: 'difuso-canvas', animated: true, shortcut: 'KeyF', usesOwnP5: true },
```

(Убрать `libs: ['paper']`-подобное поле, если оно было заглушкой — difuso не использует paper.js).

- [ ] **Step 3: Draw-пайплайн**

Портировать `setup()`/`draw()`/`drawCanvas()` из `reference/dithr/scripts/main.js` (уже частично прочитано в ходе брейншторма, дочитать полностью 100-278 строки): WEBGL-канвас/буферы (`dithBuffer`, `gradBuffer` — `p.createGraphics(w, h, p.WEBGL)`), диспетчер по `dither.type` (`'none'` → прямая текстура без эффекта, `'ascii'` → `asciiCtl.apply()`, `'halftone'`/`'halftoneCMYK'` → `halftoneCtl.applyBasic()`/`.applyCMYK()`, `'matrix'`/`'noise'` → `ditherCtl.apply()`), затем `gradient.type === 'gradient'` → композит через `gradientCtl.apply()` поверх результата. Убрать: `posterGraphics()`-вызов, `obj`/3D-ветки (`rec.type === 'object'`, `previewGraphics()`), watermark/license-проверки.

- [ ] **Step 4: Пресеты, панель, автосейв, экспорт**

Тот же паттерн, что Task 10 Этапа 1 (DIVIX): fetch presets.json (гейт draw-цикла до загрузки), `applyPreset()` (deepMerge + перестроение шейдерных текстур/glyph-атласа/градиентной текстуры при смене relevant полей), `createPanelBuilder`, кастомная 5-swatch секция палитры (аналог DIVIX-палитры, но с `gradient.use`/`gradient.color`), `createPersistence`, PNG/MP4 экспорт через `exportMedia.js`, drag-and-drop загрузка image/video файлов на canvas-контейнер (вызывает `sourceCtl.loadImageFile()`/`.loadVideoFile()`).

- [ ] **Step 5: Проверка в dev**

```bash
npx vite --port 3013
```

DIFUSO открывается без консольных ошибок, дефолтный пресет рисуется, дефолтное изображение загружается, переключение пресетов работает, смена dither-типа визуально меняет эффект, drag-and-drop нового изображения работает, автосейв переживает перезагрузку страницы. Также проверить, что остальные пять воркспейсов (особенно DIVIX) по-прежнему работают без регрессии от правки main.js.

- [ ] **Step 6: lint + test + build**

```bash
./node_modules/.bin/eslint src --max-warnings 0
npx vitest run
npx vite build
```

Expected: всё зелёное. `vite build` — критичная проверка, что двойной p5 (1.11.2 глобальный + 2.2.3 npm-модуль в difuso-чанке) не ломает сборку и оба чанка код-сплитятся независимо.

- [ ] **Step 7: Commit**

```bash
git add src/difuso/js/app.js src/js/main.js
git commit -m "feat(difuso): full workspace port — sketch, presets, panel, autosave, export"
```

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

### Task 11: Визуальная сверка с оригиналом и фиксы

**Files:**
- Modify: по результатам сверки

- [ ] **Step 1: Открыть рядом оригинал и порт**

Оригинал: https://antlii.github.io/dithr-tool/ (обойти начальный экран загрузки 3D-модели по умолчанию — переключить на изображение сразу). Порт: dev-сервер. Пройти все 23 пресета, сверяя визуально форму/цвета/чёткость эффекта. Особое внимание — ASCII-режимам (шрифт должен реально рендериться, не пустые клетки) и Halftone CMYK (сложный шейдер с noise-функциями — риск скрытой несовместимости p5 2.x).

- [ ] **Step 2: Проверить видео-режим**

Загрузить тестовый видеофайл в обоих (оригинал и порт), сравнить, что dithering применяется к видео-кадрам корректно, не просто к первому кадру.

- [ ] **Step 3: Проверить экспорт**

PNG (открыть файл), MP4 (проиграть, сравнить с оригиналом на глаз — не побитово, реализации кодирования могут отличаться по деталям, важна структурная корректность кадров).

- [ ] **Step 4: Чинить расхождения**

Каждое расхождение — минимальный фикс + отдельный коммит `fix(difuso): …`. Не откладывать несколько находок в один большой коммит — та же дисциплина, что Task 11 Этапа 1 (там нашли и исправили 3 реальных бага именно за счёт визуальной проверки, не кодового ревью).

- [ ] **Step 5: Финальный прогон**

```bash
./node_modules/.bin/eslint src --max-warnings 0
npx vitest run
npx vite build
```

### Task 12: README и коммит финального README-обновления

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Обновить секцию DIFUSO**

Заменить "Coming soon." на описание по образцу секции DIVIX в текущем README: dithering-эффекты (Bayer/matrix/noise ordered-dither, ASCII-art рендеринг с загружаемыми шрифтами, halftone/CMYK screen-print симуляция) на изображениях и видео, палитровые градиент-карты, 23 встроенных пресета, PNG/MP4-экспорт. Явно упомянуть, что 3D-режим (obj/stl-модели) отложен на будущий этап — не молчать об урезанном охвате.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update DIFUSO workspace status in README"
```

End with:

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

## Дальше (отдельные планы)

Этапы 3–6 (BANDADA/boids, DERIVA/drift, SONDEO/skaaan, CLON/klon) — по одному плану на воркспейс, составляются после приёмки DIFUSO. 3D-режим DIFUSO (`.obj`/`.stl`, WebGL-камера, освещение) и видео-специфичные доработки, если что-то осталось за скобками, — отдельный будущий план, не блокирует переход к BANDADA.
