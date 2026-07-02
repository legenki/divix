// DIFUSO — ordered-dither effect (Bayer matrix / noise texture modes).
// Wraps DITHER_FRAG + DITHER_VERT from shaders.js and the matrix tables from
// matrices.js into a reusable shader instance + per-frame uniform updates.
//
// Buffer/texture ownership: this factory does NOT create or own the WEBGL draw
// buffer — app.js (Task 10) creates it and passes it in as `buffer`, matching
// the DIVIX port's established pattern where effect modules receive their draw
// targets rather than constructing canvas/buffer state. The one graphics object
// this module DOES own is the generated pattern texture (the Bayer/noise tile),
// because its size and contents derive purely from dither state and it is an
// internal implementation detail of the ordered-dither effect. It is rebuilt
// (and the previous one released) on demand via buildDitherTexture().

import { DITHER_FRAG, DITHER_VERT } from './shaders.js';
import {
  PIXEL_MATRIX,
  GRID_MATRIX,
  CHECKER_MATRIX,
  DIAGONAL_MATRIX,
  BAYER_MATRIX_2,
  BAYER_MATRIX_4,
  BAYER_MATRIX_8,
  BAYER_MATRIX_16,
} from './matrices.js';

// Matrix lookup: dither.matrix value → { matrix (flat row-major), width (grid
// size). Widths confirmed against matrices.js's own header comment:
//   PIXEL_MATRIX 2, GRID_MATRIX 3, CHECKER_MATRIX 4, DIAGONAL_MATRIX 4,
//   BAYER_MATRIX_2 2, BAYER_MATRIX_4 4, BAYER_MATRIX_8 8, BAYER_MATRIX_16 16.
const MATRIX_TABLE = {
  pixel: { matrix: PIXEL_MATRIX, width: 2 },
  checker: { matrix: CHECKER_MATRIX, width: 4 },
  grid: { matrix: GRID_MATRIX, width: 3 },
  diagonal: { matrix: DIAGONAL_MATRIX, width: 4 },
  bayer2: { matrix: BAYER_MATRIX_2, width: 2 },
  bayer4: { matrix: BAYER_MATRIX_4, width: 4 },
  bayer8: { matrix: BAYER_MATRIX_8, width: 8 },
  bayer16: { matrix: BAYER_MATRIX_16, width: 16 },
};

export function createDither({ p, state, buffer, noiseTextures }) {
  // buffer: p5.Graphics (WEBGL) the shader draws into — supplied by app.js.
  // noiseTextures: { noise16: p5.Image[4], noise32: [...], noise64: [...],
  //   noise128: [...] } — pre-loaded from public/assets/difuso/textures/,
  //   supplied by app.js. Accessed 1-indexed matching dither.texture (1..4):
  //   noiseTextures[dither.noise][dither.texture - 1].
  let shaderInstance = null;
  let ditherTexture = null; // p5.Graphics — generated Bayer/noise pattern tile.

  function buildShader() {
    if (!shaderInstance) {
      shaderInstance = buffer.createShader(DITHER_VERT, DITHER_FRAG);
    }
    return shaderInstance;
  }

  // Configure a freshly-created pattern-tile graphics the way the reference did
  // (makeBayerTexture/makeNoiseTexture): hidden, non-smoothed, pixelDensity 1,
  // no stroke.
  function prepTile(tex) {
    hideTileCanvas(tex);
    tex.noSmooth();
    tex.pixelDensity(1);
    tex.noStroke();
  }

  function hideTileCanvas(tex) {
    const elements = [tex?.elt, tex?.canvas, tex?._renderer?.elt, tex?._renderer?.canvas];
    for (const element of elements) {
      if (!element?.style) continue;
      element.style.display = 'none';
      element.setAttribute('aria-hidden', 'true');
    }
  }

  function makeBayerTexture() {
    const { matrix, width } = MATRIX_TABLE[state.dither.matrix];
    const density = p.pixelDensity();
    const d = width * state.dither.scale * density;
    const tex = p.createGraphics(d, d);
    prepTile(tex);

    // The reference nests row/col loops over a 2D matrice[row][col]; here the
    // matrix is flat row-major, so index as matrix[row * width + col].
    const size = state.dither.scale * density;
    for (let row = 0; row < width; row++) {
      tex.push();
      tex.translate(0, row * size);
      for (let col = 0; col < width; col++) {
        tex.push();
        tex.translate(col * size, 0);
        tex.fill(matrix[row * width + col] * 255);
        tex.rect(0, 0, size, size);
        tex.pop();
      }
      tex.pop();
    }
    return tex;
  }

  function makeNoiseTexture() {
    const img = noiseTextures[state.dither.noise][state.dither.texture - 1];
    const d = img.width * state.dither.scale * p.pixelDensity();
    const tex = p.createGraphics(d, d);
    prepTile(tex);
    tex.image(img, 0, 0, tex.width, tex.height);
    return tex;
  }

  // Rebuild the generated pattern tile from current dither state. Releases the
  // previous tile first. 'custom' (makeCustomTexture / upload-custom-texture) is
  // intentionally NOT ported — the panel (Task 9) excludes that UI. For matrix
  // mode dither.matrix picks the tile; for noise mode dither.noise/texture do.
  function buildDitherTexture() {
    if (ditherTexture && typeof ditherTexture.remove === 'function') {
      ditherTexture.remove();
    }
    ditherTexture = null;

    if (state.dither.type === 'noise') {
      ditherTexture = makeNoiseTexture();
    } else {
      // 'matrix' (and any non-noise ordered-dither path) uses the matrix tile.
      ditherTexture = makeBayerTexture();
    }
    return ditherTexture;
  }

  // Port of the reference's drawFullBufferRect(): paint a CORNER-mode rect
  // covering the whole WEBGL buffer so the active shader runs over every pixel.
  function drawFullBufferRect() {
    buffer.push();
    buffer.rectMode(p.CORNER);
    buffer.rect(-buffer.width / 2, -buffer.height / 2, buffer.width, buffer.height);
    buffer.pop();
  }

  function apply(sourceTexture) {
    const { dither, gradient } = state;

    const contrast =
      dither.contrast <= 1
        ? p.map(dither.contrast, 0.5, 1, 0.25, 1)
        : p.map(dither.contrast, 1, 4, 1, 12);
    const saturation =
      gradient.type !== 'original' ? 1 : p.map(gradient.saturation, 0, 1, 1, 0);
    const step = 0.2 + dither.step * 0.1;

    const shader = buildShader();
    if (!ditherTexture) buildDitherTexture();

    buffer.shader(shader);
    shader.setUniform('u_texture', sourceTexture);
    shader.setUniform('u_resolution', [
      sourceTexture.width * p.pixelDensity(),
      sourceTexture.height * p.pixelDensity(),
    ]);
    shader.setUniform('u_dither_tex', ditherTexture);
    shader.setUniform('u_dither_size', [ditherTexture.width, ditherTexture.height]);
    shader.setUniform('u_density', p.pixelDensity());
    shader.setUniform('u_scale', dither.scale * p.pixelDensity());
    shader.setUniform('u_steps', step);
    shader.setUniform('u_contrast', contrast);
    shader.setUniform('u_brightness', dither.brightness);
    shader.setUniform('u_saturation', saturation);
    drawFullBufferRect();
  }

  return { buildShader, buildDitherTexture, apply };
}
