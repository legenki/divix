import * as state from './state.js';
import { SECTIONS } from './controls.js';

import { createPersistence } from '../../shared/utils/persistence.js';
import { deepMerge } from '../../shared/utils/deepMerge.js';
import { exportPNG } from '../../shared/utils/exportMedia.js';
import { createPanelBuilder, openSections } from '../../shared/ui/panelBuilder.js';

const STORAGE_KEY = 'clon-tool';

const { cnv, preview, form, area, mode, grid, g, SYS } = state;

export function clonSketch(p) {
  let canvasContainer;
  let isReady = false;

  const fullState = { cnv, preview, form, area, mode, grid, ...pickOptionMaps(state) };
  const panel = createPanelBuilder({ state: fullState, applyChange, refreshVisibility });

  // Klon has no factory presets — the panel starts straight at the
  // workspace's own sections, no Preset List / Export / Import section.
  function buildUI() {
    const root = document.getElementById('cl-controls');
    if (!root) return;
    root.innerHTML = '';

    panel.buildSections(root, SECTIONS);
    openSections(root, [0, 1]);
    refreshVisibility();
  }

  function applyChange(ctrl) {
    if (ctrl.regen === 'tooltips') {
      // Handle tooltips if needed
    } else if (ctrl.regen === 'visibility') {
      // handled below
    } else if (ctrl.regen === 'clipBuffer') {
      if (g.area) clipAreaBuffer(p);
    } else if (ctrl.regen === 'grid') {
      grid.update = true;
    } else if (ctrl.regen === 'gridSync') {
      if (grid.sync) {
        grid.ui.y = grid.ui.x;
      }
      grid.update = true;
    } else if (ctrl.regen === 'gridUpdate') {
      if (grid.sync) {
        if (ctrl.path.includes('x')) {
          grid.ui.y = grid.ui.x;
        } else {
          grid.ui.x = grid.ui.y;
        }
      }
      if (!grid.snap) {
        grid.snap = true;
      } else {
        grid.update = true;
      }
    } else if (ctrl.action === 'undo') {
      undoCanvas();
    } else if (ctrl.action === 'clear') {
      clearCanvas();
    } else if (ctrl.action === 'upload') {
      const el = document.getElementById('cl-hidden-file-input');
      if (el) el.click();
    }
    
    refreshVisibility();
    saveState();
  }

  function refreshVisibility() {
    const show = (id, vis) => {
      const el = document.querySelector(`[data-control-id="${id}"]`);
      if (el) el.style.display = vis ? '' : 'none';
    };
    
    show('cl-bg-custom', cnv.bg.mode === 'custom');
    
    const gridEnabled = grid.snap === true;
    show('cl-grid-show', gridEnabled);
    show('cl-grid-sync', gridEnabled);
    show('cl-grid-x', gridEnabled);
    show('cl-grid-y', gridEnabled);
    show('cl-grid-opacity', gridEnabled);
    show('cl-grid-width', gridEnabled);
    show('cl-grid-color', gridEnabled);
  }

  function syncUIFromState() {
    panel.syncUIFromState(SECTIONS);
    refreshVisibility();
  }

  // --- Image & Grid Logic ---
  
  function checkImageSize(p, img) {
    if (img.width > cnv.image.max || img.height > cnv.image.max) {
      let scaleFactor = cnv.image.max / Math.max(img.width, img.height);
      let newWidth = p.round(img.width * scaleFactor);
      let newHeight = p.round(img.height * scaleFactor);
      let resizedImage = p.createImage(newWidth, newHeight);
      resizedImage.copy(img, 0, 0, img.width, img.height, 0, 0, newWidth, newHeight);
      return resizedImage;
    } else {
      return img;
    }
  }

  // Mirrors klon's setMaxWindowResolution(): the display canvas budget
  // follows the window, minus the control panel (panel 260px + margins).
  function setMaxWindowResolution() {
    const uiOffset = 300;
    const maxWidth = Math.min(1280, (window.innerWidth - uiOffset) * 0.85);
    const maxHeight = Math.min(800, window.innerHeight * 0.9);
    cnv.maxWidth = maxWidth - (maxWidth % 10);
    cnv.maxHeight = maxHeight - (maxHeight % 10);
  }

  function canvasAdjust(loadedImage) {
    let width, height, density;
    if (loadedImage.width < cnv.maxWidth && loadedImage.height < cnv.maxHeight) {
      width = loadedImage.width;
      height = loadedImage.height;
      density = 1;
    } else {
      let maxWidth = Math.min(loadedImage.width, cnv.maxWidth);
      let maxHeight = Math.min(loadedImage.height, cnv.maxHeight);
      let w = maxWidth / loadedImage.width;
      let h = maxHeight / loadedImage.height;
      let minRatio = Math.min(w, h);

      density = minRatio === w ? loadedImage.width / maxWidth : loadedImage.height / maxHeight;
      width = loadedImage.width * minRatio;
      height = loadedImage.height * minRatio;
    }

    return { width, height, density };
  }

  function getMult(side) {
    let i;
    let mult = 0;
    let size;
    do {
      i = Math.pow(2, 3 + mult);
      size = side / i;
      mult++;
    } while (size >= 4);
    return mult;
  }

  function imageReadytoUse(p, loadedImage) {
    loadedImage = checkImageSize(p, loadedImage);
    g.imgSource = loadedImage.get();

    const imgData = canvasAdjust(loadedImage);
    cnv.density = imgData.density;

    p.resizeCanvas(imgData.width, imgData.height);
    cnv.image.size = `${p.floor(g.imgSource.width)} x ${p.floor(g.imgSource.height)} px`;

    if (g.result !== null) g.result.remove();
    g.result = p.createGraphics(g.imgSource.width, g.imgSource.height);
    g.result.rectMode(p.CORNERS);
    g.result.ellipseMode(p.CORNERS);
    g.result.pixelDensity(1);
    g.result.noStroke();

    if (g.backup !== null) g.backup.remove();
    g.backup = p.createGraphics(g.imgSource.width, g.imgSource.height);
    g.backup.pixelDensity(1);
    g.backup.noStroke();

    if (g.preview !== null) g.preview.remove();
    g.preview = p.createGraphics(g.imgSource.width, g.imgSource.height);
    g.preview.imageMode(p.CORNERS);
    g.preview.ellipseMode(p.CORNERS);
    g.preview.pixelDensity(1);
    g.preview.noStroke();

    if (g.grid !== null) g.grid.remove();
    g.grid = p.createGraphics(p.width, p.height);
    grid.update = true;

    grid.mult = 2;
    let mod = 0;
    let xmult = getMult(g.imgSource.width);
    let ymult = getMult(g.imgSource.height);
    let mult = Math.min(xmult, ymult);

    if (mult < 8) {
      mod = 8 - (mult % 8);
      grid.mult = grid.mult - mod;
    }
    grid.ui.max = mult + mod;

    cnv.size.width = g.imgSource.width;
    cnv.size.height = g.imgSource.height;

    cnv.source = true;
    
    if (mode.select === "erase") {
      mode.select = "free";
    }
    
    syncUIFromState();
  }

  function getInteractiveFormArea(p, mX, mY) {
    const sens = cnv.settings.sens;
    const normX = g.imgSource.width / p.width;
    const normY = g.imgSource.height / p.height;

    const speedX = p.floor(mX * normX * sens);
    const speedY = p.floor(mY * normY * sens);

    cnv.size.x += speedX;
    cnv.size.y += speedY;

    if (SYS.shiftLocked) {
      let s = Math.min(cnv.size.x, cnv.size.y);
      let m = Math.max(speedX, speedY);

      cnv.size.x = s;
      cnv.size.y = s;
      cnv.size.x += m;
      cnv.size.y += m;
    }

    cnv.size.x = p.round(cnv.size.x);
    cnv.size.y = p.round(cnv.size.y);
  }

  function gridX(p, value) {
    return grid.snap === true ? p.round(value / grid.x) * grid.x : p.round(value);
  }

  function gridY(p, value) {
    return grid.snap === true ? p.round(value / grid.y) * grid.y : p.round(value);
  }

  function shiftLockEvent(p) {
    if (p.mouseIsPressed && p.mouseButton.left && p.keyIsPressed && p.keyCode === p.SHIFT) {
      if (SYS.shiftLocked && !SYS.mxLocked && !SYS.myLocked) {
        if (p.mouseY > cnv.mouse.py || p.mouseY < cnv.mouse.py) {
          SYS.mxLocked = true;
          cnv.mouse.x = p.mouseX;
        } else if (p.mouseX > cnv.mouse.px || p.mouseX < cnv.mouse.px) {
          SYS.myLocked = true;
          cnv.mouse.y = p.mouseY;
        }
      }
    } else {
      cnv.mouse.px = p.mouseX;
      cnv.mouse.py = p.mouseY;
      SYS.mxLocked = false;
      SYS.myLocked = false;
    }
    if (SYS.mxLocked) p.mouseX = cnv.mouse.x;
    if (SYS.myLocked) p.mouseY = cnv.mouse.y;
  }

  function gridData(p) {
    if (cnv.mouseOver && p.mouseIsPressed && p.mouseButton.right) {
      if (!SYS.mouseLocked) {
        SYS.mouseLocked = true;
        p.requestPointerLock();
      }
      getInteractiveFormArea(p, p.movedX, p.movedY);
    } else if (SYS.mouseLocked) {
      p.exitPointerLock();
      SYS.mouseLocked = false;
    }

    shiftLockEvent(p);

    cnv.size.x = Math.min(Math.max(cnv.size.x, cnv.size.min), cnv.size.width);
    cnv.size.y = Math.min(Math.max(cnv.size.y, cnv.size.min), cnv.size.height);

    let cellX = Math.pow(2, grid.ui.x + grid.mult);
    let cellY = Math.pow(2, grid.ui.y + grid.mult);

    let sizeX = grid.snap === true ? Math.max(cellX, cnv.size.x - cellX / 2) : cnv.size.x;
    let sizeY = grid.snap === true ? Math.max(cellY, cnv.size.y - cellY / 2) : cnv.size.y;

    let mX = p.map(p.mouseX, 0, p.width, 0, g.imgSource.width);
    let mY = p.map(p.mouseY, 0, p.height, 0, g.imgSource.height);

    grid.x = cellX;
    grid.y = cellY;
    grid.mod.x = (g.imgSource.width % (cellX * 2)) / 2;
    grid.mod.y = (g.imgSource.height % (cellY * 2)) / 2;

    preview.mod.x = grid.snap === true ? grid.mod.x : 0;
    preview.mod.y = grid.snap === true ? grid.mod.y : 0;
    preview.size.x = gridX(p, sizeX);
    preview.size.y = gridY(p, sizeY);

    preview.coords.x1 = gridX(p, mX - preview.size.x / 2 - preview.mod.x) + preview.mod.x;
    preview.coords.y1 = gridY(p, mY - preview.size.y / 2 - preview.mod.y) + preview.mod.y;
    preview.coords.x2 = gridX(p, mX + preview.size.x / 2 - preview.mod.x) + preview.mod.x;
    preview.coords.y2 = gridY(p, mY + preview.size.y / 2 - preview.mod.y) + preview.mod.y;

    form.coords.x1 = preview.coords.x1 / cnv.density;
    form.coords.y1 = preview.coords.y1 / cnv.density;
    form.coords.x2 = preview.coords.x2 / cnv.density;
    form.coords.y2 = preview.coords.y2 / cnv.density;

    form.size.x = form.coords.x2 - form.coords.x1;
    form.size.y = form.coords.y2 - form.coords.y1;

    if (grid.update) {
      makeGrid(p);
      grid.update = false;
    }
  }

  function makeGrid(p) {
    if (!g.grid) return;
    let c;
    switch (grid.color) {
      case "black":
        c = p.color(0, grid.opacity * 255);
        break;
      case "white":
        c = p.color(255, grid.opacity * 255);
        break;
      case "red":
        c = p.color(255, 0, 0, grid.opacity * 255);
        break;
      case "blue":
        c = p.color(0, 150, 255, grid.opacity * 255);
        break;
    }

    g.grid.clear();
    g.grid.push();
    g.grid.strokeWeight(grid.width);
    g.grid.stroke(c);

    let dx = grid.x / cnv.density;
    let dy = grid.y / cnv.density;
    let mx = (p.width / 2) % dx;
    let my = (p.height / 2) % dy;

    if (p.floor(mx) === p.floor(dx)) mx = -dx;
    if (p.floor(my) === p.floor(dy)) my = -dy;

    g.grid.translate(grid.width / 2, grid.width / 2);
    for (let x = mx; x < p.width + dx; x += dx) {
      for (let y = my; y < p.height + dx; y += dy) {
        g.grid.point(x - grid.width / 2, y - grid.width / 2);
      }
    }
    g.grid.pop();
  }

  function clipAreaBuffer(p) {
    let sizex, sizey;
    if (area.rotation.amount % 180 === 0) {
      sizex = area.size.x;
      sizey = area.size.y;
    } else {
      sizex = area.size.y;
      sizey = area.size.x;
    }
    preview.buffer.x = sizex;
    preview.buffer.y = sizey;

    if (g.buffer !== null) g.buffer.remove();
    g.buffer = p.createGraphics(sizex, sizey);
    g.buffer.imageMode(p.CENTER);
    g.buffer.pixelDensity(1);
    g.buffer.noStroke();

    g.buffer.translate(sizex / 2, sizey / 2);
    g.buffer.push();
    g.buffer.rotate(p.radians(area.rotation.amount));
    g.buffer.image(g.area, 0, 0, area.size.x, area.size.y, 0, 0, area.size.x, area.size.y);
    g.buffer.pop();

    if (mode.shape !== "rect") {
      g.buffer.drawingContext.globalCompositeOperation = "destination-in";
      g.buffer.fill(0);
      switch (mode.shape) {
        case "ellipse":
          g.buffer.ellipse(0, 0, sizex, sizey);
          break;
        case "triangle":
          if (mode.shapeAngle === 0)
            g.buffer.triangle(-sizex / 2, sizey / 2, -sizex / 2, -sizey / 2, sizex / 2, -sizey / 2);
          if (mode.shapeAngle === 90)
            g.buffer.triangle(-sizex / 2, -sizey / 2, sizex / 2, -sizey / 2, sizex / 2, sizey / 2);
          if (mode.shapeAngle === 180)
            g.buffer.triangle(sizex / 2, -sizey / 2, sizex / 2, sizey / 2, -sizex / 2, sizey / 2);
          if (mode.shapeAngle === 270)
            g.buffer.triangle(sizex / 2, sizey / 2, -sizex / 2, sizey / 2, -sizex / 2, -sizey / 2);
          break;
        case "arc":
          if (mode.shapeAngle === 0)
            g.buffer.arc(-sizex / 2, -sizey / 2, sizex * 2, sizey * 2, 0, p.HALF_PI, p.PIE);
          if (mode.shapeAngle === 90)
            g.buffer.arc(sizex / 2, -sizey / 2, sizex * 2, sizey * 2, p.HALF_PI, p.PI, p.PIE);
          if (mode.shapeAngle === 180)
            g.buffer.arc(sizex / 2, sizey / 2, sizex * 2, sizey * 2, p.PI, p.PI + p.HALF_PI, p.PIE);
          if (mode.shapeAngle === 270)
            g.buffer.arc(-sizex / 2, sizey / 2, sizex * 2, sizey * 2, p.PI + p.HALF_PI, p.TWO_PI, p.PIE);
          break;
      }
    }
  }

  function makeGraphicsArea(p) {
    if (g.area !== null) g.area.remove();
    g.area = p.createGraphics(area.size.x, area.size.y);
    g.area.pixelDensity(1);
    g.area.noStroke();

    g.area.image(
      g.imgSource,
      0,
      0,
      area.size.x,
      area.size.y,
      area.coords.x1,
      area.coords.y1,
      area.size.x,
      area.size.y
    );
    if (mode.draw === "result") {
      g.area.image(
        g.result,
        0,
        0,
        area.size.x,
        area.size.y,
        area.coords.x1,
        area.coords.y1,
        area.size.x,
        area.size.y
      );
    }

    clipAreaBuffer(p);
  }

  function clearCanvas() {
    if (g.result) g.result.clear();
  }

  function undoCanvas() {
    if (g.result && g.backup) {
      g.result.clear();
      g.result.drawingContext.globalCompositeOperation = "source-over";
      g.result.image(g.backup, 0, 0, g.imgSource.width, g.imgSource.height);
    }
  }

  function drawPreview(p) {
    g.preview.clear();
    g.preview.push();

    if (p.mouseIsPressed && p.mouseButton.left && g.area !== null && mode.select !== "erase") {
      g.preview.image(
        g.buffer,
        preview.coords.x1,
        preview.coords.y1,
        preview.coords.x2,
        preview.coords.y2,
        0,
        0,
        preview.buffer.x,
        preview.buffer.y
      );
    } else if (preview.select) {
      if (mode.select !== "erase") {
        g.preview.image(
          g.buffer,
          preview.coords.x1,
          preview.coords.y1,
          preview.coords.x2,
          preview.coords.y2,
          0,
          0,
          preview.buffer.x,
          preview.buffer.y
        );
      }
    } else {
      switch (mode.shape) {
        case "ellipse":
          g.preview.ellipse(preview.coords.x1, preview.coords.y1, preview.coords.x2, preview.coords.y2);
          g.preview.drawingContext.clip();
          break;
        case "triangle":
          if (mode.shapeAngle === 0)
            g.preview.triangle(
              preview.coords.x1, preview.coords.y2,
              preview.coords.x1, preview.coords.y1,
              preview.coords.x2, preview.coords.y1
            );
          if (mode.shapeAngle === 90)
            g.preview.triangle(
              preview.coords.x1, preview.coords.y1,
              preview.coords.x2, preview.coords.y1,
              preview.coords.x2, preview.coords.y2
            );
          if (mode.shapeAngle === 180)
            g.preview.triangle(
              preview.coords.x2, preview.coords.y1,
              preview.coords.x2, preview.coords.y2,
              preview.coords.x1, preview.coords.y2
            );
          if (mode.shapeAngle === 270)
            g.preview.triangle(
              preview.coords.x2, preview.coords.y2,
              preview.coords.x1, preview.coords.y2,
              preview.coords.x1, preview.coords.y1
            );
          g.preview.drawingContext.clip();
          break;
        case "arc":
          g.preview.push();
          g.preview.ellipseMode(p.CENTER);
          if (mode.shapeAngle === 0)
            g.preview.arc(preview.coords.x1, preview.coords.y1, preview.size.x * 2, preview.size.y * 2, 0, p.HALF_PI, p.PIE);
          if (mode.shapeAngle === 90)
            g.preview.arc(preview.coords.x2, preview.coords.y1, preview.size.x * 2, preview.size.y * 2, p.HALF_PI, p.PI, p.PIE);
          if (mode.shapeAngle === 180)
            g.preview.arc(preview.coords.x2, preview.coords.y2, preview.size.x * 2, preview.size.y * 2, p.PI, p.PI + p.HALF_PI, p.PIE);
          if (mode.shapeAngle === 270)
            g.preview.arc(preview.coords.x1, preview.coords.y2, preview.size.x * 2, preview.size.y * 2, p.PI + p.HALF_PI, p.TWO_PI, p.PIE);
          g.preview.pop();
          g.preview.drawingContext.clip();
          break;
      }
      
      g.preview.image(
        g.imgSource,
        preview.coords.x1, preview.coords.y1, preview.coords.x2, preview.coords.y2,
        preview.coords.x1, preview.coords.y1, preview.size.x, preview.size.y
      );
      if (mode.draw === "result" && mode.select !== "erase") {
        g.preview.image(
          g.result,
          preview.coords.x1, preview.coords.y1, preview.coords.x2, preview.coords.y2,
          preview.coords.x1, preview.coords.y1, preview.size.x, preview.size.y
        );
      }
    }
    g.preview.pop();
  }

  function drawPreviewGraphics(p) {
    p.push();

    if (mode.select === "erase" || (mode.select === "buffer" && preview.select === false)) {
      preview.stroke = "#FF0000";
    } else {
      preview.stroke = "#000000";
    }

    if (!(mode.select === "buffer" && preview.select === false)) {
      p.fill(preview.fill);
    }
    p.stroke(preview.stroke);

    if (mode.shape === "rect") {
      p.rect(form.coords.x1, form.coords.y1, form.coords.x2, form.coords.y2);
    } else if (mode.shape === "ellipse") {
      p.ellipse(form.coords.x1, form.coords.y1, form.coords.x2, form.coords.y2);
    } else if (mode.shape === "triangle") {
      if (mode.shapeAngle === 0)
        p.triangle(form.coords.x1, form.coords.y2, form.coords.x1, form.coords.y1, form.coords.x2, form.coords.y1);
      if (mode.shapeAngle === 90)
        p.triangle(form.coords.x1, form.coords.y1, form.coords.x2, form.coords.y1, form.coords.x2, form.coords.y2);
      if (mode.shapeAngle === 180)
        p.triangle(form.coords.x2, form.coords.y1, form.coords.x2, form.coords.y2, form.coords.x1, form.coords.y2);
      if (mode.shapeAngle === 270)
        p.triangle(form.coords.x2, form.coords.y2, form.coords.x1, form.coords.y2, form.coords.x1, form.coords.y1);
    } else if (mode.shape === "arc") {
      p.ellipseMode(p.CENTER);
      if (mode.shapeAngle === 0)
        p.arc(form.coords.x1, form.coords.y1, form.size.x * 2, form.size.y * 2, 0, p.HALF_PI, p.PIE);
      if (mode.shapeAngle === 90)
        p.arc(form.coords.x2, form.coords.y1, form.size.x * 2, form.size.y * 2, p.HALF_PI, p.PI, p.PIE);
      if (mode.shapeAngle === 180)
        p.arc(form.coords.x2, form.coords.y2, form.size.x * 2, form.size.y * 2, p.PI, p.PI + p.HALF_PI, p.PIE);
      if (mode.shapeAngle === 270)
        p.arc(form.coords.x1, form.coords.y2, form.size.x * 2, form.size.y * 2, p.PI + p.HALF_PI, p.TWO_PI, p.PIE);
    }

    if (mode.select === "buffer" && preview.select === false) {
      p.clip(() => {
        if (mode.shape === "rect") {
          p.rect(form.coords.x1, form.coords.y1, form.coords.x2, form.coords.y2);
        } else if (mode.shape === "ellipse") {
          p.ellipse(form.coords.x1, form.coords.y1, form.coords.x2, form.coords.y2);
        } else if (mode.shape === "triangle") {
          if (mode.shapeAngle === 0)
            p.triangle(form.coords.x1, form.coords.y2, form.coords.x1, form.coords.y1, form.coords.x2, form.coords.y1);
          if (mode.shapeAngle === 90)
            p.triangle(form.coords.x1, form.coords.y1, form.coords.x2, form.coords.y1, form.coords.x2, form.coords.y2);
          if (mode.shapeAngle === 180)
            p.triangle(form.coords.x2, form.coords.y1, form.coords.x2, form.coords.y2, form.coords.x1, form.coords.y2);
          if (mode.shapeAngle === 270)
            p.triangle(form.coords.x2, form.coords.y2, form.coords.x1, form.coords.y2, form.coords.x1, form.coords.y1);
        } else if (mode.shape === "arc") {
          p.ellipseMode(p.CENTER);
          if (mode.shapeAngle === 0)
            p.arc(form.coords.x1, form.coords.y1, form.size.x * 2, form.size.y * 2, 0, p.HALF_PI, p.PIE);
          if (mode.shapeAngle === 90)
            p.arc(form.coords.x2, form.coords.y1, form.size.x * 2, form.size.y * 2, p.HALF_PI, p.PI, p.PIE);
          if (mode.shapeAngle === 180)
            p.arc(form.coords.x2, form.coords.y2, form.size.x * 2, form.size.y * 2, p.PI, p.PI + p.HALF_PI, p.PIE);
          if (mode.shapeAngle === 270)
            p.arc(form.coords.x1, form.coords.y2, form.size.x * 2, form.size.y * 2, p.PI + p.HALF_PI, p.TWO_PI, p.PIE);
        }
      }, { invert: true });
      p.fill(255, 50);
      p.noStroke();
      p.rect(0, 0, p.width, p.height);
    }
    p.pop();
  }

  function drawScene(p) {
    p.clear();
    if (cnv.bg.mode === "custom") {
      p.push();
      p.fill(cnv.bg.custom);
      p.rect(0, 0, p.width, p.height);
      p.pop();
    }

    gridData(p);

    if (cnv.source && g.imgSource) p.image(g.imgSource, 0, 0, p.width, p.height);
    if (cnv.result && g.result) p.image(g.result, 0, 0, p.width, p.height);

    if (p.mouseIsPressed && p.mouseButton.left && g.area !== null) {
      if (mode.select === "erase" && preview.coords.x2 > 0 && preview.coords.y2 > 0) {
        g.result.push();
        g.result.drawingContext.globalCompositeOperation = "destination-out";
        switch (mode.shape) {
          case "rect":
            g.result.rect(preview.coords.x1, preview.coords.y1, preview.coords.x2, preview.coords.y2);
            break;
          case "ellipse":
            g.result.ellipse(preview.coords.x1, preview.coords.y1, preview.coords.x2, preview.coords.y2);
            break;
          case "triangle":
            if (mode.shapeAngle === 0)
              g.result.triangle(preview.coords.x1, preview.coords.y2, preview.coords.x1, preview.coords.y1, preview.coords.x2, preview.coords.y1);
            if (mode.shapeAngle === 90)
              g.result.triangle(preview.coords.x1, preview.coords.y1, preview.coords.x2, preview.coords.y1, preview.coords.x2, preview.coords.y2);
            if (mode.shapeAngle === 180)
              g.result.triangle(preview.coords.x2, preview.coords.y1, preview.coords.x2, preview.coords.y2, preview.coords.x1, preview.coords.y2);
            if (mode.shapeAngle === 270)
              g.result.triangle(preview.coords.x2, preview.coords.y2, preview.coords.x1, preview.coords.y2, preview.coords.x1, preview.coords.y1);
            break;
          case "arc":
            g.result.push();
            g.result.ellipseMode(p.CENTER);
            if (mode.shapeAngle === 0)
              g.result.arc(preview.coords.x1, preview.coords.y1, preview.size.x * 2, preview.size.y * 2, 0, p.HALF_PI, p.PIE);
            if (mode.shapeAngle === 90)
              g.result.arc(preview.coords.x2, preview.coords.y1, preview.size.x * 2, preview.size.y * 2, p.HALF_PI, p.PI, p.PIE);
            if (mode.shapeAngle === 180)
              g.result.arc(preview.coords.x2, preview.coords.y2, preview.size.x * 2, preview.size.y * 2, p.PI, p.PI + p.HALF_PI, p.PIE);
            if (mode.shapeAngle === 270)
              g.result.arc(preview.coords.x1, preview.coords.y2, preview.size.x * 2, preview.size.y * 2, p.PI + p.HALF_PI, p.TWO_PI, p.PIE);
            g.result.pop();
            break;
        }
        g.result.pop();
      } else {
        g.result.drawingContext.globalCompositeOperation = "source-over";
        if (preview.ready && g.buffer) {
          g.result.image(
            g.buffer,
            preview.coords.x1, preview.coords.y1, preview.size.x, preview.size.y,
            0, 0, preview.buffer.x, preview.buffer.y
          );
        }
      }
    }

    if (grid.show && g.grid) {
      if (!(cnv.mouseOver && p.mouseIsPressed && p.mouseButton.left)) {
        p.image(g.grid, 0, 0, p.width, p.height);
      }
    }

    if (preview.coords.x2 > 0 && preview.coords.y2 > 0) {
      drawPreview(p);
    }

    if (!(mode.select === "erase" && !cnv.source) && preview.coords.x2 > 0 && preview.coords.y2 > 0) {
      p.image(g.preview, 0, 0, p.width, p.height);
    }

    if (preview.coords.x2 > 0 && preview.coords.y2 > 0) {
      drawPreviewGraphics(p);
    }
  }

  // --- Persistence ---
  function serializeState() {
    return {
      cnv: JSON.parse(JSON.stringify(cnv)),
      preview: JSON.parse(JSON.stringify(preview)),
      form: JSON.parse(JSON.stringify(form)),
      area: JSON.parse(JSON.stringify(area)),
      mode: JSON.parse(JSON.stringify(mode)),
      grid: JSON.parse(JSON.stringify(grid)),
    };
  }

  const { saveState, loadState } = createPersistence(
    STORAGE_KEY,
    'clon',
    serializeState,
    (data) => {
      deepMerge(cnv, data.cnv);
      deepMerge(preview, data.preview);
      deepMerge(form, data.form);
      deepMerge(area, data.area);
      deepMerge(mode, data.mode);
      deepMerge(grid, data.grid);
      // Transient interaction state must not survive a reload: stale
      // preview coords draw a phantom clone-stamp at the last cursor spot.
      preview.coords.x1 = 0;
      preview.coords.y1 = 0;
      preview.coords.x2 = 0;
      preview.coords.y2 = 0;
      preview.select = false;
      preview.ready = true;
      cnv.mouseOver = false;
    }
  );

  function doExportPNG() {
    if (!g.result) return;
    let s = p.createGraphics(g.result.width, g.result.height);
    s.pixelDensity(1);
    if (cnv.bg.mode === 'custom') s.background(cnv.bg.custom);
    if (cnv.source) s.image(g.imgSource, 0, 0);
    if (cnv.result) s.image(g.result, 0, 0);
    exportPNG(p, 'clon', s);
    s.remove();
  }

  // --- p5 lifecycle ---
  p.setup = () => {
    canvasContainer = document.getElementById('clon-canvas');
    if (!canvasContainer) return;

    setMaxWindowResolution();
    p.createCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
    p.rectMode(p.CORNERS);
    p.ellipseMode(p.CORNERS);
    p.noFill();
    p.noStroke();

    let fileInput = document.getElementById('cl-hidden-file-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'cl-hidden-file-input';
      fileInput.style.display = 'none';
      fileInput.accept = 'image/*';
      fileInput.onchange = (e) => {
        if (e.target.files[0]) {
          const url = URL.createObjectURL(e.target.files[0]);
          p.loadImage(url, (img) => {
            imageReadytoUse(p, img);
          }, () => {});
        }
      };
      document.body.appendChild(fileInput);
    }

    loadState();

    p.loadImage(`${import.meta.env.BASE_URL}assets/clon/default.jpg`, (img) => {
      imageReadytoUse(p, img);
      isReady = true;

      buildUI();
      syncUIFromState();
      document.getElementById('cl-btn-save-png')?.addEventListener('click', doExportPNG);
    });
  };

  p.draw = () => {
    if (!isReady) return;
    
    if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
      cnv.mouseOver = true;
      cnv.mouse.px = p.mouseX;
      cnv.mouse.py = p.mouseY;
    } else {
      cnv.mouseOver = false;
    }

    drawScene(p);
  };

  p.mousePressed = () => {
    if (cnv.mouseOver) {
      if (!preview.select) area.rotation.amount = 0;
      if (p.mouseButton.left) {
        if (g.backup && g.result) {
          g.backup.clear();
          g.backup.image(g.result, 0, 0, g.imgSource.width, g.imgSource.height);
        }
        if (!preview.select) {
          if (mode.select === "buffer") {
            preview.select = true;
            preview.ready = false;
          }
          area.coords.x1 = preview.coords.x1;
          area.coords.y1 = preview.coords.y1;
          area.coords.x2 = preview.coords.x2;
          area.coords.y2 = preview.coords.y2;
          area.size.x = preview.size.x;
          area.size.y = preview.size.y;
          makeGraphicsArea(p);
        }
      }
    } else {
      if (g.area !== null && !preview.select) g.area = null;
    }
  };

  p.mouseReleased = () => {
    preview.ready = true;
    if (!preview.select) area.rotation.amount = 0;
  };

  p.keyPressed = () => {
    if (p.keyCode === p.SHIFT) {
      SYS.shiftLocked = true;
    }
  };

  p.keyReleased = () => {
    if (p.keyCode === p.SHIFT) {
      SYS.shiftLocked = false;
    }
  };

  p.windowResized = () => {
    // Canvas keeps its size (like the original); CSS re-centres it. Only
    // the budget for the next image load follows the window.
    setMaxWindowResolution();
  };
}

function pickOptionMaps(mod) {
  const runtime = new Set(['cnv', 'preview', 'form', 'area', 'mode', 'grid', 'g', 'SYS']);
  const out = {};
  for (const key of Object.keys(mod)) {
    if (!runtime.has(key)) out[key] = mod[key];
  }
  return out;
}
