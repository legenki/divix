// DIVIX — split/mirror form generator.
// Assembles the six divix modules (form, randomize, customShape, svgExport)
// around a shared state object, an offscreen gForm buffer that is composited
// (with per-quadrant clip + mirror) into gDraw, then displayed fitted to the
// viewport and reused for PNG/MP4/SVG export.

import * as state from './state.js';
import { createForm } from './form.js';
import { createRandomize } from './randomize.js';
import { createCustomShape } from './customShape.js';
import { createSvgExport } from './svgExport.js';
import { SECTIONS } from './controls.js';
import { easeFunctions } from './ease.js';

import { createPersistence } from '../../shared/utils/persistence.js';
import { ensureVendorLibs } from '../../shared/utils/lazyLibs.js';
import { timestamp } from '../../shared/utils/datetime.js';
import { downloadPresetJSON, openPresetFile } from '../../shared/utils/presetIO.js';
import { deepMerge } from '../../shared/utils/deepMerge.js';
import { exportPNG, exportMP4 } from '../../shared/utils/exportMedia.js';
import {
  createPanelBuilder,
  buildPresetSection,
  openSections,
} from '../../shared/ui/panelBuilder.js';

const STORAGE_KEY = 'divix-tool';

// state.js exports the live, mutable state objects. Destructure the runtime
// ones we mutate directly; the option maps stay on `state` for the factories.
const { palette, simplex, cnv, form, split, rec } = state;

