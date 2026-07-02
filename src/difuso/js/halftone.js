// DIFUSO — halftone effect: basic RGB dot-pattern (HALFTONE_FRAG) and CMYK
// screen-print simulation (CMYK_HALFTONE_FRAG). dither.type === 'halftone' uses
// the basic shader (paired with DITHER_VERT); 'halftoneCMYK' uses the CMYK
// shader (paired with GRADIENT_VERT) — distinct uniform sets AND distinct vert
// pairings, confirmed against reference/dithr/scripts/main.js:104-141 and
// shaders.js's header comment.
//
// Buffer ownership: like dither.js, this factory does NOT own the WEBGL draw
// buffer — app.js (Task 10) supplies it as `buffer`. This module owns only its
// two cached shader programs.

import { HALFTONE_FRAG, CMYK_HALFTONE_FRAG, DITHER_VERT, GRADIENT_VERT } from './shaders.js';
import { createMap2 } from './map2.js';

export function createHalftone({ p, state, buffer }) {
  let basicShaderInstance = null;
  let cmykShaderInstance = null;
  const map2 = createMap2(p);

  function buildShaders() {
    if (!basicShaderInstance) {
      basicShaderInstance = buffer.createShader(DITHER_VERT, HALFTONE_FRAG);
    }
    if (!cmykShaderInstance) {
      cmykShaderInstance = buffer.createShader(GRADIENT_VERT, CMYK_HALFTONE_FRAG);
    }
    return { basic: basicShaderInstance, cmyk: cmykShaderInstance };
  }

  // Shared with dither.js's copy — kept local so each effect module is
  // self-contained (matches the reference, where drawFullBufferRect was a small
  // free function every branch called).
  function drawFullBufferRect() {
    buffer.push();
    buffer.rectMode(p.CORNER);
    buffer.rect(-buffer.width / 2, -buffer.height / 2, buffer.width, buffer.height);
    buffer.pop();
  }

  // The `contrast`/`saturation` computations are identical across the whole
  // dither family (see reference drawCanvas()); computed here from state.
  function sharedValues() {
    const { dither, gradient } = state;
    const contrast =
      dither.contrast <= 1
        ? p.map(dither.contrast, 0.5, 1, 0.25, 1)
        : p.map(dither.contrast, 1, 4, 1, 12);
    const saturation =
      gradient.type !== 'original' ? 1 : p.map(gradient.saturation, 0, 1, 1, 0);
    return { contrast, saturation };
  }

  function applyBasic(sourceTexture) {
    const { dither } = state;
    const { contrast, saturation } = sharedValues();
    const { basic } = buildShaders();

    buffer.shader(basic);
    basic.setUniform('u_texture', sourceTexture);
    basic.setUniform('u_resolution', [
      sourceTexture.width * p.pixelDensity(),
      sourceTexture.height * p.pixelDensity(),
    ]);
    basic.setUniform('u_density', p.pixelDensity());
    basic.setUniform('u_size', dither.halftone.scale * p.pixelDensity());
    basic.setUniform('u_halfscale', [dither.halftone.x, dither.halftone.y, dither.halftone.z]);
    basic.setUniform('u_smooth', dither.halftone.smooth);
    basic.setUniform('u_brightness', dither.brightness);
    basic.setUniform('u_contrast', contrast);
    basic.setUniform('u_saturation', saturation);
    drawFullBufferRect();
  }

  function applyCMYK(sourceTexture) {
    const { dither } = state;
    const { contrast, saturation } = sharedValues();
    const { cmyk } = buildShaders();

    // Exponential ease-out (when = 1 = OUT) remap from the halftone-scale slider
    // range onto the shader's dot-size range [500..5].
    const CMYKscale = map2(
      dither.halftone.scale,
      dither.halftone.scaleMin,
      dither.halftone.scaleMax,
      500,
      5,
      'Exponential',
      1
    );

    buffer.shader(cmyk);
    cmyk.setUniform('u_texture', sourceTexture);
    cmyk.setUniform('u_resolution', [
      sourceTexture.width * p.pixelDensity(),
      sourceTexture.height * p.pixelDensity(),
    ]);
    cmyk.setUniform('u_size', CMYKscale);
    cmyk.setUniform('u_brightness', dither.brightness);
    cmyk.setUniform('u_contrast', contrast);
    cmyk.setUniform('u_saturation', saturation);
    drawFullBufferRect();
  }

  return { buildShaders, applyBasic, applyCMYK };
}
