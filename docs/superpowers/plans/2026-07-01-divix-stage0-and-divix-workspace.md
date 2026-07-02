# Divix: Этап 0 (каркас) + Этап 1 (воркспейс DIVIX) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Каркас приложения Divix (копия фундамента ritmo, 6 вкладок) + полный порт первого воркспейса DIVIX (бывший SPLITX) на новый UI.

**Architecture:** Vite SPA + PWA по образцу `/Users/andy/Documents/GitHub/ritmo`: p5.js 1.11.2 instance mode, data-driven регистрация воркспейсов в `src/js/main.js`, ленивая загрузка чанков, декларативные панели через `shared/ui/panelBuilder.js`, автосейв в localStorage. Референс-исходники оригиналов лежат в `reference/` (в git не попадают).

**Tech Stack:** Vite 8, vite-plugin-pwa, p5 1.11.2 (instance mode), paper.js (SVG import/export, лениво), h264-mp4-encoder (лениво), simplex-noise + alea (сидированный шум), vitest, eslint (zero warnings), prettier.

**Спек:** `docs/superpowers/specs/2026-07-01-divix-studio-design.md`

**Осознанные упрощения против оригинала SPLITX** (утверждены в спеке / дизайне):
- Выкидываем: лицензирование (licenseManager, watermark), embed-protect, popupAlerts (заменяем на export-status в футере), p5.sound (не используется), p5.capture, GIF/PNG-sequence/WEBP-sequence экспорт (в ritmo их нет; остаются PNG, MP4, SVG).
- Tweakpane 3 → SECTIONS + panelBuilder.
- Старое имя SPLITX нигде не фигурирует: воркспейс называется `divix`, префикс контролов `dx-`, storage key `divix-tool`.

---

## Этап 0 — каркас

### Task 1: .gitignore и референс-исходники

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Создать .gitignore**

Скопировать из ritmo и добавить `reference/`:

```bash
cp /Users/andy/Documents/GitHub/ritmo/.gitignore /Users/andy/Documents/GitHub/divix/.gitignore
printf '\n# Reference sources of original tools (not ours to publish)\nreference/\n' >> /Users/andy/Documents/GitHub/divix/.gitignore
```

- [ ] **Step 2: Скачать референс-исходники всех шести инструментов**

`reference/splitx` уже скачан в этой сессии; докачать остальные (список файлов каждого инструмента виден в его index.html):

```bash
cd /Users/andy/Documents/GitHub/divix/reference
for tool in dithr boids drift skaaan klon; do
  mkdir -p $tool/scripts
  curl -s "https://antlii.github.io/${tool}-tool/" -o $tool/index.html
  grep -oE 'scripts/[a-z0-9]+\.js' $tool/index.html | sort -u | while read f; do
    curl -s "https://antlii.github.io/${tool}-tool/$f" -o "$tool/$f"
  done
done
ls */scripts | head -40
```

Expected: у каждого инструмента папка scripts с непустыми .js файлами (проверить `wc -l */scripts/*.js` — файлы не должны быть 0 строк).

- [ ] **Step 3: Commit**

```bash
cd /Users/andy/Documents/GitHub/divix
git add .gitignore
git commit -m "chore: add .gitignore (reference sources excluded)"
```

### Task 2: Фундамент из ritmo — конфиги, css, shared, lib

**Files:**
- Create: `package.json`, `vite.config.js`, `eslint.config.js`, `.prettierrc`, `.github/workflows/deploy.yml`
- Create: `public/lib/**` (копия), `public/icon.svg` (копия, временно)
- Create: `src/css/style.css`, `src/shared/**` (копия ritmo без 2 тестов)

- [ ] **Step 1: Скопировать неизменяемые файлы**

```bash
cd /Users/andy/Documents/GitHub/divix
R=/Users/andy/Documents/GitHub/ritmo
cp $R/.prettierrc $R/eslint.config.js .
mkdir -p .github/workflows && cp $R/.github/workflows/* .github/workflows/
mkdir -p public && cp -R $R/public/lib public/lib && cp $R/public/icon.svg public/
mkdir -p src && cp -R $R/src/css src/css && cp -R $R/src/shared src/shared
```

- [ ] **Step 2: Удалить тесты, привязанные к воркспейсам ritmo**

`map2.test.js` импортирует `../../ritmo/js/map2.js`, `ease.test.js` — `../../copo/js/ease.js`; этих модулей в divix пока нет (ease вернётся в Task 7 внутри воркспейса divix, map2 — при порте DIFUSO):

```bash
rm src/shared/utils/map2.test.js src/shared/utils/ease.test.js
```

- [ ] **Step 3: Проверить, что в скопированном shared нет ссылок на auth/paywall**

```bash
grep -rn "auth\|paywall\|supabase\|checkPro" src/shared/ | grep -v Binary
```

Expected: пусто. Если `panelBuilder.js` (`buildPresetSection`) принимает pro-параметры (`freePresets`/`proPresets`/`onProDenied`) — это нормально, они опциональны и работают без auth; удалять не нужно. Убедиться только, что нет **импортов** из `src/js/auth.js`/`paywall.js`.

- [ ] **Step 4: package.json**

Создать (как у ritmo, но имя divix, без `@supabase/supabase-js`, repo legenki/divix):

