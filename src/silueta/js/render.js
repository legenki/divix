// SILUETA — silhouette render layer. Each image block is processed through a
// lightweight pipeline: WEBGL shader (pixelate/halftone) → 2D canvas alpha-mask
// via destination-in composite. The mask step replaces the old per-pixel JS loop
// (which iterated ~10M pixels on density-2 canvases) with a single GPU composite.

import { PIXELATE_FRAG, HALFTONE_FRAG, DITHER_VERT } from './shaders.js';
import { shapeIndex, blankStamp } from './stamp.js';

function hexToRgb01(hex) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * @param {object} deps { p, state }
 * @returns render controller with buildBuffers/setMask/renderSilhouette/dispose.
 */
export function createRender({ p, state }) {
  const { render } = state;
  let sil = null;          // WEBGL shader-output buffer (reused, resized on demand)
  let maskCanvas = null;   // offscreen 2D canvas holding the upscaled mask (for composite)
  let maskCtx = null;
  let pixelateShader = null;
  let halftoneShader = null;
  let maskData = null;     // { mask: Uint8Array, w, h }
  let stampImg = null;
  let fallbackStamp = null;
  let bufW = 0, bufH = 0, bufDensity = 0; // track current buffer dimensions

  function hideGraphics(g) {
    const els = [g?.elt, g?.canvas, g?._renderer?.canvas];
    for (const el of els) {
      if (el?.style) { el.style.display = 'none'; el.setAttribute?.('aria-hidden', 'true'); }
    }
  }

  // Resize the WEBGL buffer only when the dimensions actually change.
  function ensureBuffers(w, h, density) {
    if (sil && bufW === w && bufH === h && bufDensity === density) return;
    if (sil) {
      try { sil.remove(); } catch { /* ok */ }
    }
    sil = p.createGraphics(w, h, p.WEBGL);
    sil.pixelDensity(density);
    sil.noStroke();
    pixelateShader = sil.createShader(DITHER_VERT, PIXELATE_FRAG);
    halftoneShader = sil.createShader(DITHER_VERT, HALFTONE_FRAG);
    hideGraphics(sil);
    bufW = w; bufH = h; bufDensity = density;
  }

  // Keep API compat — callers still pass buildBuffers() before renderSilhouette().
  function buildBuffers(w, h, density) {
    ensureBuffers(w, h, density);
  }

  function setMask(maskInfo) {
    maskData = maskInfo;
    maskCanvas = null; // invalidate cached upscaled mask
    maskCtx = null;
  }

  function setStamp(img) { stampImg = img || null; }

  function currentStamp() {
    if (stampImg) return stampImg;
    if (!fallbackStamp) fallbackStamp = blankStamp(p);
    return fallbackStamp;
  }

  function drawFullQuad(buf) {
    buf.push();
    buf.rectMode(p.CORNER);
    buf.rect(-buf.width / 2, -buf.height / 2, buf.width, buf.height);
    buf.pop();
  }

  // Build (or reuse) an upscaled mask ImageData at pixel-density resolution.
  // This is the expensive step, but it only runs when maskData changes (setMask).
  function getMaskCanvas(pw, ph) {
    if (maskCanvas && maskCanvas.width === pw && maskCanvas.height === ph) {
      return maskCanvas;
    }
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = pw;
    maskCanvas.height = ph;
    maskCtx = maskCanvas.getContext('2d');

    if (!maskData) {
      // No mask: fill entirely white (everything visible).
      maskCtx.fillStyle = '#fff';
      maskCtx.fillRect(0, 0, pw, ph);
    } else {
      const { mask, w: mw, h: mh } = maskData;
      const img = maskCtx.createImageData(pw, ph);
      const d = img.data;
      for (let y = 0; y < ph; y++) {
        const my = Math.min(mh - 1, ((y / ph) * mh) | 0);
        for (let x = 0; x < pw; x++) {
          const mx = Math.min(mw - 1, ((x / pw) * mw) | 0);
          const on = mask[my * mw + mx] ? 255 : 0;
          const i = (y * pw + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = 255;
          d[i + 3] = on;
        }
      }
      maskCtx.putImageData(img, 0, 0);
    }
    return maskCanvas;
  }

  /**
   * Run the silhouette effect for the current block and return an HTMLCanvasElement
   * (or null) that the caller can draw via p.drawingContext.drawImage().
   *
   * Masking is done with destination-in composite — the GPU handles it in one
   * pass instead of a per-pixel JS loop.
   */
  function renderSilhouette(sourceTex) {
    const w = sil.width;
    const h = sil.height;
    const density = sil.pixelDensity();
    const pw = Math.max(1, Math.round(w * density));
    const ph = Math.max(1, Math.round(h * density));

    // 1 — run shader (or plain blit for 'none') into the WEBGL buffer.
    sil.clear();
    if (render.effect === 'none') {
      sil.push();
      sil.texture(sourceTex);
      sil.rectMode(p.CORNER);
      sil.rect(-w / 2, -h / 2, w, h);
      sil.pop();
    } else if (render.effect === 'pixelate') {
      sil.shader(pixelateShader);
      pixelateShader.setUniform('u_texture', sourceTex);
      pixelateShader.setUniform('u_resolution', [pw, ph]);
      pixelateShader.setUniform('u_size', render.granularity * density);
      pixelateShader.setUniform('u_flatColor', render.keepOriginal ? 0 : 1);
      pixelateShader.setUniform('u_color', hexToRgb01(render.color));
      pixelateShader.setUniform('u_shape', shapeIndex(render.shape));
      pixelateShader.setUniform('u_stamp', currentStamp());
      drawFullQuad(sil);
    } else {
      sil.shader(halftoneShader);
      halftoneShader.setUniform('u_texture', sourceTex);
      halftoneShader.setUniform('u_resolution', [pw, ph]);
      halftoneShader.setUniform('u_size', render.granularity * density);
      halftoneShader.setUniform('u_flatColor', render.keepOriginal ? 0 : 1);
      halftoneShader.setUniform('u_color', hexToRgb01(render.color));
      halftoneShader.setUniform('u_shape', shapeIndex(render.shape));
      halftoneShader.setUniform('u_stamp', currentStamp());
      drawFullQuad(sil);
    }

    // 2 — composite mask via destination-in on a plain 2D canvas.
    // Grab the shader output from the WebGL canvas, stamp the mask on top.
    const out = document.createElement('canvas');
    out.width = pw;
    out.height = ph;
    const ctx = out.getContext('2d');
    ctx.drawImage(sil.canvas, 0, 0, pw, ph);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(getMaskCanvas(pw, ph), 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    return out; // HTMLCanvasElement — caller uses drawingContext.drawImage()
  }

  function dispose() {
    if (sil) { try { sil.remove(); } catch { /* ok */ } sil = null; }
    bufW = 0; bufH = 0; bufDensity = 0;
    maskCanvas = null; maskCtx = null;
  }

  return {
    buildBuffers, setMask, setStamp, renderSilhouette, dispose,
    get size() { return sil ? { w: sil.width, h: sil.height } : null; },
  };
}
