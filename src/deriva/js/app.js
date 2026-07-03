// DRIFT (Deriva) — main workspace controller.

import * as state from './state.js';
import { SECTIONS } from './controls.js';
import { Form } from './form.js';
import { randomParameters } from './random.js';

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

const STORAGE_KEY = 'deriva-tool';

const { cnv, form, anim, rec, g } = state;

export function derivaSketch(p) {
  let canvasContainer;
  let isReady = false;
  let PRESETS = {};
  
  const recVideo = { active: false, seconds: 10 };
  let formArray = [];
  let isMouseLocked = false;
  let isLoadImage = true;

  const fullState = { cnv, form, anim, rec, ...pickOptionMaps(state) };
  const panel = createPanelBuilder({ state: fullState, applyChange, refreshVisibility });

  function buildUI() {
    const root = document.getElementById('dr-controls');
    if (!root) return;
    root.innerHTML = '';

    buildPresetSection(root, {
      idPrefix: 'dr',
      presets: PRESETS,
      onExport: exportPreset,
      onImport: importPreset,
    });
    panel.buildSections(root, SECTIONS);
    openSections(root, [0, 1]);
    refreshVisibility();
  }

  function applyChange(ctrl) {
    if (ctrl.regen === 'amount') {
      checkFormsAmount();
    } else if (ctrl.regen === 'ui') {
      refreshVisibility();
    } else if (ctrl.action === 'addRandom') {
      addRandomForm();
    } else if (ctrl.action === 'removeLast') {
      removeLastForm();
    } else if (ctrl.action === 'clear') {
      clearAllForms();
    } else if (ctrl.action === 'randomImage') {
      loadUnsplashImage();
    } else if (ctrl.action === 'upload') {
      const el = document.getElementById('dr-hidden-file-input');
      if (el) el.click();
    }
    saveState();
  }

  function refreshVisibility() {
    const show = (id, vis) => {
      const el = document.querySelector(`[data-control-id="${id}"]`);
      if (el) el.style.display = vis ? '' : 'none';
    };
    show('dr-bg-color', cnv.bg.mode === 'custom');
    show('dr-form-frame-w', form.frame.value === 'on');
    show('dr-form-frame-c', form.frame.value === 'on');
  }

  function syncUIFromState() {
    panel.syncUIFromState(SECTIONS);
    refreshVisibility();
  }

  // --- Buffers ---
  function setupBuffers() {
    let w = cnv.image.size;
    let h = cnv.image.size;
    
    if (g.texture.data && g.texture.data.width > 0) {
      w = g.texture.data.width;
      h = g.texture.data.height;
    }
    
    g.ctx = p.createGraphics(w, h);
    g.ctx.pixelDensity(1);
    // g.ctx.imageMode(p.CENTER); // REMOVED
    g.ctx.rectMode(p.CENTER);
    g.ctx.noStroke();
    
    g.preview = p.createGraphics(w, h);
    g.preview.pixelDensity(1);
    g.preview.imageMode(p.CENTER);
    g.preview.rectMode(p.CENTER);
    
    g.alphaImg = createAlphaImage(w, h, 1);
    
    form.size.max.width = g.ctx.width;
    form.size.max.height = g.ctx.height;
    form.coords.x = g.ctx.width / 2;
    form.coords.y = g.ctx.height / 2;
  }

  function createAlphaImage(width, height, density) {
    let buffer = p.createGraphics(width, height);
    buffer.pixelDensity(density);
    buffer.noStroke();
    buffer.push();
    buffer.fill(255);
    buffer.rect(0, 0, width, height);

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
        buffer.fill(yBool ? 255 : 220);
        buffer.rect(x, y, size + divX, size + divY);
      }
    }
    buffer.pop();
    const img = buffer.get();
    buffer.remove();
    return img;
  }

  function fitCanvas() {
    const w = canvasContainer.clientWidth || window.innerWidth;
    const h = canvasContainer.clientHeight || window.innerHeight;
    p.resizeCanvas(w, h);
  }

  // --- Rendering ---
  function drawScene() {
    if (!g.ctx) return;
    g.ctx.clear();
    
    if (cnv.bg.mode === 'transparent') {
      if (!rec.capture && g.alphaImg) {
        // imageMode is CORNER here (only rectMode is CENTER), so this must
        // draw from (0,0) — the reference's image(alphaImg, 0, 0, w, h).
        g.ctx.image(g.alphaImg, 0, 0, g.ctx.width, g.ctx.height);
      }
    } else {
      g.ctx.push();
      g.ctx.noStroke();
      g.ctx.fill(cnv.bg.custom);
      g.ctx.rect(g.ctx.width/2, g.ctx.height/2, g.ctx.width, g.ctx.height);
      g.ctx.pop();
    }

    if (cnv.mouseOver) translateCoords();
    if (cnv.show && g.texture.data) {
      g.ctx.image(g.texture.data, 0, 0, g.ctx.width, g.ctx.height);
    }

    if (form.run) {
      for (let f of formArray) {
        f.run();
        // f.graphics is a full-canvas-sized buffer with the form already
        // positioned inside it via this.graphics.translate(...) — it must be
        // blitted at its native (0,0) corner, not re-centered. g.ctx uses the
        // default CORNER imageMode (see setupBuffers below), so drawing at
        // (g.ctx.width/2, g.ctx.height/2) shifted every form half a canvas
        // right and down from where it was actually placed.
        g.ctx.image(f.graphics, 0, 0);
      }
    }

    if (rec.capture) return;

    if (cnv.mouseOver && !isLoadImage) {
      drawPreview();
      // Same CORNER-imageMode reasoning as above — reference draws at (0,0).
      g.ctx.image(g.preview, 0, 0, g.ctx.width, g.ctx.height);
      // We'll draw preview graphics directly onto the visible canvas in blitToVisible
    }
  }

  function drawPreview() {
    g.preview.clear();
    g.preview.push();
    g.preview.translate(form.mouse.x, form.mouse.y);

    const xSize = form.size.x;
    const ySize = form.size.y;
    
    if (form.type === "ellipse") {
      g.preview.ellipse(0, 0, xSize, ySize);
      g.preview.drawingContext.clip();
    }

    if (g.texture.data) {
      if (cnv.image.preview && form.content === "preview") {
        g.preview.image(g.texture.data, 0, 0, xSize, ySize, cnv.image.x, cnv.image.y, xSize, ySize);
      } else {
        g.preview.image(g.texture.data, 0, 0, xSize, ySize, form.coords.x, form.coords.y, xSize, ySize);
      }
    }
    g.preview.pop();
  }

  function blitToVisible() {
    if (!g.ctx) return;
    p.clear();
    const scale = getCanvasScale();
    const w = g.ctx.width * scale;
    const h = g.ctx.height * scale;
    
    if (cnv.bg.mode !== 'transparent') {
      p.push();
      p.noStroke();
      p.fill(cnv.bg.custom || '#ffffff');
      p.rectMode(p.CENTER);
      p.rect(p.width / 2, p.height / 2, w, h);
      p.pop();
    }

    p.image(g.ctx, p.width / 2, p.height / 2, w, h);

    if (cnv.mouseOver && !rec.capture && !isLoadImage) {
      p.push();
      p.strokeWeight(p.map(scale, 0, 1, 4, 0.4));
      p.fill(cnv.fill);
      p.stroke(cnv.stroke);
      p.rectMode(p.CENTER);
      p.ellipseMode(p.CENTER);
      if (form.type === "rect") {
        p.rect(p.mouseX, p.mouseY, form.size.x * scale, form.size.y * scale);
      } else if (form.type === "ellipse") {
        p.ellipse(p.mouseX, p.mouseY, form.size.x * scale, form.size.y * scale);
      }
      p.pop();
    }
  }

  function getCanvasScale() {
    if (!g.ctx) return 1;
    const margin = cnv.settings.margin || 0.9;
    const uiSize = 340;
    const maxW = (p.width - (window.innerWidth > 768 ? uiSize : 0)) * margin;
    const maxH = p.height * margin;
    return Math.min(maxW / g.ctx.width, maxH / g.ctx.height, 1);
  }

  function translateCoords() {
    if (p.mouseIsPressed && p.mouseButton.right) {
      if (!isMouseLocked) {
        isMouseLocked = true;
        // In full app, requestPointerLock here
      }
      // Handled in mouseDragged
    } else if (isMouseLocked) {
      // exitPointerLock
      isMouseLocked = false;
    }

    const scale = getCanvasScale();
    const gw = g.ctx.width * scale;
    const gh = g.ctx.height * scale;
    const offsetX = (p.width - gw) / 2;
    const offsetY = (p.height - gh) / 2;

    form.mouse.x = p.map(p.mouseX, offsetX, offsetX + gw, 0, g.ctx.width);
    form.mouse.y = p.map(p.mouseY, offsetY, offsetY + gh, 0, g.ctx.height);
    form.coords.x = form.mouse.x - form.size.x / 2;
    form.coords.y = form.mouse.y - form.size.y / 2;
  }

  // --- Forms Management ---
  function activeFormsState() {
    form.amount.active = `${formArray.length} forms`;
    const el = document.getElementById('dr-form-amount');
    if (el) el.title = form.amount.active;
  }

  function addFormPreview() {
    if (p.mouseButton.left && !isLoadImage) {
      cnv.image.preview = true;
      cnv.image.x = form.coords.x;
      cnv.image.y = form.coords.y;
    }
  }

  function addForm(isRandom = false) {
    if ((p.mouseButton.left && cnv.image.preview) || isRandom) {
      cnv.image.preview = false;
      if (formArray.length >= form.amount.num) {
        formArray[0].remove();
        formArray.splice(0, 1);
      }
      formArray.push(new Form(p, isRandom));
    }
    activeFormsState();
  }

  function addRandomForm() {
    addForm(true);
  }

  function removeLastForm() {
    if (formArray.length > 0) {
      const f = formArray.pop();
      f.remove();
    }
    activeFormsState();
  }

  function clearAllForms() {
    for (let f of formArray) f.remove();
    formArray = [];
    if (g.ctx) g.ctx.clear();
    activeFormsState();
  }

  function checkFormsAmount() {
    while (formArray.length > form.amount.num) {
      const f = formArray.pop();
      f.remove();
    }
    activeFormsState();
  }

  // --- Image loading ---
  function loadUnsplashImage() {
    isLoadImage = true;
    const url = 'https://source.unsplash.com/random/' + cnv.image.size + 'x' + cnv.image.size;
    p.loadImage(url, (img) => {
      g.texture.data = img;
      setupBuffers();
      isLoadImage = false;
    }, () => {
      console.warn("Unsplash failed, falling back to default");
      p.loadImage(g.texture.default, (img) => {
        g.texture.data = img;
        setupBuffers();
        isLoadImage = false;
      });
    });
  }

  // --- Persistence ---
  function serializeState() {
    return {
      cnv: JSON.parse(JSON.stringify(cnv)),
      form: JSON.parse(JSON.stringify(form)),
      anim: JSON.parse(JSON.stringify(anim)),
      rec: { type: rec.type, length: { value: rec.length.value } }
    };
  }

  const { saveState, loadState } = createPersistence(
    STORAGE_KEY,
    'deriva',
    serializeState,
    (data) => {
      deepMerge(cnv, data.cnv);
      deepMerge(form, data.form);
      deepMerge(anim, data.anim);
      deepMerge(rec, data.rec);
    }
  );

  function generateForms() {
    clearAllForms();
    let count = form.amount.num;
    for (let i = 0; i < count; i++) {
      formArray.push(new Form(p, true));
    }
    activeFormsState();
  }

  // Preset JSON carries some colors as "#RRGGBB[AA]" strings and others as
  // {r,g,b[,a]} objects (see the reference's presetChange()) — deepMerge
  // copies whichever shape shows up straight into state, so an {r,g,b}
  // preset color reaches the <input type=color> as an object and fails
  // silently (Chrome logs a format warning, the swatch just doesn't update).
  function rgbaToHex({ r, g, b, a = 1 }) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const toHex = (v) => clamp(v).toString(16).padStart(2, '0');
    const alpha = clamp(a * 255);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${alpha < 255 ? toHex(alpha) : ''}`.toUpperCase();
  }

  function normalizePresetColor(obj, path) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o?.[k], obj);
    const c = target?.[last];
    if (c && typeof c === 'object') target[last] = rgbaToHex(c);
  }

  function applyPreset(preset) {
    if (!preset) return;
    deepMerge(cnv, preset.cnv);
    deepMerge(form, preset.form);
    deepMerge(anim, preset.anim);
    deepMerge(rec, preset.rec);

    normalizePresetColor(form, 'frame.color');
    normalizePresetColor(anim, 'tint.color');

    // Presets store form.size.x/y as a 1-100 percentage of the current
    // image's size range (see the reference's presetChange()), not raw
    // pixels — map them into form.size.min..max AFTER the merge above,
    // using the range for the image that's actually loaded right now.
    if (preset.form?.size?.x !== undefined) {
      form.size.x = Math.round(p.map(preset.form.size.x, 1, 100, form.size.min, form.size.max.width));
    }
    if (preset.form?.size?.y !== undefined) {
      form.size.y = Math.round(p.map(preset.form.size.y, 1, 100, form.size.min, form.size.max.height));
    }
    if (preset.form?.size?.uniform) {
      const s = Math.min(form.size.x, form.size.y);
      form.size.x = s;
      form.size.y = s;
    }

    clearAllForms();
    generateForms();
    syncUIFromState();
    saveState();
  }

  function exportPreset() {
    // Presets store form.size.x/y as a 1-100 percentage (see applyPreset),
    // so invert the pixel value back to a percentage on the way out —
    // otherwise re-importing this file would shrink the forms again.
    const data = serializeState();
    data.form.size.x = Math.round(p.map(form.size.x, form.size.min, form.size.max.width, 1, 100) * 100) / 100;
    data.form.size.y = Math.round(p.map(form.size.y, form.size.min, form.size.max.height, 1, 100) * 100) / 100;
    data.form.size.uniform = form.size.x === form.size.y;
    downloadPresetJSON(`deriva-preset-${timestamp()}.json`, data);
  }

  function importPreset() {
    openPresetFile((data) => applyPreset(data), () => setStatus('Invalid preset file'));
  }

  function setStatus(msg) {
    const el = document.getElementById('dr-export-status');
    if (el) el.innerText = msg;
  }

  function doExportPNG() {
    drawScene();
    blitToVisible();
    exportPNG(p, 'deriva');
  }

  function doExportMP4() {
    recVideo.seconds = rec.length.value;
    return exportMP4({
      p, prefix: 'deriva', cnv, rec, recVideo,
      drawComposite: () => {
        drawScene();
        blitToVisible();
      },
      setStatus,
    });
  }

  // --- p5 lifecycle ---
  p.setup = () => {
    canvasContainer = document.getElementById('deriva-canvas');
    if (!canvasContainer) return;
    p.createCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
    p.pixelDensity(1);
    p.imageMode(p.CENTER);
    p.frameRate(rec.frameRate);

    // Setup hidden file input for images
    let fileInput = document.getElementById('dr-hidden-file-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'dr-hidden-file-input';
      fileInput.style.display = 'none';
      fileInput.accept = 'image/*';
      fileInput.onchange = (e) => {
        if (e.target.files[0]) {
          const url = URL.createObjectURL(e.target.files[0]);
          isLoadImage = true;
          p.loadImage(url, (img) => {
            g.texture.data = img;
            setupBuffers();
            isLoadImage = false;
          });
        }
      };
      document.body.appendChild(fileInput);
    }

    let restored = loadState();

    function finishSetup() {
      setupBuffers();
      isLoadImage = false;

      // Load presets and setup UI AFTER texture is loaded and buffers are created
      fetch(`${import.meta.env.BASE_URL}assets/deriva/presets.json`)
        .then((r) => r.json())
        .then((d) => { PRESETS = d; })
        .catch((e) => console.warn('[deriva] presets load failed:', e))
        .finally(() => {
          buildUI();
          if (restored) {
            syncUIFromState();
          } else if (Object.keys(PRESETS).length) {
            const keys = Object.keys(PRESETS);
            const pick = keys[Math.floor(Math.random() * keys.length)];
            applyPreset(PRESETS[pick]);
            const sel = document.getElementById('dr-preset');
            if (sel) sel.value = pick;
          } else {
            syncUIFromState();
            generateForms();
          }

          document.getElementById('dr-preset')?.addEventListener('change', (e) => {
            const preset = PRESETS[e.target.value];
            if (preset) applyPreset(preset);
          });
          document.getElementById('dr-btn-save-png')?.addEventListener('click', doExportPNG);
          document.getElementById('dr-btn-save-mp4')?.addEventListener('click', doExportMP4);

          isReady = true;
        });
    }

    function loadFallbackTexture() {
      p.loadImage(g.texture.default, (img) => {
        g.texture.data = img;
        finishSetup();
      }, (err) => {
        console.warn("Failed to load fallback texture, using a solid placeholder.", err);
        let dummy = p.createImage(800, 800);
        dummy.loadPixels();
        for (let i = 0; i < dummy.pixels.length; i += 4) {
          dummy.pixels[i] = 100;
          dummy.pixels[i + 1] = 150;
          dummy.pixels[i + 2] = 200;
          dummy.pixels[i + 3] = 255;
        }
        dummy.updatePixels();
        g.texture.data = dummy;
        finishSetup();
      });
    }

    // Mirrors the original's setup(): getRandomImage() (a random Unsplash
    // photo) first, falling back to a fixed image only if that fetch fails.
    const randomUrl = 'https://source.unsplash.com/random/' + cnv.image.size + 'x' + cnv.image.size;
    p.loadImage(randomUrl, (img) => {
      g.texture.data = img;
      finishSetup();
    }, (err) => {
      console.warn("Random Unsplash image failed, falling back to default.", err);
      loadFallbackTexture();
    });
  };

  p.draw = () => {
    if (!isReady) return;

    // Check mouse bounds manually
    if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
      cnv.mouseOver = true;
      p.cursor(cnv.showCursor ? p.CROSS : p.ARROW);
    } else {
      cnv.mouseOver = false;
    }

    drawScene();
    blitToVisible();
  };

  p.windowResized = () => {
    if (canvasContainer) fitCanvas();
  };

  p.mousePressed = () => {
    // Recompute form.coords right now instead of trusting the last draw()
    // frame's value — mouse DOM events aren't synchronized with the draw
    // loop, so a fast click could otherwise place the form where the
    // cursor was up to one frame ago.
    if (cnv.mouseOver) {
      translateCoords();
      addFormPreview();
    }
  };

  p.mouseReleased = () => {
    if (cnv.mouseOver) {
      translateCoords();
      addForm(false);
    }
  };

  p.mouseDragged = () => {
    if (cnv.mouseOver && p.mouseButton.right) {
      const speedX = Math.floor(p.movedX * cnv.settings.sens);
      const speedY = Math.floor(p.movedY * cnv.settings.sens);
      form.size.x += speedX;
      form.size.y += speedY;

      if (p.keyIsDown(p.SHIFT)) {
        let s = Math.min(form.size.x, form.size.y);
        let m = Math.max(speedX, speedY);
        form.size.x = s + m;
        form.size.y = s + m;
      }

      form.size.x = p.constrain(form.size.x, form.size.min, form.size.max.width);
      form.size.y = p.constrain(form.size.y, form.size.min, form.size.max.height);
      form.size.x = Math.round(form.size.x);
      form.size.y = Math.round(form.size.y);
      syncUIFromState();
    }
  };
  
  p.keyPressed = () => {
    if (p.key === 'a') randomParameters(p);
  };
}

function pickOptionMaps(mod) {
  const runtime = new Set(['cnv', 'form', 'anim', 'rec', 'g']);
  const out = {};
  for (const key of Object.keys(mod)) {
    if (!runtime.has(key)) out[key] = mod[key];
  }
  return out;
}