```json
{
  "name": "divix",
  "version": "1.0.0",
  "description": "Divix is a generative graphics studio with six p5.js workspaces — Divix, Difuso, Bandada, Deriva, Sondeo and Clon — sharing the Grafema architecture and design system.",
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "eslint": "^10.4.1",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-html": "^8.1.4",
    "globals": "^17.6.0",
    "jsdom": "^29.1.1",
    "lightningcss": "^1.32.0",
    "prettier": "^3.8.3",
    "vite": "^8.0.16",
    "vite-plugin-pwa": "^1.3.0",
    "vitest": "^4.1.8",
    "workbox-window": "^7.4.1"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "lint": "eslint src --max-warnings 0",
    "format": "prettier --write \"src/**/*.{js,css,html}\""
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/legenki/divix.git"
  },
  "license": "ISC",
  "type": "module",
  "bugs": {
    "url": "https://github.com/legenki/divix/issues"
  },
  "homepage": "https://github.com/legenki/divix#readme"
}
```

- [ ] **Step 5: vite.config.js**

Копия ritmo с заменами: `base: '/divix/'`, manifest name `Divix Design Studio` / short_name `Divix` / description `Generative graphics studio: Divix, Difuso, Bandada, Deriva, Sondeo, Clon`. Остальное (htmlPartialsAndCopyPlugin, lightningcss, workbox) — без изменений, скопировать содержимое `/Users/andy/Documents/GitHub/ritmo/vite.config.js` и внести только эти три правки.

- [ ] **Step 6: Проверить workflow деплоя**

Прочитать `.github/workflows/deploy.yml`: если внутри захардкожено имя репозитория/базовый путь ritmo — заменить на divix. Обычно там только `npm ci && npm run build` + upload dist в Pages, тогда правки не нужны.

- [ ] **Step 7: npm install и smoke-check**

```bash
npm install
npm run test
npm run lint
```

Expected: install чистый; test — проходит `panelBuilder.test.js`; lint может упасть, если shared импортирует отсутствующие модули — на этом шаге допустимо, чинится в Task 3–4 (index.html/main.js/стабы). Если lint ругается на сам shared-код — исправить импорты сейчас.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Divix from Ritmo foundation (configs, css, shared, libs)"
```

### Task 3: index.html и src/js/main.js

**Files:**
- Create: `index.html`
- Create: `src/js/main.js`

- [ ] **Step 1: index.html**

По образцу ritmo, 6 вкладок, без auth-капсулы:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Divix</title>
  <link rel="icon" type="image/svg+xml" href="icon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="src/css/style.css">

  <!-- LIBRARIES -->
  <script src="/lib/p5.min.js"></script>

  <!-- Small helpers shared by the workspaces (seeded noise, ~20 KB) -->
  <script src="/lib/vendor/alea.js"></script>
  <script src="/lib/vendor/simplex-noise.min.js"></script>
  <script src="/lib/vendor/hsluv.min.js"></script>
  <!-- Heavy vendor libs (paper, colorjs, h264 encoder) load on demand per
       workspace — see shared/utils/lazyLibs.js -->
</head>
<body class="theme-light">

  <!-- Top-Center Tab Switcher Capsule -->
  <div style="position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:1000; display:flex; gap:8px;">
    <div class="app-switcher" role="tablist">
      <button id="tab-divix" class="switcher-tab active" data-target="divix" role="tab" aria-selected="true" aria-controls="app-divix">DIVIX</button>
      <button id="tab-difuso" class="switcher-tab" data-target="difuso" role="tab" aria-selected="false" aria-controls="app-difuso">DIFUSO</button>
      <button id="tab-bandada" class="switcher-tab" data-target="bandada" role="tab" aria-selected="false" aria-controls="app-bandada">BANDADA</button>
      <button id="tab-deriva" class="switcher-tab" data-target="deriva" role="tab" aria-selected="false" aria-controls="app-deriva">DERIVA</button>
      <button id="tab-sondeo" class="switcher-tab" data-target="sondeo" role="tab" aria-selected="false" aria-controls="app-sondeo">SONDEO</button>
      <button id="tab-clon" class="switcher-tab" data-target="clon" role="tab" aria-selected="false" aria-controls="app-clon">CLON</button>
    </div>
    <div class="app-switcher" style="padding: 3px;">
      <button id="btn-global-theme" class="switcher-tab" style="padding: 8px; display: flex; align-items: center; justify-content: center;" title="Toggle Theme">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>
    </div>
  </div>

  <div class="apps-container" style="width:100vw; height:100vh; position:absolute; top:0; left:0; z-index:0; overflow:hidden;">

    <div id="app-divix" class="app-view active" role="tabpanel" aria-labelledby="tab-divix" style="width:100%; height:100%;">
      <!--#include file="src/divix/template.html"-->
    </div>

    <div id="app-difuso" class="app-view" role="tabpanel" aria-labelledby="tab-difuso" style="width:100%; height:100%; display:none;">
      <!--#include file="src/difuso/template.html"-->
    </div>

    <div id="app-bandada" class="app-view" role="tabpanel" aria-labelledby="tab-bandada" style="width:100%; height:100%; display:none;">
      <!--#include file="src/bandada/template.html"-->
    </div>

    <div id="app-deriva" class="app-view" role="tabpanel" aria-labelledby="tab-deriva" style="width:100%; height:100%; display:none;">
      <!--#include file="src/deriva/template.html"-->
    </div>

    <div id="app-sondeo" class="app-view" role="tabpanel" aria-labelledby="tab-sondeo" style="width:100%; height:100%; display:none;">
      <!--#include file="src/sondeo/template.html"-->
    </div>

    <div id="app-clon" class="app-view" role="tabpanel" aria-labelledby="tab-clon" style="width:100%; height:100%; display:none;">
      <!--#include file="src/clon/template.html"-->
    </div>
  </div>

  <script type="module" src="/src/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: src/js/main.js**

Копия `/Users/andy/Documents/GitHub/ritmo/src/js/main.js` со следующими правками (построчно):

1. Удалить импорты `auth.js` и `paywall.js` (строки 3–4 оригинала).
2. Удалить целиком: константу `PRO_WORKSPACES`, функцию `updateAuthUI`, вызовы `initAuth(...)`, `handleCheckoutSuccess(...)`, `updateAuthUI(null, null, false)` в DOMContentLoaded, и pro-проверку в `switchApp` (блок `if (PRO_WORKSPACES.has(appName) && !checkPro()) { openPaywall(); return; }`).
3. Список воркспейсов заменить на:

```js
/** @type {Workspace[]} */
const workspaces = [
  { name: 'divix',   load: () => import('../divix/js/app.js').then((m) => m.divixSketch),     containerId: 'divix-canvas',   animated: true, shortcut: 'KeyD', libs: ['paper'] },
  { name: 'difuso',  load: () => import('../difuso/js/app.js').then((m) => m.difusoSketch),   containerId: 'difuso-canvas',  animated: true, shortcut: 'KeyF' },
  { name: 'bandada', load: () => import('../bandada/js/app.js').then((m) => m.bandadaSketch), containerId: 'bandada-canvas', animated: true, shortcut: 'KeyB' },
  { name: 'deriva',  load: () => import('../deriva/js/app.js').then((m) => m.derivaSketch),   containerId: 'deriva-canvas',  animated: true, shortcut: 'KeyR' },
  { name: 'sondeo',  load: () => import('../sondeo/js/app.js').then((m) => m.sondeoSketch),   containerId: 'sondeo-canvas',  animated: true, shortcut: 'KeyS' },
  { name: 'clon',    load: () => import('../clon/js/app.js').then((m) => m.clonSketch),       containerId: 'clon-canvas',    animated: true, shortcut: 'KeyC' },
].map((w) => ({ ...w, instance: null }));
```

4. `let currentApp = 'ritmo'` → `'divix'`.
Остальное (PWA-тост, initApp, switchApp/executeSwitchApp, темы, Alt-шорткаты) — без изменений.

- [ ] **Step 3: Commit**

```bash
git add index.html src/js/main.js
git commit -m "feat: app shell with six workspace tabs and lazy loader"
```

### Task 4: Заглушки шести воркспейсов

**Files:**
- Create: `src/{divix,difuso,bandada,deriva,sondeo,clon}/template.html`
- Create: `src/{divix,difuso,bandada,deriva,sondeo,clon}/js/app.js`

- [ ] **Step 1: Создать 12 файлов-заглушек**

Для каждого воркспейса из таблицы:

| dir | префикс id | экспорт | заголовок |
|---|---|---|---|
| divix | dx | divixSketch | DIVIX |
| difuso | df | difusoSketch | DIFUSO |
| bandada | bn | bandadaSketch | BANDADA |
| deriva | dr | derivaSketch | DERIVA |
| sondeo | sn | sondeoSketch | SONDEO |
| clon | cl | clonSketch | CLON |

`src/<dir>/template.html` (пример для divix; в остальных заменить `dx-`/`divix` на значения из таблицы):

```html
<div class="app-container">
  <aside class="sidebar secuencia-panel right-sidebar">
    <div class="sidebar-content" id="dx-controls"></div>
    <footer class="sidebar-footer">
      <button id="dx-btn-save-png" class="btn btn-accent">Export as PNG</button>
      <div class="btn-group">
        <button id="dx-btn-save-mp4" class="btn btn-secondary">Export as MP4</button>
        <select id="dx-mp4-length" class="grafema-select" style="width: auto; min-width: 64px" title="Video length">
          <option value="2">2s</option>
          <option value="4" selected>4s</option>
          <option value="6">6s</option>
          <option value="8">8s</option>
          <option value="10">10s</option>
          <option value="15">15s</option>
        </select>
      </div>
      <div id="dx-export-status" class="export-status"></div>
    </footer>
  </aside>
  <main class="canvas-viewport" id="divix-canvas">
    <!-- p5.js canvas injected here -->
  </main>
