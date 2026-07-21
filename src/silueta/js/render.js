// SILUETA — silhouette render layer (WEBGL). Textures the source image, runs the
// pixelate/halftone/original shader into an offscreen buffer, then gates the
// result with the (upsampled) object mask so background is transparent.
// Buffer/pixel-density discipline mirrors difuso (see the difuso pixel-density
// memory: p.pixelDensity() must match the buffer's density or the shader tiles).

import { PIXELATE_FRAG, HALFTONE_FRAG, DITHER_VERT } from './shaders.js';

function hexToRgb01(hex) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * @param {object} deps { p, state }
 * @returns render controller with buildShaders/render/dispose.
 */
export function createRender({ p, state }) {
  const { render } = state;
  let sil = null;      // WEBGL shader-output buffer
  let masked = null;   // P2D buffer holding the final masked silhouette (RGBA)
  let pixelateShader = null;
  let halftoneShader = null;
  let maskImg = null;  // p5.Image built from the extraction mask (for gating)

  function buildBuffers(w, h, density) {
    dispose();
    sil = p.createGraphics(w, h, p.WEBGL);
    sil.pixelDensity(density);
    sil.noStroke();
    pixelateShader = sil.createShader(DITHER_VERT, PIXELATE_FRAG);
    halftoneShader = sil.createShader(DITHER_VERT, HALFTONE_FRAG);

    masked = p.createGraphics(w, h); // P2D
    masked.pixelDensity(density);
    masked.noStroke();
  }

  /**
   * Build a p5.Image (white where object, transparent where background) from a
   * flat mask, sized to the mask's own resolution. Used as the gate.
   */
  function setMask(maskInfo) {
    const { mask, w: mw, h: mh } = maskInfo;
    maskImg = p.createImage(mw, mh);
    maskImg.loadPixels();
    for (let i = 0; i < mw * mh; i++) {
      const on = mask[i] ? 255 : 0;
      const j = i * 4;
      maskImg.pixels[j] = 255;
      maskImg.pixels[j + 1] = 255;
      maskImg.pixels[j + 2] = 255;
      maskImg.pixels[j + 3] = on;
    }
    maskImg.updatePixels();
  }

  function drawFullQuad(buf) {
    buf.push();
    buf.rectMode(p.CORNER);
    buf.rect(-buf.width / 2, -buf.height / 2, buf.width, buf.height);
    buf.pop();
  }

  /**
   * Render the current silhouette into `masked` (P2D, RGBA with transparent bg).
   * @param {p5.Image} sourceTex  resized source image (fits the buffer)
   * @returns {p5.Graphics} the masked buffer (caller blits it to the canvas)
   */
  function renderSilhouette(sourceTex) {
    const w = sil.width, h = sil.height;
    const density = sil.pixelDensity();

    sil.clear();

    if (render.effect === 'none') {
      // Pass-through: draw the source as-is (still gets mask-gated below).
      sil.push();
      sil.texture(sourceTex);
      sil.rectMode(p.CORNER);
      sil.rect(-w / 2, -h / 2, w, h);
      sil.pop();
    } else if (render.effect === 'pixelate') {
      sil.shader(pixelateShader);
      pixelateShader.setUniform('u_texture', sourceTex);
      pixelateShader.setUniform('u_resolution', [w * density, h * density]);
      pixelateShader.setUniform('u_size', render.granularity * density);
      pixelateShader.setUniform('u_flatColor', render.keepOriginal ? 0 : 1);
      pixelateShader.setUniform('u_color', hexToRgb01(render.color));
      drawFullQuad(sil);
    } else {
      // halftone — reuse difuso's HALFTONE_FRAG uniform set (neutral b/c/s).
      sil.shader(halftoneShader);
      halftoneShader.setUniform('u_texture', sourceTex);
      halftoneShader.setUniform('u_resolution', [w * density, h * density]);
      halftoneShader.setUniform('u_size', render.granularity * density);
      halftoneShader.setUniform('u_smooth', 2);
      halftoneShader.setUniform('u_brightness', 1);
      halftoneShader.setUniform('u_contrast', 1);
      halftoneShader.setUniform('u_saturation', render.keepOriginal ? 0 : 1);
      halftoneShader.setUniform('u_density', density);
      halftoneShader.setUniform('u_halfscale', [1, 1, 1]);
      drawFullQuad(sil);
    }

    // Gate with the mask: draw the shader output, then keep only where the mask
    // is opaque (destination-in). masked ends up transparent on the background.
    masked.clear();
    masked.push();
    masked.image(sil, 0, 0, masked.width, masked.height);
    if (maskImg) {
      masked.blendMode(p.REMOVE); // destination-out of the inverse == keep inside mask
      // REMOVE subtracts alpha; to KEEP inside the mask we instead multiply.
      masked.blendMode(p.MULTIPLY);
      masked.image(maskImg, 0, 0, masked.width, masked.height);
    }
    masked.pop();
    masked.blendMode(p.BLEND);

    // For a flat silhouette (effect !== none, keepOriginal false) recolor is
    // already baked by the shader; MULTIPLY by white mask preserves it.
    return masked;
  }

  function dispose() {
    for (const g of [sil, masked]) {
      if (g && typeof g.remove === 'function') {
        try { g.remove(); } catch { /* instance-mode remove may throw */ }
      }
    }
    sil = null; masked = null;
  }

  return { buildBuffers, setMask, renderSilhouette, dispose, get size() { return sil ? { w: sil.width, h: sil.height } : null; } };
}
