// SILUETA — poster/typography workspace. Orchestrates the three layers:
// extract.js (mask) → render.js (WEBGL silhouette) → layout.js (text), and
// composites paper bg → masked silhouette → text onto the visible canvas.
// Structure mirrors difuso/js/app.js (buffers, dirty-loop, panel, presets,
// export). See docs/superpowers/specs/2026-07-21-silueta-workspace-design.md.

import * as state from './state.js';
import { SECTIONS } from './controls.js';
import { extractFromBrightness } from './extract.js';
import { computeLayout } from './layout.js';
import { createRender } from './render.js';
import { exportSVG } from './svgExport.js';

import { createPersistence } from '../../shared/utils/persistence.js';
import { timestamp } from '../../shared/utils/datetime.js';
import { downloadPresetJSON, openPresetFile } from '../../shared/utils/presetIO.js';
import { deepMerge } from '../../shared/utils/deepMerge.js';
import { exportMP4 } from '../../shared/utils/exportMedia.js';
import { debounce } from '../../shared/utils/debounce.js';
import { createDirtyLoop } from '../../shared/utils/dirtyLoop.js';
import {
  createPanelBuilder,
  buildPresetSection,
  openSections,
} from '../../shared/ui/panelBuilder.js';

const STORAGE_KEY = 'silueta-tool';
const ANALYSIS_EDGE = 120; // long-edge px of the mask analysis buffer
const FONT_FAMILY = 'Inter, system-ui, sans-serif';

const { cnv, render, extract, layout, rec, RESOLUTIONS } = state;

