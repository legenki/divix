// SILUETA — silhouette shaders. PIXELATE_FRAG is new (a true block-average
// pixelate; difuso has no averaging pixelate). Halftone is reused verbatim from
// difuso by re-export, so the two workspaces can't drift. All paired with
// difuso's DITHER_VERT (full-buffer quad, no varying tex coords).

export { HALFTONE_FRAG, DITHER_VERT } from '../../difuso/js/shaders.js';

// Block-average pixelate. Samples the block center for each u_size×u_size block
// so each block is one flat color. u_flatColor (>0) replaces the sampled color
// with u_color (flat silhouette); u_flatColor == 0 keeps the source color
// (Keep original image content). Alpha is preserved so the mask gate (applied
// on the buffer via a separate masked blit) keeps background transparent.
export const PIXELATE_FRAG = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform float u_size;
  uniform float u_flatColor;   // 1.0 = use u_color, 0.0 = keep source color
  uniform vec3 u_color;        // flat silhouette color (0..1 rgb)

  void main() {
    vec2 coord = vec2(gl_FragCoord.x, 1.0 - gl_FragCoord.y);
    vec2 block = (floor(coord / u_size) + 0.5) * u_size;
    vec4 src = texture2D(u_texture, block / u_resolution);
    vec3 rgb = mix(src.rgb, u_color, u_flatColor);
    gl_FragColor = vec4(rgb, src.a);
  }
`;
