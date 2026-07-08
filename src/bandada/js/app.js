// BANDADA — main workspace controller.
// Assembles the simulation logic, UI, and export pipeline.

import * as state from './state.js';
import { Flock } from './flock.js';
import { SECTIONS } from './controls.js';
import { V2D } from './v2d.js';
import { randomObjectValue, snapGrid } from './utils.js';

import { createPersistence } from '../../shared/utils/persistence.js';
import { timestamp } from '../../shared/utils/datetime.js';
import { downloadPresetJSON, openPresetFile } from '../../shared/utils/presetIO.js';
import { deepMerge } from '../../shared/utils/deepMerge.js';
import { exportPNG, exportMP4 } from '../../shared/utils/exportMedia.js';
import {
  createPanelBuilder,
  buildPresetSection,
  openSections,
} from '../../shared/ui/panelBuilder.js';

const STORAGE_KEY = 'bandada-tool';

const { cnv, seed, params, debug, g, rec, texture } = state;

export function bandadaSketch(p) {
  let canvasContainer;
  let isReady = false;
  let flock = null;
  let gAlpha = null;
  let PRESETS = {};

  const recVideo = { active: false, seconds: 10 };

  const fullState = {
    cnv,
    seed,
    params,
    debug,
    g,
    rec,
    ...pickOptionMaps(state),
  };

  const panel = createPanelBuilder({ state: fullState, applyChange, refreshVisibility });

  function buildUI() {
    const root = document.getElementById('bn-controls');
    if (!root) return;
    root.innerHTML = '';

    buildPresetSection(root, {
      idPrefix: 'bd',
      presets: PRESETS,
      onExport: exportPreset,
      onImport: importPreset,
    });
    panel.buildSections(root, SECTIONS);
    openSections(root, [0, 3]);
    refreshVisibility();
  }

  function applyChange(ctrl) {
    if (ctrl.action === 'uploadImage') {
      document.getElementById('bn-image-file-input')?.click();
    }
    switch (ctrl.regen) {
      case 'canvas':
        setupBuffers();
        break;
      case 'shape':
        // g.shapeTypes is a precomputed per-boid array — rebuild it from the
        // new params.shape before flock.update()'s shape-mismatch check copies
        // it onto the boids (the donor's Shape Type change handler does the
        // same, ui.js:334-338). Without this the mismatch check reassigns the
        // SAME stale strings and the control appears dead.
        updateShapeTypes();
        if (!cnv.animation && flock) flock.update();
        break;
      case 'skew':
      case 'color':
        // Values updated via reference tracking (syncGlobals recomputes the
        // derived g.* fields every frame).
        break;
      case 'boids':
        flock.resize(params.boids.value);
        break;
      case 'flock':
      case 'sim':
      case 'edge':
        restartSimulation();
        break;
    }
    refreshVisibility();
    saveState();
  }

  function refreshVisibility() {
    const show = (id, vis) => {
      const el = document.querySelector(`[data-control-id="${id}"]`);
      if (el) el.style.display = vis ? '' : 'none';
    };

    show('bd-edge-offset', params.edge.mode === 'repel');
    show('bd-edge-ease', params.edge.mode === 'repel');
    show('bd-bg-color', cnv.bg.mode !== 'alpha');
    show('bd-skew-level', params.skew.mode !== 'none');
    show('bd-skew-reaction', params.skew.mode !== 'none');
    
    const isVector = params.render === 'vector';
    show('bd-fill-style', isVector);
    show('bd-fill-reaction', isVector && params.fill.style !== 'none');
    show('bd-fill-start', isVector && params.fill.style !== 'none');
    show('bd-fill-end', isVector && params.fill.style !== 'none');
    
    show('bd-stroke-style', isVector);
    show('bd-stroke-width', isVector && params.stroke.style !== 'none');
    show('bd-stroke-reaction', isVector && params.stroke.style !== 'none');
    show('bd-stroke-start', isVector && params.stroke.style !== 'none');
    show('bd-stroke-end', isVector && params.stroke.style !== 'none');
  }

  function syncUIFromState() {
    panel.syncUIFromState(SECTIONS);
    refreshVisibility();
  }

  // --- Buffers ---
  function setupBuffers() {
    const res = state.RESOLUTIONS[cnv.ratio];
    const targetWidth = res.width;
    const targetHeight = res.height;

    if (!g.ctx) {
      g.ctx = p.createGraphics(targetWidth, targetHeight);
      g.ctx.pixelDensity(cnv.density.base);
      g.ctx.imageMode(p.CENTER);
      g.ctx.ellipseMode(p.CENTER);
      g.ctx.rectMode(p.CENTER);
      
      gAlpha = p.createGraphics(targetWidth, targetHeight);
      gAlpha.pixelDensity(cnv.density.base);
    } else {
      g.ctx.resizeCanvas(targetWidth, targetHeight);
      g.ctx.pixelDensity(cnv.density.base);
      gAlpha.resizeCanvas(targetWidth, targetHeight);
      gAlpha.pixelDensity(cnv.density.base);
    }

    g.width = g.ctx.width;
    g.height = g.ctx.height;
    
    if (texture.data) {
      g.texture = updateImageAsTexture(cnv.density.base);
    } else {
      g.texture = null;
    }
    
    updateAlphaBuffer(targetWidth, targetHeight);
  }

  function updateImageAsTexture(density) {
    if (!texture.data) return null;
    const imgW = texture.data.width;
    const imgH = texture.data.height;
    const canvasW = g.ctx.width;
    const canvasH = g.ctx.height;

    const scaleToFill = Math.max(canvasW / imgW, canvasH / imgH);
    const offsetX = (canvasW - imgW * scaleToFill) / 2;
    const offsetY = (canvasH - imgH * scaleToFill) / 2;

    const tex = p.createGraphics(canvasW, canvasH);
    tex.pixelDensity(density);
    tex.translate(offsetX, offsetY);
    tex.scale(scaleToFill);
    tex.image(texture.data, 0, 0);

    return tex;
  }
  
  function updateAlphaBuffer(width, height) {
    gAlpha.push();
    gAlpha.noStroke();
    gAlpha.fill(255);
    gAlpha.rectMode(p.CORNER);
    gAlpha.rect(0, 0, width, height);

    let size = (height + width) / 100;
    let xBool = true;
    let yBool;

    let modY = height % size;
    let modX = width % size;
    let divY = modY / (height / size);
    let divX = modX / (width / size);

    for (let y = 0; y < height - modY; y += size + divY) {
      xBool = !xBool;
      yBool = !xBool;
      for (let x = 0; x < width - modX; x += size + divX) {
        yBool = !yBool;
        yBool ? gAlpha.fill(255) : gAlpha.fill(220);
        gAlpha.rect(x, y, size + divX, size + divY);
      }
    }
    gAlpha.pop();
  }

  function fitCanvas() {
    const w = canvasContainer.clientWidth || window.innerWidth;
    const h = canvasContainer.clientHeight || window.innerHeight;
    p.resizeCanvas(w, h);
  }

  // --- Simulation logic ---

  function seedEvent() {
    p.randomSeed(seed.value);
    p.noiseSeed(seed.value);
  }

  function restartSimulation() {
    g.ctx.clear();
    g.frame = 0;
    cnv.animation = true;

    seedEvent();
    syncGlobals();
    updateRandomArrays();
    
    if (!flock) {
      flock = new Flock(params.boids.value, p);
    } else {
      flock.reset();
    }
  }

  function syncGlobals() {
    g.delta = 1;
    g.minCanvasSide = Math.min(g.width, g.height);
    g.speedTime = 1;
    g.steerTime = 1;
    
    g.boidsCount = params.boids.value;
    g.alignment = params.alignment.value;
    g.aligmentBias = params.bias.value;
    g.cohesion = params.cohesion.value;
    g.separation = params.separation.value;
    
    g.accuracy = params.accuracy.value >= 10 ? 0 : Math.pow(2, params.accuracy.value);
    g.steering = params.steering.value;
    g.steerReaction = params.steering.reaction * g.steerTime;
    g.gridPadding = 0;

    const flockVision = Math.max(params.vision.value * (Math.min(g.width, g.height) / 100), 4);
    g.vision = params.vision.value === 0 ? 0 : flockVision;
    g.sqVision = g.vision * g.vision;

    const baseScale = g.defaultSize * ((g.width + g.height) / 1280);
    g.scale = baseScale * params.scale.value;
    g.maxScale = g.scale * 0.5;

    g.speedMin = params.speed.value.min * g.speedTime;
    g.speedMax = params.speed.value.max * g.speedTime + 0.01;
    g.drag = params.drag.value;

    g.noiseAngle = params.angle.value !== 0;
    g.noiseAngleRange = (Math.PI / 80) * params.angle.value;

    g.scaleRandom = params.scale.random.value;

    g.bounce = params.edge.mode !== 'wrap';
    g.bounceOffset = p.map(params.edge.offset.value, params.edge.offset.min, params.edge.offset.max, 0.01, 0.45);
    g.bounceEase = p.map(params.edge.ease.value, params.edge.ease.min, params.edge.ease.max, 5, 0.05);

    g.skewMode = `${params.skew.mode}Skew`;
    g.skewValue = params.skew.value;
    g.skewReaction = params.skew.reaction;

    g.renderMode = `${params.render}Render`;
    g.shapeType = `${params.shape}Shape`;

    g.fillStyle = `${params.fill.style}Color`;
    g.fillColors = [p.color(params.fill[0]), p.color(params.fill[1])];
    g.fillReaction = params.fill.reaction;

    g.strokeStyle = `${params.stroke.style}Color`;
    g.strokeColors = [p.color(params.stroke[0]), p.color(params.stroke[1])];
    g.strokeReaction = params.stroke.reaction;
    g.strokeWeight = params.stroke.width.value;

    const mouseForce = 1 + g.speedMax * (g.alignment + g.cohesion + g.separation + 1);
    const forceLevel = p.map(cnv.mouseForce.value, cnv.mouseForce.min, cnv.mouseForce.max, 200, 5);
    g.mouse.force = Math.max(mouseForce / forceLevel, 0);

    if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
      g.mouse.over = true;
      const scale = Math.min((p.width * 0.85) / g.ctx.width, (p.height * 0.85) / g.ctx.height);
      const gw = g.ctx.width * scale;
      const gh = g.ctx.height * scale;
      const offsetX = (p.width - gw) / 2;
      const offsetY = (p.height - gh) / 2;
      g.mouse.x = p.map(p.mouseX, offsetX, offsetX + gw, 0, g.ctx.width);
      g.mouse.y = p.map(p.mouseY, offsetY, offsetY + gh, 0, g.ctx.height);
    } else {
      g.mouse.over = false;
    }
    
    g.mouse.down = p.mouseIsPressed;
    g.mouse.button = p.mouseButton.left ? 0 : (p.mouseButton.right ? 2 : 1);

    if (cnv.animation) g.frame++;
  }

  function updateRandomArrays() {
    updateShapesVelocity();
    updateShapeTypes();
    updateShapesScale();
    updateShapePositions();
    updateShapesColor();
  }

  function updateShapeTypes() {
    g.shapeTypes = [];
    for (let i = 0; i < params.boids.max; i++) {
      const shapeType = params.shape === "mixed" ? randomObjectValue(p, state.SHAPE_TYPES, [0]) : params.shape;
      g.shapeTypes.push(`${shapeType}Shape`);
    }
  }

  function updateShapePositions() {
    g.shapePos = [];
    const minWidth = g.maxScale;
    const maxWidth = g.width - g.maxScale;
    const minHeight = g.maxScale;
    const maxHeight = g.height - g.maxScale;

    for (let i = 0; i < params.boids.max; i++) {
      const x = p.random(minWidth, maxWidth);
      const y = p.random(minHeight, maxHeight);

      const xpos = snapGrid(x, g.width, minWidth, maxWidth);
      const ypos = snapGrid(y, g.height, minHeight, maxHeight);

      g.shapePos.push({ x: xpos, y: ypos });
    }
  }

  function updateShapesVelocity() {
    g.shapeVelocity = [];
    for (let i = 0; i < params.boids.max; i++) {
      g.shapeVelocity.push(V2D.random(p.random(g.speedMin, g.speedMax)));
    }
  }

  function updateShapesScale() {
    g.shapeScale = [];
    for (let i = 0; i < params.boids.max; i++) {
      g.shapeScale.push(p.random(-0.2, 0.9));
    }
  }

  function updateShapesColor() {
    g.shapeColor = [];
    for (let i = 0; i < params.boids.max; i++) {
      g.shapeColor.push(p.random());
    }
  }

  function drawScene() {
    g.ctx.reset();
    g.ctx.noFill();
    g.ctx.noStroke();

    if (cnv.bg.mode === "alpha") {
      g.ctx.clear();
      g.ctx.image(gAlpha, g.ctx.width / 2, g.ctx.height / 2, g.ctx.width, g.ctx.height);
    } else {
      g.ctx.background(cnv.bg.color);
      if (cnv.bg.mode === "image" && g.texture) {
        g.ctx.image(g.texture, g.ctx.width / 2, g.ctx.height / 2, g.ctx.width, g.ctx.height);
      }
    }

    syncGlobals();

    if (cnv.animation && flock) {
      flock.update();
    }

    if (flock) {
      flock.draw();
    }
  }

  function blitToVisible() {
    p.clear();
    const res = state.RESOLUTIONS[cnv.ratio];
    const scale = Math.min((p.width * 0.85) / g.ctx.width, (p.height * 0.85) / g.ctx.height);
    
    if (cnv.bg.mode !== 'transparent') {
      p.push();
      p.noStroke();
      p.fill(cnv.bg.color || '#ffffff');
      p.rectMode(p.CENTER);
      p.rect(p.width / 2, p.height / 2, res.width * scale, res.height * scale);
      p.pop();
    }

    p.image(g.ctx, p.width / 2, p.height / 2, g.ctx.width * scale, g.ctx.height * scale);
  }

  // --- Persistence ---
  function serializeState() {
    return {
      cnv: JSON.parse(JSON.stringify(cnv)),
      seed: JSON.parse(JSON.stringify(seed)),
      params: JSON.parse(JSON.stringify(params)),
      rec: {
        type: rec.type,
        quality: rec.quality,
        length: { value: rec.length.value },
      },
    };
  }

  const { saveState, loadState } = createPersistence(
    STORAGE_KEY,
    'bandada',
    serializeState,
    (data) => {
      deepMerge(cnv, data.cnv);
      deepMerge(seed, data.seed);
      deepMerge(params, data.params);
      deepMerge(rec, data.rec);
    }
  );

  function applyPreset(preset) {
    if (!preset) return;
    deepMerge(cnv, preset.cnv);
    deepMerge(seed, preset.seed);
    deepMerge(params, preset.params);
    deepMerge(rec, preset.rec);
    cnv.frame = preset.cnv?.frame ?? 0;
    
    setupBuffers();
    restartSimulation();
    syncUIFromState();
    saveState();
  }

  function exportPreset() {
    downloadPresetJSON(`bandada-preset-${timestamp()}.json`, serializeState());
  }

  function importPreset() {
    openPresetFile(
      (data) => applyPreset(data),
      () => setStatus('Invalid preset file')
    );
  }

  function setStatus(msg) {
    const el = document.getElementById('bn-export-status');
    if (el) el.innerText = msg;
  }

  async function withHighResExport(fn) {
    const savedBase = cnv.density.base;
    try {
      // Density multiplier against the fixed-ratio buffer's own edge, not the
      // browser window's — otherwise "Export Size (px)" would silently depend
      // on how big the window happened to be when the user clicked export.
      const maxEdge = Math.max(g.ctx.width, g.ctx.height);
      const targetEdge = cnv.density.export || 1000;
      const exportDensity = Math.max(1, targetEdge / maxEdge);
      
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
      // Save g.ctx itself (the fixed-ratio composite), not p.canvas — the
      // visible canvas is a full-viewport surface whose aspect ratio tracks
      // the browser window, not cnv.ratio, so saving it directly would export
      // whatever rectangle the window happens to be instead of the ratio the
      // user configured.
      drawScene();
      exportPNG(p, 'bandada', g.ctx);
    });
  }

  function doExportMP4() {
    recVideo.seconds = rec.length.value;
    return withHighResExport(() => {
      return exportMP4({
        p,
        prefix: 'bandada',
        cnv,
        rec,
        recVideo,
        drawComposite: drawScene,
        setStatus,
        getCanvas: () => g.ctx.canvas,
        getSize: () => ({
          w: Math.floor(g.ctx.width * cnv.density.base),
          h: Math.floor(g.ctx.height * cnv.density.base)
        })
      });
    });
  }

  function bindFooter() {
    document.getElementById('bn-btn-save-png')?.addEventListener('click', doExportPNG);
    document.getElementById('bn-btn-save-mp4')?.addEventListener('click', doExportMP4);
    document.getElementById('bd-preset')?.addEventListener('change', (e) => {
      const preset = PRESETS[e.target.value];
      if (preset) applyPreset(preset);
    });
  }

  function bindImageUpload() {
    document.getElementById('bn-image-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) loadImageFile(file);
      e.target.value = '';
    });
  }

  // Loads a user-picked raster image as the canvas background texture,
  // mirroring the reference's loadUserImage() (events.js): texture.data feeds
  // updateImageAsTexture(). Unlike the reference (which left its render-mode
  // switch commented out), also flip the Background mode to 'image' so the
  // uploaded picture is visible immediately regardless of the current setting.
  function loadImageFile(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setStatus('Unsupported file type');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      p.loadImage(
        event.target.result,
        (img) => {
          texture.data = img;
          g.texture = updateImageAsTexture(cnv.density.base);
          cnv.bg.mode = 'image';
          syncUIFromState();
          saveState();
        },
        (err) => {
          console.warn('[bandada] image load failed:', err);
          setStatus('Image load failed');
        }
      );
    };
    reader.readAsDataURL(file);
  }

  // --- p5 lifecycle ---
  p.setup = () => {
    canvasContainer = document.getElementById('bandada-canvas');
    if (!canvasContainer) return;

    p.createCanvas(
      canvasContainer.clientWidth || window.innerWidth,
      canvasContainer.clientHeight || window.innerHeight
    );
    p.pixelDensity(1);
    p.imageMode(p.CENTER);
    p.frameRate(rec.frameRate);

    setupBuffers();

    const restored = loadState();

    p.loadImage(texture.default, (img) => {
      texture.data = img;
      setupBuffers(); // Re-setup buffers with texture now loaded
      restartSimulation();
    });

    fetch(`${import.meta.env.BASE_URL}assets/bandada/presets.json`)
      .then((r) => r.json())
      .then((d) => {
        PRESETS = d;
      })
      .catch((e) => console.warn('[bandada] presets load failed:', e))
      .finally(() => {
        buildUI();
        bindFooter();
        bindImageUpload();

        const keys = Object.keys(PRESETS);
        if (restored) {
          syncUIFromState();
        } else if (keys.length) {
          const pick = keys[Math.floor(Math.random() * keys.length)];
          applyPreset(PRESETS[pick]);
          const sel = document.getElementById('bd-preset');
          if (sel) sel.value = pick;
        } else {
          syncUIFromState();
        }
        isReady = true;
      });
  };

  p.draw = () => {
    if (!isReady || !g.ctx) return;

    p.cursor(p.HAND);
    drawScene();
    blitToVisible();
  };

  p.windowResized = () => {
    if (canvasContainer) fitCanvas();
  };
}

function pickOptionMaps(mod) {
  const runtime = new Set(['cnv', 'seed', 'params', 'debug', 'g', 'rec', 'texture']);
  const out = {};
  for (const key of Object.keys(mod)) {
    if (!runtime.has(key)) out[key] = mod[key];
  }
  return out;
}
