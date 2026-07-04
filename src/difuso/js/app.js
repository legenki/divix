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
import { SECTIONS } from './controls.js';

import { createPersistence } from '../../shared/utils/persistence.js';
import { timestamp } from '../../shared/utils/datetime.js';
import { downloadPresetJSON, openPresetFile } from '../../shared/utils/presetIO.js';
import { deepMerge } from '../../shared/utils/deepMerge.js';
import { exportMP4 } from '../../shared/utils/exportMedia.js';
import {
  createPanelBuilder,
  buildPresetSection,
  openSections,
} from '../../shared/ui/panelBuilder.js';

const STORAGE_KEY = 'difuso-tool';

const { cnv, ascii, dither, gradient, rec, FONT_TYPES, COLOR_PALETTES } = state;

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
  let noiseTextures = null; // { noise16: p5.Image[4], ... }
  const recVideo = { active: false, seconds: 4 };

  // ---- Factories (wired after buffers + assets exist, in setup) ----
  let source = null;
  let ditherCtl = null;
  let halftoneCtl = null;
  let asciiCtl = null;
  let gradientCtl = null;

  // ---- Font-path resolution ----
  // FONT_TYPES[label] is a relative path like 'assets/font/font_atascii.ttf';
  // resolve to the actual public/ location `/assets/difuso/fonts/<basename>`.
  function fontUrl(fontname) {
    const rel = FONT_TYPES[fontname] || FONT_TYPES['Public Pixel'];
    const basename = rel.split('/').pop();
    return `${import.meta.env.BASE_URL}assets/difuso/fonts/${basename}`;
  }

  // ---- Panel UI ----
  const panel = createPanelBuilder({ state, applyChange, refreshVisibility });

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
    switch (ctrl.regen) {
      case 'canvas':
        // Canvas ratio isn't a fixed resolution here (calculateCanvasSize fits
        // the source to the window); the ratio slider is inert for sizing but
        // we resize buffers to stay consistent with any source change.
        resizeCanvas();
        break;
      case 'ditherType':
        // New dither.type: rebuild whatever generated texture it needs. Only
        // 'matrix'/'noise' have a dither tile; 'ascii' has a glyph atlas.
        if (dither.type === 'matrix' || dither.type === 'noise') {
          ditherCtl.buildDitherTexture();
        } else if (dither.type === 'ascii') {
          asciiCtl.buildGlyphTexture();
        }
        break;
      case 'ditherTexture':
        // matrix/scale/noise/texture changed — rebuild the Bayer/noise tile.
        // Guarded: buildDitherTexture throws for non-matrix/noise types.
        if (dither.type === 'matrix' || dither.type === 'noise') {
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
    const source0 = source ? source.getCurrentTexture() : null;
    const targetWidth = source0 ? source0.width : cnv.width;
    const targetHeight = source0 ? source0.height : cnv.height;
    if (!targetWidth || !targetHeight) return;

    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    const ui = 640 < winWidth - cnv.uiSize * 2 ? cnv.uiSize : 0;
    const availWidth = winWidth - ui * 2;

    const maxWidth = Math.min(availWidth * cnv.scale, cnv.maxSize);
    const maxHeight = Math.min(winHeight * cnv.scale, cnv.maxSize);
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
      defaultImageUrl: `${import.meta.env.BASE_URL}assets/difuso/default-image.webp`,
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
  function resizeCanvas() {
    calculateCanvasSize();
    setupBuffers();
    wireFactories();
    rebuildGeneratedTextures();
  }

  // Rebuild the glyph atlas / dither tile / gradient ramp for the current state,
  // after the factories are (re)wired. Font must already be loaded.
  function rebuildGeneratedTextures() {
    if (state.ascii.font) {
      asciiCtl.measureGlyphBox();
      asciiCtl.buildGlyphTexture();
    }
    if (dither.type === 'matrix' || dither.type === 'noise') {
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
        if (recVideo.active && typeof vid.time === 'function') {
          vid.pause();
          vid.time(cnv.frame / rec.frameRate);
        }
        gImg.clear();
        gImg.texture(vid);
        gImg.plane(gImg.width, gImg.height);
      }
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
    // CENTER, not the top-left. gradBuffer is already sized by
    // calculateCanvasSize() to fit the window minus UI chrome, so blit it at
    // its NATURAL size — scaling it up to the viewport here (the old
    // fit-to-canvas math) stretched the image edge-to-edge and hid the margins
    // the reference shows. Mirror centerCanvas(): shift left by the UI offset
    // when the window is wide enough for the side panel.
    const ui = 640 <= p.width - cnv.uiSize * 2 ? cnv.uiSize : 0;
    p.image(gradBuffer, -ui, 0, gradBuffer.width, gradBuffer.height);
  }

  // ---- Presets ----
  // Merge the effect state a preset carries (dither/ascii/gradient/cnv), ignore
  // the 3D-only obj/motion blocks and the bundled colorPalette map (state.js
  // already owns COLOR_PALETTES), then rebuild everything. The preset's
  // gradient.palette drives which built-in palette populates the working swatch
  // colours via applySelectedPalette() — matching the reference's applyPalette().
  function applyPreset(preset) {
    if (!preset) return;
    if (preset.cnv) deepMerge(cnv, preset.cnv);
    if (preset.dither) deepMerge(dither, preset.dither);
    if (preset.ascii) deepMerge(ascii, preset.ascii);
    if (preset.gradient) deepMerge(gradient, preset.gradient);

    resizeCanvas();

    // Load the preset's font (async), then rebuild the glyph atlas. Font load
    // resolves independently; the ramp/tile were already rebuilt by resizeCanvas.
    asciiCtl.loadFont(fontUrl(ascii.fontname)).catch((e) =>
      console.warn('[difuso] font load failed:', e)
    );

    // Populate working swatch colours from the selected built-in palette, then
    // rebuild the ramp (applySelectedPalette does the rebuild internally).
    gradientCtl.applySelectedPalette();

    syncUIFromState();
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

  function doExportMP4() {
    recVideo.seconds = readMp4Length();
    return withHighResExport(() => {
      return exportMP4({
        p,
        prefix: 'difuso',
        cnv,
        rec,
        recVideo,
        drawComposite: drawCanvas,
        setStatus,
        getCanvas: () => gradBuffer.canvas,
        getSize: () => ({
          w: Math.floor(cnv.width * cnv.density.base),
          h: Math.floor(cnv.height * cnv.density.base)
        })
      });
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

  // Route a dropped file through source.js and, once loaded, resize to fit the
  // new source. source.handleDroppedFile fires the load but doesn't await it, so
  // dispatch by type here to know when to resize.
  function loadSourceFile(file) {
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
    } else {
      setStatus('Unsupported file type');
    }
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

  // Load the 4 noise tiles for each tier in parallel.
  function loadNoiseTextures() {
    const tiers = Object.keys(NOISE_MANIFEST);
    const out = {};
    const jobs = [];
    for (const tier of tiers) {
      out[tier] = new Array(NOISE_MANIFEST[tier].length);
      NOISE_MANIFEST[tier].forEach((file, i) => {
        const url = `${import.meta.env.BASE_URL}assets/difuso/textures/${tier}/${file}`;
        jobs.push(
          p.loadImage(url).then((img) => {
            out[tier][i] = img;
          })
        );
      });
    }
    return Promise.all(jobs).then(() => out);
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

    // Fetch presets, load noise textures + the default source image + initial
    // font in parallel; gate the draw loop on all of them.
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}assets/difuso/presets.json`)
        .then((r) => r.json())
        .then((d) => {
          PRESETS = d;
        })
        .catch((e) => console.warn('[difuso] presets load failed:', e)),
      loadNoiseTextures()
        .then((tex) => {
          noiseTextures = tex;
        })
        .catch((e) => console.warn('[difuso] noise textures load failed:', e)),
    ]).finally(() => {
      // Create the source loader, load the default image, size the canvas and
      // wire everything once the source resolves.
      source = createSource({
        p,
        state,
        defaultImageUrl: `${import.meta.env.BASE_URL}assets/difuso/default-image.webp`,
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
          asciiCtl
            .loadFont(fontUrl(ascii.fontname))
            .catch((e) => console.warn('[difuso] font load failed:', e))
            .finally(() => {
              gradientCtl.applySelectedPalette();
              if (dither.type === 'matrix' || dither.type === 'noise') {
                ditherCtl.buildDitherTexture();
              }

              buildUI();
              bindFooter();
              bindDragDrop();

              const keys = Object.keys(PRESETS);
              if (restored) {
                syncUIFromState();
              } else if (keys.length) {
                const pick = keys[Math.floor(Math.random() * keys.length)];
                applyPreset(PRESETS[pick]);
                const sel = document.getElementById('df-preset');
                if (sel) sel.value = pick;
              } else {
                syncUIFromState();
              }
              isReady = true;
            });
        });
    });
  };

  p.draw = () => {
    if (!isReady || !gImg || !dithBuffer || !gradBuffer) return;
    if (!source || source.getCurrentTexture() === null) return;
    drawCanvas();
  };

  p.windowResized = () => {
    if (!canvasContainer) return;
    fitVisibleCanvas();
    if (isReady) resizeCanvas();
  };
}

export { difusoSketch };
