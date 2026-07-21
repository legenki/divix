// SILUETA — silhouette shaders. Both frags are silueta's own: PIXELATE_FRAG is
// a true block-average pixelate, and HALFTONE_FRAG inks dots by DARKNESS.
// Difuso's halftone sizes dots by brightness (bright = big dot), which is right
// for a photo filter but backwards for a silhouette: our objects are the dark
// pixels, so a dark subject produced radius≈0 and rendered an empty field.
// Difuso's shader is left untouched (it is shared); only DITHER_VERT (the
// full-buffer quad vertex shader, no varying tex coords) is reused from it.

export { DITHER_VERT } from '../../difuso/js/shaders.js';

// Halftone stamp shader. One stamp per cell, scaled by the source's DARKNESS,
// so the object inks up and the light background stays empty. u_flatColor (>0)
// paints stamps in u_color (flat silhouette); 0 keeps the source colour sampled
// at the cell centre (Keep original image content). Pixels outside a stamp are
// output fully transparent, so the paper shows through without a blend pass.
//
// u_shape selects the stamp:
//   0 = circle  — analytic disc, crisp at any size
//   1 = square  — analytic box, crisp at any size
//   2 = custom  — alpha sampled from u_stamp, a rasterised user SVG
// Circle and square are computed rather than sampled so they stay sharp when a
// cell is only a few pixels across, where a texture would blur or alias.
export const HALFTONE_FRAG = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform sampler2D u_stamp;   // rasterised custom shape (alpha = coverage)
  uniform vec2 u_resolution;
  uniform float u_size;        // stamp cell size in pixels
  uniform float u_flatColor;   // 1.0 = use u_color, 0.0 = keep source color
  uniform vec3 u_color;        // flat silhouette color (0..1 rgb)
  uniform int u_shape;         // 0 circle, 1 square, 2 custom stamp

  void main() {
    vec2 coord = vec2(gl_FragCoord.x, 1.0 - gl_FragCoord.y);
    vec2 cell = (floor(coord / u_size) + 0.5) * u_size;
    vec4 src = texture2D(u_texture, cell / u_resolution);

    // Darkness drives coverage: dark subject -> large stamp, light -> none.
    // The curve is lifted because the mask has already decided what is object:
    // inside it even a pale pixel should print a visible stamp, so raw
    // darkness (near 0 for a light subject on white) is remapped to a usable
    // range instead of leaving the poster almost empty.
    float lum = dot(src.rgb, vec3(0.299, 0.587, 0.114));
    float ink = clamp((1.0 - lum) * 1.9 + 0.22, 0.0, 1.0);
    float halfExtent = ink * u_size * 0.5;   // stamp half-extent

    vec2 offset = coord - cell;        // position within the cell
    float cov = 0.0;

    if (u_shape == 0) {
      // Circle: distance to the cell centre, antialiased over ~1px.
      cov = 1.0 - smoothstep(halfExtent - 1.0, halfExtent + 1.0, length(offset));
    } else if (u_shape == 1) {
      // Square: Chebyshev distance gives a box with the same antialias band.
      float box = max(abs(offset.x), abs(offset.y));
      cov = 1.0 - smoothstep(halfExtent - 1.0, halfExtent + 1.0, box);
    } else {
      // Custom: the stamp spans a box of side 2*halfExtent centred in the
      // cell, matching how halfExtent is the radius for circle/square — so at
      // full ink the artwork fills the cell rather than sitting tiny inside it.
      if (halfExtent <= 0.001) discard;
      vec2 uv = offset / (2.0 * halfExtent) + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
      cov = texture2D(u_stamp, uv).a;
    }

    if (cov <= 0.001) discard;

    vec3 rgb = mix(src.rgb, u_color, u_flatColor);
    gl_FragColor = vec4(rgb, cov * src.a);
  }
`;

// Block pixelate. Samples the block centre for each u_size×u_size block so the
// block is one flat colour. u_flatColor (>0) replaces the sampled colour with
// u_color (flat silhouette); 0 keeps the source colour (Keep original image
// content).
//
// u_shape masks the block: 1 = square fills the whole cell (classic pixelate),
// 0 = circle and 2 = custom stamp cut the cell to that outline, giving a grid
// of discs or user shapes at constant size (unlike halftone, where the stamp
// scales with darkness).
export const PIXELATE_FRAG = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform sampler2D u_stamp;
  uniform vec2 u_resolution;
  uniform float u_size;
  uniform float u_flatColor;   // 1.0 = use u_color, 0.0 = keep source color
  uniform vec3 u_color;        // flat silhouette color (0..1 rgb)
  uniform int u_shape;         // 0 circle, 1 square, 2 custom stamp

  void main() {
    vec2 coord = vec2(gl_FragCoord.x, 1.0 - gl_FragCoord.y);
    vec2 block = (floor(coord / u_size) + 0.5) * u_size;
    vec4 src = texture2D(u_texture, block / u_resolution);

    float cov = 1.0;
    vec2 offset = coord - block;
    float halfExtent = u_size * 0.5;

    if (u_shape == 0) {
      cov = 1.0 - smoothstep(halfExtent - 1.0, halfExtent + 1.0, length(offset));
    } else if (u_shape == 2) {
      vec2 uv = offset / u_size + 0.5;
      cov = texture2D(u_stamp, uv).a;
    }
    if (cov <= 0.001) discard;

    vec3 rgb = mix(src.rgb, u_color, u_flatColor);
    gl_FragColor = vec4(rgb, cov * src.a);
  }
`;
