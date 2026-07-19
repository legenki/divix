// DIFUSO — image/video dithering workspace.
// Assembles the difuso effect modules (source, dither, halftone, ascii,
// gradient) around a WEBGL multi-buffer pipeline: a source buffer (gImg) blits
// the current image/video frame; one of the four effect shaders renders gImg
// into dithBuffer; gradBuffer then either gradient-maps dithBuffer or copies it
// through; the visible p5 canvas displays gradBuffer fitted to the viewport.
//

import * as state from './state.js';
import { createSource } from './source.js';
import { createDither } from './dither.js';
import { createHalftone } from './halftone.js';
import { createAscii } from './ascii.js';
import { createGradient } from './gradient.js';
import { createObjects } from './objects.js';
import { SECTIONS } from './controls.js';

import { createPersistence } from '../../shared/utils/persistence.js';
import { timestamp } from '../../shared/utils/datetime.js';
import { downloadPresetJSON, openPresetFile } from '../../shared/utils/presetIO.js';
import { deepMerge } from '../../shared/utils/deepMerge.js';
import { exportMP4 } from '../../shared/utils/exportMedia.js';
import { isOverPanel } from '../../shared/utils/panelGuard.js';
import { debounce } from '../../shared/utils/debounce.js';
import { createDirtyLoop } from '../../shared/utils/dirtyLoop.js';
import {
  createPanelBuilder,
  buildPresetSection,
  openSections,
} from '../../shared/ui/panelBuilder.js';

const STORAGE_KEY = 'difuso-tool';

const { cnv, ascii, dither, gradient, rec, motion, FONT_TYPES, COLOR_PALETTES } = state;

// Noise-texture manifest: `dither.texture` (1..4) indexes into the per-tier
// array. The bundled filenames differ per tier, so they're listed explicitly
// (alphabetical, stable) rather than discovered at runtime — dither.js reads
// noiseTextures[dither.noise][dither.texture - 1].
const NOISE_MANIFEST = {
  noise16: ['HDR_LA_11.png', 'HDR_LA_6.png', 'HDR_L_32.png', 'LDR_LLL1_11.png'],
  noise32: ['HDR_LA_4.png', 'HDR_LA_9.png', 'HDR_L_30.png', 'LDR_LLL1_10.png'],
  noise64: ['HDR_LA_3.png', 'HDR_LA_7.png', 'HDR_L_14.png', 'LDR_LLL1_6.png'],
  noise128: ['HDR_LA_12.png', 'HDR_LA_5.png', 'HDR_L_4.png', 'LDR_LLL1_8.png'],
};