export function divixSketch(p) {
  let canvasContainer;

  // ---- Runtime-only (not persisted) ----
  let gForm = null;
  let gDraw = null;
  let gAlpha = null;
  let isReady = false;
  let PRESETS = {};
  let palettes = [];
  const recVideo = { active: false, seconds: 4 };

  // Seeded simplex generators — one per transform axis, keyed to that axis'
  // own `.seed`. Rebuilt when the relevant seed changes (the 'seed' regen tag)
  // or on preset apply. Constructed here (NOT state.js's numeric `simplex`).
  const noise = { scale: null, xmove: null, ymove: null, rotate: null };

  function buildNoise(axis) {
    noise[axis] = new SimplexNoise(alea(form[axis].seed));
  }
  function buildAllNoise() {
    buildNoise('scale');
    buildNoise('xmove');
    buildNoise('ymove');
    buildNoise('rotate');
  }

  // The whole-module state object the factories destructure (they read the
  // option maps SHAPE_SIZE / SHAPE_PATHS / *_TYPES off it). `simplex` is the
  // numeric placeholder from state.js — randomize.js reads `.max` off it.
  const fullState = {
    palette,
    simplex,
    cnv,
    form,
    split,
    rec,
    ...pickOptionMaps(state),
  };

  const buffers = {};

  // ---- Factories (wired after buffers exist, in setup) ----
  let formCtl = null;
  let randomizeCtl = null;
  let customShapeCtl = null;
  let svgExportCtl = null;

  function wireFactories() {
    formCtl = createForm({ p, state: fullState, buffers, noise });
    randomizeCtl = createRandomize({ p, state: fullState, ease: { easeFunctions }, palettes });
    customShapeCtl = createCustomShape({
      p,
      state: fullState,
      switchForm: () => formCtl.switchForm(),
      onError: (key) =>
        setStatus(key === 'emptySvgNotice' ? 'SVG has no drawable path' : 'SVG import failed'),
    });
    svgExportCtl = createSvgExport({
      p,
      state: fullState,
      buffers,
      getFormData: () => formCtl.getFormData(),
      filenamePrefix: 'divix',
    });
  }

  // ---- Panel UI ----
  const panel = createPanelBuilder({ state: fullState, applyChange, refreshVisibility });

  function buildUI() {
    const root = document.getElementById('dx-controls');
    if (!root) return;
    root.innerHTML = '';

    buildPresetSection(root, {
      idPrefix: 'dx',
      presets: PRESETS,
      onExport: exportPreset,
      onImport: importPreset,
    });
    panel.buildSections(root, SECTIONS);
    buildPaletteSection(root);
    // Open Preset + Canvas by default.
    openSections(root, [0, 3]);
    refreshVisibility();
  }

  // The 5-swatch palette picker has no generic panelBuilder control type, so
  // it is built directly here: each fixed slot shows its color, a click
  // selects it (palette.index — drives xor fill + canvas palette slot), and a
  // checkbox toggles whether it feeds palette.temp (sequence/transition modes).
  function buildPaletteSection(root) {
    const sec = document.createElement('section');
    sec.className = 'panel-section collapsed';
    sec.innerHTML = `
      <h2 class="section-title"><span>Palette</span>
        <svg class="chevron-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </h2>
      <div class="section-content">
        <div class="parameter-row">
          <button id="dx-palette-random" class="btn btn-secondary" style="width:100%;">Randomize Palette</button>
        </div>
        <div id="dx-palette-swatches"></div>
      </div>`;
    sec.querySelector('.section-title').addEventListener('click', () => {
      sec.classList.toggle('collapsed');
    });
    sec.querySelector('#dx-palette-random').addEventListener('click', (e) => {
      e.stopPropagation();
      randomizeCtl.randomizePalette();
      syncPaletteTemp();
      rebuildSwatches();
      saveState();
    });
    root.appendChild(sec);
    rebuildSwatches();
  }

  function rebuildSwatches() {
    const holder = document.getElementById('dx-palette-swatches');
    if (!holder) return;
    holder.innerHTML = '';
    for (let i = 0; i < palette.array.length; i++) {
      const row = document.createElement('div');
      row.className = 'parameter-row';
      const hex = String(palette.array[i] || '#000000').slice(0, 7);
      const active = i === palette.index;
      row.innerHTML = `
        <div class="parameter-header" style="align-items:center;">
          <label class="checkbox-container" style="margin:0;">
            <input type="checkbox" id="dx-palette-use-${i}" ${palette.use[i] ? 'checked' : ''}>
            <span class="custom-checkbox"></span>
          </label>
          <span class="parameter-label" style="flex:1;">Color ${i + 1}${active ? ' •' : ''}</span>
          <div class="color-picker-wrapper" style="margin:0;">
            <input type="color" id="dx-palette-color-${i}" value="${hex}">
            <span class="color-code" id="dx-palette-color-${i}-code">${hex.toUpperCase()}</span>
          </div>
        </div>
        <button id="dx-palette-select-${i}" class="btn ${active ? 'btn-accent' : 'btn-secondary'}" style="width:100%;">${active ? 'Selected' : 'Select'}</button>`;

      row.querySelector(`#dx-palette-use-${i}`).addEventListener('change', (e) => {
        palette.use[i] = e.target.checked;
        syncPaletteTemp();
        saveState();
      });
      const colorInput = row.querySelector(`#dx-palette-color-${i}`);
      const code = row.querySelector(`#dx-palette-color-${i}-code`);
      colorInput.addEventListener('input', (e) => {
        palette.array[i] = e.target.value;
        code.textContent = e.target.value.toUpperCase();
        syncPaletteTemp();
        saveState();
      });
      row.querySelector(`#dx-palette-select-${i}`).addEventListener('click', () => {
        palette.index = i;
        rebuildSwatches();
        saveState();
      });
      holder.appendChild(row);
    }
  }

  // Populate palette.temp (the array form.js's sequence/transition color modes
  // read) from palette.array filtered by palette.use. This logic has no home
  // in the ported modules — it lives here per Task 8's flag.
  function syncPaletteTemp() {
    palette.temp = palette.array.filter((_, i) => palette.use[i]);
    if (palette.temp.length === 0) palette.temp = palette.array.slice();
  }

  // ---- Change dispatch ----
  function applyChange(ctrl) {
    switch (ctrl.id) {
      case 'dx-canvas-random':
        randomizeCtl.randomizeAll();
        applySplitGrid();
        buildAllNoise();
        syncPaletteTemp();
        syncUIFromState();
        saveState();
        return;
      case 'dx-canvas-reset':
        cnv.scale.value = 1;
        cnv.rotation.value = 0;
        cnv.position.x = 0;
        cnv.position.y = 0;
        form.transition.x = 0;
        form.transition.y = 0;
        syncUIFromState();
        saveState();
        return;
      case 'dx-rand-scale':
        randomizeCtl.randomizeTransform(form.scale, false);
        buildNoise('scale');
        syncUIFromState();
        saveState();
        return;
      case 'dx-rand-xmove':
        randomizeCtl.randomizeTransform(form.xmove, false);
        buildNoise('xmove');
        syncUIFromState();
        saveState();
        return;
      case 'dx-rand-ymove':
        randomizeCtl.randomizeTransform(form.ymove, false);
        buildNoise('ymove');
        syncUIFromState();
        saveState();
        return;
      case 'dx-rand-rotate':
        randomizeCtl.randomizeTransform(form.rotate, false);
        buildNoise('rotate');
        syncUIFromState();
        saveState();
        return;
    }

    switch (ctrl.regen) {
      case 'canvas':
        setupBuffers();
        break;
      case 'shape':
        formCtl.switchForm();
        break;
      case 'split':
        applySplitGrid();
        break;
      case 'seed': {
        // Rebuild only the axis whose seed changed (id like 'dx-scale-seed').
        const axis = axisFromId(ctrl.id);
        if (axis) buildNoise(axis);
        break;
      }
      case 'transform':
        // Motion-type change only gates which sub-controls show; handled by
        // the refreshVisibility() below.
        break;
    }
    refreshVisibility();
    saveState();
  }

  function axisFromId(id) {
    if (!id) return null;
    const m = /^dx-(scale|xmove|ymove|rotate)-seed$/.exec(id);
    return m ? m[1] : null;
  }

  // Split type sets the quadrant grid (reference splitUI()); presets only carry
  // split.type, so x/y are always derived, never trusted from the preset.
  function applySplitGrid() {
    switch (split.type) {
      case 'vertical':
        split.x = 1;
        split.y = 2;
        break;
      case 'horizontal':
        split.x = 2;
        split.y = 1;
        break;
      case 'quad':
        split.x = 2;
        split.y = 2;
        break;
      default:
        split.x = 1;
        split.y = 1;
    }
  }

  // ---- Visibility ----
  function refreshVisibility() {
    const show = (id, vis) => {
      const el = document.querySelector(`[data-control-id="${id}"]`);
      if (el) el.style.display = vis ? '' : 'none';
    };

    show('dx-bg-custom', cnv.color.mode === 'custom');
    show('dx-bg-slot', cnv.color.mode === 'palette');
    show('dx-stroke-width', form.color.type === 'stroke');

    // Per-axis motion-type gating (reference scaleUI/moveUI/rotateUI):
    //   off  → cycle + phase visible; speed + seed hidden
    //   noise→ speed + seed visible; cycle + phase hidden
    //   sin  → cycle + phase visible; speed + seed hidden
    // order/amp/freq stay visible for all types (reference keeps them mounted,
    // only disables them for 'off'; our panel has no disable, so they remain).
    for (const axis of ['scale', 'xmove', 'ymove', 'rotate']) {
      const t = form[axis].type;
      show(`dx-${axis}-cycle`, t === 'off' || t === 'sin');
      show(`dx-${axis}-phase`, t === 'off' || t === 'sin');
      show(`dx-${axis}-speed`, t === 'noise');
      show(`dx-${axis}-seed`, t === 'noise');
    }
  }

  function syncUIFromState() {
    panel.syncUIFromState(SECTIONS);
    rebuildSwatches();
    refreshVisibility();
  }

  // ---- Canvas / buffers ----
  function setupBuffers() {
    const res = state.RESOLUTIONS[cnv.ratio];
    if (!gForm) {
      gForm = p.createGraphics(res.width, res.height);
      gForm.pixelDensity(cnv.density.base);
      // Match the reference (system.js: gForm.angleMode(DEGREES)). All form
      // rotations (cnv.rotation.value, per-form formData.transform.rotate) are
      // authored in DEGREES; without this a fresh p5.Graphics defaults to
      // RADIANS, so the forms are rotated ~57x too far and their content
      // collapses toward gForm's center. For split.type 'none' the 1:1 copy
      // still fills the canvas so it looked plausible, but any split that
      // clips+mirrors gForm's quadrants then only fills the region the
      // (mislaid) content actually reached — producing the compressed composite.
      // Reference system.js also sets strokeWeight(0.5)+noStroke() on gForm
      // here; form.js always overwrites strokeWeight before drawing so this
      // has no visible effect today, but replicate it anyway — this file has
      // twice now shipped a bug from a buffer mode call silently missing
      // (see the angleMode/rectMode/imageMode comments above and below), so
      // treat reference/splitx/scripts/system.js's buffer setup as the
      // authoritative checklist rather than relying on incidental call order.
      gForm.strokeWeight(0.5);
      gForm.noStroke();
      gForm.angleMode(p.DEGREES);
      gDraw = p.createGraphics(res.width, res.height);
      gDraw.pixelDensity(cnv.density.base);
      // Match the reference tool's gDraw render modes (system.js setupCanvas):
      // the per-quadrant clip rects use CORNERS coords (rect(x1,y1,x2,y2)) and
      // the composited image is centered at the translated origin. Without these
      // the clip rect and the corner-anchored image never overlap, so gDraw
      // composites out fully transparent for every split.type !== 'none'.
      gDraw.rectMode(p.CORNERS);
      gDraw.imageMode(p.CENTER);
      gDraw.strokeWeight(0.5);
      gDraw.noStroke();
      gAlpha = p.createGraphics(res.width, res.height);
      gAlpha.pixelDensity(cnv.density.base);
      buffers.gForm = gForm;
      buffers.gDraw = gDraw;
      buffers.gAlpha = gAlpha;
    } else if (gForm.width !== res.width || gForm.height !== res.height) {
      // resizeCanvas instead of remove+create: p5.Graphics.remove() throws in
      // instance mode (ritmo hit the same constraint).
      gForm.resizeCanvas(res.width, res.height);
      gDraw.resizeCanvas(res.width, res.height);
      gAlpha.resizeCanvas(res.width, res.height);
    }
  }

  function fitCanvas() {
    const w = canvasContainer.clientWidth || window.innerWidth;
    const h = canvasContainer.clientHeight || window.innerHeight;
    p.resizeCanvas(w, h);
  }

  // ---- Split / clip (ported from reference main.js) ----

  // Pure port of the reference `splitFormation(count, x, y)`: for one quadrant
  // returns its clip rect (in gForm pixel space) and mirror scale.
  function splitFormation(count, x, y) {
    const w = gForm.width;
    const h = gForm.height;
    const data = { x: 0, y: 0, width: w, height: h, scale: { x: 1, y: 1 } };

    switch (split.type) {
      case 'vertical':
        data.x = 0;
        data.width = w;
        if (y === 0) {
          data.y = 0;
          data.height = Math.floor(h * 0.5 * (1 + split.mask.y));
          data.scale.y = 1;
        } else {
          data.y = Math.floor(h * 0.5 * (1 + split.mask.y));
          data.height = h;
          data.scale.y = -1;
        }
        break;

      case 'horizontal':
        data.y = 0;
        data.height = h;
        if (x === 0) {
          data.x = 0;
          data.width = Math.floor(w * 0.5 * (1 + split.mask.x));
          data.scale.x = 1;
        } else {
          data.x = Math.floor(w * 0.5 * (1 + split.mask.x));
          data.width = w;
          data.scale.x = -1;
        }
        break;

      case 'quad':
        if (x === 0) {
          data.x = 0;
          data.width = Math.floor(w * 0.5 * (1 + split.mask.x));
        } else {
          data.x = Math.floor(w * 0.5 * (1 + split.mask.x));
          data.width = w;
        }
        if (y === 0) {
          data.y = 0;
          data.height = Math.floor(h * 0.5 * (1 + split.mask.y));
        } else {
          data.y = Math.floor(h * 0.5 * (1 + split.mask.y));
          data.height = h;
        }
        if (count === 0) {
          data.scale.x = 1;
          data.scale.y = 1;
        } else if (count === 1) {
          data.scale.x = 1;
          data.scale.y = -1;
        } else if (count === 2) {
          data.scale.x = -1;
          data.scale.y = 1;
        } else {
          data.scale.x = -1;
          data.scale.y = -1;
        }
        break;

      default:
        break; // 'none' → full-size, unscaled, single quadrant.
    }
    return data;
  }

  // Composites gForm into gDraw with per-quadrant clip + mirror, and mutates
  // formData.clip on the live object form.js returns (getFormData() hands back
  // the same reference) so svgExport reads a populated clip array. Ported from
  // reference drawSplitImages().
  function drawSplitImages() {
    const formData = formCtl.getFormData();
    formData.clip = [];
    gDraw.clear();

    let count = 0;
    for (let x = 0; x < split.x; x++) {
      for (let y = 0; y < split.y; y++) {
        const clip = splitFormation(count, x, y);
        formData.clip.push(clip);

        gDraw.push();
        gDraw.beginClip();
        gDraw.rect(clip.x, clip.y, clip.width, clip.height);
        gDraw.endClip();

        gDraw.translate(gForm.width / 2, gForm.height / 2);
        gDraw.scale(clip.scale.x, clip.scale.y);
        gDraw.image(gForm, 0, 0, gDraw.width, gDraw.height, 0, 0, gForm.width, gForm.height);
        gDraw.pop();
        count++;
      }
    }
    showSplit();
  }

  // Red split-guide overlay (reference showSplit()); skipped while exporting.
  function showSplit() {
    if (recVideo.active || split.type === 'none' || !split.show) return;
    gDraw.push();
    gDraw.stroke(255, 0, 0);
    const x = Math.floor(gDraw.width * 0.5 * (1 + split.mask.x));
    const y = Math.floor(gDraw.height * 0.5 * (1 + split.mask.y));
    switch (split.type) {
      case 'horizontal':
        gDraw.line(x, 0, x, gDraw.height);
        break;
      case 'vertical':
        gDraw.line(0, y, gDraw.width, y);
        break;
      case 'quad':
        gDraw.line(x, 0, x, gDraw.height);
        gDraw.line(0, y, gDraw.width, y);
        break;
    }
    gDraw.pop();
  }

  // ---- Render core ----
  // Renders one full frame into gDraw (forms + split composite). The visible-
  // canvas background is drawn separately by drawBackground() when blitting.
  function drawScene() {
    formCtl.drawForms();
    drawSplitImages();
  }

  // ---- Presets ----
  function applyPreset(preset) {
    if (!preset) return;
    deepMerge(cnv, preset.cnv);
    deepMerge(form, preset.form);
    deepMerge(split, preset.split);
    deepMerge(rec, preset.rec);
    if (preset.palette) deepMerge(palette, preset.palette);
    cnv.frame = preset.cnv?.frame ?? 0;

    // A `custom`-shape preset carries its own SVG path/size payload in
    // `form.shape`. switchForm() reads geometry from the static
    // SHAPE_PATHS.custom / SHAPE_SIZE.custom slots (the same slots the live
    // drag-and-drop importer writes), NOT from the merged `form.shape`, so we
    // must propagate the preset payload into those slots before switchForm().
    // Match the reference tool's preset-load convention (preset.js loadPreset):
    // the path goes in verbatim (form.js wraps it in Path2D), and the stored
    // size is ALREADY the half-extent the importer persists — it is copied
    // straight into SHAPE_SIZE.custom with no further halving.
    const presetShape = preset.form?.shape;
    if (presetShape?.path && presetShape.size) {
      state.SHAPE_PATHS.custom = presetShape.path;
      state.SHAPE_SIZE.custom.width = presetShape.size.width;
      state.SHAPE_SIZE.custom.height = presetShape.size.height;
    }

    applySplitGrid();
    setupBuffers();
    formCtl.switchForm();
    buildAllNoise();
    syncPaletteTemp();
    syncUIFromState();
    saveState();
  }

  // ---- Persistence ----
  function serializeState() {
    return {
      cnv: JSON.parse(JSON.stringify(cnv)),
      form: JSON.parse(JSON.stringify(form)),
      split: JSON.parse(JSON.stringify(split)),
      rec: {
        type: rec.type,
        quality: rec.quality,
        length: { value: rec.length.value },
      },
      palette: {
        index: palette.index,
        array: palette.array.slice(),
        use: palette.use.slice(),
        label: palette.label.slice(),
      },
    };
  }

  const { saveState, loadState } = createPersistence(
    STORAGE_KEY,
    'divix',
    serializeState,
    (data) => {
      deepMerge(cnv, data.cnv);
      deepMerge(form, data.form);
      deepMerge(split, data.split);
      deepMerge(rec, data.rec);
      deepMerge(palette, data.palette);
    }
  );

  function exportPreset() {
    downloadPresetJSON(`divix-preset-${timestamp()}.json`, serializeState());
  }

  function importPreset() {
    openPresetFile(
      (data) => applyPreset(data),
      () => setStatus('Invalid preset file')
    );
  }

  // ---- Export ----
  function setStatus(msg) {
    const el = document.getElementById('dx-export-status');
    if (el) el.innerText = msg;
  }

  function blitToVisible() {
    p.clear();
    const res = state.RESOLUTIONS[cnv.ratio];
    const scale = Math.min((p.width * 0.85) / gDraw.width, (p.height * 0.85) / gDraw.height);
    drawBackground(res, scale);
    p.image(gDraw, p.width / 2, p.height / 2, gDraw.width * scale, gDraw.height * scale);
  }

  async function withHighResExport(fn) {
    const savedBase = cnv.density.base;
    try {
      const maxScreen = Math.max(p.width, p.height);
      const targetEdge = cnv.density.export || 1000;
      const exportDensity = Math.max(1, targetEdge / maxScreen);
      
      cnv.density.base = exportDensity;
      p.pixelDensity(exportDensity);
      setupBuffers();
      
      await fn();
    } finally {
      cnv.density.base = savedBase;
      p.pixelDensity(1);
      setupBuffers();
      drawScene();
      blitToVisible();
    }
  }

  function doExportPNG() {
    withHighResExport(() => {
      // Render one frame and blit to the visible canvas so the shared exportPNG
      // (which saves p.canvas) captures the current composite.
      drawScene();
      blitToVisible();
      exportPNG(p, 'divix');
    });
  }

  function doExportMP4() {
    recVideo.seconds = readMp4Length();
    return withHighResExport(() => {
      return exportMP4({
        p,
        prefix: 'divix',
        cnv,
        rec,
        recVideo,
        drawComposite: () => {
          drawScene();
          blitToVisible();
        },
        setStatus,
      });
    });
  }

  function readMp4Length() {
    const sel = document.getElementById('dx-mp4-length');
    const v = sel ? parseInt(sel.value, 10) : 4;
    return Number.isFinite(v) ? v : 4;
  }

  function bindFooter() {
    document.getElementById('dx-btn-save-png')?.addEventListener('click', doExportPNG);
    document.getElementById('dx-btn-save-mp4')?.addEventListener('click', doExportMP4);
    document.getElementById('dx-mp4-length')?.addEventListener('change', (e) => {
      recVideo.seconds = parseInt(e.target.value, 10);
    });
    document.getElementById('dx-btn-save-svg')?.addEventListener('click', () => {
      setStatus('Exporting SVG…');
      // Ensure formData is fresh (clip populated) before the exporter reads it.
      drawScene();
      svgExportCtl.startSvgExport();
      setTimeout(() => setStatus('SVG exported ✓'), 300);
      setTimeout(() => setStatus(''), 3000);
    });
    document.getElementById('dx-preset')?.addEventListener('change', (e) => {
      const preset = PRESETS[e.target.value];
      if (preset) applyPreset(preset);
    });
  }

  // Drag-and-drop SVG shape upload onto the canvas (reference feature).
  function bindDragDrop() {
    if (!canvasContainer) return;
    canvasContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    canvasContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file || !/\.svg$/i.test(file.name)) return;
      const reader = new FileReader();
      reader.onload = () => {
        customShapeCtl.importSVG(String(reader.result));
        syncUIFromState();
        saveState();
      };
      reader.readAsText(file);
    });
  }

  // ---- Visible-canvas background (matches reference drawCanvas fill) ----
  function drawBackground(res, scale) {
    if (cnv.color.mode === 'transparent') return;
    p.push();
    p.noStroke();
    if (cnv.color.mode === 'custom') p.fill(cnv.color.custom);
    else p.fill(palette.array[cnv.color.slot] || '#ffffff');
    p.rectMode(p.CENTER);
    p.rect(p.width / 2, p.height / 2, res.width * scale, res.height * scale);
    p.pop();
  }

  // ---- p5 lifecycle ----
  p.setup = () => {
    canvasContainer = document.getElementById('divix-canvas');
    if (!canvasContainer) return;

    p.createCanvas(
      canvasContainer.clientWidth || window.innerWidth,
      canvasContainer.clientHeight || window.innerHeight
    );
    p.pixelDensity(1);
    p.imageMode(p.CENTER);
    p.frameRate(rec.frameRate);

    setupBuffers();
    wireFactories();
    formCtl.switchForm();
    buildAllNoise();
    applySplitGrid();

    const restored = loadState();
    if (restored) applySplitGrid();
    syncPaletteTemp();

    // colorjs (window.Color) is needed by form.js's LCH interpolation but is
    // NOT in main.js's `libs: ['paper']` for divix. Rather than change Task 3's
    // contract, load it here and gate the draw loop until it (and the fetches)
    // resolve — the same pattern ritmo uses for its per-workspace lazy libs.
    Promise.all([
      ensureVendorLibs('color').catch((e) => console.warn('[divix] colorjs load failed:', e)),
      fetch(`${import.meta.env.BASE_URL}assets/divix/presets.json`)
        .then((r) => r.json())
        .then((d) => {
          PRESETS = d;
        })
        .catch((e) => console.warn('[divix] presets load failed:', e)),
      fetch(`${import.meta.env.BASE_URL}assets/divix/palettes.json`)
        .then((r) => r.json())
        .then((d) => {
          palettes = Array.isArray(d) ? d : [];
        })
        .catch((e) => console.warn('[divix] palettes load failed:', e)),
    ]).finally(() => {
      // Rewire randomize with the now-loaded palette catalog.
      randomizeCtl = createRandomize({ p, state: fullState, ease: { easeFunctions }, palettes });

      buildUI();
      bindFooter();
      bindDragDrop();

      const keys = Object.keys(PRESETS);
      if (restored) {
        syncUIFromState();
      } else if (keys.length) {
        const pick = keys[Math.floor(Math.random() * keys.length)];
        applyPreset(PRESETS[pick]);
        const sel = document.getElementById('dx-preset');
        if (sel) sel.value = pick;
      } else {
        // No presets: at least have a coherent palette to draw.
        syncPaletteTemp();
        syncUIFromState();
      }
      isReady = true;
    });
  };

  p.draw = () => {
    if (!isReady || !gForm) return;

    drawScene();
    blitToVisible();

    if (cnv.animation) {
      const total = rec.length.value * rec.frameRate;
      cnv.frame >= total ? (cnv.frame = 0) : cnv.frame++;
    }
  };

  p.windowResized = () => {
    if (canvasContainer) fitCanvas();
  };
}

// Copies just the read-only option maps off the state module (everything that
// isn't one of the mutable runtime objects), so the factories can read
// SHAPE_SIZE / SHAPE_PATHS / *_TYPES / RESOLUTIONS off the state object.
function pickOptionMaps(mod) {
  const runtime = new Set(['palette', 'simplex', 'cnv', 'form', 'split', 'rec']);
  const out = {};
  for (const key of Object.keys(mod)) {
    if (!runtime.has(key)) out[key] = mod[key];
  }
  return out;
}
