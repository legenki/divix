// DIFUSO — gradient-map post-processing: maps the dither/ascii/halftone stage's
// grayscale output through a horizontal colour-ramp texture built from the
// selected palette (state.gradient.palette indexes into COLOR_PALETTES,
// state.js's DELIBERATELY 1-indexed object — see state.js's own comment; do not
// "fix" it to 0-indexed). The GRADIENT_FRAG shader samples this ramp at
// texture-coord (grayscale, 0.5), so the ramp is a width×1 strip.
//
// Buffer/texture ownership: like dither.js/halftone.js, this factory does NOT
// own the WEBGL draw buffer(s) — app.js (Task 10) creates both the prior-stage
// output buffer and the gradient target buffer and passes them into buildShader/
// apply. This module owns ONLY its internal ramp texture (a 2D — NOT WEBGL —
// p5.Graphics used purely as a texture source for the shader), rebuilt via
// buildGradientTexture().
//
// Two-buffer relationship: the reference's drawCanvas() (main.js:160-167) does
//   gradBuffer.shader(gradientShader);
//   gradientShader.setUniform('u_texture', dithBuffer);  // prior stage output
//   gradientShader.setUniform('u_gradient', gTexture);   // this ramp
//   drawFullBufferRect(gradBuffer);
// i.e. it reads FROM the prior stage's buffer and writes INTO a separate target.
// apply() below models that as apply(sourceBuffer, targetBuffer). The
// gradient.type === 'original' pass-through (gradBuffer.image(dithBuffer,...)) is
// app.js's own concern — the reference branches on gradient.type BEFORE ever
// calling the gradient shader path, so this module is only invoked for
// type === 'gradient'.

import { GRADIENT_FRAG, GRADIENT_VERT } from './shaders.js';