export function siluetaSketch(p) {
  let canvasContainer;
  let sourceImage = null;   // full-res uploaded/default image
  let resizedSource = null; // source fit to the silhouette buffer
  let maskInfo = null;      // { mask, labels, components, w, h }
  let layoutItems = [];
  let textBuffer = null;    // P2D buffer for text (WEBGL can't use CSS fonts)
  let isReady = false;
  let PRESETS = {};
  const recVideo = { active: false, seconds: 4 };
  const dirty = createDirtyLoop(p);
  const renderer = createRender({ p, state });

  const panel = createPanelBuilder({
    state,
    applyChange,
    refreshVisibility,
    onSliderInput: () => dirty.markDirty(),
  });

  // ---- Deterministic PRNG (LCG) seeded from layout.seed for reproducibility. ----
  function makeRand(seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  // ---- Canvas sizing (poster ratio, independent of source aspect). ----
  function computeCanvasSize() {
    const res = RESOLUTIONS[cnv.ratio] || RESOLUTIONS['3:4'];
    const maxW = Math.min(window.innerWidth * 0.85, cnv.maxSize);
    const maxH = Math.min(window.innerHeight * 0.85, cnv.maxSize);
    const fit = Math.min(maxW / res.width, maxH / res.height);
    cnv.width = Math.max(2, Math.round((res.width * fit) / 2) * 2);
    cnv.height = Math.max(2, Math.round((res.height * fit) / 2) * 2);
  }

  // ---- Fit the source into a buffer-sized image (contain). ----
  function buildResizedSource() {
    if (!sourceImage) return;
    const r = Math.min(cnv.width / sourceImage.width, cnv.height / sourceImage.height);
    let nw = Math.max(2, Math.floor(sourceImage.width * r));
    let nh = Math.max(2, Math.floor(sourceImage.height * r));
    nw -= nw % 2; nh -= nh % 2;
    // Draw the source centered on a white canvas the size of the buffer, so the
    // mask coordinate space matches the silhouette buffer 1:1.
    const g = p.createImage(cnv.width, cnv.height);
    g.loadPixels();
    for (let i = 0; i < g.pixels.length; i++) g.pixels[i] = 255; // white
    g.updatePixels();
    const fitted = p.createImage(nw, nh);
    fitted.copy(sourceImage, 0, 0, sourceImage.width, sourceImage.height, 0, 0, nw, nh);
    g.copy(fitted, 0, 0, nw, nh, (cnv.width - nw) >> 1, (cnv.height - nh) >> 1, nw, nh);
    resizedSource = g;
  }

  // ---- Extraction: downscale resizedSource → brightness → mask + components. ----
  function runExtract() {
    if (!resizedSource) return;
    const scale = ANALYSIS_EDGE / Math.max(resizedSource.width, resizedSource.height);
    const aw = Math.max(1, Math.round(resizedSource.width * scale));
    const ah = Math.max(1, Math.round(resizedSource.height * scale));
    const small = p.createImage(aw, ah);
    small.copy(resizedSource, 0, 0, resizedSource.width, resizedSource.height, 0, 0, aw, ah);
    small.loadPixels();
    const brightness = new Uint8Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) {
      const j = i * 4;
      brightness[i] = (small.pixels[j] * 0.299 + small.pixels[j + 1] * 0.587 + small.pixels[j + 2] * 0.114) | 0;
    }
    const areaFloor = Math.max(2, Math.round(aw * ah * 0.002));
    maskInfo = extractFromBrightness(brightness, aw, ah, {
      threshold: extract.threshold,
      merge: extract.merge,
      areaFloor,
    });
    renderer.setMask(maskInfo);
  }

  // ---- Layout. ----
  function runLayout() {
    if (!maskInfo) { layoutItems = []; return; }
    layoutItems = computeLayout({
      w: cnv.width,
      h: cnv.height,
      maskInfo,
      state: layout,
      rand: makeRand(layout.seed),
    });
  }

  // ---- Full rebuild: size → resize source → extract → buffers → layout. ----
  function rebuildAll() {
    computeCanvasSize();
    buildResizedSource();
    renderer.buildBuffers(cnv.width, cnv.height, cnv.density.base);
    ensureTextBuffer();
    runExtract();
    runLayout();
    dirty.markDirty();
  }

  // ---- Compose the visible frame. ----
  function drawCanvas() {
    p.clear();
    p.push();
    // WEBGL origin is canvas center; shift left to center in the free area left
    // of the 290px panel (same discipline as difuso).
    p.translate(-145, 0);

    // Paper background.
    p.push();
    p.fill(255);
    p.noStroke();
    p.rectMode(p.CENTER);
    p.rect(0, 0, cnv.width, cnv.height);
    p.pop();

    // Masked silhouette.
    if (resizedSource) {
      const masked = renderer.renderSilhouette(resizedSource);
      p.image(masked, 0, 0, cnv.width, cnv.height);
    }

    // Text on top.
    drawText();
    p.pop();
  }

  // Text is rendered on a 2D (P2D) buffer, not directly on the WEBGL canvas:
  // p5's WEBGL text needs a loaded p5.Font (a CSS family string like 'Inter'
  // is rejected), whereas a 2D graphics buffer accepts CSS font strings and
  // the browser's own fonts — including CJK glyphs the poster mixes in. The
  // buffer is then blitted over the silhouette. It is (re)created to match the
  // canvas size in rebuildAll via ensureTextBuffer().
  function ensureTextBuffer() {
    const density = cnv.density.base;
    if (
      textBuffer &&
      textBuffer.width === cnv.width &&
      textBuffer.height === cnv.height &&
      textBuffer.pixelDensity() === density
    ) return;
    if (textBuffer && typeof textBuffer.remove === 'function') {
      try { textBuffer.remove(); } catch { /* instance-mode remove may throw */ }
    }
    textBuffer = p.createGraphics(cnv.width, cnv.height); // P2D
    textBuffer.pixelDensity(density);
    const els = [textBuffer.elt, textBuffer.canvas];
    for (const el of els) {
      if (el?.style) { el.style.display = 'none'; el.setAttribute?.('aria-hidden', 'true'); }
    }
  }

  function drawText() {
    if (!textBuffer) return;
    const g = textBuffer;
    g.clear();
    g.textFont(FONT_FAMILY);
    g.textAlign(p.LEFT, p.BASELINE);
    g.noStroke();
    for (const it of layoutItems) {
      if (it.role === 'small' && it.placed === false) continue; // unplaceable caption
      if (it.role === 'main') {
        g.fill(layout.main.color);
        g.textStyle(p.BOLD);
      } else {
        g.fill('#333333');
        g.textStyle(p.NORMAL);
      }
      g.textSize(it.size);
      g.text(it.text, it.x, it.y);
    }
    // Blit centered onto the WEBGL canvas (origin at center).
    p.image(g, 0, 0, cnv.width, cnv.height);
  }

  // ---- Change dispatch. ----
  function applyChange(ctrl) {
    switch (ctrl.regen) {
      case 'canvas': rebuildAll(); break;
      case 'extract': runExtract(); runLayout(); break;
      case 'effect': /* fallthrough to render + visibility */
      case 'render': /* buffer params only */ break;
      case 'layout': runLayout(); break;
    }
    refreshVisibility();
    dirty.markDirty();
    saveState();
  }

  function refreshVisibility() {
    const colorEl = document.getElementById('sl-sil-color');
    if (colorEl) colorEl.disabled = render.effect === 'none';
  }

  function syncUIFromState() {
    panel.syncUIFromState(SECTIONS);
    refreshVisibility();
  }

  // ---- Panel. ----
  function buildUI() {
    const root = document.getElementById('sl-controls');
    if (!root) return;
    root.innerHTML = '';
    buildPresetSection(root, {
      idPrefix: 'sl',
      presets: PRESETS,
      onExport: exportPreset,
      onImport: importPreset,
    });
    panel.buildSections(root, SECTIONS);
    openSections(root, [1, 2]); // Silhouette + Layout open by default
    refreshVisibility();
  }

  // ---- Persistence. ----
  function serializeState() {
    return {
      cnv: { ratio: cnv.ratio, scale: cnv.scale, density: { export: cnv.density.export } },
      render: JSON.parse(JSON.stringify(render)),
      extract: JSON.parse(JSON.stringify(extract)),
      layout: JSON.parse(JSON.stringify(layout)),
      rec: { quality: rec.quality },
    };
  }
  const { saveState, loadState } = createPersistence(STORAGE_KEY, 'silueta', serializeState, (data) => {
    if (data.cnv) deepMerge(cnv, data.cnv);
    if (data.render) deepMerge(render, data.render);
    if (data.extract) deepMerge(extract, data.extract);
    if (data.layout) deepMerge(layout, data.layout);
    if (data.rec) deepMerge(rec, data.rec);
  });

  function applyPreset(preset) {
    if (!preset) return;
    if (preset.cnv) deepMerge(cnv, preset.cnv);
    if (preset.render) deepMerge(render, preset.render);
    if (preset.extract) deepMerge(extract, preset.extract);
    if (preset.layout) deepMerge(layout, preset.layout);
    rebuildAll();
    syncUIFromState();
    saveState();
  }
  function exportPreset() { downloadPresetJSON(`silueta-preset-${timestamp()}.json`, serializeState()); }
  function importPreset() { openPresetFile((d) => applyPreset(d), () => setStatus('Invalid preset file')); }

  // ---- Export. ----
  function setStatus(msg) {
    const el = document.getElementById('sl-export-status');
    if (el) el.innerText = msg;
  }

  function withHighRes(fn) {
    const savedBase = cnv.density.base;
    try {
      const maxEdge = Math.max(cnv.width, cnv.height);
      const target = cnv.density.export || 2000;
      // Whole-number density only: p5 sizes buffer backing stores by
      // width * density, and a fractional density yields a non-integer row
      // stride that the pixel-gate in render.js cannot index safely.
      const d = Math.max(1, Math.round(target / maxEdge));
      cnv.density.base = d;
      p.pixelDensity(d);
      renderer.buildBuffers(cnv.width, cnv.height, d);
      renderer.setMask(maskInfo);
      ensureTextBuffer();
      fn(d);
    } finally {
      cnv.density.base = savedBase;
      p.pixelDensity(savedBase);
      renderer.buildBuffers(cnv.width, cnv.height, savedBase);
      renderer.setMask(maskInfo);
      ensureTextBuffer();
      drawCanvas();
    }
  }

  function doExportPNG() {
    withHighRes((d) => {
      drawCanvas();
      const w = Math.floor(cnv.width * d);
      const h = Math.floor(cnv.height * d);
      const copy = document.createElement('canvas');
      copy.width = w; copy.height = h;
      copy.getContext('2d').drawImage(p.canvas, 0, 0, w, h);
      const link = document.createElement('a');
      link.download = `silueta-${timestamp()}.png`;
      link.href = copy.toDataURL('image/png');
      link.click();
    });
  }

  function doExportSVG() {
    exportSVG({
      w: cnv.width,
      h: cnv.height,
      maskInfo,
      render,
      layoutItems,
      fontFamily: FONT_FAMILY,
    });
  }

  function doExportMP4() {
    const sel = document.getElementById('sl-mp4-length');
    recVideo.seconds = sel ? parseInt(sel.value, 10) || 4 : 4;
    const baseSeed = layout.seed;
    let frame = 0;
    return exportMP4({
      p, prefix: 'silueta', cnv, rec, recVideo,
      drawComposite: drawCanvas,
      beforeDraw: (n) => {
        // Subtle seeded drift so the clip has motion: re-jitter the layout each
        // frame from a moving seed.
        frame = n;
        layout.seed = baseSeed + frame;
        runLayout();
        return Promise.resolve();
      },
      setStatus,
      getCanvas: () => p.canvas,
      getSize: () => ({ w: Math.floor(cnv.width * cnv.density.base), h: Math.floor(cnv.height * cnv.density.base) }),
    }).finally(() => { layout.seed = baseSeed; runLayout(); dirty.markDirty(); });
  }

  function bindFooter() {
    document.getElementById('sl-btn-save-svg')?.addEventListener('click', doExportSVG);
    document.getElementById('sl-btn-save-png')?.addEventListener('click', doExportPNG);
    document.getElementById('sl-btn-save-mp4')?.addEventListener('click', doExportMP4);
    document.getElementById('sl-preset')?.addEventListener('change', (e) => {
      const preset = PRESETS[e.target.value];
      if (preset) applyPreset(preset);
    });
  }

  function bindDragDrop() {
    if (!canvasContainer) return;
    canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
    canvasContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) loadImageFile(file);
    });
  }

  function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        sourceImage = await p.loadImage(ev.target.result);
        rebuildAll();
      } catch (err) {
        console.warn('[silueta] image load failed:', err);
        setStatus('Image load failed');
      }
    };
    reader.readAsDataURL(file);
  }

  // ---- p5 lifecycle. ----
  p.setup = () => {
    canvasContainer = document.getElementById('silueta-canvas');
    if (!canvasContainer) return;
    const canvas = p.createCanvas(
      canvasContainer.clientWidth || window.innerWidth,
      canvasContainer.clientHeight || window.innerHeight,
      p.WEBGL
    );
    canvas.parent(canvasContainer);
    p.pixelDensity(cnv.density.base);
    p.imageMode(p.CENTER);
    p.rectMode(p.CENTER);
    p.noStroke();
    p.frameRate(rec.frameRate);

    const restored = loadState();

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}assets/silueta/presets.json`).then((r) => r.json()).then((d) => { PRESETS = d; }).catch(() => {}),
      p.loadImage(`${import.meta.env.BASE_URL}assets/silueta/default.webp`).then((img) => { sourceImage = img; }).catch((e) => console.warn('[silueta] default image load failed:', e)),
    ]).finally(() => {
      rebuildAll();
      buildUI();
      bindFooter();
      bindDragDrop();
      if (restored) syncUIFromState();
      isReady = true;
      dirty.markDirty();
    });
  };

  p.draw = () => {
    if (!isReady) return;
    const live = recVideo.active || dirty.needsDraw();
    if (!live) { dirty.afterDraw(); return; }
    drawCanvas();
    dirty.consume();
    if (!recVideo.active) dirty.afterDraw();
  };

  const onResize = debounce(() => {
    if (!canvasContainer) return;
    p.resizeCanvas(canvasContainer.clientWidth || window.innerWidth, canvasContainer.clientHeight || window.innerHeight);
    if (isReady) rebuildAll();
  }, 200);
  p.windowResized = () => onResize();
}

export { siluetaSketch as default };
