# Divix

**Divix** is a generative graphics studio with five p5.js workspaces sharing the [Grafema](https://github.com/legenki/grafema) architecture and design system.

Live: [legenki.github.io/divix](https://legenki.github.io/divix/)

---

## Workspaces

### DIVIX
Split-mirror generative graphics on custom and built-in SVG shapes — rect, circle, ring, oval, triangle, hexagon, cross, star, petals, checker, rhombus, blob, organic, or a custom uploaded SVG. Noise- and sinusoidal-driven scale/move/rotate transforms per shape, horizontal/vertical/quad split-mirror compositing, LCH/RGB palette transitions, XOR cutout and sequence fill modes. 21 built-in presets, PNG/MP4/SVG export, custom SVG drag-and-drop import.

### DIFUSO
Image and video dithering studio built on a WEBGL shader pipeline — ASCII glyph rendering, RGB and CMYK halftone, ordered (Bayer) and blue-noise dithering at multiple texture sizes, plus posterization/brightness/contrast levels and a gradient color-map stage. Upload or drag-and-drop your own source, PNG/MP4 export.

### BANDADA
Boids-style flocking simulation with vector or image-textured rendering. Tunable alignment/cohesion/separation/vision forces, wrap-around or repel-from-edge boundaries, per-boid fill/stroke color and skew reactions to speed, custom canvas ratios and background. PNG/MP4 export.

### SONDEO
Line-scan image reveal tool — sweep a source image horizontally or vertically into a result canvas, side-by-side or layered, with a freehand mask to constrain the scanned region. Shade and grain effects can react to mouse drag or to the shift/scale/rotate animations; base and animated transforms on the still-unscanned source. PNG export.

### CLON
Clone-stamp image editor with a snapping grid — sample a region (free, 1:1, or from a rendered buffer) and stamp it as rectangles, ellipses, triangles, or arcs anywhere on the canvas, source or your own working buffer as sample data. Undo/clear history, PNG/MP4 export.

---

## Architecture

Same as Grafema:

- **ES modules + p5.js instance mode** — each workspace is an isolated sketch (`{name}Sketch`) mounted via `new p5(sketch, container)`
- **Single-page, lazy-loaded** — workspaces are registered in `src/js/main.js`, code-split and fetched on first tab activation; heavy vendor libs load per workspace via `shared/utils/lazyLibs.js`
- **Shared design system** — `src/css/style.css` and the declarative `shared/ui/panelBuilder.js` control panels (SECTIONS data instead of Tweakpane)
- **localStorage autosave** per workspace, PNG/MP4/SVG export
- **Vite + PWA** — offline-capable, deployed to GitHub Pages via Actions

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # production build to dist/
npm run lint     # eslint, zero warnings enforced
```
