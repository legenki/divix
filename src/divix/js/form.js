// DIVIX — form geometry and per-frame render logic (instance mode).
//
// Ported from the original tool's global-mode form script. Only the pure
// geometry/render pipeline lives here; all Tweakpane/palette-picker/DOM wiring
// from the original was intentionally left out (it belongs to controls.js /
// app.js). Every p5 global from the original (`map`, `sin`, `floor`, ...) is
// namespaced through the injected p5 instance `p`; trig used purely for math
// (not canvas drawing) uses `Math.*` for clarity.

/**
 * Builds the form renderer bound to a p5 instance and shared graphics buffers.
 *
 * @param {object} deps
 * @param {import('p5')} deps.p            The p5 instance (instance mode).
 * @param {object}       deps.state        The whole state.js module (palette, cnv, form, rec, SHAPE_SIZE, SHAPE_PATHS, ...).
 * @param {object}       deps.buffers      Graphics buffers created by app.js: `{ gForm, gDraw }` (p5.Graphics).
 * @param {object}       deps.noise        Seeded simplex generators: `{ xmove, ymove, rotate, scale }`.
 *   IMPORTANT CONTRACT: each entry must expose `.noise3D(x, y, z)`. These are
 *   constructed by app.js (e.g. `new SimplexNoise(alea(seed))`) — NOT here, and
 *   NOT the numeric placeholders on state.js's `simplex` export. This module
 *   only reads `.noise3D()` off them.
 * @returns {{ switchForm: () => void, drawForms: () => void, generateParameters: () => void, getFormData: () => object, invalidateColorCache: () => void }}
 */
