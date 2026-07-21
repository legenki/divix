// SILUETA — poster/typography workspace. Composes a poster on a responsive
// grid: gridLayout.js packs image / headline / caption blocks into cells,
// extract.js + render.js turn each image block into a pixelated or halftoned
// silhouette, and the text blocks are set with variable fonts on a P2D buffer.
// Structure mirrors difuso/js/app.js (buffers, dirty-loop, panel, presets,
// export). See docs/superpowers/specs/2026-07-21-silueta-workspace-design.md.

import * as state from './state.js';
import { SECTIONS } from './controls.js';
import { extractFromBrightness } from './extract.js';
import { composeGrid, wrapText } from './gridLayout.js';
import { createRender } from './render.js';
import { exportGridSVG } from './svgExport.js';
import { createMediaLibrary } from './media.js';
import { buildMediaSection } from './mediaPanel.js';
import { ensureFont, variationSettings, hasAxis, AXIS_TAGS } from './fonts.js';

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
const FALLBACK_FONT = 'system-ui, sans-serif';
const BLOCK_PAD = 6;       // px inset so blocks don't touch cell edges

const { cnv, render, extract, layout, rec, RESOLUTIONS } = state;

export function siluetaSketch(p) {
  let canvasContainer;
  // Packed blocks from gridLayout.composeGrid; each carries its own pixel
  // geometry (x/y/w/h), so the grid itself doesn't need to be kept around.
  let blocks = [];
  // Per-image-block silhouette cache: entry.key -> { masked, w, h, sig }.
  // Extraction + shader work is the expensive part, so a block is only
  // re-rendered when its size or the effect parameters actually change.
  const silCache = new Map();
  let textBuffer = null;    // P2D buffer for text (WEBGL can't use CSS fonts)
  let isReady = false;
  let PRESETS = {};
  const recVideo = { active: false, seconds: 4 };
  const dirty = createDirtyLoop(p);
  const renderer = createRender({ p, state });
  const media = createMediaLibrary({
    p,
    baseUrl: `${import.meta.env.BASE_URL}assets/silueta/media/`,
  });

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

  // ---- Grid composition. ----
  // Packs image/headline/caption blocks into the responsive grid. Changing the
  // canvas ratio or any block count reshapes the grid (see gridLayout.makeGrid).
  function runLayout() {
    const composed = composeGrid({
      w: cnv.width,
      h: cnv.height,
      images: media.active(),
      imageCount: layout.counts.images,
      mainText: layout.main.text,
      smallText: layout.small.text,
      mainCount: layout.counts.main,
      smallCount: layout.counts.small,
      rand: makeRand(layout.seed),
    });
    blocks = composed.blocks;
  }

  // ---- Per-block silhouette. ----
  // Each image block is extracted and shaded at its own cell size. Results are
  // cached on a signature of everything that affects the pixels, so dragging an
  // unrelated slider (or re-drawing a frame) costs nothing.
  function silhouetteFor(block) {
    const entry = block.entry;
    if (!entry?.ready || !entry.img) return null;

    const bw = Math.max(2, Math.round(block.w - BLOCK_PAD * 2));
    const bh = Math.max(2, Math.round(block.h - BLOCK_PAD * 2));
    const sig = [
      bw, bh, render.effect, render.granularity, render.color,
      render.keepOriginal, extract.threshold, extract.merge, cnv.density.base,
    ].join('|');

    const hit = silCache.get(entry.key);
    if (hit && hit.sig === sig) return hit.img;

    // Fit the source into the block, centred on white so the mask's coordinate
    // space matches the rendered buffer 1:1.
    const fitScale = Math.min(bw / entry.img.width, bh / entry.img.height);
    const fw = Math.max(2, Math.floor(entry.img.width * fitScale));
    const fh = Math.max(2, Math.floor(entry.img.height * fitScale));
    const plate = p.createImage(bw, bh);
    plate.loadPixels();
    for (let i = 0; i < plate.pixels.length; i++) plate.pixels[i] = 255;
    plate.updatePixels();
    const fitted = p.createImage(fw, fh);
    fitted.copy(entry.img, 0, 0, entry.img.width, entry.img.height, 0, 0, fw, fh);
    plate.copy(fitted, 0, 0, fw, fh, (bw - fw) >> 1, (bh - fh) >> 1, fw, fh);

    // Extract this block's mask at analysis resolution.
    const scale = ANALYSIS_EDGE / Math.max(bw, bh);
    const aw = Math.max(1, Math.round(bw * scale));
    const ah = Math.max(1, Math.round(bh * scale));
    const small = p.createImage(aw, ah);
    small.copy(plate, 0, 0, bw, bh, 0, 0, aw, ah);
    small.loadPixels();
    const brightness = new Uint8Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) {
      const j = i * 4;
      brightness[i] = (small.pixels[j] * 0.299 + small.pixels[j + 1] * 0.587 + small.pixels[j + 2] * 0.114) | 0;
    }
    const maskInfo = extractFromBrightness(brightness, aw, ah, {
      threshold: extract.threshold,
      merge: extract.merge,
      areaFloor: Math.max(2, Math.round(aw * ah * 0.002)),
    });

    // Shade it, then snapshot: the renderer reuses one buffer per call, so the
    // result must be copied before the next block overwrites it.
    renderer.buildBuffers(bw, bh, cnv.density.base);
    renderer.setMask(maskInfo);
    const masked = renderer.renderSilhouette(plate);
    const snapshot = p.createImage(masked.width, masked.height);
    snapshot.copy(masked, 0, 0, masked.width, masked.height, 0, 0, masked.width, masked.height);

    silCache.set(entry.key, { sig, img: snapshot, mask: maskInfo });
    return snapshot;
  }

  /** Drop cached silhouettes (call when block geometry or effect params change). */
  function invalidateSilhouettes() {
    silCache.clear();
  }

  // ---- Full rebuild: size → grid → buffers. ----
  function rebuildAll() {
    computeCanvasSize();
    ensureTextBuffer();
    runLayout();
    invalidateSilhouettes();
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

    // Image blocks: each silhouette is drawn into its own grid cell. WEBGL's
    // origin is the canvas centre, so cell coordinates are offset by half.
    const ox = -cnv.width / 2;
    const oy = -cnv.height / 2;
    p.push();
    p.imageMode(p.CORNER);
    for (const block of blocks) {
      if (block.kind !== 'image') continue;
      const img = silhouetteFor(block);
      if (!img) continue;
      p.image(img, ox + block.x + BLOCK_PAD, oy + block.y + BLOCK_PAD,
        block.w - BLOCK_PAD * 2, block.h - BLOCK_PAD * 2);
    }
    p.pop();

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

  /**
   * Apply a variable-font style to the buffer's 2D context. p5 has no API for
   * font-variation-settings, so the axes are set on the underlying context —
   * this is what makes the same family read as hairline-condensed or black.
   */
  function applyFontStyle(g, style, sizePx) {
    const family = style.font;
    const ready = document.fonts?.check?.(`12px "${family}"`);
    const stack = ready ? `"${family}", ${FALLBACK_FONT}` : FALLBACK_FONT;
    const ctx = g.drawingContext;
    ctx.font = `${sizePx}px ${stack}`;
    ctx.fontVariationSettings = variationSettings(family, style) || 'normal';
  }

  function drawText() {
    if (!textBuffer) return;
    const g = textBuffer;
    g.clear();
    g.noStroke();
    g.textAlign(p.LEFT, p.TOP);

    for (const block of blocks) {
      if (block.kind === 'main') drawMainBlock(g, block);
      else if (block.kind === 'small') drawSmallBlock(g, block);
    }

    // Blit centered onto the WEBGL canvas (origin at center).
    p.image(g, 0, 0, cnv.width, cnv.height);
  }

  /** Headline: shrink-to-fit within the block, set in the main variable font. */
  function drawMainBlock(g, block) {
    const maxW = block.w - BLOCK_PAD * 2;
    const maxH = block.h - BLOCK_PAD * 2;
    if (maxW <= 4 || maxH <= 4) return;

    // Fit the fragment to the block: start from the requested size and step
    // down until it fits, so a long phrase in a 1x1 cell stays inside its box.
    let size = Math.min(layout.main.fontSize, maxH);
    applyFontStyle(g, layout.main, size);
    let guard = 0;
    while (size > 8 && guard < 60 && g.drawingContext.measureText(block.text).width > maxW) {
      size -= 1;
      applyFontStyle(g, layout.main, size);
      guard += 1;
    }

    g.fill(layout.main.color);
    g.drawingContext.textBaseline = 'top';
    g.drawingContext.fillText(
      block.text,
      block.x + BLOCK_PAD,
      block.y + BLOCK_PAD,
    );
  }

  /** Caption: wrapped body copy filling the block, in the small variable font. */
  function drawSmallBlock(g, block) {
    const maxW = block.w - BLOCK_PAD * 2;
    const maxH = block.h - BLOCK_PAD * 2;
    if (maxW <= 4 || maxH <= 4) return;

    const size = layout.small.fontSize;
    applyFontStyle(g, layout.small, size);
    const ctx = g.drawingContext;
    ctx.textBaseline = 'top';

    // Estimate characters per line from the font's actual average advance.
    const sample = ctx.measureText('abcdefghijklmnopqrstuvwxyz').width / 26 || size * 0.5;
    const charsPerLine = Math.max(6, Math.floor(maxW / sample));
    const lineH = size * 1.25;
    const maxLines = Math.max(1, Math.floor(maxH / lineH));
    const lines = wrapText(block.text, charsPerLine).slice(0, maxLines);

    g.fill('#333333');
    lines.forEach((line, i) => {
      ctx.fillText(line, block.x + BLOCK_PAD, block.y + BLOCK_PAD + i * lineH);
    });
  }

  // ---- Change dispatch. ----
  function applyChange(ctrl) {
    if (ctrl.action === 'shuffle') {
      // New seed = a different packing of the same content.
      layout.seed = (Math.random() * 0xffffffff) >>> 0;
      runLayout();
    }
    switch (ctrl.regen) {
      case 'canvas':
        rebuildAll();
        break;
      case 'extract':
      case 'effect':
      case 'render':
        // These change the silhouette pixels but not the packing.
        invalidateSilhouettes();
        break;
      case 'font':
        loadFonts().then(() => dirty.markDirty());
        break;
      case 'layout':
        runLayout();
        break;
    }
    refreshVisibility();
    dirty.markDirty();
    saveState();
  }

  function refreshVisibility() {
    const colorEl = document.getElementById('sl-sil-color');
    if (colorEl) colorEl.disabled = render.effect === 'none';

    // A variable axis only gets a slider when the chosen family supports it,
    // so e.g. Syne (weight only) doesn't show dead Width/Optical Size rows.
    const show = (id, vis) => {
      const el = document.querySelector(`[data-control-id="${id}"]`);
      if (el) el.style.display = vis ? '' : 'none';
    };
    for (const tag of AXIS_TAGS) {
      show(`sl-main-${tag}`, hasAxis(layout.main.font, tag));
      show(`sl-small-${tag}`, hasAxis(layout.small.font, tag));
    }
  }

  function syncUIFromState() {
    panel.syncUIFromState(SECTIONS);
    refreshVisibility();
  }

  /** Register the selected families so the text buffer can draw with them. */
  function loadFonts() {
    return Promise.all(
      [layout.main.font, layout.small.font].map((f) =>
        ensureFont(f).catch((e) => console.warn(`[silueta] font "${f}" failed:`, e))
      )
    );
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
    buildMediaSection(root, {
      media,
      onChange: () => {
        runLayout();
        invalidateSilhouettes();
        dirty.markDirty();
      },
    });
    panel.buildSections(root, SECTIONS);
    openSections(root, [1, 3]); // Media Library + Composition open by default
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
      // Silhouettes are built per block at draw time and keyed on density, so
      // clearing the cache is what re-renders them at export resolution.
      invalidateSilhouettes();
      ensureTextBuffer();
      fn(d);
    } finally {
      cnv.density.base = savedBase;
      p.pixelDensity(savedBase);
      invalidateSilhouettes();
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
    // Ensure every image block has a cached mask to vectorise (drawing
    // populates the cache; a fresh load may not have drawn yet).
    for (const b of blocks) {
      if (b.kind === 'image') silhouetteFor(b);
    }
    const withMasks = blocks.map((b) =>
      b.kind === 'image' ? { ...b, mask: silCache.get(b.entry?.key)?.mask || null } : b
    );
    exportGridSVG({
      w: cnv.width,
      h: cnv.height,
      blocks: withMasks,
      render,
      main: layout.main,
      small: layout.small,
      pad: BLOCK_PAD,
      wrap: wrapText,
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

  // Dropping images onto the canvas adds them to the media library, so the
  // poster grows a new tile instead of replacing the whole composition.
  function bindDragDrop() {
    if (!canvasContainer) return;
    canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
    canvasContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
        f.type.startsWith('image/')
      );
      if (!files.length) return;
      for (const file of files) {
        try {
          await media.addFile(file);
        } catch (err) {
          console.warn('[silueta] image load failed:', err);
          setStatus('Image load failed');
        }
      }
      runLayout();
      invalidateSilhouettes();
      dirty.markDirty();
    });
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
      media.loadDefaults(),
      loadFonts(),
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
