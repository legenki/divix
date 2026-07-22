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
import { ensureFont, hasAxis, AXIS_TAGS } from './fonts.js';
import { rasterizeSVG } from './stamp.js';

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
  // Two-level per-block cache:
  //   maskCache  key=[bw,bh,threshold,merge,density]  → {plate, maskInfo}
  //     Rebuilt only when image/size/threshold change. Expensive (JS extraction).
  //   renderCache key=[bw,bh,effect,granularity,color,keepOriginal,shape,density]
  //     → HTMLCanvasElement (masked shader output)
  //     Rebuilt only when visual params change. One GPU draw call, no new contexts.
  const maskCache = new Map();
  const renderCache = new Map();
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
    onSliderInput: () => requestRepaint(),
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
    measureCoverage();
    const composed = composeGrid({
      w: cnv.width,
      h: cnv.height,
      images: media.active(),
      imageCount: layout.counts.images,
      // Auto mode hands the composer one body of copy and lets it decide what
      // is set large; manual mode keeps the two explicit fields.
      autoCopy: layout.autoCopy ? layout.autoText : '',
      mainText: layout.main.text,
      smallText: layout.small.text,
      mainCount: layout.counts.main,
      smallCount: layout.counts.small,
      rand: makeRand(layout.seed),
    });
    blocks = composed.blocks;
  }

  // ---- Per-block silhouette. ----
  function silhouetteFor(block) {
    const entry = block.entry;
    if (!entry?.ready || !entry.img) return null;

    const bw = Math.max(2, Math.round(block.w - BLOCK_PAD * 2));
    const bh = Math.max(2, Math.round(block.h - BLOCK_PAD * 2));
    const density = cnv.density.base;

    // Level 1 — mask extraction. Only rebuilt when geometry/threshold changes.
    const maskSig = [bw, bh, extract.threshold, extract.merge, density].join('|');
    let maskHit = maskCache.get(entry.key);
    if (!maskHit || maskHit.sig !== maskSig) {
      const fitScale = Math.min(bw / entry.img.width, bh / entry.img.height);
      const fw = Math.max(2, Math.floor(entry.img.width * fitScale));
      const fh = Math.max(2, Math.floor(entry.img.height * fitScale));
      // Build white plate with image centered (mask coords must match render coords).
      const plate = p.createImage(bw, bh);
      plate.loadPixels();
      for (let i = 0; i < plate.pixels.length; i++) plate.pixels[i] = 255;
      plate.updatePixels();
      const fitted = p.createImage(fw, fh);
      fitted.copy(entry.img, 0, 0, entry.img.width, entry.img.height, 0, 0, fw, fh);
      plate.copy(fitted, 0, 0, fw, fh, (bw - fw) >> 1, (bh - fh) >> 1, fw, fh);
      // Downscale for extraction — analysis resolution is enough for the mask.
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
        threshold: extract.threshold, merge: extract.merge,
        areaFloor: Math.max(2, Math.round(aw * ah * 0.002)),
      });
      maskHit = { sig: maskSig, plate, maskInfo };
      maskCache.set(entry.key, maskHit);
      renderCache.delete(entry.key);
    }

    // Level 2 — shader + mask composite. One GPU draw via the shared WEBGL context.
    // Returns HTMLCanvasElement — drawn directly via drawingContext, no p5.Image copy.
    const renderSig = [
      bw, bh, render.effect, render.granularity, render.color,
      render.keepOriginal, render.shape, density,
    ].join('|');
    let renderHit = renderCache.get(entry.key);
    if (!renderHit || renderHit.sig !== renderSig) {
      const canvas = renderer.renderBlock(maskHit.plate, maskHit.maskInfo, bw, bh, density);
      renderHit = { sig: renderSig, canvas, mask: maskHit.maskInfo };
      renderCache.set(entry.key, renderHit);
    }

    return renderHit.canvas;
  }

  /**
   * Measure how much of its own bounding box each image's subject fills, and
   * cache it on the entry as `coverage` (0..1). gridLayout ranks the hero by
   * this: a sparse, spindly outline rewards being shown large, a solid blob
   * does not. Measured once per image at a fixed small resolution — it depends
   * only on the photo and the threshold, not on block geometry, so it must be
   * known before layout picks the hero.
   */
  function measureCoverage() {
    const EDGE = 64;
    for (const entry of media.all()) {
      if (!entry.ready || !entry.img) continue;
      if (entry.coverage != null && entry.coverageThreshold === extract.threshold) continue;
      const scale = EDGE / Math.max(entry.img.width, entry.img.height);
      const aw = Math.max(1, Math.round(entry.img.width * scale));
      const ah = Math.max(1, Math.round(entry.img.height * scale));
      const small = p.createImage(aw, ah);
      small.copy(entry.img, 0, 0, entry.img.width, entry.img.height, 0, 0, aw, ah);
      small.loadPixels();
      let on = 0;
      for (let i = 0; i < aw * ah; i++) {
        const j = i * 4;
        const lum = small.pixels[j] * 0.299 + small.pixels[j + 1] * 0.587 + small.pixels[j + 2] * 0.114;
        if (lum < extract.threshold) on += 1;
      }
      entry.coverage = on / (aw * ah);
      entry.coverageThreshold = extract.threshold;
    }
  }

  /** Full invalidation — geometry, images, or extract params changed. */
  function invalidateSilhouettes() {
    maskCache.clear();
    renderCache.clear();
  }

  /** Visual-only invalidation — color/effect/granularity changed, mask is still good. */
  function invalidateRenderCache() {
    renderCache.clear();
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
    p.translate(-145, 0);

    // White paper background.
    p.push();
    p.fill(255);
    p.noStroke();
    p.rectMode(p.CENTER);
    p.rect(0, 0, cnv.width, cnv.height);
    p.pop();

    // All images + text go into the P2D textBuffer so we can use native 2D
    // drawImage for the silhouette canvases — no p5.Image wrapping, no per-block
    // WebGL texture upload. One p.image(textBuffer) blit at the end.
    drawComposite();
    p.pop();
  }

  function drawComposite() {
    if (!textBuffer) return;
    const g = textBuffer;
    g.clear();
    const ctx = g.drawingContext;

    // 1 — image blocks via native 2D drawImage (HTMLCanvasElement → 2D ctx).
    const density = g.pixelDensity();
    for (const block of blocks) {
      if (block.kind !== 'image') continue;
      const canvas = silhouetteFor(block);
      if (!canvas) continue;
      ctx.drawImage(
        canvas,
        (block.x + BLOCK_PAD) * density, (block.y + BLOCK_PAD) * density,
        (block.w - BLOCK_PAD * 2) * density, (block.h - BLOCK_PAD * 2) * density,
      );
    }

    // 2 — text blocks on top (same buffer, same 2D context).
    g.noStroke();
    g.textAlign(p.LEFT, p.TOP);
    for (const block of blocks) {
      if (block.kind === 'main') drawMainBlock(g, block);
      else if (block.kind === 'small') drawSmallBlock(g, block);
    }

    // 3 — single blit onto the WEBGL canvas.
    p.image(g, 0, 0, cnv.width, cnv.height);
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
   * Apply a variable-font style to the buffer's 2D context.
   *
   * Weight and width go through the CSS font shorthand (`700 condensed 48px …`)
   * because that is what canvas 2D honours: it selects an instance from the
   * range declared on the FontFace. `fontVariationSettings` alone does NOT
   * work here — verified in-browser, every weight rendered identical ink — so
   * it is used only for `opsz`, which has no shorthand equivalent.
   */
  function applyFontStyle(g, style, sizePx) {
    const family = style.font;
    const ready = document.fonts?.check?.(`12px "${family}"`);
    const ctx = g.drawingContext;

    const weight = hasAxis(family, 'wght') ? Math.round(style.wght ?? 400) : 400;
    // Stretch must be a KEYWORD here: canvas 2D rejects a percentage such as
    // `100%`, and one invalid token invalidates the whole font string — the
    // context then silently falls back to 10px sans-serif (observed).
    const stretch = hasAxis(family, 'wdth') ? stretchKeyword(style.wdth) : '';

    if (ready) {
      // Quote the family and DON'T append a fallback stack: a fallback makes
      // no difference once the face is loaded, and keeping the string minimal
      // avoids further parse failures.
      ctx.font = `${weight} ${stretch} ${sizePx}px "${family}"`.replace(/\s+/g, ' ').trim();
      // If anything was still rejected, fall back explicitly rather than
      // rendering at the browser's 10px default.
      if (!ctx.font.includes(`${sizePx}px`)) {
        ctx.font = `${weight} ${sizePx}px "${family}"`;
      }
    } else {
      ctx.font = `${weight} ${sizePx}px ${FALLBACK_FONT}`;
    }

    // opsz has no shorthand equivalent, so it goes through the axis property.
    const opsz = hasAxis(family, 'opsz') && style.opsz != null ? `"opsz" ${style.opsz}` : '';
    ctx.fontVariationSettings = opsz || 'normal';
  }

  /** Map a wdth axis percentage onto the CSS font-stretch keyword scale. */
  function stretchKeyword(wdth) {
    const v = Number(wdth);
    if (!Number.isFinite(v) || Math.abs(v - 100) < 6) return '';
    if (v < 56) return 'ultra-condensed';
    if (v < 69) return 'extra-condensed';
    if (v < 81) return 'condensed';
    if (v < 94) return 'semi-condensed';
    if (v < 113) return 'semi-expanded';
    if (v < 138) return 'expanded';
    if (v < 175) return 'extra-expanded';
    return 'ultra-expanded';
  }

  /**
   * Wrap text to a pixel width using the context's REAL metrics (not a
   * character-count estimate), so a line can never overhang its block.
   * A single word longer than the box is broken mid-word rather than
   * bleeding past the edge.
   */
  function wrapToWidth(ctx, text, maxW) {
    const words = String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxW) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      // Hard-break a word that cannot fit on a line of its own.
      let rest = word;
      while (ctx.measureText(rest).width > maxW && rest.length > 1) {
        let cut = rest.length;
        while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxW) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Headline: wrapped and shrink-to-fit so it always stays inside its block. */
  function drawMainBlock(g, block) {
    const maxW = block.w - BLOCK_PAD * 2;
    const maxH = block.h - BLOCK_PAD * 2;
    if (maxW <= 4 || maxH <= 4) return;

    const ctx = g.drawingContext;
    const lh = layout.main.lineHeight;

    // Shrink until the wrapped block fits the box in BOTH axes. Wrapping keeps
    // long phrases inside the width; this loop keeps them inside the height.
    let size = Math.max(8, Math.min(layout.main.fontSize, maxH));
    let lines = [];
    let guard = 0;
    while (guard < 80) {
      applyFontStyle(g, layout.main, size);
      lines = wrapToWidth(ctx, block.text, maxW);
      if (lines.length * size * lh <= maxH || size <= 8) break;
      size -= 1;
      guard += 1;
    }

    g.fill(layout.main.color);
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillText(line, block.x + BLOCK_PAD, block.y + BLOCK_PAD + i * size * lh);
    });
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

    // Wrap on real metrics so no line overhangs the block, then clip to the
    // number of lines that actually fit its height.
    const lineH = size * layout.small.lineHeight;
    const maxLines = Math.max(1, Math.floor(maxH / lineH));
    const lines = wrapToWidth(ctx, block.text, maxW).slice(0, maxLines);

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
    } else if (ctrl.action === 'uploadShape') {
      document.getElementById('sl-shape-input')?.click();
      return; // the file dialog drives the rest
    }
    switch (ctrl.regen) {
      case 'canvas':
        rebuildAll();
        break;
      case 'extract':
        // Threshold also changes coverage → hero selection, so re-layout too.
        invalidateSilhouettes();
        runLayout();
        break;
      case 'effect':
      case 'render':
        // Color / granularity / shape / effect — mask unchanged, only re-run shader.
        invalidateRenderCache();
        break;
      case 'font':
        loadFonts().then(() => dirty.markDirty());
        break;
      case 'layout':
        runLayout();
        break;
    }
    refreshVisibility();
    requestRepaint();
    saveStateDebounced();
  }

  /**
   * Force exactly one repaint. markDirty() alone is not enough: the sketch is
   * paused via noLoop() after each idle frame, and waking it with loop() can
   * miss a frame, so a slider change would update state without repainting
   * (observed with the weight slider — the buffer was never redrawn).
   * redraw() always paints, so the panel and canvas stay in step.
   */
  function requestRepaint() {
    dirty.markDirty();
    if (typeof p.redraw === 'function' && !recVideo.active) {
      try { p.redraw(); } catch { /* instance may not be ready yet */ }
    }
  }

  function refreshVisibility() {
    const colorEl = document.getElementById('sl-sil-color');
    if (colorEl) colorEl.disabled = render.effect === 'none';

    const show = (id, vis) => {
      const el = document.querySelector(`[data-control-id="${id}"]`);
      if (el) el.style.display = vis ? '' : 'none';
    };
    // Nothing is stamped in Original mode, and the SVG loader is only
    // meaningful once "Custom SVG" is the selected shape.
    const stamped = render.effect !== 'none';
    show('sl-shape', stamped);
    show('sl-shape-upload', stamped && render.shape === 'custom');
    const label = document.getElementById('sl-shape-name');
    if (label) {
      label.style.display = stamped && render.shape === 'custom' ? 'block' : 'none';
      label.textContent = render.shapeName || 'no file — using a square';
    }

    // A variable axis only gets a slider when the chosen family supports it,
    // so e.g. Syne (weight only) doesn't show dead Width/Optical Size rows.
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

    // Filename label + hidden file input for the SVG loader. Both are created
    // here rather than in template.html because panelBuilder has no control
    // type for them, and building them alongside the button keeps the loader
    // working no matter how the panel is rebuilt.
    const uploadRow = root.querySelector('[data-control-id="sl-shape-upload"]');
    if (uploadRow && !document.getElementById('sl-shape-name')) {
      const label = document.createElement('span');
      label.id = 'sl-shape-name';
      label.className = 'color-code';
      label.style.cssText = 'display:block;margin-top:6px;';
      uploadRow.appendChild(label);

      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'sl-shape-input';
      input.accept = '.svg,image/svg+xml';
      input.style.display = 'none';
      input.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) loadShapeFile(file);
        e.target.value = '';
      });
      uploadRow.appendChild(input);
    }

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
  // Debounced save: avoids writing localStorage on every color-picker input event.
  const saveStateDebounced = debounce(saveState, 400);

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
      b.kind === 'image' ? { ...b, mask: renderCache.get(b.entry?.key)?.mask || null } : b
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

  /** Read an uploaded SVG, rasterise it to a stamp and re-render with it. */
  function loadShapeFile(file) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const img = await rasterizeSVG({ p, svgText: ev.target.result });
        renderer.setStamp(img);
        render.shape = 'custom';
        render.shapeName = file.name;
        invalidateSilhouettes();
        syncUIFromState();
        requestRepaint();
        saveState();
        setStatus('');
      } catch (err) {
        console.warn('[silueta] SVG shape failed:', err);
        setStatus(err.message || 'SVG shape failed');
      }
    };
    reader.onerror = () => setStatus('Could not read that file');
    reader.readAsText(file);
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
