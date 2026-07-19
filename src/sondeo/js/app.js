import * as state from './state.js';
import { SECTIONS } from './controls.js';
import { layoutMode } from './layout.js';
import { maapUse, maapClear } from './maap.js';
import { rotationMode } from './rotate.js';
import { scalingMode } from './scale.js';
import { startScanning, prepareShade } from './scan.js';
import { shiftXMode, shiftYMode, restartShiftXAnimation, restartShiftYAnimation } from './shift.js';
import { randomSystem } from './random.js';

import { createPersistence } from '../../shared/utils/persistence.js';
import { deepMerge } from '../../shared/utils/deepMerge.js';
import { exportPNG } from '../../shared/utils/exportMedia.js';
import { isOverPanel } from '../../shared/utils/panelGuard.js';
import { createDirtyLoop } from '../../shared/utils/dirtyLoop.js';
import { createPanelBuilder, openSections } from '../../shared/ui/panelBuilder.js';

const STORAGE_KEY = 'sondeo-tool';

const { cnv, maask, scan, shade, grain, params, layout, shift, scaling, rotation, maap, g } = state;

export function restartRotationAnimation() {
  rotation.frame = 0;
  rotation.value = 0;
}

export function restartScalingAnimation() {
  scaling.frame = 0;
  scaling.value = 0;
}

/** Optional hook set by the active sketch so scanComplete can pause the loop. */
let onScanComplete = null;

export function scanComplete() {
  scan.action = false;
  params.frame = 0;
  shade.frame = 0;
  scanType();
  restartRotationAnimation();
  restartScalingAnimation();
  restartShiftXAnimation();
  restartShiftYAnimation();
  if (typeof onScanComplete === 'function') onScanComplete();
}

export function scanType() {
  if (scan.type === "horizontal") {
    scan.position = scan.area.x1;
    scan.line.x1 = scan.position / scan.ratio;
    scan.line.y1 = scan.frame.y1;
    scan.line.x2 = scan.position / scan.ratio;
    scan.line.y2 = scan.frame.y2;
  } else if (scan.type === "vertical") {
    scan.position = scan.area.y1;
    scan.line.x1 = scan.frame.x1;
    scan.line.y1 = scan.position / scan.ratio;
    scan.line.x2 = scan.frame.x2;
    scan.line.y2 = scan.position / scan.ratio;
  }
}

export function scanArea() {
  if (!g.imgSource) return;
  if (scan.type === "horizontal") {
    scan.ratio = g.imgSource.width / cnv.width;
  } else if (scan.type === "vertical") {
    scan.ratio = g.imgSource.height / cnv.height;
  }

  if (maask.x2 - maask.x1 > maask.min && maask.y2 - maask.y1 > maask.min) {
    scan.area.x1 = maask.x1;
    scan.area.y1 = maask.y1;
    scan.area.x2 = maask.x2;
    scan.area.y2 = maask.y2;
  }

  scan.frame.x1 = scan.area.x1 / scan.ratio;
  scan.frame.y1 = scan.area.y1 / scan.ratio;
  scan.frame.x2 = scan.area.x2 / scan.ratio;
  scan.frame.y2 = scan.area.y2 / scan.ratio;

  scanType();
}