export function createGradient({ p, state, palettes }) {
  // palettes = COLOR_PALETTES from state.js (30 entries, 1-indexed object keyed
  // "1".."30"; not an array, so no .length — use Object.keys() to count).
  let shaderInstance = null;
  let gradientTexture = null; // 2D p5.Graphics — horizontal linear-gradient strip.

  /**
   * Builds/caches the gradient shader. The reference builds this shader on
   * gradBuffer specifically, so — matching dither.js/halftone.js's convention of
   * receiving their draw buffer rather than inventing a new one — this takes the
   * target (gradient) buffer as a param. Pass the same buffer you later hand to
   * apply()'s targetBuffer.
   * @param {import('p5').Graphics} targetBuffer WEBGL buffer (the reference's gradBuffer).
   */
  function buildShader(targetBuffer) {
    if (!shaderInstance) {
      shaderInstance = targetBuffer.createShader(GRADIENT_VERT, GRADIENT_FRAG);
    }
    return shaderInstance;
  }

  // Port of the reference's hideGraphicsCanvas(): keep the ramp canvas out of the
  // DOM flow (texture source, never displayed).
  function hideGraphicsCanvas(graphics) {
    const elements = [
      graphics?.elt,
      graphics?.canvas,
      graphics?._renderer?.elt,
      graphics?._renderer?.canvas,
    ];
    for (const element of elements) {
      if (!element?.style) continue;
      element.style.display = 'none';
      element.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Ports applyPalette(): copies the selected built-in palette's color/use/reverse
   * into the working state.gradient.{color,use,reverse}, then rebuilds the ramp.
   *
   * state.gradient.color/use are objects keyed 0..4 (see state.js); the source
   * palette stores them as 5-element arrays. We copy index-for-index. The
   * reference also .refresh()'d each Tweakpane binding afterwards — that UI-sync
   * is controls.js's (Task 9) concern here, not this module's, so it's omitted.
   */
  function applySelectedPalette() {
    const { gradient } = state;
    const source = palettes[gradient.palette];
    const paletteColors = Object.values(source.color);
    const useColor = Object.values(source.use);

    for (let i = 0; i < paletteColors.length; i++) {
      gradient.color[i] = paletteColors[i];
      gradient.use[i] = useColor[i];
    }
    gradient.reverse = source.reverse;
    buildGradientTexture();
  }

  /**
   * Ports createGradient()+createGradientTexture(): counts the enabled swatches
   * (state.gradient.use) and builds a colorAmount*16 × 1 horizontal linear
   * gradient using the 2D canvas API (drawingContext.createLinearGradient) — this
   * is a plain 2D p5.Graphics, not WEBGL, matching the reference exactly. Releases
   * any previous ramp first.
   *
   * Divide-by-zero guard (design decision): the reference advances each colour
   * stop by 1 / (colorAmount - 1), which is Infinity when colorAmount === 1 and
   * NaN-producing when colorAmount === 0 (all swatches disabled). This is the
   * exact class of bug already fixed elsewhere in this project (DIVIX's empty-
   * palette guards, dither.js's fail-loud unsupported-state fix). A palette with
   * ≤1 enabled swatch is malformed-but-plausible user/preset data, not an
   * impossible internal state, so we DON'T throw — we fall back to a flat,
   * single-colour ramp (the first enabled colour, or the first colour, or black),
   * which the shader samples uniformly. Documented here and inline below.
   */
  function buildGradientTexture() {
    const { gradient } = state;
    const paletteColors = Object.values(gradient.color);
    const useColor = Object.values(gradient.use);

    let colorAmount = 0;
    for (let i = 0; i < paletteColors.length; i++) {
      if (useColor[i] === true) colorAmount++;
    }

    if (gradientTexture && typeof gradientTexture.remove === 'function') {
      gradientTexture.remove();
    }

    // Guard: with ≤1 enabled swatch the reference's 1/(colorAmount-1) step is
    // Infinity/NaN. Fall back to a flat single-colour ramp instead. Width is
    // clamped to a minimum of 16 (one swatch's worth) so the strip is non-empty.
    if (colorAmount <= 1) {
      const flatColor =
        paletteColors.find((c, i) => useColor[i] === true) || paletteColors[0] || '#000000';
      gradientTexture = p.createGraphics(16, 1);
      hideGraphicsCanvas(gradientTexture);
      gradientTexture.pixelDensity(1);
      gradientTexture.noStroke();
      gradientTexture.background(flatColor);
      return gradientTexture;
    }

    gradientTexture = p.createGraphics(colorAmount * 16, 1);
    hideGraphicsCanvas(gradientTexture);
    gradientTexture.pixelDensity(1);
    gradientTexture.noStroke();
    gradientTexture.rectMode(p.CENTER);
    gradientTexture.translate(gradientTexture.width * 0.5, gradientTexture.height * 0.5);
    if (gradient.reverse) gradientTexture.rotate(p.PI);

    const grad = gradientTexture.drawingContext.createLinearGradient(
      -gradientTexture.width / 2,
      -gradientTexture.height * 0.5,
      gradientTexture.width / 2,
      -gradientTexture.height * 0.5
    );

    let index = 0;
    for (let i = 0; i < paletteColors.length; i++) {
      if (useColor[i] !== false) {
        grad.addColorStop(index, paletteColors[i]);
        index += 1 / (colorAmount - 1);
      }
    }
    gradientTexture.drawingContext.fillStyle = grad;
    gradientTexture.rect(0, 0, gradientTexture.width, gradientTexture.height);
    return gradientTexture;
  }

  // Port of the reference's drawFullBufferRect(): CORNER-mode rect over the whole
  // target buffer so the shader runs on every pixel. Kept local, matching
  // dither.js/halftone.js.
  function drawFullBufferRect(targetBuffer) {
    targetBuffer.push();
    targetBuffer.rectMode(p.CORNER);
    targetBuffer.rect(
      -targetBuffer.width / 2,
      -targetBuffer.height / 2,
      targetBuffer.width,
      targetBuffer.height
    );
    targetBuffer.pop();
  }

  /**
   * Runs the gradient-map shader: reads the prior stage's output buffer as the
   * grayscale source, samples the ramp texture, and draws into the separate
   * target buffer. Only call this when state.gradient.type === 'gradient' — the
   * 'original' pass-through is app.js's concern (see header). Self-heals a never-
   * built ramp; does not detect a stale one (call buildGradientTexture/
   * applySelectedPalette after palette/color/use/reverse changes).
   *
   * @param {import('p5').Graphics} sourceBuffer prior stage's WEBGL output (reference's dithBuffer).
   * @param {import('p5').Graphics} targetBuffer WEBGL buffer to draw into (reference's gradBuffer).
   */
  function apply(sourceBuffer, targetBuffer) {
    const shader = buildShader(targetBuffer);
    if (!gradientTexture) buildGradientTexture();

    targetBuffer.shader(shader);
    shader.setUniform('u_texture', sourceBuffer);
    shader.setUniform('u_gradient', gradientTexture);
    drawFullBufferRect(targetBuffer);
  }

  // buildShader(targetBuffer): call once after the gradient buffer exists.
  // applySelectedPalette(): call when gradient.palette changes (copies palette →
  // working state + rebuilds ramp). buildGradientTexture(): call after any
  // gradient.color/use/reverse change. apply(sourceBuffer, targetBuffer): every
  // frame, only when gradient.type === 'gradient'.
  return { buildShader, applySelectedPalette, buildGradientTexture, apply };
}
