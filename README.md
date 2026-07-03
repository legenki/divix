# Divix

**Divix** is a generative graphics studio with five p5.js workspaces sharing the [Grafema](https://github.com/legenki/grafema) architecture and design system.

Live: [legenki.github.io/divix](https://legenki.github.io/divix/)

---

## Workspaces

### DIVIX
Split-mirror generative graphics on custom and built-in SVG shapes — rect, circle, ring, oval, triangle, hexagon, cross, star, petals, checker, rhombus, blob, organic, or a custom uploaded SVG. Noise- and sinusoidal-driven scale/move/rotate transforms per shape, horizontal/vertical/quad split-mirror compositing, LCH/RGB palette transitions, XOR cutout and sequence fill modes. 21 built-in presets, PNG/MP4/SVG export, custom SVG drag-and-drop import.

### DIFUSO
Coming soon.

### BANDADA
Coming soon.

### SONDEO
Coming soon.

### CLON
Coming soon.

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
