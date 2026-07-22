// SILUETA — silhouette render layer.
// One persistent WEBGL context (like Difuso) processes the entire poster in one
// shader pass. Per-block silhouette masking happens on a 2D offscreen canvas via
// destination-in composite — no per-block WebGL contexts, no context limit errors.

import { PIXELATE_FRAG, HALFTONE_FRAG, DITHER_VERT } from './shaders.js';
import { shapeIndex, blankStamp } from './stamp.js';

function hexToRgb01(hex) {
  const h = String(hex).replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/**
 * One WEBGL buffer lives for the app lifetime. renderBlock() runs the shader
 * on a single source image (already fitted to block size) and returns a masked
 * HTMLCanvasElement the caller caches and blits.
 */
export function createRender({ p, state }) {
  const { render } = state;
  let sil = null;
  let pixelateShader = null;
  let halftoneShader = null;
  let stampImg = null;
  let fallbackStamp = null;
  // Current sil dimensions — resize only when a larger block arrives.
  let silW = 0, silH = 0, silDensity = 0;

  function hide(g) {
    for (const el of [g?.elt, g?.canvas, g?._renderer?.canvas]) {
      if (el?.style) { el.style.display = 'none'; el.setAttribute?.('aria-hidden', 'true'); }
    }
  }

  function initSil(w, h, density) {
    if (sil && silW === w && silH === h && silDensity === density) return;
    if (sil) { try { sil.remove(); } catch { /* ok */ } }
    sil = p.createGraphics(w, h, p.WEBGL);
    sil.pixelDensity(density);
    sil.noStroke();
    pixelateShader = sil.createShader(DITHER_VERT, PIXELATE_FRAG);
    halftoneShader = sil.createShader(DITHER_VERT, HALFTONE_FRAG);
    hide(sil);
    silW = w; silH = h; silDensity = density;
  }

  function stamp() {
    if (stampImg) return stampImg;
    if (!fallbackStamp) fallbackStamp = blankStamp(p);
    return fallbackStamp;
  }

  function setStamp(img) { stampImg = img || null; }

  /**
   * Render one image block through the current effect shader and apply the
   * silhouette mask. Returns an HTMLCanvasElement at physical (density-scaled)
   * resolution, ready to blit.
   *
   * @param {p5.Image}  sourceTex  source image already fitted to block size
   * @param {object}    maskInfo   { mask: Uint8Array, w, h } from extractFromBrightness
   * @param {number}    w          block width in CSS pixels
   * @param {number}    h          block height in CSS pixels
   * @param {number}    density    pixel density
   */
  function renderBlock(sourceTex, maskInfo, w, h, density) {
    initSil(w, h, density);

    const pw = Math.max(1, Math.round(w * density));
    const ph = Math.max(1, Math.round(h * density));

    // 1 — shader pass into the persistent WEBGL buffer.
    sil.clear();
    if (render.effect === 'none') {
      sil.push();
      sil.texture(sourceTex);
      sil.rectMode(p.CORNER);
      sil.rect(-w / 2, -h / 2, w, h);
      sil.pop();
    } else {
      const sh = render.effect === 'pixelate' ? pixelateShader : halftoneShader;
      sil.shader(sh);
      sh.setUniform('u_texture', sourceTex);
      sh.setUniform('u_resolution', [pw, ph]);
      sh.setUniform('u_size', render.granularity * density);
      sh.setUniform('u_flatColor', render.keepOriginal ? 0 : 1);
      sh.setUniform('u_color', hexToRgb01(render.color));
      sh.setUniform('u_shape', shapeIndex(render.shape));
      sh.setUniform('u_stamp', stamp());
      sil.push();
      sil.rectMode(p.CORNER);
      sil.rect(-w / 2, -h / 2, w, h);
      sil.pop();
    }

    // 2 — blit shader output to a 2D canvas, then cut with destination-in mask.
    const out = document.createElement('canvas');
    out.width = pw;
    out.height = ph;
    const ctx = out.getContext('2d');
    ctx.drawImage(sil.canvas, 0, 0, pw, ph);

    if (maskInfo) {
      // Build mask ImageData inline — no separate maskCanvas object per block.
      const { mask, w: mw, h: mh } = maskInfo;
      const imgData = ctx.createImageData(pw, ph);
      const d = imgData.data;
      for (let y = 0; y < ph; y++) {
        const my = Math.min(mh - 1, ((y / ph) * mh) | 0);
        for (let x = 0; x < pw; x++) {
          const mx = Math.min(mw - 1, ((x / pw) * mw) | 0);
          const i = (y * pw + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = 255;
          d[i + 3] = mask[my * mw + mx] ? 255 : 0;
        }
      }
      const maskTex = document.createElement('canvas');
      maskTex.width = pw; maskTex.height = ph;
      maskTex.getContext('2d').putImageData(imgData, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskTex, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    return out;
  }

  // Legacy entry-point kept so existing callers (SVG export, etc.) still work.
  function buildBuffers(w, h, density) { initSil(w, h, density); }

  function dispose() {
    if (sil) { try { sil.remove(); } catch { /* ok */ } sil = null; }
    silW = 0; silH = 0; silDensity = 0;
  }

  return { renderBlock, buildBuffers, setStamp, dispose };
}