function difusoSketch(p) {
  let canvasContainer;

  // ---- Runtime-only (not persisted) ----
  let gImg = null; // WEBGL source buffer (current frame blitted / video-textured).
  let dithBuffer = null; // WEBGL effect-shader target.
  let gradBuffer = null; // WEBGL gradient / pass-through target.
  let isReady = false;
  let PRESETS = {};
  let noiseTextures = { noise16: [], noise32: [], noise64: [], noise128: [] };
  const recVideo = { active: false, seconds: 4 };
  const dirty = createDirtyLoop(p);
  let loadedNoiseTiers = new Set();

  // ---- Factories (wired after buffers + assets exist, in setup) ----
  let source = null;
  let ditherCtl = null;
  let halftoneCtl = null;
  let asciiCtl = null;
  let gradientCtl = null;
  let objectsCtl = null;

  // ---- Font-path resolution ----
  // FONT_TYPES[label] is a relative path like 'assets/font/font_atascii.ttf';
  // resolve to the actual public/ location `/assets/difuso/fonts/<basename>`.
  function fontUrl(fontname) {
    const rel = FONT_TYPES[fontname] || FONT_TYPES['Public Pixel'];
    const basename = rel.split('/').pop();
    return `${import.meta.env.BASE_URL}assets/difuso/fonts/${basename}`;
  }

  // ---- Panel UI ----
  const panel = createPanelBuilder({
    state,
    applyChange,
    refreshVisibility,
    onSliderInput: () => dirty.markDirty(),
  });

  function buildUI() {
    const root = document.getElementById('df-controls');
    if (!root) return;
    root.innerHTML = '';

    buildPresetSection(root, {
      idPrefix: 'df',
      presets: PRESETS,
      onExport: exportPreset,
      onImport: importPreset,
    });
    panel.buildSections(root, SECTIONS);
    buildPaletteSection(root);
    // Open Preset + Dither by default.
    openSections(root, [0, 2]);
    refreshVisibility();
  }

  // The dynamic 5-swatch palette picker (gradient.use.0..4 / gradient.color.0..4)
  // has no generic panelBuilder control type, so it is built directly here
  // (mirroring DIVIX's buildPaletteSection). Each slot has a use-toggle and a
  // colour input; edits rebuild the gradient ramp.
  function buildPaletteSection(root) {
    const sec = document.createElement('section');
    sec.className = 'panel-section collapsed';
    sec.innerHTML = `
      <h2 class="section-title"><span>Palette</span>
        <svg class="chevron-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </h2>
      <div class="section-content">
        <div id="df-palette-swatches"></div>
      </div>`;
    sec.querySelector('.section-title').addEventListener('click', () => {
      sec.classList.toggle('collapsed');
    });
    root.appendChild(sec);
    rebuildSwatches();
  }

  function rebuildSwatches() {
    const holder = document.getElementById('df-palette-swatches');
    if (!holder) return;
    holder.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const row = document.createElement('div');
      row.className = 'parameter-row';
      const hex = String(gradient.color[i] || '#000000').slice(0, 7);
      row.innerHTML = `
        <div class="parameter-header" style="align-items:center;">
          <label class="checkbox-container" style="margin:0;">
            <input type="checkbox" id="df-palette-use-${i}" ${gradient.use[i] ? 'checked' : ''}>
            <span class="custom-checkbox"></span>
          </label>
          <span class="parameter-label" style="flex:1;">Color ${i + 1}</span>
          <div class="color-picker-wrapper" style="margin:0;">
            <input type="color" id="df-palette-color-${i}" value="${hex}">
            <span class="color-code" id="df-palette-color-${i}-code">${hex.toUpperCase()}</span>
          </div>
        </div>`;

      row.querySelector(`#df-palette-use-${i}`).addEventListener('change', (e) => {
        gradient.use[i] = e.target.checked;
        gradientCtl.buildGradientTexture();
        saveState();
      });
      const colorInput = row.querySelector(`#df-palette-color-${i}`);
      const code = row.querySelector(`#df-palette-color-${i}-code`);
      colorInput.addEventListener('input', (e) => {
        gradient.color[i] = e.target.value;
        code.textContent = e.target.value.toUpperCase();
        gradientCtl.buildGradientTexture();
        saveState();
      });
      holder.appendChild(row);
    }
  }

  // ---- Change dispatch ----
  // applyChange fires after panelBuilder writes state. It dispatches on the
  // control's `regen` tag (controls.js's header maps each tag to its meaning),
  // rebuilding whatever generated texture / shader-path the change invalidates.
  // The effect modules do NOT auto-detect state changes, so this is where the
  // rebuild-on-change discipline lives.
  function applyChange(ctrl) {
    if (ctrl.action === 'uploadModel') {
      document.getElementById('df-obj-file-input')?.click();
    } else if (ctrl.action === 'resetLights') {
      objectsCtl.resetLights();
      syncUIFromState();
    } else if (ctrl.action === 'resetObjectMotions') {
      objectsCtl.resetObjectMotions();
      syncUIFromState();
    } else if (ctrl.action === 'resetObjectCoordinates') {
      objectsCtl.resetObjectCoordinates();
      syncUIFromState();
    }
    switch (ctrl.regen) {
      case 'canvas':
        // In object mode this is a real resize (calculateCanvasSize reads
        // RESOLUTIONS[cnv.ratio] directly); in image/video mode the ratio
        // slider is inert for sizing (source dictates it) but we still
        // resize buffers to stay consistent.
        resizeCanvas();
        break;
      case 'objectCamera':
        // Camera mode (ortho/perspective) is read live every frame in
        // previewGraphics() — nothing to rebuild here.
        break;
      case 'ditherType':
        // New dither.type: rebuild whatever generated texture it needs. Only
        // 'matrix'/'noise' have a dither tile; 'ascii' has a glyph atlas.
        if (dither.type === 'noise') {
          ensureNoiseTier(dither.noise).then(() => {
            if (ditherCtl) ditherCtl.buildDitherTexture();
            dirty.markDirty();
          });
        } else if (dither.type === 'matrix') {
          ditherCtl.buildDitherTexture();
        } else if (dither.type === 'ascii') {
          asciiCtl.buildGlyphTexture();
        }
        break;
      case 'ditherTexture':
        // matrix/scale/noise/texture changed — rebuild the Bayer/noise tile.
        // Guarded: buildDitherTexture throws for non-matrix/noise types.
        if (dither.type === 'noise') {
          ensureNoiseTier(dither.noise).then(() => {
            if (ditherCtl) ditherCtl.buildDitherTexture();
            dirty.markDirty();
          });
        } else if (dither.type === 'matrix') {
          ditherCtl.buildDitherTexture();
        }
        break;
      case 'gradientType':
        // original vs gradient-map — draw() picks the path; nothing to rebuild.
        break;
      case 'gradientPalette':
        gradientCtl.applySelectedPalette();
        rebuildSwatches();
        break;
      case 'gradientTexture':
        gradientCtl.buildGradientTexture();
        break;
    }
    refreshVisibility();
    dirty.markDirty();
    saveState();
  }

  // ---- Visibility ----
  // Implements every conditional-visibility gate documented in controls.js's
  // header/inline comments.
  function refreshVisibility() {
    const show = (id, vis) => {
      const el = document.querySelector(`[data-control-id="${id}"]`);
      if (el) el.style.display = vis ? '' : 'none';
    };

    const t = dither.type;
    const isAscii = t === 'ascii';
    const isMatrix = t === 'matrix';
    const isNoise = t === 'noise';
    const isHalftone = t === 'halftone';
    const isCMYK = t === 'halftoneCMYK';
    const isOrderedDither = isMatrix || isNoise;

    // Dither section
    show('df-dither-matrix', isMatrix);
    show('df-dither-noise', isNoise);
    show('df-dither-texture', isNoise);
    show('df-ascii-font', isAscii);
    show('df-ascii-text', isAscii);
    show('df-ascii-scale', isAscii);
    show('df-ascii-color-mode', isAscii);
    show('df-ascii-char', isAscii && (ascii.color.mode === 'chars' || ascii.color.mode === 'duotone'));
    show('df-ascii-bg', isAscii && (ascii.color.mode === 'background' || ascii.color.mode === 'duotone'));
    show('df-dither-scale', isOrderedDither);
    show('df-halftone-scale', isHalftone || isCMYK);
    show('df-halftone-smooth', isHalftone); // NOT CMYK

    // Levels section
    show('df-dither-step', isOrderedDither);
    show('df-ascii-limit', isAscii);

    // Colors section
    const isGradientMap = gradient.type === 'gradient';
    show('df-gradient-saturation', gradient.type === 'original');
    show('df-gradient-palette', isGradientMap);
    show('df-gradient-reverse', isGradientMap);

    // 3D Object section: every row in it individually gated on
    // rec.type === 'object', same mechanism as every other conditional row
    // above — the whole section collapses to an empty shell when every row
    // inside it is hidden.
    const isObject = rec.type === 'object';
    show('df-canvas-ratio', isObject);
    show('df-obj-upload', true);
    show('df-obj-camera', isObject);
    show('df-obj-transparent', isObject);
    show('df-obj-canvas-color', isObject);
    show('df-obj-scale-factor', isObject);
    show('df-obj-translate-x', isObject);
    show('df-obj-translate-y', isObject);
    show('df-obj-reset-coords', isObject);
    show('df-light-ambient', isObject);
    show('df-light-specular', isObject);
    show('df-light-shininess', isObject);
    show('df-light-one-color', isObject);
    show('df-light-one-x', isObject);
    show('df-light-one-y', isObject);
    show('df-light-one-z', isObject);
    show('df-light-two-color', isObject);
    show('df-light-two-x', isObject);
    show('df-light-two-y', isObject);
    show('df-light-two-z', isObject);
    show('df-light-three-color', isObject);
    show('df-light-three-x', isObject);
    show('df-light-three-y', isObject);
    show('df-light-three-z', isObject);
    show('df-light-reset', isObject);
    show('df-motion-active', isObject);
    show('df-motion-rotate-type', isObject);
    show('df-motion-rotate-angle-x', isObject);
    show('df-motion-rotate-angle-y', isObject);
    show('df-motion-rotate-angle-z', isObject);
    show('df-motion-rotate-speed-x', isObject);
    show('df-motion-rotate-speed-y', isObject);
    show('df-motion-rotate-speed-z', isObject);
    show('df-motion-translate-level-x', isObject);
    show('df-motion-translate-level-y', isObject);
    show('df-motion-translate-level-z', isObject);
    show('df-motion-translate-speed-x', isObject);
    show('df-motion-translate-speed-y', isObject);
    show('df-motion-translate-speed-z', isObject);
    show('df-motion-reset', isObject);
  }

  function syncUIFromState() {
    panel.syncUIFromState(SECTIONS);
    rebuildSwatches();
    refreshVisibility();
  }

  // ---- Canvas / buffers ----
  // Ported from the reference calculateCanvasSize() (main.js:249-267): fit the
  // CURRENT source's aspect ratio into the window (minus the UI chrome), rounded
  // to even pixel dimensions. Unlike DIVIX (fixed resolution per ratio), DIFUSO's
  // canvas dimensions are computed from the source image at runtime.
  function calculateCanvasSize() {
    let targetWidth;
    let targetHeight;
    if (rec.type === 'object') {
      const res = state.RESOLUTIONS[cnv.ratio] || state.RESOLUTIONS['1:1'];
      targetWidth = res.width;
      targetHeight = res.height;
    } else {
      const source0 = source ? source.getCurrentTexture() : null;
      targetWidth = source0 ? source0.width : cnv.width;
      targetHeight = source0 ? source0.height : cnv.height;
    }
    if (!targetWidth || !targetHeight) return;

    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    const maxWidth = Math.min(winWidth * 0.85, cnv.maxSize);
    const maxHeight = Math.min(winHeight * 0.85, cnv.maxSize);
    const scaleFactor = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);

    const w = targetWidth * scaleFactor;
    const h = targetHeight * scaleFactor;
    cnv.width = Math.max(2, w - (w % 2));
    cnv.height = Math.max(2, h - (h % 2));
  }

  // Ports updateCanvas()/createBuffer() (main.js:180-239): (re)creates gImg and
  // the two effect buffers at cnv.width/cnv.height, then blits the current
  // static source into gImg. The visible canvas itself is full-viewport (created
  // once in setup) — we do NOT recreate it per resize (DIVIX's pattern), which
  // sidesteps the reference's manual canvas.position() centering: the composed
  // gradBuffer is blitted centered+fitted in blitToVisible() instead.
  function setupBuffers() {
    const w = cnv.width;
    const h = cnv.height;
    const density = cnv.density.base;

    disposeGraphics(gImg);
    gImg = p.createGraphics(w, h, p.WEBGL);
    hideGraphics(gImg);
    gImg.pixelDensity(density);
    gImg.noStroke();
    gImg.rectMode(p.CENTER);
    gImg.imageMode(p.CENTER);

    disposeGraphics(gradBuffer);
    gradBuffer = p.createGraphics(w, h, p.WEBGL);
    hideGraphics(gradBuffer);
    gradBuffer.pixelDensity(density);
    gradBuffer.noStroke();
    gradBuffer.imageMode(p.CENTER);
    gradBuffer.rectMode(p.CENTER);

    disposeGraphics(dithBuffer);
    dithBuffer = p.createGraphics(w, h, p.WEBGL);
    hideGraphics(dithBuffer);
    dithBuffer.pixelDensity(density);
    dithBuffer.noStroke();
    dithBuffer.imageMode(p.CENTER);
    dithBuffer.rectMode(p.CENTER);
    // Needed for the ordered-dither pattern-tile tiling shader to wrap correctly.
    dithBuffer.textureWrap(p.REPEAT);

    blitSourceToGImg();
  }

  // Rebuild all effect factories against the freshly-created buffers. The
  // shaders are compiled ONCE here (per buffer), NOT per frame. gradient.js and
  // dither.js cache their shader against the first buffer passed, so a fresh
  // set of factories must be created whenever the buffers are recreated.
  function wireFactories() {
    source = source || createSource({
      p,
      state,
      defaultImageUrl: `${import.meta.env.BASE_URL}assets/difuso/default.webp`,
      onUnsupported: () => setStatus('Unsupported file type'),
    });

    ditherCtl = createDither({ p, state, buffer: dithBuffer, noiseTextures });
    halftoneCtl = createHalftone({ p, state, buffer: dithBuffer });
    asciiCtl = createAscii({ p, state, buffer: dithBuffer });
    gradientCtl = createGradient({ p, state, palettes: COLOR_PALETTES });

    ditherCtl.buildShader();
    halftoneCtl.buildShaders();
    asciiCtl.buildShader();
    gradientCtl.buildShader(gradBuffer);
  }

  // Blit the current static source image into gImg (video frames are textured
  // per-frame in drawCanvas() instead). Called after (re)creating buffers and
  // after a new source loads.
  function blitSourceToGImg() {
    if (!gImg || !source) return;
    const tex = source.getCurrentTexture();
    if (tex && rec.type === 'image') {
      gImg.clear();
      gImg.image(tex, 0, 0);
    }
  }

  // Recompute canvas size from the current source, recreate buffers + factories,
  // and rebuild all generated textures for the current state. Used on ratio /
  // source / window changes.
  async function resizeCanvas() {
    calculateCanvasSize();
    setupBuffers();
    wireFactories();
    await rebuildGeneratedTextures();
  }

  // Rebuild the glyph atlas / dither tile / gradient ramp for the current state,
  // after the factories are (re)wired. Font must already be loaded.
  async function rebuildGeneratedTextures() {
    if (state.ascii.font) {
      asciiCtl.measureGlyphBox();
      asciiCtl.buildGlyphTexture();
    }
    if (dither.type === 'noise') {
      await ensureNoiseTier(dither.noise);
      ditherCtl.buildDitherTexture();
    } else if (dither.type === 'matrix') {
      ditherCtl.buildDitherTexture();
    }
    gradientCtl.buildGradientTexture();
  }

  function fitVisibleCanvas() {
    const w = canvasContainer.clientWidth || window.innerWidth;
    const h = canvasContainer.clientHeight || window.innerHeight;
    p.resizeCanvas(w, h);
  }

  // ---- Render core ----
  // Ports the reference drawCanvas() (main.js:49-171). Runs exactly one effect
  // shader into dithBuffer (dispatched on dither.type), then composites through
  // gradBuffer (gradient-map or pass-through), then blits gradBuffer fitted to
  // the visible canvas. Effect modules encapsulate the contrast/saturation/step
  // math, so this loop only dispatches.
  function drawCanvas() {
    dithBuffer.clear();
    gradBuffer.clear();

    if (rec.type === 'video') {
      const vid = source.getCurrentTexture();
      if (vid) {
        // During export, seeking happens in beforeVideoFrame() (awaited by
        // exportMP4 before this draw call) so the seek has actually landed by
        // the time this texture read happens — seeking here too would race it.
        if (recVideo.active && typeof vid.time === 'function') {
          vid.pause();
        }
        gImg.clear();
        gImg.texture(vid);
        gImg.plane(gImg.width, gImg.height);
      }
    } else if (rec.type === 'object') {
      objectsCtl.previewGraphics(gImg);
    }

    if (dither.type === 'none') {
      // Not reachable via the panel (controls.js omits 'none' from Dither Type),
      // BUT state.js's dither.type default IS 'none', so this branch renders the
      // very first frame(s) before a preset is applied in setup(). Implemented
      // as a safe pass-through of the raw source, matching the reference — the
      // alternative (leaving it dead) would blank the canvas on first paint.
      dithBuffer.push();
      dithBuffer.texture(gImg);
      dithBuffer.rectMode(p.CORNER);
      dithBuffer.rect(-dithBuffer.width / 2, -dithBuffer.height / 2, dithBuffer.width, dithBuffer.height);
      dithBuffer.pop();
    } else if (dither.type === 'ascii') {
      asciiCtl.apply(gImg);
    } else if (dither.type === 'halftoneCMYK') {
      halftoneCtl.applyCMYK(gImg);
    } else if (dither.type === 'halftone') {
      halftoneCtl.applyBasic(gImg);
    } else {
      // 'matrix' or 'noise'
      ditherCtl.apply(gImg);
    }

    if (gradient.type === 'gradient') {
      gradientCtl.apply(dithBuffer, gradBuffer);
    } else {
      gradBuffer.image(dithBuffer, 0, 0);
    }

    blitToVisible();
  }

  // Blit the composed gradBuffer to the full-viewport visible canvas, centered
  // and fitted (aspect-preserving). Since cnv.width/height are already fit to
  // the window, the fit scale here is ~1 — this replaces the reference's manual
  // canvas.position() centering with a declarative, CSS-friendly blit.
  function blitToVisible() {
    p.clear();
    // The visible canvas is WEBGL, so its coordinate origin (0, 0) is the canvas
    // CENTER, not the top-left. Shift left by 145px (half of 290px right panel space)
    // to center the drawing in the available space.
    p.image(gradBuffer, -145, 0, gradBuffer.width, gradBuffer.height);
  }

  // ---- Presets ----
  // Merge the effect state a preset carries (dither/ascii/gradient/cnv), ignore
  // the 3D-only obj/motion blocks and the bundled colorPalette map (state.js
  // already owns COLOR_PALETTES), then rebuild everything. The preset's
  // gradient.palette drives which built-in palette populates the working swatch
  // colours via applySelectedPalette() — matching the reference's applyPalette().
  async function applyPreset(preset) {
    if (!preset) return;
    if (preset.cnv) deepMerge(cnv, preset.cnv);
    if (preset.dither) deepMerge(dither, preset.dither);
    if (preset.ascii) deepMerge(ascii, preset.ascii);
    if (preset.gradient) deepMerge(gradient, preset.gradient);

    // Presets often pick a different noise tier than the default — load it
    // before rebuild so makeNoiseTexture never gets an undefined image.
    if (dither.type === 'noise') {
      await ensureNoiseTier(dither.noise);
    }
    await resizeCanvas();

    // Load the preset's font (async), then rebuild the glyph atlas. Font load
    // resolves independently; the ramp/tile were already rebuilt by resizeCanvas.
    asciiCtl.loadFont(fontUrl(ascii.fontname)).catch((e) =>
      console.warn('[difuso] font load failed:', e)
    );

    // Populate working swatch colours from the selected built-in palette, then
    // rebuild the ramp (applySelectedPalette does the rebuild internally).
    gradientCtl.applySelectedPalette();

    syncUIFromState();
    dirty.markDirty();
    saveState();
  }

  // ---- Persistence ----
  function serializeState() {
    return {
      cnv: { ratio: cnv.ratio, scale: cnv.scale, density: { export: cnv.density.export } },
      dither: JSON.parse(JSON.stringify(dither)),
      ascii: {
        fontname: ascii.fontname,
        text: ascii.text,
        scale: ascii.scale,
        color: JSON.parse(JSON.stringify(ascii.color)),
      },
      gradient: JSON.parse(JSON.stringify(gradient)),
      rec: { quality: rec.quality },
    };
  }

  const { saveState, loadState } = createPersistence(
    STORAGE_KEY,
    'difuso',
    serializeState,
    (data) => {
      if (data.cnv) deepMerge(cnv, data.cnv);
      if (data.dither) deepMerge(dither, data.dither);
      if (data.ascii) deepMerge(ascii, data.ascii);
      if (data.gradient) deepMerge(gradient, data.gradient);
      if (data.rec) deepMerge(rec, data.rec);
    }
  );

  function exportPreset() {
    downloadPresetJSON(`difuso-preset-${timestamp()}.json`, serializeState());
  }

  function importPreset() {
    openPresetFile(
      (data) => applyPreset(data),
      () => setStatus('Invalid preset file')
    );
  }

  // ---- Export ----
  function setStatus(msg) {
    const el = document.getElementById('df-export-status');
    if (el) el.innerText = msg;
  }

  async function withHighResExport(fn) {
    const savedBase = cnv.density.base;
    try {
      const maxImageEdge = Math.max(cnv.width, cnv.height);
      const targetEdge = cnv.density.export || 1000;
      const exportDensity = Math.max(1, targetEdge / maxImageEdge);
      
      cnv.density.base = exportDensity;
      p.pixelDensity(exportDensity);
      setupBuffers();
      wireFactories();
      
      await fn();
    } finally {
      cnv.density.base = savedBase;
      p.pixelDensity(1);
      setupBuffers();
      wireFactories();
      drawCanvas();
    }
  }

  function doExportPNG() {
    withHighResExport(() => {
      drawCanvas();
      const w = Math.floor(cnv.width * cnv.density.base);
      const h = Math.floor(cnv.height * cnv.density.base);
      
      const copy = document.createElement('canvas');
      copy.width = w;
      copy.height = h;
      const copyCtx = copy.getContext('2d');
      copyCtx.drawImage(gradBuffer.canvas, 0, 0, w, h);
      
      const link = document.createElement('a');
      link.download = `difuso-${timestamp()}.png`;
      link.href = copy.toDataURL('image/png');
      link.click();
    });
  }

  // Seeks the source video to this export frame's timestamp and waits for the
  // browser to actually decode it before drawCanvas() reads a texture from
  // the video element. video.time(...) (= elt.currentTime = ...) is
  // asynchronous — the element only fires 'seeked' once the requested frame
  // is decoded — and drawCanvas() just samples whatever frame the element
  // currently has, live. Seeking without waiting (the previous behavior) let
  // the export loop outrun the decoder, so every exported frame was whatever
  // frame happened to be decoded yet: a slideshow instead of smooth video.
  // A 200ms cap keeps a stalled/looping seek (observed on some codecs right
  // at a video's start/end) from hanging the whole export.
  function beforeVideoFrame(frameNum) {
    if (rec.type !== 'video' || !recVideo.active) return Promise.resolve();
    const vid = rec.video;
    if (!vid || typeof vid.time !== 'function') return Promise.resolve();
    const el = vid.elt;

    vid.time(frameNum / rec.frameRate);
    if (el.seeking === false) return Promise.resolve();

    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.removeEventListener('seeked', finish);
        resolve();
      };
      el.addEventListener('seeked', finish, { once: true });
      setTimeout(finish, 200);
    });
  }

  // Advances motion.frame synchronously to match the export frame number.
  // Unlike beforeVideoFrame, no async wait is needed: motion.frame is a plain
  // counter read directly by objects.js's previewGraphics(), not tied to
  // browser-decoded media that needs time to catch up.
  function beforeObjectFrame(frameNum) {
    if (rec.type !== 'object') return Promise.resolve();
    motion.frame = frameNum;
    return Promise.resolve();
  }

  function doExportMP4() {
    recVideo.seconds = readMp4Length();
    const savedMotionFrame = motion.frame;
    return withHighResExport(() =>
      exportMP4({
        p,
        prefix: 'difuso',
        cnv,
        rec,
        recVideo,
        drawComposite: drawCanvas,
        beforeDraw: rec.type === 'object' ? beforeObjectFrame : beforeVideoFrame,
        setStatus,
        getCanvas: () => gradBuffer.canvas,
        getSize: () => ({
          w: Math.floor(cnv.width * cnv.density.base),
          h: Math.floor(cnv.height * cnv.density.base)
        })
      })
    ).finally(() => {
      motion.frame = savedMotionFrame;
    });
  }

  function readMp4Length() {
    const sel = document.getElementById('df-mp4-length');
    const v = sel ? parseInt(sel.value, 10) : 4;
    return Number.isFinite(v) ? v : 4;
  }

  function bindFooter() {
    document.getElementById('df-btn-save-png')?.addEventListener('click', doExportPNG);
    document.getElementById('df-btn-save-mp4')?.addEventListener('click', doExportMP4);
    document.getElementById('df-mp4-length')?.addEventListener('change', (e) => {
      recVideo.seconds = parseInt(e.target.value, 10);
    });
    document.getElementById('df-preset')?.addEventListener('change', (e) => {
      const preset = PRESETS[e.target.value];
      if (preset) applyPreset(preset);
    });
    // df-ascii-font has NO regen tag (controls.js): font loading is async, so
    // it's wired via a dedicated change listener that resolves the URL and
    // reloads the font (which rebuilds the glyph box + atlas internally).
    document.getElementById('df-ascii-font')?.addEventListener('change', (e) => {
      ascii.fontname = e.target.value;
      asciiCtl
        .loadFont(fontUrl(ascii.fontname))
        .then(() => saveState())
        .catch((err) => console.warn('[difuso] font load failed:', err));
    });
  }

  // Drag-and-drop image/video onto the canvas (reference feature). source.js
  // owns the file-type dispatch; app.js only wires the DOM listeners (matching
  // DIVIX's customShape drag-and-drop pattern). After an image/video load
  // settles we resize the canvas to the new source's aspect ratio.
  function bindDragDrop() {
    if (!canvasContainer) return;
    canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
    canvasContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      loadSourceFile(file);
    });
  }

  // Wires the hidden #df-obj-file-input (opened via the "3D Object" panel's
  // upload button, see applyChange's 'uploadModel' action) to the shared
  // loadModelFile path.
  function bindObjectUpload() {
    document.getElementById('df-obj-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) loadModelFile(file);
      e.target.value = '';
    });
  }

  // Route a dropped file through source.js and, once loaded, resize to fit the
  // new source. source.handleDroppedFile fires the load but doesn't await it, so
  // dispatch by type here to know when to resize.
  function loadSourceFile(file) {
    const name = file.name.toLowerCase();
    if (file.type.startsWith('image/')) {
      source
        .loadImageFile(file)
        .then(() => resizeCanvas())
        .catch((err) => {
          console.warn('[difuso] image load failed:', err);
          setStatus('Image load failed');
        });
    } else if (/^video\/(mp4|webm|quicktime)/.test(file.type)) {
      source
        .loadVideoFile(URL.createObjectURL(file))
        .then(() => resizeCanvas())
        .catch((err) => {
          console.warn('[difuso] video load failed:', err);
          setStatus('Video load failed');
        });
    } else if (name.endsWith('.obj') || name.endsWith('.stl')) {
      loadModelFile(file);
    } else {
      setStatus('Unsupported file type');
    }
  }

  // Load a .obj/.stl model via objects.js, mirroring how loadSourceFile wraps
  // source.js's image/video loaders. Shared by the file-input change handler
  // and drag-and-drop (both funnel model files here).
  function loadModelFile(file) {
    objectsCtl
      .loadModelFile(file)
      .then(() => {
        resizeCanvas();
        syncUIFromState();
        saveState();
      })
      .catch((err) => {
        console.warn('[difuso] model load failed:', err);
        setStatus('Model load failed');
      });
  }

  // ---- Graphics helpers ----
  function disposeGraphics(g) {
    // p5.Graphics.remove() throws in instance mode; guard it so a failed
    // dispose can't abort a resize.
    if (g && typeof g.remove === 'function') {
      try {
        g.remove();
      } catch {
        /* remove() may throw in instance mode — ignore */
      }
    }
  }

  function hideGraphics(g) {
    const elements = [g?.elt, g?.canvas, g?._renderer?.elt, g?._renderer?.canvas];
    for (const element of elements) {
      if (!element?.style) continue;
      element.style.display = 'none';
      element.setAttribute('aria-hidden', 'true');
    }
  }

  // Load only the noise tier currently selected (noise16/32/64/128). Other
  // tiers load on first switch — saves ~200 KB of PNG decode on startup.
  // Concurrent callers for the same tier share one in-flight promise.
  const noiseTierPending = new Map();
  function ensureNoiseTier(tier) {
    if (!NOISE_MANIFEST[tier]) return Promise.resolve();
    if (loadedNoiseTiers.has(tier)) return Promise.resolve();
    if (noiseTierPending.has(tier)) return noiseTierPending.get(tier);

    const files = NOISE_MANIFEST[tier];
    noiseTextures[tier] = new Array(files.length);
    const promise = Promise.all(
      files.map((file, i) => {
        const url = `${import.meta.env.BASE_URL}assets/difuso/textures/${tier}/${file}`;
        return p.loadImage(url).then((img) => {
          noiseTextures[tier][i] = img;
        });
      })
    )
      .then(() => {
        loadedNoiseTiers.add(tier);
      })
      .catch((e) => {
        console.warn(`[difuso] noise tier ${tier} load failed:`, e);
        throw e;
      })
      .finally(() => {
        noiseTierPending.delete(tier);
      });

    noiseTierPending.set(tier, promise);
    return promise;
  }

  // ---- p5 lifecycle ----
  p.setup = () => {
    canvasContainer = document.getElementById('difuso-canvas');
    if (!canvasContainer) return;

    const canvas = p.createCanvas(
      canvasContainer.clientWidth || window.innerWidth,
      canvasContainer.clientHeight || window.innerHeight,
      p.WEBGL
    );
    canvas.parent(canvasContainer);
    objectsCtl = createObjects({ p, state });
    // Must match cnv.density.base (setupBuffers() below): the dither/halftone
    // shaders read p.pixelDensity() to size their UV grid against the effect
    // buffers. A mismatch here doesn't error, it just makes the shader think
    // the buffer is a different resolution than it really is, which makes
    // its pattern wrap and tile across the canvas.
    p.pixelDensity(cnv.density.base);
    p.imageMode(p.CENTER);
    p.noStroke();
    p.frameRate(rec.frameRate);

    const restored = loadState();

    // Fetch presets + only the default noise tier; other tiers load on demand.
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}assets/difuso/presets.json`)
        .then((r) => r.json())
        .then((d) => {
          PRESETS = d;
        })
        .catch((e) => console.warn('[difuso] presets load failed:', e)),
      ensureNoiseTier(dither.noise || 'noise64').catch((e) =>
        console.warn('[difuso] noise textures load failed:', e)
      ),
    ]).finally(() => {
      // Create the source loader, load the default image, size the canvas and
      // wire everything once the source resolves.
      source = createSource({
        p,
        state,
        defaultImageUrl: `${import.meta.env.BASE_URL}assets/difuso/default.webp`,
        onUnsupported: () => setStatus('Unsupported file type'),
      });

      source
        .loadDefaultImage()
        .catch((e) => {
          console.warn('[difuso] default image load failed:', e);
          setStatus('Default image failed to load');
        })
        .finally(() => {
          calculateCanvasSize();
          setupBuffers();
          wireFactories();

          // Load the initial font (async), then build the glyph atlas.
          // loadState() may have restored a non-default noise tier — ensure it
          // before building the dither tile.
          const noiseReady =
            dither.type === 'noise'
              ? ensureNoiseTier(dither.noise)
              : Promise.resolve();

          Promise.all([
            asciiCtl.loadFont(fontUrl(ascii.fontname)).catch((e) =>
              console.warn('[difuso] font load failed:', e)
            ),
            noiseReady.catch((e) => console.warn('[difuso] noise load failed:', e)),
          ]).finally(() => {
            gradientCtl.applySelectedPalette();
            if (dither.type === 'matrix' || dither.type === 'noise') {
              ditherCtl.buildDitherTexture();
            }

            buildUI();
            bindFooter();
            bindDragDrop();
            bindObjectUpload();

            const keys = Object.keys(PRESETS);
            const finish = () => {
              dirty.markDirty();
              isReady = true;
            };

            if (restored) {
              syncUIFromState();
              // Restored state may still need the noise tier above; rebuild once
              // more after ensure (already awaited in noiseReady).
              if (dither.type === 'noise') ditherCtl.buildDitherTexture();
              finish();
            } else if (keys.length) {
              const pick = keys[Math.floor(Math.random() * keys.length)];
              applyPreset(PRESETS[pick])
                .then(() => {
                  const sel = document.getElementById('df-preset');
                  if (sel) sel.value = pick;
                })
                .finally(finish);
            } else {
              syncUIFromState();
              finish();
            }
          });
        });
    });
  };

  p.draw = () => {
    if (!isReady || !gImg || !dithBuffer || !gradBuffer) return;
    if (rec.type !== 'object' && (!source || source.getCurrentTexture() === null)) return;

    // Static image + non-object: only redraw when dirty. Video/object/export
    // always need a live loop.
    const live =
      rec.type === 'video' || rec.type === 'object' || recVideo.active || dirty.needsDraw();
    if (!live) {
      dirty.afterDraw();
      return;
    }

    drawCanvas();
    dirty.consume();
    // Keep looping for video/object; pause static image after paint.
    if (rec.type === 'image' && !recVideo.active) {
      dirty.afterDraw();
    }
  };

  const onResize = debounce(() => {
    if (!canvasContainer) return;
    fitVisibleCanvas();
    if (isReady) resizeCanvas();
    dirty.markDirty();
  }, 200);

  p.windowResized = () => {
    onResize();
  };

  p.mouseDragged = () => {
    if (rec.type === 'object' && isReady && !isOverPanel('app-difuso', p.mouseX, p.mouseY)) {
      objectsCtl.handleMouseDragged();
      dirty.markDirty();
    }
  };

  p.mouseWheel = (event) => {
    if (rec.type === 'object' && isReady && !isOverPanel('app-difuso', p.mouseX, p.mouseY)) {
      event.preventDefault();
      objectsCtl.handleMouseWheel(event);
      dirty.markDirty();
    }
  };
}

export { difusoSketch };