</div>
```

`src/<dir>/js/app.js` (пример для divix; в остальных заменить имя экспорта и заголовок):

```js
// DIVIX — placeholder sketch; replaced by the real port.
export function divixSketch(p) {
  p.setup = () => {
    const c = p.createCanvas(480, 480);
    c.parent(document.getElementById('divix-canvas'));
    p.noLoop();
  };
  p.draw = () => {
    p.background(244);
    p.fill(0);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(24);
    p.text('DIVIX — coming soon', p.width / 2, p.height / 2);
  };
}
```

- [ ] **Step 2: Проверить dev-сервер**

```bash
npm run dev
```

Открыть http://localhost:3000/divix/ (или порт из вывода): все 6 вкладок переключаются, каждая показывает свою заглушку, тема переключается, Alt+D/F/B/R/S/C работают, консоль без ошибок.

- [ ] **Step 3: lint + build**

```bash
npm run lint && npm run build
```

Expected: оба зелёные.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat: placeholder sketches for all six workspaces"
```

---

## Этап 1 — воркспейс DIVIX (порт SPLITX)

Референс: `reference/splitx/scripts/*.js` (var 454, ease 264, system 206, ui 1116, form 415, path 109, svg 162, allpresets 2268, preset 328, random 115, export 187, events 215, main 178 строк). Живой оригинал для сверки: https://antlii.github.io/splitx-tool/

### Task 5: Состояние — src/divix/js/state.js

**Files:**
- Create: `src/divix/js/state.js`
- Reference: `reference/splitx/scripts/var.js`

- [ ] **Step 1: Создать state.js**