export function sondeoSketch(p) {
  let canvasContainer;
  let isReady = false;
  const dirty = createDirtyLoop(p);
  onScanComplete = () => {
    dirty.setAnimating(false);
    dirty.markDirty();
  };

  const fullState = { cnv, maask, scan, shade, grain, params, layout, shift, scaling, rotation, maap, ...pickOptionMaps(state) };
  const panel = createPanelBuilder({
    state: fullState,
    applyChange,
    refreshVisibility,
    onSliderInput: () => dirty.markDirty(),
  });

  // Sondeo has no factory presets — the panel starts straight at the
  // workspace's own sections, no Preset List / Export / Import section.
  function buildUI() {
    const root = document.getElementById('sn-controls');
    if (!root) return;
    root.innerHTML = '';

    panel.buildSections(root, SECTIONS);
    openSections(root, [0, 1]);
    refreshVisibility();
  }

  function applyChange(ctrl) {
    if (ctrl.regen === 'layout') {
      changeLayout();
    } else if (ctrl.regen === 'scan') {
      // Scan direction changed — recompute ratio/frame for the new axis.
      scan.action = false;
      scanArea();
    } else if (ctrl.action === 'resetScan') {
      resetScan();
    } else if (ctrl.action === 'startScan') {
      startScan();
    } else if (ctrl.action === 'useResult') {
      copyResult();
    } else if (ctrl.action === 'toggleMask') {
      changeMode();
    } else if (ctrl.action === 'resetMask') {
      resetMask();
    } else if (ctrl.action === 'resetTransform') {
      resetTransform();
    } else if (ctrl.action === 'stopAnimations') {
      stopAnimations();
    } else if (ctrl.action === 'exportPNG') {
      doExportPNG();
    } else if (ctrl.action === 'upload') {
      const el = document.getElementById('sn-hidden-file-input');
      if (el) el.click();
    }
    refreshVisibility();
    dirty.markDirty();
    saveState();
  }

  function startScan() {
    if (params.mode !== "scan") changeMode();
    scan.action = !scan.action;
    dirty.setAnimating(!!scan.action);
    dirty.markDirty();
  }

  function changeMode() {
    scan.action = false;
    params.mode === "mask" ? (params.mode = "scan") : (params.mode = "mask");
  }

  function resetTransform() {
    shift.base.x = 0;
    shift.base.y = 0;
    scaling.base = 100;
    rotation.base = 0;
    syncUIFromState();
  }

  function stopAnimations() {
    shift.type.x = "none";
    shift.type.y = "none";
    scaling.type = "none";
    rotation.type = "none";
    restartShiftXAnimation();
    restartShiftYAnimation();
    restartScalingAnimation();
    restartRotationAnimation();
    syncUIFromState();
  }


  function changeLayout() {
    params.sideMode === "full" ? (cnv.uiSize = 0) : (cnv.uiSize = -172);
    if (layout.mode === "layer") cnv.uiSize = -172;
  
    if (g.imgSource) imageAdjust(g.imgSource);
    scan.action = false;
    maapClear();
    scanArea();
    restartRotationAnimation();
    restartScalingAnimation();
    params.sideMode === "full" ? (cnv.uiSize = 0) : (cnv.uiSize = -145);
    if (layout.mode === "layer") cnv.uiSize = -145;
  }

  function resetScan() {
    scan.action = false;
    params.frame = 0;
    shade.frame = 0;
    if (g.result) g.result.clear();
    maapClear();
    scanArea();
    restartRotationAnimation();
    restartScalingAnimation();
    restartShiftXAnimation();
    restartShiftYAnimation();
  }

  function resetMask() {
    scan.action = false;
    maask.x1 = 0;
    maask.y1 = 0;
    if (g.imgSource) {
      maask.x2 = g.imgSource.width;
      maask.y2 = g.imgSource.height;
    }
    scanArea();
    params.mode = "scan";
  }

  function copyResult() {
    if (g.result) g.imgSource = g.result.get();
    if (g.result) g.result.clear();
    params.mode = "scan";
    params.frame = 0;
    shade.frame = 0;
    maask.x1 = 0;
    maask.y1 = 0;
    if (g.imgSource) {
      maask.x2 = g.imgSource.width;
      maask.y2 = g.imgSource.height;
    }
    maapClear();
    scanArea();
    restartShiftXAnimation();
    restartShiftYAnimation();
    restartScalingAnimation();
    restartRotationAnimation();
  }

  function refreshVisibility() {
    const show = (id, vis) => {
      const el = document.querySelector(`[data-control-id="${id}"]`);
      if (el) el.style.display = vis ? '' : 'none';
    };
    
    show('sn-scan-color', layout.mode === 'layer');
    show('sn-side-mode', layout.mode === 'side');
  }

  function syncUIFromState() {
    panel.syncUIFromState(SECTIONS);
    refreshVisibility();
  }

  function imageAdjust(loadedImage) {
    if (layout.mode === "side") cnv.multWidth = cnv.multSide;
    if (layout.mode === "layer") cnv.multWidth = cnv.multLayer;
  
    let maxWidth = Math.min(cnv.maxWidth, Math.floor(window.innerWidth * cnv.multWidth));
    let maxHeight = Math.min(cnv.maxHeight, Math.floor(window.innerHeight * cnv.multHeight));
  
    let w = maxWidth / loadedImage.width;
    let h = maxHeight / loadedImage.height;
    let density;
    let minRatio = Math.min(w, h);
    minRatio === w
      ? (density = loadedImage.width / maxWidth)
      : (density = loadedImage.height / maxHeight);
  
    cnv.width = loadedImage.width * minRatio;
    cnv.height = loadedImage.height * minRatio;
    cnv.density = density;
  }

  function imageReadytoUse(loadedImage) {
    imageAdjust(loadedImage);
    g.imgSource = loadedImage.get();
  
    if (g.source != null) { try { g.source.remove(); } catch(e){} }
    g.source = p.createGraphics(g.imgSource.width, g.imgSource.height);
    g.source.pixelDensity(1);
    g.source.noStroke();
    g.source.imageMode(p.CENTER);
  
    if (g.result != null) { try { g.result.remove(); } catch(e){} }
    g.result = p.createGraphics(g.imgSource.width, g.imgSource.height);
    g.result.pixelDensity(1);
    g.result.noStroke();
  
    maask.x1 = 0;
    maask.y1 = 0;
    maask.x2 = g.imgSource.width;
    maask.y2 = g.imgSource.height;
  
    prepareShade(g.imgSource);
  
    params.frame = 0;
    shade.frame = 0;
    restartShiftXAnimation();
    restartShiftYAnimation();
    restartScalingAnimation();
    restartRotationAnimation();
    maapClear();
    scanArea();
  }

  function fitCanvas() {
    const w = canvasContainer.clientWidth || window.innerWidth;
    const h = canvasContainer.clientHeight || window.innerHeight;
    p.resizeCanvas(w, h);
    if (g.imgSource) imageAdjust(g.imgSource);
    scanArea();
  }

  // Mirrors the original drawCanvas(): the source buffer is rebuilt every
  // frame (so mouse drag and animations preview live, not only while
  // scanning), then the scan head advances, then the layout is composited
  // around the window centre.
  function drawCanvas() {
    p.push();
    p.translate(p.width / 2 - cnv.width / 2, p.height / 2 - cnv.height / 2);

    g.source.clear();
    g.source.push();
    g.source.translate(g.source.width / 2, g.source.height / 2);

    translateMouse();

    if (params.mode === "scan") maapUse(p);

    g.source.translate(maap.translate.x, maap.translate.y);

    shiftXMode(p);
    shiftYMode(p);
    scalingMode(p);
    rotationMode(p);

    g.source.image(g.imgSource, 0, 0, g.imgSource.width, g.imgSource.height);
    g.source.pop();

    if (scan.action) {
      params.frame += scan.speed;
      startScanning(p);
    }

    layoutMode(p);
    p.pop();
  }

  // Maps the window-space mouse into source-image coordinates (params.mouse)
  // and display coordinates (params.cmouse); mask drawing depends on this.
  function translateMouse() {
    let posX = 0;
    let posY = 0;

    if (layout.mode === "side") {
      posX = p.constrain(
        posX,
        p.mouseX - (p.width / 2 - cnv.width - cnv.offSide + cnv.uiSize),
        p.width / 2 - cnv.offSide
      );
    } else if (layout.mode === "layer") {
      posX = p.constrain(
        posX,
        p.mouseX - (p.width / 2 - cnv.width / 2 - cnv.offSide + cnv.uiSize),
        p.width / 2 - cnv.offSide
      );
    }

    posY = p.constrain(posY, p.mouseY - (p.height / 2 - cnv.height / 2), p.height / 2 + cnv.height / 2);
    posX = p.map(posX, 0, cnv.width, 0, g.source.width);
    posY = p.map(posY, 0, cnv.height, 0, g.source.height);
    posX = Math.floor(p.constrain(posX, 0, g.source.width));
    posY = Math.floor(p.constrain(posY, 0, g.source.height));

    params.mouse.x = posX;
    params.mouse.y = posY;
    params.cmouse.x = posX / cnv.density;
    params.cmouse.y = posY / cnv.density;
  }

  function loadingImageText() {
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.noStroke();
    p.textSize(18);
    p.textAlign(p.CENTER);
    p.fill(0);
    p.text("LOADING IMAGE", 0, 0);
    p.fill(220, p.map(p.sin(p.frameCount / 10), -1, 1, 0, 255));
    p.text("LOADING IMAGE", 0, 0);
    p.pop();
  }

  // --- Persistence ---
  function serializeState() {
    return {
      cnv: JSON.parse(JSON.stringify(cnv)),
      maask: JSON.parse(JSON.stringify(maask)),
      scan: JSON.parse(JSON.stringify(scan)),
      shade: JSON.parse(JSON.stringify(shade)),
      grain: JSON.parse(JSON.stringify(grain)),
      params: JSON.parse(JSON.stringify(params)),
      layout: JSON.parse(JSON.stringify(layout)),
      shift: JSON.parse(JSON.stringify(shift)),
      scaling: JSON.parse(JSON.stringify(scaling)),
      rotation: JSON.parse(JSON.stringify(rotation)),
    };
  }

  const { saveState, loadState } = createPersistence(
    STORAGE_KEY,
    'sondeo',
    serializeState,
    (data) => {
      deepMerge(cnv, data.cnv);
      deepMerge(maask, data.maask);
      deepMerge(scan, data.scan);
      deepMerge(shade, data.shade);
      deepMerge(grain, data.grain);
      deepMerge(params, data.params);
      deepMerge(layout, data.layout);
      deepMerge(shift, data.shift);
      deepMerge(scaling, data.scaling);
      deepMerge(rotation, data.rotation);
      // Transient runtime flags must not survive a reload: a persisted
      // scan.action=true would autostart scanning into a stale buffer.
      scan.action = false;
      scan.position = 0;
      params.mode = "scan";
      params.frame = 0;
      maask.first = true;
      maask.draw = false;
    }
  );

  function doExportPNG() {
    if (!g.result) return;
    let s = p.createGraphics(g.result.width, g.result.height);
    s.pixelDensity(1);
    s.background(cnv.bgResult);
    s.image(g.result, 0, 0);
    exportPNG(p, 'sondeo', s);
    try { s.remove(); } catch(e){}
  }
  
  function doExportMask() {
    if (!g.result) return;
    let s = p.createGraphics(maask.x2 - maask.x1, maask.y2 - maask.y1);
    let img = p.createImage(maask.x2 - maask.x1, maask.y2 - maask.y1);
    s.pixelDensity(1);
    img.copy(
      g.result,
      maask.x1,
      maask.y1,
      maask.x2 - maask.x1,
      maask.y2 - maask.y1,
      0,
      0,
      maask.x2 - maask.x1,
      maask.y2 - maask.y1
    );
    s.background(cnv.bgResult);
    s.image(img, 0, 0);
    exportPNG(p, 'sondeo-mask', s);
    try { s.remove(); } catch(e){}
  }

  // --- p5 lifecycle ---
  p.setup = () => {
    canvasContainer = document.getElementById('sondeo-canvas');
    if (!canvasContainer) return;
    const canvasEl = p.createCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
    canvasEl.mouseOver(() => { cnv.canvasOver = true; });
    canvasEl.mouseOut(() => { cnv.canvasOver = false; });
    // Preview at 1× pixel density (export still uses full-resolution
    // offscreen buffers). rectMode CORNERS matches layout.js (x1,y1,x2,y2).
    p.pixelDensity(1);
    p.rectMode(p.CORNERS);

    // Seed the simplex generators (the original's newSimplex*() calls in
    // setup). Without this every randomSystem.simplex* stays null and the
    // first noise-based animation or shade/grain scan crashes on .noise2D.
    randomSystem.init(state);

    let fileInput = document.getElementById('sn-hidden-file-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'sn-hidden-file-input';
      fileInput.style.display = 'none';
      fileInput.accept = 'image/*';
      fileInput.onchange = (e) => {
        if (e.target.files[0]) {
          const url = URL.createObjectURL(e.target.files[0]);
          p.loadImage(url, (img) => {
            imageReadytoUse(img);
          });
        }
      };
      document.body.appendChild(fileInput);
    }

    loadState();
    p.loadImage(`${import.meta.env.BASE_URL}assets/sondeo/default.webp`, (img) => {
      imageReadytoUse(img);
      isReady = true;
    });

    buildUI();
    syncUIFromState();
    document.getElementById('sn-btn-save-png')?.addEventListener('click', doExportPNG);
    document.getElementById('sn-btn-save-mask')?.addEventListener('click', doExportMask);
  };

  p.draw = () => {
    // Live only while scanning, dragging, or after a dirty UI change.
    const live =
      scan.action ||
      p.mouseIsPressed ||
      dirty.needsDraw() ||
      params.mode === 'mask';
    if (isReady && g.imgSource && g.source && !live) {
      dirty.afterDraw();
      return;
    }

    p.clear();
    // Mask mode dims the page behind the canvas with translucent red,
    // exactly like the original (params.bg alpha 0.5 vs 0).
    if (params.mode === "mask") p.background(255, 0, 0, 127);

    if (!isReady || !g.imgSource || !g.source) {
      loadingImageText();
      return;
    }

    p.cursor(p.CROSS);
    drawCanvas();
    dirty.consume();
    if (!scan.action && !p.mouseIsPressed) dirty.afterDraw();
  };

  // Original gates mask interaction on a press that starts inside the
  // canvas area, not on hover.
  p.mousePressed = () => {
    if (isOverPanel('app-sondeo', p.mouseX, p.mouseY)) return;
    if (
      params.cmouse.x > 1 &&
      params.cmouse.x < cnv.width - 1 &&
      params.cmouse.y > 1 &&
      params.cmouse.y < cnv.height - 1
    ) {
      cnv.mouseOver = true;
      dirty.markDirty();
    } else if (params.mode === "mask" && cnv.canvasOver) {
      cnv.mouseOver = true;
      dirty.markDirty();
    }
  };

  p.mouseReleased = () => {
    cnv.mouseOver = false;
    dirty.markDirty();
  };

  p.mouseDragged = () => {
    if (cnv.mouseOver) dirty.markDirty();
  };

  p.keyPressed = (e) => {
    // Only react while the Sondeo tab is active and focus is not in a field.
    const view = document.getElementById('app-sondeo');
    if (!view || !view.classList.contains('active')) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e && (e.altKey || e.metaKey || e.ctrlKey)) return;

    switch (p.keyCode) {
      case 32: // Space — start/stop scan
        startScan();
        e?.preventDefault();
        break;
      case 68: // D — download result
        doExportPNG();
        break;
      case 82: // R — restart scan
        resetScan();
        break;
      case 84: // T — reset transformations
        resetTransform();
        break;
      case 77: // M / Shift+M — mask mode / reset mask
        p.keyIsDown(p.SHIFT) ? resetMask() : changeMode();
        break;
      case 76: // L — toggle layout
        layout.mode = layout.mode === "side" ? "layer" : "side";
        changeLayout();
        syncUIFromState();
        break;
      case 83: // S — toggle scan direction
        scan.type = scan.type === "horizontal" ? "vertical" : "horizontal";
        scan.action = false;
        scanArea();
        syncUIFromState();
        break;
    }
  };

  p.windowResized = () => {
    if (canvasContainer) fitCanvas();
    dirty.markDirty();
  };
}

function pickOptionMaps(mod) {
  const runtime = new Set(['cnv', 'maask', 'scan', 'shade', 'grain', 'params', 'layout', 'shift', 'scaling', 'rotation', 'maap', 'g']);
  const out = {};
  for (const key of Object.keys(mod)) {
    if (!runtime.has(key)) out[key] = mod[key];
  }
  return out;
}
