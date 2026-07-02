// DIFUSO — ASCII-art effect: builds a glyph-atlas texture from a loaded TTF
// font, then the shader (ASCII_FRAG, paired with DITHER_VERT) samples characters
// from that atlas by grayscale value of the source image.
//
// Buffer/texture ownership: like dither.js/halftone.js, this factory does NOT
// create or own the WEBGL draw buffer — app.js (Task 10) creates it and passes
// it in as `buffer`. The one graphics object this module DOES own is the glyph
// atlas (an internal 2D p5.Graphics built from the current font + text), because
// it derives purely from ascii state and is an implementation detail of the
// effect. It is rebuilt (and the previous one released) on demand via
// buildGlyphTexture().
//
// p5 2.2.3 API notes (this workspace's p5 is the npm/ESM 2.x build, not the
// global 1.11.2 the rest of Divix uses):
// - `p.loadFont(path, successCallback, errorCallback)` is `async` and returns a
//   Promise resolving to the loaded p5.Font (verified in node_modules/p5/lib/p5.js
//   ~L120366: `fn.loadFont = async function (...)`, returning `pfont` — it also
//   invokes successCallback if given). This is NOT the p5 1.x sync-with-callback
//   signature; we use the Promise/await style here, matching source.js's
//   loadImage/createVideo verification discipline.
// - `p.textBounds(str, x, y)` returns `{ x, y, w, h }` (verified L52619,
//   `_textBoundsSingle` via measureText's actualBoundingBox metrics). `textWidth`,
//   `textAscent`, `textDescent` are all present (L51888/51912/51931). The glyph-box
//   measurement below uses these exactly as the reference did.

import { ASCII_FRAG, DITHER_VERT } from './shaders.js';