Перенести из `var.js` объекты состояния и словари опций как именованные экспорты. Что переносится и как:

```js
// DIVIX — workspace state and option maps (ported from the original tool).
// Objects are mutated in place by the panel, presets and the sketch.

export const palette = { /* … содержимое const palette из var.js без изменений … */ };
export const simplex = { /* … из var.js … */ };
export const cnv = { /* … из var.js; поле preset оставить … */ };
export const form = { /* … из var.js … */ };
export const split = { /* … из var.js … */ };
export const rec = { /* … из var.js, но status: '' вместо 'Loading ...' … */ };

export const PRESET_TYPES = { /* … presetTypes из var.js без '** User Preset **' — user-пресет строится динамически … */ };
export const SLOT_TYPES = { /* slotTypes */ };
export const SPLIT_TYPES = { /* splitTypes */ };
export const COLOR_STYLE_TYPES = { /* colorStyleTypes */ };
export const FORM_FILL_MODES = { /* formFillModes */ };
export const TRANSFORM_TYPES = { /* transformTypes */ };
export const ORDER_TYPES = { /* orderTypes */ };
export const EXPORT_TYPES = { 'PNG File': 'image', 'MP4 File': 'mp4', 'SVG File': 'svg' };
export const SHAPE_TYPES = { /* shapeTypes */ };
export const SHAPE_SIZE = { /* shapeSize */ };
export const SHAPE_PATHS = { /* shapePaths — все path-строки скопировать дословно */ };
export const RATIO_TYPES = { /* ratioTypes */ };
export const RESOLUTIONS = { /* resolutions */ };
```

НЕ переносить: `watermarkImageLink`, `license`, `tool` (заменяется константами в app.js), `capture`/`P5Capture`, DOM-переменные `jsonInput`/`svgInput` (создаются в app.js), `canvas/formData/gForm/gDraw/gAlpha/colorPalettes/encoder/isReady/isDrop` (это runtime-переменные скетча — живут в замыкании app.js), `palettesJSONLink` (палитры кладём в public/assets — Task 6), `exportTypes` c gif/png/webp.

Значения объектов копировать из var.js дословно — это дефолтный пресет инструмента.

- [ ] **Step 2: lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/divix/js/state.js
git commit -m "feat(divix): workspace state and option maps"
```

### Task 6: Ассеты — пресеты и палитры

**Files:**
- Create: `public/assets/divix/presets.json`
- Create: `public/assets/divix/palettes.json`
- Create: `scripts/convert-splitx-presets.mjs` (одноразовый конвертер, коммитится для воспроизводимости)
- Reference: `reference/splitx/scripts/allpresets.js` (21 пресет: splitVibration, lotusMetamorphosis, starTrails, wallArtDynamics, radicalVortex, hypnoticGarden, hypeTheType, butterflyEffect, cutoutProgression, funkyBeats, crossTransition, jellyAirflow, omgType, starForceCredits, glowingVessel, blossomGeomerty, matrixDrawing, poolVibration, unfoldingCircles, prismaticMandala, dropTheSVG)

- [ ] **Step 1: Написать конвертер**

`allpresets.js` — набор `var <name> = { … }` деклараций. Конвертер исполняет файл в изолированном контексте и собирает пресеты в один JSON, ключи — человекочитаемые имена из `PRESET_TYPES`:

```js
// scripts/convert-splitx-presets.mjs — one-shot: reference allpresets.js → presets.json
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('reference/splitx/scripts/allpresets.js', 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src, ctx);

// Имена и порядок — presetTypes из reference/splitx/scripts/var.js (без '** User Preset **')
const PRESET_TYPES = {
  'Split Vibration': 'splitVibration',
  'Lotus Metamorphosis': 'lotusMetamorphosis',
  'Star Trails': 'starTrails',
  'Wall Art Dynamics': 'wallArtDynamics',
  'Radical Vortex': 'radicalVortex',
  'Hypnotic Garden': 'hypnoticGarden',
  'Hype The Type': 'hypeTheType',
  'Butterfly Effect': 'butterflyEffect',
  'Cutout Progression': 'cutoutProgression',
  'Funky Beats': 'funkyBeats',
  'Cross Transition': 'crossTransition',
  'Jelly Airflow': 'jellyAirflow',
  OMG: 'omgType',
  'Star Force Credits': 'starForceCredits',
  'Glowing Vessel': 'glowingVessel',
  'Blossom Geomerty': 'blossomGeomerty',
  'Matrix Drawing': 'matrixDrawing',
  'Pool Vibration': 'poolVibration',
  'Unfolding Circles': 'unfoldingCircles',
  'Prismatic Mandala': 'prismaticMandala',
  'Drop The SVG': 'dropTheSVG',
};