export function createForm({ p, state, buffers, noise }) {
  const { palette, cnv, form, rec, SHAPE_SIZE, SHAPE_PATHS } = state;
  const { gForm } = buffers;

  const TWO_PI = Math.PI * 2;

  // Reused every frame — avoid allocating new arrays/objects for GC pressure.
  const formData = {
    frame: 0,
    width: 0,
    height: 0,
    scale: 1,
    rotation: 0,
    position: { x: 0, y: 0 },
    shape: { width: 0, height: 0 },
    clip: [],
    color: [],
    transform: {
      transition: { x: [], y: [] },
      move: { x: [], y: [] },
      scale: [],
      rotate: [],
    },
    maxRotateAngle: 90,
  };

  // Cached interpolated ramps for transitionLCH / transitionRGB (invalidated
  // when palette or mode changes).
  let colorRamp = null;
  let colorRampKey = '';

  // --- Shape lookup -------------------------------------------------------

  function getShapeWidth() {
    if (form.type in SHAPE_SIZE) return SHAPE_SIZE[form.type].width;
    return 0;
  }

  function getShapeHeight() {
    if (form.type in SHAPE_SIZE) return SHAPE_SIZE[form.type].height;
    return 0;
  }

  function getShapeForm() {
    if (form.type in SHAPE_PATHS) return SHAPE_PATHS[form.type];
    return '';
  }

  // Path2D is a browser Canvas API global (not p5-specific); safe to use directly.
  function switchForm() {
    form.shape.path = new Path2D(getShapeForm());
    form.shape.width = getShapeWidth();
    form.shape.height = getShapeHeight();
  }

  // --- Per-frame draw -----------------------------------------------------

  function drawForms() {
    gForm.clear();
    gForm.reset();
    gForm.push();

    gForm.strokeWeight(form.stroke.width);

    generateParameters(); // Generate all parameters for forms

    gForm.translate(formData.width, formData.height);
    gForm.translate(formData.position.x, formData.position.y);
    gForm.scale(formData.scale);
    gForm.rotate(formData.rotation);

    if (form.color.mode === 'xor' && form.color.type === 'fill') {
      gForm.drawingContext.globalCompositeOperation = 'xor';
    }
    generateForm();

    gForm.pop();
  }

  function generateForm() {
    for (let i = 0; i < form.count.base; i++) {
      gForm.push();
      gForm.translate(formData.transform.transition.x[i], formData.transform.transition.y[i]);
      gForm.translate(formData.transform.move.x[i], formData.transform.move.y[i]);
      gForm.scale(formData.transform.scale[i]);
      gForm.rotate(formData.transform.rotate[i]);

      gForm.translate(formData.shape.width, formData.shape.height);

      if (form.color.type === 'fill') {
        gForm.fill(formData.color[i]);
        gForm.drawingContext.fill(form.shape.path, 'evenodd');
      } else {
        gForm.stroke(formData.color[i]);
        gForm.drawingContext.stroke(form.shape.path, 'evenodd');
      }
      gForm.pop();
    }
  }

  function ensureCapacity(n) {
    const arrays = [
      formData.color,
      formData.transform.transition.x,
      formData.transform.transition.y,
      formData.transform.move.x,
      formData.transform.move.y,
      formData.transform.scale,
      formData.transform.rotate,
    ];
    for (const arr of arrays) {
      if (arr.length < n) arr.length = n;
    }
  }

  function invalidateColorCache() {
    colorRamp = null;
    colorRampKey = '';
  }

  function ensureColorRamp(count) {
    const mode = form.color.mode;
    if (mode !== 'transitionLCH' && mode !== 'transitionRGB') {
      colorRamp = null;
      return;
    }
    const colors = palette.temp && palette.temp.length ? palette.temp : palette.array;
    const key = `${mode}|${count}|${colors.join(',')}`;
    if (colorRamp && colorRampKey === key) return;
    colorRampKey = key;
    colorRamp = new Array(count);
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0 : i / (count - 1);
      colorRamp[i] =
        mode === 'transitionLCH'
          ? getInterpolatedLCHColor(t, colors)
          : getInterpolatedRGBColor(t, colors);
    }
  }

  function generateParameters() {
    const n = form.count.base;
    ensureCapacity(n);
    ensureColorRamp(n);
    formData.clip.length = 0;

    // Guard: a zero-length clip (frames * frameRate) would make `frame` NaN.
    const totalFrames = rec.length.value * rec.frameRate;
    formData.frame = totalFrames > 0 ? cnv.frame / totalFrames : 0;
    formData.width = gForm.width * 0.5;
    formData.height = gForm.height * 0.5;
    formData.scale = cnv.scale.value;
    formData.rotation = cnv.rotation.value;
    formData.position.x = formData.width * cnv.position.x;
    formData.position.y = formData.height * cnv.position.y;
    formData.shape.width = -form.shape.width;
    formData.shape.height = -form.shape.height;
    formData.maxRotateAngle = 90;
    const seqCount = form.sequence >= 0 ? [1, 1 - form.sequence] : [form.sequence + 1, 1];

    for (let i = 0; i < n; i++) {
      formData.color[i] = getColorValue(i);

      formData.transform.transition.x[i] = getTransition(i, formData.width * form.transition.x);
      formData.transform.transition.y[i] = getTransition(i, formData.height * form.transition.y);

      const xMove = getMoveValue(
        i,
        noise.xmove,
        form.xmove.type,
        form.xmove.freq,
        form.xmove.cycle,
        form.xmove.phase,
        form.xmove.speed,
        29.7 * form.xmove.seed
      );
      const yMove = getMoveValue(
        i,
        noise.ymove,
        form.ymove.type,
        form.ymove.freq,
        form.ymove.cycle,
        form.ymove.phase,
        form.ymove.speed,
        47.3 * form.ymove.seed
      );
      formData.transform.move.x[i] = getMoveOrder(
        i,
        form.xmove.order,
        xMove * formData.width * form.xmove.amp
      );
      formData.transform.move.y[i] = getMoveOrder(
        i,
        form.ymove.order,
        yMove * formData.width * form.ymove.amp
      );

      const sequence = p.map(i, 0, n - 1, seqCount[0], seqCount[1]);
      formData.transform.scale[i] = p.constrain(
        sequence + getScaleOrder(i, getScaleValue(i)),
        0,
        2
      );

      formData.transform.rotate[i] = getRotateOrder(i, getRotateValue(i));
    }
  }

  // --- Transform math helpers --------------------------------------------

  function getTransition(i, data) {
    return p.map(i, 0, form.count.base - 1, -data, data);
  }

  function getRotateValue(i) {
    switch (form.rotate.type) {
      case 'off':
        return 0;

      case 'noise': {
        const noiseFreq = p.map(i, 0, form.count.base - 1, 0, 1) * form.rotate.freq;
        const noiseSpeed =
          rec.length.value * rec.frameRate * p.map(form.rotate.speed, 0, 1, 0, 0.005);
        return noise.rotate.noise3D(
          -19.8 * form.rotate.seed + noiseFreq,
          noiseSpeed * Math.sin(TWO_PI * formData.frame),
          noiseSpeed * Math.cos(TWO_PI * formData.frame)
        );
      }

      case 'sin': {
        const sinFreq = p.map(i, 0, form.count.base - 1, 0, TWO_PI) * form.rotate.freq;
        return Math.sin(
          TWO_PI * formData.frame * form.rotate.cycle + sinFreq + TWO_PI * form.rotate.phase
        );
      }

      default:
        return 0;
    }
  }

  function getScaleValue(i) {
    switch (form.scale.type) {
      case 'off':
        return 0;

      case 'noise': {
        const noiseFreq = p.map(i, 0, form.count.base - 1, 0, 1) * form.scale.freq;
        const noiseSpeed =
          rec.length.value * rec.frameRate * p.map(form.scale.speed, 0, 1, 0, 0.005);
        const noiseValue = noise.scale.noise3D(
          -19.8 * form.scale.seed + noiseFreq,
          noiseSpeed * Math.sin(TWO_PI * formData.frame),
          noiseSpeed * Math.cos(TWO_PI * formData.frame)
        );
        return (noiseValue + 1) / 2;
      }

      case 'sin': {
        const sinFreq = p.map(i, 0, form.count.base - 1, 0, TWO_PI) * form.scale.freq;
        const sinValue = Math.sin(
          TWO_PI * formData.frame * form.scale.cycle + sinFreq + TWO_PI * form.scale.phase
        );
        return (sinValue + 1) / 4;
      }

      default:
        return 0;
    }
  }

  function getMoveValue(i, generator, type, freq, cycle, phase, speed, seed) {
    switch (type) {
      case 'off':
        return 0;

      case 'noise': {
        const noiseFreq = p.map(i, 0, form.count.base - 1, 0, 1) * freq;
        const noiseSpeed = rec.length.value * rec.frameRate * p.map(speed, 0, 1, 0, 0.005);
        return generator.noise3D(
          seed + noiseFreq,
          noiseSpeed * Math.sin(TWO_PI * formData.frame),
          noiseSpeed * Math.cos(TWO_PI * formData.frame)
        );
      }

      case 'sin': {
        const sinFreq = p.map(i, 0, form.count.base - 1, 0, TWO_PI) * freq;
        return Math.sin(TWO_PI * formData.frame * cycle + sinFreq + TWO_PI * phase);
      }

      default:
        return 0;
    }
  }

  function getRotateOrder(i, value) {
    switch (form.rotate.order) {
      case 'forward':
        return p.map(i, 0, form.count.base - 1, 0, formData.maxRotateAngle * value * form.rotate.amp);

      case 'backward':
        return p.map(i, 0, form.count.base - 1, -formData.maxRotateAngle * value * form.rotate.amp, 0);

      case 'equal':
        return p.map(
          i,
          0,
          form.count.base - 1,
          -formData.maxRotateAngle * value * form.rotate.amp,
          formData.maxRotateAngle * value * form.rotate.amp
        );

      default:
        return 0;
    }
  }

  function getScaleOrder(i, value) {
    switch (form.scale.order) {
      case 'forward':
        return p.map(i, 0, form.count.base - 1, 0, value * form.scale.amp);

      case 'backward':
        return p.map(i, 0, form.count.base - 1, value * form.scale.amp, 0);

      case 'equal':
        return p.map(i, 0, form.count.base - 1, value * form.scale.amp, value * form.scale.amp);

      default:
        return 0;
    }
  }

  function getMoveOrder(i, order, value) {
    switch (order) {
      case 'forward':
        return p.map(i, 0, form.count.base - 1, 0, value);

      case 'backward':
        return p.map(i, 0, form.count.base - 1, value, 0);

      case 'equal':
        return p.map(i, 0, form.count.base - 1, -value, value);

      default:
        return 0;
    }
  }

  // --- Color math ---------------------------------------------------------

  function getColorValue(i) {
    switch (form.color.mode) {
      case 'xor':
        return palette.array[palette.index] || '#000000';

      case 'sequence': {
        // Defensive: palette.temp is empty when every active-color slot is
        // toggled off; `i % 0` is NaN and would index undefined. Fall back.
        if (palette.temp.length === 0) return palette.array[0] || '#000000';
        const index = i % palette.temp.length;
        return palette.temp[index];
      }

      case 'transitionLCH':
      case 'transitionRGB':
        // Precomputed in ensureColorRamp().
        return (colorRamp && colorRamp[i]) || '#000000';

      default:
        return '#000000';
    }
  }

  // Renamed the original's local `palette` param to `colors` and its `p` array
  // to `pairs` to avoid colliding with the p5 instance `p` in scope here.
  function getInterpolatedRGBColor(noiseValue, colors) {
    // Defensive: empty active-color selection → no stops to interpolate.
    if (!colors || colors.length === 0) return '#000000';
    if (colors.length === 1) return colors[0] || '#000000';

    const pairs = [];
    for (let i = 0; i < colors.length; i++) {
      pairs.push([colors[i], i / (colors.length - 1)]);
    }
    return paletteLerp(pairs, noiseValue);
  }

  function getInterpolatedLCHColor(noiseValue, colors) {
    // Defensive: empty active-color selection → nothing to interpolate.
    if (!colors || colors.length === 0) return '#000000';
    if (colors.length === 1) return colors[0] || '#000000';

    const scaledIndex = noiseValue * (colors.length - 1);
    const lowerIndex = p.floor(scaledIndex);
    const upperIndex = (lowerIndex + 1) % colors.length;
    const index = p.fract(scaledIndex);

    const colorA = new Color(colors[lowerIndex]);
    const colorB = new Color(colors[upperIndex]);

    const mixedColor = colorA.range(colorB, { space: 'lch' });
    return mixedColor(index).toString({ format: 'hex' });
  }

  return {
    switchForm,
    drawForms,
    generateParameters,
    invalidateColorCache,
    // Returns the params from the last generateParameters() call (run inside
    // drawForms()). Callers that read into it (e.g. svgExport.js) must only
    // run after at least one draw has happened.
    getFormData: () => formData,
  };
}

