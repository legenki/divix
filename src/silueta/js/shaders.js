// SILUETA — silhouette shaders. Both frags are silueta's own: PIXELATE_FRAG is
// a true block-average pixelate, and HALFTONE_FRAG inks dots by DARKNESS.
// Difuso's halftone sizes dots by brightness (bright = big dot), which is right
// for a photo filter but backwards for a silhouette: our objects are the dark
// pixels, so a dark subject produced radius≈0 and rendered an empty field.
// Difuso's shader is left untouched (it is shared); only DITHER_VERT (the
// full-buffer quad vertex shader, no varying tex coords) is reused from it.

export { DITHER_VERT } from '../../difuso/js/shaders.js';

// Silhouette halftone: dot radius grows with the source's DARKNESS, so the
// object inks up and the light background stays empty. u_flatColor (>0) paints
// dots in u_color (flat silhouette); 0 keeps the source color sampled at the
// cell centre (Keep original image content). Pixels outside a dot are output
// fully transparent so the paper shows through without needing a blend pass.
export const HALFTONE_FRAG = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform float u_size;        // dot cell size in pixels
  uniform float u_flatColor;   // 1.0 = use u_color, 0.0 = keep source color
  uniform vec3 u_color;        // flat silhouette color (0..1 rgb)

  void main() {
    vec2 coord = vec2(gl_FragCoord.x, 1.0 - gl_FragCoord.y);
    vec2 cell = (floor(coord / u_size) + 0.5) * u_size;
    vec4 src = texture2D(u_texture, cell / u_resolution);

    // Darkness drives coverage: dark subject -> large dot, light -> none.
    float lum = dot(src.rgb, vec3(0.299, 0.587, 0.114));
    float ink = clamp(1.0 - lum, 0.0, 1.0);
    float radius = ink * u_size * 0.5;

    float d = length(coord - cell);
    // Antialias the dot edge over ~1px.
    float cov = 1.0 - smoothstep(radius - 1.0, radius + 1.0, d);
    if (cov <= 0.001) discard;

    vec3 rgb = mix(src.rgb, u_color, u_flatColor);
    gl_FragColor = vec4(rgb, cov * src.a);
  }
`;

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