const out = {};
for (const [label, varName] of Object.entries(PRESET_TYPES)) {
  if (!(varName in ctx)) throw new Error(`preset ${varName} not found in allpresets.js`);
  out[label] = ctx[varName];
}
fs.mkdirSync('public/assets/divix', { recursive: true });
fs.writeFileSync('public/assets/divix/presets.json', JSON.stringify(out, null, 2));
console.log(`Wrote ${Object.keys(out).length} presets`);
```

- [ ] **Step 2: Запустить и проверить**

```bash
node scripts/convert-splitx-presets.mjs
node -e "const p=require('./public/assets/divix/presets.json'); console.log(Object.keys(p).length, Object.keys(p)[0]);"
```

Expected: `Wrote 21 presets`, затем `21 Split Vibration`.

- [ ] **Step 3: Палитры**

Оригинал грузит `1000-color-palettes.json` с antlii.github.io — тот же формат (массив массивов из 5 hex), что `copo/palettes.json` в ritmo. Взять файл оригинала:

```bash
curl -s https://antlii.github.io/assets/json/1000-color-palettes.json -o public/assets/divix/palettes.json
node -e "const p=require('./public/assets/divix/palettes.json'); console.log(Array.isArray(p), p.length, p[0]);"
```

Expected: `true 1000 [ '#…', … ]` (5 hex-строк).

- [ ] **Step 4: Commit**

```bash
git add scripts/convert-splitx-presets.mjs public/assets/divix
git commit -m "feat(divix): presets JSON (21) and 1000-color palettes"
```

### Task 7: ease.js — с тестом (TDD)

**Files:**
- Create: `src/divix/js/ease.test.js`
- Create: `src/divix/js/ease.js`
- Reference: `reference/splitx/scripts/ease.js`

- [ ] **Step 1: Посмотреть референс**

Открыть `reference/splitx/scripts/ease.js` — там таблица easing-функций (`easeInSine`, `easeOutQuad`, …) и диспетчер. Выяснить точное имя экспортируемой точки входа (функция, применяющая easing по имени) и список функций.

- [ ] **Step 2: Написать падающий тест**

Инварианты easing-функций (не зависят от конкретной формулы):

```js
import { describe, it, expect } from 'vitest';
import { easeFunctions } from './ease.js';

describe('divix easeFunctions', () => {
  it('every easing maps 0→0 and 1→1', () => {
    for (const [name, fn] of Object.entries(easeFunctions)) {
      expect(fn(0), `${name}(0)`).toBeCloseTo(0, 5);
      expect(fn(1), `${name}(1)`).toBeCloseTo(1, 5);
    }
  });
  it('returns finite values across the domain', () => {
    for (const [name, fn] of Object.entries(easeFunctions)) {
      for (let t = 0; t <= 1.0001; t += 0.1) {
        expect(Number.isFinite(fn(t)), `${name}(${t})`).toBe(true);
      }
    }
  });
});
```

Если в референсе точка входа не `easeFunctions` — привести порт к этому имени (как в copo у ritmo), тест не менять.

- [ ] **Step 3: Убедиться, что тест падает**

```bash
npx vitest run src/divix/js/ease.test.js
```

Expected: FAIL (`ease.js` не существует).

- [ ] **Step 4: Портировать ease.js**

Скопировать функции из референса в ES-модуль `src/divix/js/ease.js`, собрать в `export const easeFunctions = { … }`. p5-глобалей там быть не должно (чистая математика); если встречаются `sin/cos/PI` из p5 — заменить на `Math.*`.

- [ ] **Step 5: Тест зелёный**

```bash
npx vitest run src/divix/js/ease.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/divix/js/ease.js src/divix/js/ease.test.js
git commit -m "feat(divix): easing functions with invariant tests"
```

### Task 8: Рендер-модули — form.js, path.js, svg.js, random.js

**Files:**
- Create: `src/divix/js/form.js` (из `reference/splitx/scripts/form.js`, 415 строк)
- Create: `src/divix/js/path.js` (из `path.js`, 109 строк — paper.js: импорт SVG-пути в точки)
- Create: `src/divix/js/svgExport.js` (из `svg.js`, 162 строки — paper.js: сборка SVG для экспорта, `startSvgExport`)
- Create: `src/divix/js/randomize.js` (из `random.js`, 115 строк — рандомизация параметров)

Правила порта (одинаковые для всех четырёх файлов):

1. Каждый модуль — фабрика, принимающая контекст: `export function createForm({ p, state, buffers }) { … return { drawForms, generateForm, … }; }`, где `state` — модуль state.js, `buffers` — `{ gForm, gDraw, gAlpha }` (создаются в app.js). Прямых глобалей быть не должно.
2. p5-глобали → методы инстанса: `random()` → `p.random()`, `floor` → `p.floor` (или `Math.floor`), `createGraphics` → `p.createGraphics`, `width/height` → `p.width/p.height`, `noise` → сидированный simplex из `window.SimplexNoise`+`alea` как в ritmo (см. `ritmo/js/app.js`).
3. `paper` — глобаль, доступная после `ensureVendorLibs('paper')` (main.js уже грузит её для divix до setup()); использование в path/svgExport оставить как есть.
4. Функции, читающие/пишущие Tweakpane (`pane.refresh()` и пр.), — убрать; обновление панели делается в app.js через `refreshPanel()`.
5. Известный класс багов из ritmo — сразу защититься: индекс палитры clamp'ить (`Math.min(idx, palette.array.length - 1)`), значения цветов валидировать перед `p.color()` (фолбэк `#000000`), деление на ноль в масштабах (`|| 1`).

- [ ] **Step 1: Портировать form.js → createForm** (генерация буфера форм, drawForms, работа с shapePaths/масштабом/движением)
- [ ] **Step 2: Портировать path.js → createPathTools** (paper.importSVG → массивы точек; custom SVG upload использует это)
- [ ] **Step 3: Портировать svg.js → createSvgExport** (`startSvgExport()`: пересборка сцены в paper.project и выгрузка через `shared/utils/svgDownload.js`)
- [ ] **Step 4: Портировать random.js → createRandomize** (случайные значения параметров + случайная палитра из palettes.json)
- [ ] **Step 5: lint**

```bash
npm run lint
```

Expected: PASS (модули пока не подключены — это нормально для ES-модулей).

- [ ] **Step 6: Commit**

```bash
git add src/divix/js
git commit -m "feat(divix): port form, path, svg-export and randomize modules to instance mode"
```

### Task 9: controls.js — SECTIONS для panelBuilder