export function createAscii({ p, state, buffer }) {
  // buffer: p5.Graphics (WEBGL) the ASCII shader draws into — supplied by app.js.
  let shaderInstance = null;
  let glyphTexture = null; // 2D p5.Graphics — the glyph atlas.

  function buildShader() {
    if (!shaderInstance) {
      shaderInstance = buffer.createShader(DITHER_VERT, ASCII_FRAG);
    }
    return shaderInstance;
  }

  // Port of the reference's hideGraphicsCanvas(): keep the internal atlas
  // canvas out of the DOM flow (it's a texture source, never displayed).
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
   * Ports getASCIITextureText(): returns state.ascii.text if it has any
   * characters, else a single space " ". The single-space fallback keeps the
   * atlas at least 1 glyph wide/tall (empty text would produce a 0-length atlas
   * and a divide-by-zero in the col/row grid math). Callers that need the
   * shader's u_totalChars must use THIS length, not state.ascii.text.length.
   * @returns {string}
   */
  function getTextureText() {
    return state.ascii.text.length > 0 ? state.ascii.text : ' ';
  }

  /**
   * Ports updateFont(): loads a TTF from the given resolved URL and, on success,
   * stores it in state.ascii.font then rebuilds the glyph box + atlas.
   *
   * Font-URL convention (design decision): rather than hardcode a base path or
   * re-resolve FONT_TYPES here, this accepts the fully-resolved font URL from the
   * caller — the same convention source.js established with its `defaultImageUrl`
   * dep. app.js (Task 10) owns the FONT_TYPES[state.ascii.fontname] → basename →
   * `/assets/difuso/fonts/<basename>` resolution and passes the URL in per call.
   * This keeps Vite public/-dir path knowledge in app.js, not scattered across
   * effect modules.
   *
   * @param {string} fontUrl  Resolved URL, e.g. `/assets/difuso/fonts/font_atascii.ttf`.
   * @returns {Promise<import('p5').Font>} the loaded font (also stored on state.ascii.font).
   */
  async function loadFont(fontUrl) {
    const font = await p.loadFont(fontUrl);
    state.ascii.font = font;
    measureGlyphBox();
    buildGlyphTexture();
    return font;
  }

  /**
   * Ports getGlyphBox(): measures the widest/tallest glyph across the characters
   * in state.ascii.text using the loaded font, then stores the box + aspect
   * ratio on state. Falls back to a single-space width / (ascent+descent) height
   * when text is empty (or every glyph measured zero), exactly matching the
   * reference. Sets state.ascii.box = [w, h] and state.ascii.ratio = w / h.
   */
  function measureGlyphBox() {
    const { ascii } = state;
    let maxWidth = 0;
    let maxHeight = 0;

    p.textFont(ascii.font);
    p.textSize(ascii.maxScale);
    p.textAlign(p.LEFT, p.TOP);

    for (let i = 0; i < ascii.text.length; i++) {
      const bounds = p.textBounds(ascii.text[i], 0, 0);
      if (maxWidth < bounds.w) maxWidth = bounds.w;
      if (maxHeight < bounds.h) maxHeight = bounds.h;
    }

    if (maxWidth === 0) maxWidth = Math.max(1, p.textWidth(' '));
    if (maxHeight === 0) maxHeight = Math.max(1, p.textAscent() + p.textDescent());

    ascii.box = [Math.ceil(maxWidth), Math.ceil(maxHeight)];
    ascii.ratio = ascii.box[0] / ascii.box[1];
  }

  /**
   * Ports createASCIITexture(): builds the glyph-atlas 2D p5.Graphics, laying out
   * each character of getTextureText() into a cols×rows grid of ascii.box-sized
   * cells. cols/rows math is ported exactly (ceil(sqrt(len)) etc., clamped to a
   * minimum of 1). Releases any previous atlas first.
   *
   * Requires state.ascii.font to be set (call loadFont/measureGlyphBox first);
   * app.js must have loaded a font before invoking this or apply().
   */
  function buildGlyphTexture() {
    const { ascii } = state;
    const textureText = getTextureText();
    ascii.cols = Math.max(1, Math.ceil(Math.sqrt(textureText.length)));
    ascii.rows = Math.max(1, Math.ceil(textureText.length / ascii.cols));

    if (glyphTexture && typeof glyphTexture.remove === 'function') {
      glyphTexture.remove();
    }
    glyphTexture = p.createGraphics(
      Math.max(1, ascii.box[0] * ascii.cols),
      Math.max(1, ascii.box[1] * ascii.rows)
    );
    hideGraphicsCanvas(glyphTexture);
    glyphTexture.pixelDensity(1);
    glyphTexture.noSmooth();
    glyphTexture.fill(255);
    glyphTexture.textFont(ascii.font);
    glyphTexture.textSize(ascii.maxScale);
    glyphTexture.textAlign(p.LEFT, p.TOP);
    glyphTexture.noStroke();

    for (let i = 0; i < textureText.length; i++) {
      const col = i % ascii.cols;
      const row = Math.floor(i / ascii.cols);
      const x = ascii.box[0] * col;
      const y = ascii.box[1] * row;
      glyphTexture.text(textureText[i], x, y);
    }
    return glyphTexture;
  }

  /**
   * Ports hexToShader(): '#RRGGBB' → [r/255, g/255, b/255] normalized floats.
   *
   * Guard (design decision): validate the hex string before parseInt so a
   * malformed value (e.g. from a corrupted preset) can't silently feed NaN into
   * the shader uniforms. Following dither.js's "fail loudly on genuinely-
   * impossible internal state" vs. "graceful fallback for malformed-but-plausible
   * input" split: a bad hex here is malformed *input* (user/preset colour), not
   * an impossible internal state, so we fall back to black [0, 0, 0] with a
   * console.warn rather than throwing — a wrong colour is recoverable, a crashed
   * render loop is not.
   * @param {string} hex e.g. '#ffcc00'
   * @returns {[number, number, number]}
   */
  function hexToShader(hex) {
    if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
      console.warn(`ascii.hexToShader: invalid hex '${hex}', falling back to black`);
      return [0, 0, 0];
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r / 255, g / 255, b / 255];
  }

  // Port of the reference's drawFullBufferRect(): paint a CORNER-mode rect over
  // the whole WEBGL buffer so the active shader runs on every pixel. Kept local
  // (matches dither.js/halftone.js, and the reference's per-branch free function).
  function drawFullBufferRect() {
    buffer.push();
    buffer.rectMode(p.CORNER);
    buffer.rect(-buffer.width / 2, -buffer.height / 2, buffer.width, buffer.height);
    buffer.pop();
  }

  /**
   * Wires all ASCII_FRAG uniforms from current state + the source texture, then
   * draws a full-buffer rect. Formulas ported exactly from the reference
   * main.js:68-103 (colour-mode flags, per-axis scale from box aspect, grid
   * offset/cells/size, shared contrast/saturation). Self-heals a never-built
   * atlas (glyphTexture === null) by building it, but — like dither.js — it does
   * NOT detect a *stale* atlas: app.js must call buildGlyphTexture() (or loadFont)
   * after any change to ascii.text/font/box that affects the atlas.
   *
   * @param {import('p5').Image | import('p5').MediaElement} sourceTexture
   *   the source image/video (the reference's gImg): fed as u_imageTexture AND
   *   used for the grid-size math (its width/height).
   */
  function apply(sourceTexture) {
    const { ascii, dither, gradient } = state;

    let charMode = true;
    let bgMode = true;
    if (ascii.color.mode === 'chars') bgMode = false;
    if (ascii.color.mode === 'background') charMode = false;
    // mode === 'duotone' leaves both true.

    let scaleX = ascii.scale;
    const scaleY = ascii.scale;
    if (ascii.box[0] !== ascii.box[1]) scaleX = Math.floor(ascii.scale * ascii.ratio);

    const modX = sourceTexture.width % scaleX;
    const modY = sourceTexture.height % scaleY;
    const gridSize = [
      (sourceTexture.width - modX) / scaleX,
      (sourceTexture.height - modY) / scaleY,
    ];
    const gridCells = [
      scaleX * gridSize[0] * p.pixelDensity(),
      scaleY * gridSize[1] * p.pixelDensity(),
    ];
    const gridOffset = [modX * p.pixelDensity(), modY * p.pixelDensity()];

    const contrast =
      dither.contrast <= 1
        ? p.map(dither.contrast, 0.5, 1, 0.25, 1)
        : p.map(dither.contrast, 1, 4, 1, 12);
    const saturation =
      gradient.type !== 'original' ? 1 : p.map(gradient.saturation, 0, 1, 1, 0);

    const shader = buildShader();
    if (!glyphTexture) buildGlyphTexture();

    buffer.shader(shader);
    shader.setUniform('u_asciiTexture', glyphTexture);
    shader.setUniform('u_imageTexture', sourceTexture);
    shader.setUniform('u_asciiCols', ascii.cols);
    shader.setUniform('u_asciiRows', ascii.rows);
    shader.setUniform('u_totalChars', getTextureText().length);
    shader.setUniform('u_gridOffset', gridOffset);
    shader.setUniform('u_gridCells', gridCells);
    shader.setUniform('u_gridSize', gridSize);
    shader.setUniform('u_charColor', hexToShader(ascii.color.char));
    shader.setUniform('u_bgColor', hexToShader(ascii.color.bg));
    shader.setUniform('u_charColorMode', charMode);
    shader.setUniform('u_bgColorMode', bgMode);
    shader.setUniform('u_contrast', contrast);
    shader.setUniform('u_brightness', dither.brightness);
    shader.setUniform('u_saturation', saturation);
    shader.setUniform('u_steps', ascii.color.limit - 1);
    drawFullBufferRect();
  }

  // buildShader(): call once after `buffer` exists. loadFont(url): call to
  // (re)load a font — resolves after the atlas is rebuilt. measureGlyphBox() /
  // buildGlyphTexture(): call after any ascii.text change (not auto-detected).
  // hexToShader is exported for reuse/testing. apply(sourceTexture): every frame.
  return { buildShader, loadFont, measureGlyphBox, buildGlyphTexture, hexToShader, apply };
}
