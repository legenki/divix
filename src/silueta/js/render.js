// SILUETA — silhouette render layer (WEBGL). Textures the source image, runs the
// pixelate/halftone/original shader into an offscreen buffer, then gates the
// result with the (upsampled) object mask so background is transparent.
// Buffer/pixel-density discipline mirrors difuso (see the difuso pixel-density
// memory: p.pixelDensity() must match the buffer's density or the shader tiles).

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
 * @returns render controller with buildShaders/render/dispose.
 */
export function createRender({ p, state }) {
  const { render } = state;
  let sil = null;      // WEBGL shader-output buffer
  let masked = null;   // P2D buffer holding the final masked silhouette (RGBA)
  let pixelateShader = null;
  let halftoneShader = null;
  let maskData = null; // { mask: Uint8Array, w, h } — the extraction mask (for gating)
  let stampImg = null; // rasterised custom-shape stamp (alpha = coverage)
  let fallbackStamp = null; // 1x1 opaque texture; u_stamp must always be bound

  function hideGraphics(g) {
    const els = [g?.elt, g?.canvas, g?._renderer?.canvas];
    for (const el of els) {
      if (el?.style) { el.style.display = 'none'; el.setAttribute?.('aria-hidden', 'true'); }
    }
  }

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

    hideGraphics(sil);
    hideGraphics(masked);
  }

  /**
   * Store the extraction mask for gating. Kept as the raw low-res typed array
   * (not a p5.Image) so renderSilhouette can gate by writing alpha directly —
   * a deterministic per-pixel mask that does not depend on p5 blend-mode
   * semantics (an earlier blendMode(MULTIPLY) gate left the background opaque).
   */
  function setMask(maskInfo) {
    const { mask, w: mw, h: mh } = maskInfo;
    maskData = { mask, w: mw, h: mh };
  }

  /** Install the rasterised custom-shape stamp (null clears it). */
  function setStamp(img) {
    stampImg = img || null;
  }

  /** The texture to bind to u_stamp — never null, or sampling is undefined. */
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
      pixelateShader.setUniform('u_shape', shapeIndex(render.shape));
      pixelateShader.setUniform('u_stamp', currentStamp());
      drawFullQuad(sil);
    } else {
      // halftone — silueta's own darkness-driven dots (same uniform set as
      // pixelate); dots are already painted in the silhouette color in-shader.
      sil.shader(halftoneShader);
      halftoneShader.setUniform('u_texture', sourceTex);
      halftoneShader.setUniform('u_resolution', [w * density, h * density]);
      halftoneShader.setUniform('u_size', render.granularity * density);
      halftoneShader.setUniform('u_flatColor', render.keepOriginal ? 0 : 1);
      halftoneShader.setUniform('u_color', hexToRgb01(render.color));
      halftoneShader.setUniform('u_shape', shapeIndex(render.shape));
      halftoneShader.setUniform('u_stamp', currentStamp());
      drawFullQuad(sil);
    }

    // Gate the shader output into the P2D buffer. Rather than blitting `sil`
    // and post-processing it (drawing the WEBGL canvas into a 2D context
    // re-composites its cleared background as OPAQUE, which filled the whole
    // poster), copy pixel-for-pixel: a pixel survives only where the object
    // mask is on AND the shader actually drew something (sil alpha > 0).
    // Everything else stays transparent so the paper shows through.
    masked.clear();
    sil.loadPixels();
    masked.loadPixels();
    const src = sil.pixels;
    const dst = masked.pixels;
    // Row strides come from width * density, rounded to whole pixels: p5 sizes
    // the backing store that way, and a fractional density (possible during
    // high-res export) would otherwise give a non-integer stride and overrun
    // the array (RangeError: offset is out of bounds).
    const pw = Math.max(1, Math.round(masked.width * masked.pixelDensity()));
    const ph = Math.max(1, Math.round(masked.height * masked.pixelDensity()));
    const sw = Math.max(1, Math.round(sil.width * sil.pixelDensity()));
    const sh = Math.max(1, Math.round(sil.height * sil.pixelDensity()));
    const mask = maskData ? maskData.mask : null;
    const mw = maskData ? maskData.w : 0;
    const mh = maskData ? maskData.h : 0;

    for (let y = 0; y < ph; y++) {
      const sy = Math.min(sh - 1, (y / ph * sh) | 0);
      const my = mask ? Math.min(mh - 1, (y / ph * mh) | 0) : 0;
      for (let x = 0; x < pw; x++) {
        const di = (y * pw + x) * 4;
        if (di + 3 >= dst.length) break;
        if (mask && !mask[my * mw + Math.min(mw - 1, (x / pw * mw) | 0)]) continue; // outside object
        const si = (sy * sw + Math.min(sw - 1, (x / pw * sw) | 0)) * 4;
        if (si + 3 >= src.length) continue;
        const a = src[si + 3];
        if (!a) continue; // shader drew nothing here (e.g. between halftone dots)
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = a;
      }
    }
    masked.updatePixels();

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

  return { buildBuffers, setMask, setStamp, renderSilhouette, dispose, get size() { return sil ? { w: sil.width, h: sil.height } : null; } };
}