**Files:**
- Create: `src/divix/js/controls.js`
- Modify: `src/divix/template.html` (кнопка Export SVG в футер)
- Reference: `reference/splitx/scripts/ui.js` (структура Tweakpane)

Маппинг оригинальной панели (страницы MAIN/EXPORT/OPTIONS/LICENSE) на новый UI:

- Страница LICENSE — не переносится.
- Страница EXPORT → футер сайдбара: кнопки PNG/MP4 (+ селектор длины) уже в шаблоне; добавить кнопку `dx-btn-save-svg` («Export as SVG», class `btn btn-secondary`) после MP4-группы. Плотность экспорта (`cnv.density.export`) и качество — в секцию Export в SECTIONS.
- Страница OPTIONS (margin, mouse sens, ui color) → секция Options.
- Страница MAIN → секции: Preset (через `buildPresetSection` из panelBuilder — как в ritmo), Canvas, Shape, Color, Transform.
- Tweakpane-таб TRANSFORM с 4 страницами (SCALE/X MOVE/Y MOVE/ROTATE) → 4 секции `Transform: Scale`, `Transform: Move X`, `Transform: Move Y`, `Transform: Rotate`; каждая — селекторы type/order + слайдеры amp/freq/cycle/speed/phase/seed + кнопка Get Random Values (id `dx-rand-scale` и т.д.).

- [ ] **Step 1: Выписать полный SECTIONS**

Структура (пути — в объекты state.js; диапазоны min/max/step взять из соответствующих `addInput` в `reference/splitx/scripts/ui.js` — открыть и переписать точные значения):

```js
// DIVIX — control panel sections (declarative SECTIONS format consumed by
// shared/ui/panelBuilder.js). Ranges mirror the original tool's Tweakpane UI.
import {
  RATIO_TYPES, SHAPE_TYPES, SPLIT_TYPES, COLOR_STYLE_TYPES, FORM_FILL_MODES,
  TRANSFORM_TYPES, ORDER_TYPES, SLOT_TYPES,
} from './state.js';

const CANVAS_COLOR_MODES = { Custom: 'custom', Palette: 'palette', Transparent: 'transparent' };

function transformSection(title, key, randomId) {
  return {
    title,
    controls: [
      { id: `dx-${key}-type`,  type: 'select', label: 'Type',  path: `form.${key}.type`,  options: TRANSFORM_TYPES },
      { id: `dx-${key}-order`, type: 'select', label: 'Order', path: `form.${key}.order`, options: ORDER_TYPES },
      { id: `dx-${key}-amp`,   type: 'slider', label: 'Amplitude', path: `form.${key}.amp`,   min: 0, max: 1, step: 0.01 },
      { id: `dx-${key}-freq`,  type: 'slider', label: 'Frequency', path: `form.${key}.freq`,  min: 0, max: 1, step: 0.01 },
      { id: `dx-${key}-cycle`, type: 'slider', label: 'Cycle',     path: `form.${key}.cycle`, min: 0, max: 10, step: 0.1 },
      { id: `dx-${key}-speed`, type: 'slider', label: 'Speed',     path: `form.${key}.speed`, min: 0, max: 1, step: 0.01 },
      { id: `dx-${key}-phase`, type: 'slider', label: 'Phase',     path: `form.${key}.phase`, min: 0, max: 1, step: 0.01 },
      { id: `dx-${key}-seed`,  type: 'slider', label: 'Seed',      path: `form.${key}.seed`,  min: 0, max: 1000, step: 1 },
      { id: randomId, type: 'button', label: 'Get Random Values' },
    ],
  };
}

export const SECTIONS = [
  {
    title: 'Canvas',
    controls: [
      { id: 'dx-ratio', type: 'select', label: 'Canvas Ratio', path: 'cnv.ratio', options: RATIO_TYPES, regen: 'canvas' },
      { id: 'dx-bg-mode', type: 'select', label: 'Background', path: 'cnv.color.mode', options: CANVAS_COLOR_MODES },
      { id: 'dx-bg-custom', type: 'color', label: 'Background Color', path: 'cnv.color.custom', showIf: { path: 'cnv.color.mode', equals: 'custom' } },
      { id: 'dx-bg-slot', type: 'select', label: 'Palette Slot', path: 'cnv.color.slot', options: SLOT_TYPES, showIf: { path: 'cnv.color.mode', equals: 'palette' } },
      { id: 'dx-animation', type: 'checkbox', label: 'Animation', path: 'cnv.animation' },
    ],
  },
  {
    title: 'Shape',
    controls: [
      { id: 'dx-form-type', type: 'select', label: 'Shape Type', path: 'form.type', options: SHAPE_TYPES, regen: 'form' },
      { id: 'dx-upload-svg', type: 'button', label: 'Upload Custom SVG', showIf: { path: 'form.type', equals: 'custom' } },
      { id: 'dx-count', type: 'slider', label: 'Forms Count', path: 'form.count.base', min: 1, max: 200, step: 1, regen: 'form' },
      { id: 'dx-sequence', type: 'slider', label: 'Sequence', path: 'form.sequence', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Color',
    controls: [
      { id: 'dx-color-type', type: 'select', label: 'Color Style', path: 'form.color.type', options: COLOR_STYLE_TYPES },
      { id: 'dx-stroke-width', type: 'slider', label: 'Stroke Width', path: 'form.stroke.width', min: 1, max: 10, step: 0.5, showIf: { path: 'form.color.type', equals: 'stroke' } },
      { id: 'dx-fill-mode', type: 'select', label: 'Fill Mode', path: 'form.color.mode', options: FORM_FILL_MODES },
      // Палитра (5 пикеров + чекбоксы use + shuffle) — кастомная секция в app.js,
      // как палитра в ritmo (динамика на panelBuilder не ложится).
    ],
  },
  {
    title: 'Split',
    controls: [
      { id: 'dx-split-type', type: 'select', label: 'Split Type', path: 'split.type', options: SPLIT_TYPES },
      { id: 'dx-split-show', type: 'checkbox', label: 'Show Split Lines', path: 'split.show' },
      { id: 'dx-split-mask-x', type: 'slider', label: 'Mask X', path: 'split.mask.x', min: -1, max: 1, step: 0.01 },
      { id: 'dx-split-mask-y', type: 'slider', label: 'Mask Y', path: 'split.mask.y', min: -1, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Transform',
    controls: [
      { id: 'dx-canvas-scale', type: 'slider', label: 'Content Scale', path: 'cnv.scale.value', min: 0.25, max: 5, step: 0.05 },
      { id: 'dx-canvas-rotate', type: 'slider', label: 'Content Rotate', path: 'cnv.rotation.value', min: -180, max: 180, step: 1 },
      { id: 'dx-trans-x', type: 'slider', label: 'Transition X', path: 'form.transition.x', min: -1, max: 1, step: 0.01 },
      { id: 'dx-trans-y', type: 'slider', label: 'Transition Y', path: 'form.transition.y', min: -1, max: 1, step: 0.01 },
    ],
  },
  transformSection('Transform: Scale', 'scale', 'dx-rand-scale'),
  transformSection('Transform: Move X', 'xmove', 'dx-rand-xmove'),
  transformSection('Transform: Move Y', 'ymove', 'dx-rand-ymove'),
  transformSection('Transform: Rotate', 'rotate', 'dx-rand-rotate'),
  {
    title: 'Export',
    controls: [
      { id: 'dx-density', type: 'slider', label: 'Export Density', path: 'cnv.density.export', min: 1, max: 8, step: 1 },
      { id: 'dx-quality', type: 'slider', label: 'Video Quality', path: 'rec.quality', min: 10, max: 100, step: 5 },
    ],
  },
  {
    title: 'Options',
    controls: [
      { id: 'dx-margin', type: 'slider', label: 'Canvas Margin', path: 'cnv.settings.margin', min: 0.5, max: 1, step: 0.01 },
      { id: 'dx-mouse', type: 'checkbox', label: 'Mouse Interaction', path: 'cnv.event.mouse' },
      { id: 'dx-sens', type: 'slider', label: 'Mouse Sensitivity', path: 'cnv.event.sens', min: 0, max: 1, step: 0.05, showIf: { path: 'cnv.event.mouse', equals: true } },
    ],
  },
];
```

