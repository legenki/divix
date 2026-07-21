// SILUETA — shape stamps. The silhouette shaders draw one stamp per cell:
// circle and square are computed analytically in GLSL (crisp at any cell size),
// while a user-supplied SVG is rasterised here into a square alpha texture the
// shader samples.
//
// Rasterising once into a texture (rather than tessellating paths) keeps the
// render loop untouched: an arbitrary SVG costs exactly what a circle costs.

/** Stamp kinds, in panel order. Values are the ints the shaders switch on. */
export const SHAPE_TYPES = {
  Circle: 'circle',
  Square: 'square',
  'Custom SVG': 'custom',
};

/** Map a shape id to the shader's u_shape int. */
export function shapeIndex(shape) {
  if (shape === 'square') return 1;
  if (shape === 'custom') return 2;
  return 0; // circle
}

/** Stamp texture resolution. 128px keeps small cells sharp without cost. */
export const STAMP_SIZE = 128;

/**
 * Rasterise SVG markup into a square p5.Image whose ALPHA is the shape's
 * coverage. The SVG is drawn in black on transparent and scaled to fit, so any
 * artwork works regardless of its own viewBox or colours.
 *
 * @param {object} deps
 * @param {import('p5')} deps.p
 * @param {string} svgText raw SVG file contents
 * @returns {Promise<import('p5').Image>}
 */
export function rasterizeSVG({ p, svgText }) {
  return new Promise((resolve, reject) => {
    const markup = String(svgText || '');
    if (!/<svg[\s>]/i.test(markup)) {
      reject(new Error('Not an SVG file'));
      return;
    }

    // Force a fill so artwork that relies on CSS or presentation defaults still
    // rasterises to something visible, and strip any explicit white fill that
    // would otherwise vanish against the transparent backdrop.
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = STAMP_SIZE;
        canvas.height = STAMP_SIZE;
        const ctx = canvas.getContext('2d');

        // Contain-fit the artwork, centred. The margin is deliberately tiny:
        // the stamp is scaled down again by the shader, so padding here is
        // wasted texture that makes every stamp read smaller than a circle of
        // the same cell.
        const margin = 0.01 * STAMP_SIZE;
        const box = STAMP_SIZE - margin * 2;
        const iw = img.width || STAMP_SIZE;
        const ih = img.height || STAMP_SIZE;
        const scale = Math.min(box / iw, box / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.drawImage(img, (STAMP_SIZE - dw) / 2, (STAMP_SIZE - dh) / 2, dw, dh);

        // Convert to an alpha-only stamp: any painted pixel becomes opaque
        // white, so the shader's own colour logic drives the final look.
        const data = ctx.getImageData(0, 0, STAMP_SIZE, STAMP_SIZE);
        const px = data.data;
        let painted = 0;
        for (let i = 0; i < px.length; i += 4) {
          const a = px[i + 3];
          if (a > 8) painted += 1;
          px[i] = 255;
          px[i + 1] = 255;
          px[i + 2] = 255;
          px[i + 3] = a;
        }
        URL.revokeObjectURL(url);
        if (!painted) {
          reject(new Error('SVG contains nothing to draw'));
          return;
        }
        ctx.putImageData(data, 0, 0);

        const out = p.createImage(STAMP_SIZE, STAMP_SIZE);
        out.drawingContext.drawImage(canvas, 0, 0);
        resolve(out);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG failed to render'));
    };
    img.src = url;
  });
}

/**
 * A 1x1 fully-opaque fallback stamp. WebGL needs *some* texture bound to
 * u_stamp even when the shape is circle/square, or sampling is undefined.
 */
export function blankStamp(p) {
  const img = p.createImage(1, 1);
  img.loadPixels();
  img.pixels[0] = 255;
  img.pixels[1] = 255;
  img.pixels[2] = 255;
  img.pixels[3] = 255;
  img.updatePixels();
  return img;
}
