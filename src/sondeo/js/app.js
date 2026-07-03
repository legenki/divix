import * as state from './state.js';
import { SECTIONS } from './controls.js';
import { layoutMode } from './layout.js';
import { maapUse, maapClear } from './maap.js';
import { rotationMode } from './rotate.js';
import { scalingMode } from './scale.js';
import { startScanning, prepareShade } from './scan.js';
import { shiftXMode, shiftYMode, restartShiftXAnimation, restartShiftYAnimation } from './shift.js';

import { createPersistence } from '../../shared/utils/persistence.js';
import { timestamp } from '../../shared/utils/datetime.js';
import { downloadPresetJSON, openPresetFile } from '../../shared/utils/presetIO.js';
import { deepMerge } from '../../shared/utils/deepMerge.js';
import { exportPNG, exportMP4 } from '../../shared/utils/exportMedia.js';
import { createPanelBuilder, buildPresetSection, openSections } from '../../shared/ui/panelBuilder.js';

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

export function scanComplete(p) {
  scan.action = false;
  params.frame = 0;
  shade.frame = 0;
  scanType(p);
  restartRotationAnimation();
  restartScalingAnimation();
  restartShiftXAnimation();
  restartShiftYAnimation();
}

export function scanType(p) {
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

export function scanArea(p) {
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

  scanType(p);
}

export function sondeoSketch(p) {
  let canvasContainer;
  let isReady = false;
  let PRESETS = {};
  
  const recVideo = { active: false, seconds: 10 };
  
  const fullState = { cnv, maask, scan, shade, grain, params, layout, shift, scaling, rotation, maap, ...pickOptionMaps(state) };
  const panel = createPanelBuilder({ state: fullState, applyChange, refreshVisibility });

  function buildUI() {
    const root = document.getElementById('sn-controls');
    if (!root) return;
    root.innerHTML = '';

    buildPresetSection(root, {
      idPrefix: 'sn',
      presets: PRESETS,
      onExport: exportPreset,
      onImport: importPreset,
    });
    panel.buildSections(root, SECTIONS);
    openSections(root, [0, 1]);
    refreshVisibility();
  }

  function applyChange(ctrl) {
    if (ctrl.regen === 'layout') {
      changeLayout();
    } else if (ctrl.action === 'resetScan') {
      resetScan();
    } else if (ctrl.action === 'startScan') {
      scan.action = !scan.action;
      if (!scan.action) scanComplete(p);
    } else if (ctrl.action === 'copyResult') {
      copyResult();
    } else if (ctrl.action === 'resetMask') {
      resetMask();
    } else if (ctrl.action === 'upload') {
      const el = document.getElementById('sn-hidden-file-input');
      if (el) el.click();
    }
    refreshVisibility();
    saveState();
  }

  function changeLayout() {
    params.sideMode === "full" ? (cnv.uiSize = 0) : (cnv.uiSize = -155);
    if (layout.mode === "layer") cnv.uiSize = -155;
  
    if (g.imgSource) imageAdjust(g.imgSource);
    scan.action = false;
    maapClear();
    scanArea(p);
    restartRotationAnimation();
    restartScalingAnimation();
    restartShiftXAnimation();
    restartShiftYAnimation();
  }

  function resetScan() {
    scan.action = false;
    params.frame = 0;
    shade.frame = 0;
    if (g.result) g.result.clear();
    maapClear();
    scanArea(p);
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
    scanArea(p);
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
    scanArea(p);
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
  
    let maxWidth = Math.min(cnv.maxWidth, Math.floor(window.innerWidth * cnv.multWidth) + cnv.uiSize);
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
  
    if (g.source != null) g.source.remove();
    g.source = p.createGraphics(g.imgSource.width, g.imgSource.height);
    g.source.pixelDensity(1);
    g.source.noStroke();
    g.source.imageMode(p.CENTER);
  
    if (g.result != null) g.result.remove();
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
    scanArea(p);
  }

  function fitCanvas() {
    const w = canvasContainer.clientWidth || window.innerWidth;
    const h = canvasContainer.clientHeight || window.innerHeight;
    p.resizeCanvas(w, h);
    if (g.imgSource) imageAdjust(g.imgSource);
    scanArea(p);
  }

  function drawScene() {
    if (scan.action && params.frame % params.skip === 0) {
      if (g.source) {
        g.source.clear();
        g.source.push();
        g.source.translate(g.source.width / 2, g.source.height / 2);
        shiftXMode(p);
        shiftYMode(p);
        scalingMode(p);
        rotationMode(p);
        if (g.imgSource) g.source.image(g.imgSource, 0, 0);
        g.source.pop();
        startScanning(p);
      }
    }
  
    if (scan.action) params.frame++;
  
    p.background(220); // Default background if needed, will be covered by layoutMode
    layoutMode(p);
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
    }
  );

  function applyPreset(preset) {
    if (!preset) return;
    deepMerge(cnv, preset.cnv);
    deepMerge(maask, preset.maask);
    deepMerge(scan, preset.scan);
    deepMerge(shade, preset.shade);
    deepMerge(grain, preset.grain);
    deepMerge(params, preset.params);
    deepMerge(layout, preset.layout);
    deepMerge(shift, preset.shift);
    deepMerge(scaling, preset.scaling);
    deepMerge(rotation, preset.rotation);
    
    changeLayout();
    syncUIFromState();
    saveState();
  }

  function exportPreset() {
    downloadPresetJSON(`sondeo-preset-${timestamp()}.json`, serializeState());
  }

  function importPreset() {
    openPresetFile((data) => applyPreset(data), () => setStatus('Invalid preset file'));
  }

  function setStatus(msg) {
    const el = document.getElementById('sn-export-status');
    if (el) el.innerText = msg;
  }

  function doExportPNG() {
    if (!g.result) return;
    let s = p.createGraphics(g.result.width, g.result.height);
    s.pixelDensity(1);
    s.background(cnv.bgResult);
    s.image(g.result, 0, 0);
    exportPNG(s, 'sondeo');
    s.remove();
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
    exportPNG(s, 'sondeo-mask');
    s.remove();
  }

  // --- p5 lifecycle ---
  p.setup = () => {
    canvasContainer = document.getElementById('sondeo-canvas');
    if (!canvasContainer) return;
    p.createCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
    p.pixelDensity(1);
    p.imageMode(p.CENTER);

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

    const restored = loadState();

    p.loadImage(`${import.meta.env.BASE_URL}assets/sondeo/default.jpg`, (img) => {
      imageReadytoUse(img);
      isReady = true;
    });

    fetch(`${import.meta.env.BASE_URL}assets/sondeo/presets.json`)
      .then((r) => r.json())
      .then((d) => { PRESETS = d; })
      .catch((e) => console.warn('[sondeo] presets load failed:', e))
      .finally(() => {
        buildUI();
        if (restored) {
          syncUIFromState();
        } else if (Object.keys(PRESETS).length) {
          const keys = Object.keys(PRESETS);
          applyPreset(PRESETS[keys[0]]);
        } else {
          syncUIFromState();
        }
        
        document.getElementById('sn-btn-save-png')?.addEventListener('click', doExportPNG);
        document.getElementById('sn-btn-save-mask')?.addEventListener('click', doExportMask);
      });
  };

  p.draw = () => {
    if (!isReady) return;
    
    if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
      cnv.mouseOver = true;
      params.mouse.x = p.mouseX;
      params.mouse.y = p.mouseY;
    } else {
      cnv.mouseOver = false;
    }
    
    p.cursor(p.CROSS);
    maapUse(p);
    drawScene();
  };

  p.windowResized = () => {
    if (canvasContainer) fitCanvas();
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