**Обязательно сверить каждый min/max/step и label с `addInput`-вызовами в `reference/splitx/scripts/ui.js`** — выше проставлены значения по var.js (`min`/`max` полей) и здравому смыслу; точные диапазоны — в ui.js. Синтаксис `showIf` проверить по фактическому API `panelBuilder.js` (в ritmo видимость решается через `refreshVisibility`; если декларативного showIf нет — управлять видимостью в `refreshVisibility()` app.js по `data-control-id`).

- [ ] **Step 2: Кнопка SVG в футер шаблона**

В `src/divix/template.html` после `.btn-group` MP4 добавить:

```html
<button id="dx-btn-save-svg" class="btn btn-secondary">Export as SVG</button>
```

- [ ] **Step 3: lint + commit**

```bash
npm run lint
git add src/divix
git commit -m "feat(divix): declarative control panel sections"
```

### Task 10: app.js — сборка воркспейса

**Files:**
- Create: `src/divix/js/app.js` (заменяет заглушку)
- Reference: `reference/splitx/scripts/{main,system,preset,events}.js` и образец `/Users/andy/Documents/GitHub/ritmo/src/ritmo/js/app.js`

Структура файла — точно по образцу `ritmo/js/app.js`:

```js
// DIVIX — split-mirror generative graphics on custom SVG shapes.
// Renders into offscreen gForm/gDraw buffers composited to the viewport,
// reused for PNG/MP4/SVG export.

import * as state from './state.js';
import { easeFunctions } from './ease.js';
import { createForm } from './form.js';
import { createPathTools } from './path.js';
import { createSvgExport } from './svgExport.js';
import { createRandomize } from './randomize.js';
import { SECTIONS } from './controls.js';
import { createPersistence } from '../../shared/utils/persistence.js';
import { timestamp } from '../../shared/utils/datetime.js';
import { downloadPresetJSON, openPresetFile } from '../../shared/utils/presetIO.js';
import { deepMerge } from '../../shared/utils/deepMerge.js';
import { exportPNG, exportMP4 } from '../../shared/utils/exportMedia.js';
import { createPanelBuilder, buildPresetSection, openSections } from '../../shared/ui/panelBuilder.js';

const STORAGE_KEY = 'divix-tool';
let PRESETS = {};

export function divixSketch(p) {
  // …
}
```