/**
 * Linearly interpolates a color from an ordered list of `[hexColor, stop]`
 * pairs (stop in [0..1]). Pure and side-effect free.
 *
 * The original tool referenced a `paletteLerp` global that was provided by an
 * external embed script (not present in the ported sources), so this is a
 * clean reimplementation of its documented behavior: find the bracketing
 * stops for `t` and lerp each RGB channel between them.
 *
 * @param {Array<[string, number]>} pairs  Ordered `[hex, stop]` color stops.
 * @param {number} t                       Position in [0..1].
 * @returns {string} `#rrggbb`
 */
export function paletteLerp(pairs, t) {
  if (!pairs || pairs.length === 0) return '#000000';
  if (pairs.length === 1) return normalizeHex(pairs[0][0]);

  // Clamp t so an input of exactly 1 (or noise slightly outside [0..1]) can't
  // walk past the last stop.
  const clamped = Math.min(1, Math.max(0, t));

  let lower = pairs[0];
  let upper = pairs[pairs.length - 1];
  for (let i = 0; i < pairs.length - 1; i++) {
    if (clamped >= pairs[i][1] && clamped <= pairs[i + 1][1]) {
      lower = pairs[i];
      upper = pairs[i + 1];
      break;
    }
  }

  const span = upper[1] - lower[1];
  // Guard against a zero-width span (duplicate stops) → division by zero.
  const localT = span > 0 ? (clamped - lower[1]) / span : 0;

  const a = hexToRgb(lower[0]);
  const b = hexToRgb(upper[0]);
  const r = Math.round(a.r + (b.r - a.r) * localT);
  const g = Math.round(a.g + (b.g - a.g) * localT);
  const bl = Math.round(a.b + (b.b - a.b) * localT);
  return rgbToHex(r, g, bl);
}

function normalizeHex(hex) {
  const rgb = hexToRgb(hex);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function hexToRgb(hex) {
  // Accepts `#rgb` and `#rrggbb`; falls back to black on anything invalid so
  // generative palette math never produces a NaN color.
  if (typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.min(255, Math.max(0, n | 0));
  const toHex = (n) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