- [ ] **Step 1: Каркас скетча** — `p.setup`: создание canvas по `RESOLUTIONS[cnv.ratio]` и `density.base`, буферы `gForm/gDraw/gAlpha` (`p.createGraphics`), сидированный simplex (как ritmo), монтирование в `#divix-canvas`. `p.draw`: порт `draw()`/`drawCanvas()`/`drawSplitImages()`/`showSplit()`/`splitFormation()` из `reference/splitx/scripts/main.js` (заменить глобали на `p.*`/`buffers.*`, выбросить `license.image`, `captureCanvas()` и `isDrop`-ветку; drag-and-drop оверлей делаем DOM'ом в Step 5).
- [ ] **Step 2: Пресеты** — fetch `assets/divix/presets.json` + `assets/divix/palettes.json` (базовый путь как в ritmo: `import.meta.env.BASE_URL`), гейт draw-цикла до загрузки (`let ready = false` — рисовать только после), `loadPreset(name)` — порт из `reference/splitx/scripts/preset.js`: `deepMerge` пресета поверх дефолтного состояния, регенерация форм. User Preset — сохранение текущего состояния в localStorage (порт `preset.js`, ключ `divix-user-preset`).
- [ ] **Step 3: Панель** — `createPanelBuilder({ state, applyChange, refreshVisibility })`, `buildPresetSection` с именами из PRESETS + 'User Preset', рендер SECTIONS в `#dx-controls`, кастомная секция палитры (5 color-инпутов + чекбоксы use + кнопка Shuffle — по образцу палитры в `ritmo/js/app.js`), `applyChange(ctrl)` — диспетчер regen-флагов (`canvas` → пересоздать canvas/буферы, `form` → перегенерить форму, прочее — просто redraw), обработчики кнопок (`dx-rand-*` → createRandomize, `dx-upload-svg` → клик по скрытому file input).
- [ ] **Step 4: Автосейв** — `createPersistence` (как ritmo): сохранение state-объектов в `STORAGE_KEY` с debounce, восстановление при старте (deepMerge поверх дефолтов), кнопка Restart Preset сбрасывает к выбранному пресету.
- [ ] **Step 5: События** — порт `events.js`: мышиные взаимодействия (`cnv.event`: drag/sens → transx/transy), drag-and-drop SVG/JSON на канвас (DOM `dragover/drop` на контейнере воркспейса, оверлей «DROP FILE TO LOAD» — DOM-элемент, не p5-текст), скрытые file-инпуты создать в app.js динамически (`document.createElement('input')`), не в глобальном index.html.
- [ ] **Step 6: Экспорт** — PNG: `exportPNG(p, 'divix')` с рендером в export-density; MP4: `exportMP4({...})` из shared (лениво тянет h264 через `ensureHME`), длина из `#dx-mp4-length`, статус в `#dx-export-status`; SVG: `createSvgExport().startSvgExport()` → `svgDownload.js`. Двойной клик по кнопке во время экспорта игнорировать (`recVideo.active` уже это делает для MP4).
- [ ] **Step 7: Тема** — `p.applyTheme = (theme) => { … }` как в ritmo (перекраска фона вьюпорта, форм не касается).
- [ ] **Step 8: Проверка в dev**

```bash
npm run dev
```

DIVIX открывается, дефолтный пресет рисуется и анимируется, переключение пресетов работает, слайдеры живые, автосейв переживает перезагрузку страницы.

- [ ] **Step 9: lint + test + build**

```bash
npm run lint && npm run test && npm run build
```

Expected: всё зелёное.

- [ ] **Step 10: Commit**

```bash
git add src/divix
git commit -m "feat(divix): full workspace port — sketch, presets, panel, autosave, export"
```

### Task 11: Визуальная сверка с оригиналом и фиксы

**Files:**
- Modify: по результатам сверки

- [ ] **Step 1: Открыть рядом оригинал и порт**

Оригинал: https://antlii.github.io/splitx-tool/ . Порт: dev-сервер. Пройти все 21 пресет по списку; у каждого сверить: форму, палитру, характер движения, split-режим.

- [ ] **Step 2: Проверить экспорт** — PNG (открыть файл), MP4 (проиграть), SVG (открыть в браузере), кастомный SVG-аплоад (перетащить любой SVG), импорт/экспорт пресета JSON.

- [ ] **Step 3: Чинить расхождения** — каждое расхождение: минимальный фикс + отдельный коммит `fix(divix): …`. Известные баги оригинала фиксить в пользу корректного поведения и записывать в commit message.

- [ ] **Step 4: Финальный прогон**

```bash
npm run lint && npm run test && npm run build
```

### Task 12: README и деплой

**Files:**
- Create: `README.md`
- Repo: создать `legenki/divix`, включить Pages

- [ ] **Step 1: README.md**

По структуре README ritmo: название, одно-абзацное описание, live-ссылка `legenki.github.io/divix`, секция Workspaces (6 позиций: DIVIX — готов; DIFUSO/BANDADA/DERIVA/SONDEO/CLON — coming soon), секция Architecture (как у ritmo, ссылка на Grafema), секция Development (npm install/dev/build/lint).

- [ ] **Step 2: Создать репозиторий и запушить**

```bash
gh repo create legenki/divix --public --source=. --push
```

- [ ] **Step 3: Включить Pages (build через Actions)**

```bash
gh api -X POST repos/legenki/divix/pages -f build_type=workflow 2>/dev/null || gh api -X PUT repos/legenki/divix/pages -f build_type=workflow
gh run watch --exit-status
```

Expected: workflow зелёный.

- [ ] **Step 4: Проверить живой сайт**

Открыть https://legenki.github.io/divix/ — вкладки переключаются, DIVIX рисует, PWA-манифест отдаётся.

- [ ] **Step 5: Commit README (если ещё не в пуше)**

```bash
git add README.md && git commit -m "docs: README with workspaces and architecture" && git push
```

---

## Дальше (отдельные планы)

Этапы 2–6 — по одному плану на воркспейс (DIFUSO → BANDADA → DERIVA → SONDEO → CLON), каждый по шаблону Task 5–11 этого плана: state → ассеты → модули → SECTIONS → app.js → сверка. Составляются после приёмки DIVIX, с учётом уроков первого порта.
