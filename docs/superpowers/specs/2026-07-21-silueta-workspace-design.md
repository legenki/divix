# Silueta — Poster / Typographic Composition Workspace

**Date:** 2026-07-21
**Status:** Design approved, pending spec review
**Author:** Andy Legenki (with Claude)

## 1. Summary

`silueta` is a new divix workspace: a **poster / typographic composition engine**.
The user uploads a photo (the demo uses seafood — lobster, oysters, fish). The tool
automatically extracts the silhouettes of the main objects, renders those silhouettes
as artistic **Pixelate** or **Halftone** forms, and then intelligently places large and
small text so it interacts with (weaves through) or tiles around those forms. The result
is a finished design layout in the style of *experimental image processing + typography
layout*.

It slots in alongside the existing workspaces (divix, difuso, bandada, sondeo, clon) and
reuses divix's shared machinery (panel builder, persistence, preset IO, export). It
borrows difuso's WEBGL shader effects (halftone) and buffer pipeline where useful.

Reference: the source demo is a portrait 720×960 screen recording ("图像主体轮廓提取器 /
Image subject contour extractor — 网点边缘优化 | 小字行距增强版"). See design decisions
below for how each panel control maps to the demo.

## 2. Goals / Non-Goals

### Goals
- Upload a photo; extract main-object silhouettes automatically (no ML, deterministic).
- Render silhouettes as Pixelate or Halftone (or leave Original), with adjustable
  granularity (dot / block size in px) and a silhouette color.
- Two layout modes: **Semantic mixed** (text weaves through/over the forms) and
  **Original overlay** (forms remain whole and claim grid tiles; text placed around them).
- Large "main text" (multiline) with adjustable font size and line height.
- Small fixed caption text with an optional **contour-avoidance** mode that keeps captions
  off the silhouettes.
- Extraction parameters: keep-original-image-content toggle, brightness threshold,
  cross-line connected-component merge.
- Export SVG, PNG, and MP4 (matching the rest of divix).

### Non-Goals
- ML-based segmentation (bodypix/u2net). Rejected: heavy weight, network deps, breaks
  divix's offline-first PWA model. Threshold + connected components is deterministic and
  bundles with zero extra assets.
- Editing individual extracted objects by hand (move/delete a single blob). Out of scope
  for v1; the layout engine places them automatically.
- Rich per-word typographic controls (kerning, tracking, per-line font). v1 uses one main
  font and one caption size.

## 3. Architecture — three decoupled layers

The design splits the tool into three layers that communicate through **one shared
contract: the low-resolution object mask**. Each layer can be understood and tested on its
own.

```
 source image ──▶ [1] extract.js ──▶  mask + components  ──▶ [3] layout.js ──▶ text placement
                                    │                     │
                                    └──▶ [2] render.js ────┘ (mask gates the shader)
                                              │
                                        WEBGL silhouette buffer
                                              │
                       app.js composites:  paper bg → silhouette buffer → text  → visible canvas
```

### Layer 1 — Extraction (CPU, `extract.js`)

The "understanding" layer. Pure functions over pixel data; no p5 draw calls.

- **Downscale** the source to a small analysis buffer (long edge ~120 px). Cheap,
  deterministic, resolution-independent. All mask math happens at this scale; the mask is
  upsampled when consumed.
- **Object mask:** a pixel is "object" when its brightness is **below** `extract.threshold`
  (0–255, default **233** — matches the demo; dark seafood over a light background). The
  *Keep original image content* toggle does **not** change the mask — it only changes how
  render.js colors the object pixels.
- **Cross-line connected-component merge** (`extract.merge`, toggle): when on, the mask is
  **dilated** (a small morphological grow) before labeling, so nearby object regions fuse
  into a single component. When off, components stay separate.
- **Connected-component labeling:** two-pass union-find (4- or 8-connectivity) over the
  mask, producing a label map plus a list of components, each with `{ bbox, centroid, area }`.
  Tiny components below an area floor are discarded as noise.
- **Output:** `{ mask: Uint8Array, w, h, components: Component[] }`. This object is the
  single source of truth for both render.js (gating) and layout.js (placement/avoidance).

### Layer 2 — Silhouette render (WEBGL, `render.js`)

Reuses difuso's buffer pattern and its halftone shader; adds a small pixelate shader.

- A WEBGL graphics buffer (`gSil`) textures the (resized) source image. One shader path
  renders it based on `render.effect`:
  - **`none` (Original):** pass the source through unchanged inside the mask.
  - **`pixelate`:** block-average the source; block size = `render.granularity` px
    (10–28, default 11). Implemented as a small dedicated fragment shader (`PIXELATE_FRAG`,
    new — difuso has no true block-average pixelate; its `pixel` matrix is a dither, not an
    averaging pixelate). Paired with difuso's existing `DITHER_VERT`.
  - **`halftone`:** reuse difuso's `HALFTONE_FRAG` via a thin adapter around
    `createHalftone`-style logic; dot cell size driven by `render.granularity`.
- **Silhouette color** (`render.color`, default `#B8B8B8`): when effect ≠ `none`, object
  pixels are recolored to this flat monochrome silhouette color. The color picker in the
  UI is **disabled when effect === 'none'** (Original) — matches the demo.
- **Keep original image content** (`render.keepOriginal`, toggle): when ON, the shader keeps
  the source texture/color *inside* the pixelate/halftone cells instead of the flat
  silhouette color (the demo's colored-tile look, video f14). When OFF, cells are the flat
  silhouette color (monochrome).
- **Masking:** the upsampled object mask gates the shader so only object pixels are drawn;
  background is left transparent → the paper-white canvas shows through.

Buffer/pixel-density discipline follows difuso exactly: `p.pixelDensity()` must match the
buffers' density, or shader UV grids tile (see the difuso pixel-density memory).

### Layer 3 — Layout engine (CPU, `layout.js`)

The "intelligent typography" layer. Deterministic given the same inputs and `layout.seed`,
so **preview === PNG === SVG**.

- Divide the canvas into an **implicit grid** of cells (grid resolution derived from canvas
  size and main font size).
- **Semantic mixed** mode (`layout.mode === 'mixed'`): large main-text lines and small
  captions are distributed across cells; text is allowed to **overlap / interleave** the
  silhouettes (drawn over and through them). Mask components influence placement so type and
  form weave together — the woven look from video f01–f12.
- **Original overlay** mode (`layout.mode === 'overlay'`): each silhouette component claims
  one or more whole grid cells as an **image tile**; text fills the remaining free cells
  more conservatively, never covering a tile (video f14–f17).
- **Main text** (`layout.main.text`, multiline): tokenized into lines; drawn at
  `layout.main.fontSize` (40–120, default 52) with `layout.main.lineHeight` (0.7–1.4,
  default 0.9). Mixed CJK/Latin is supported (the demo mixes 视觉/REMIX LAYOUT).
- **Small caption text** (`layout.small.text`, fixed default *"Experimental image processing
  and typography layout engine."*) at `layout.small.fontSize` (8–24, default 10).
- **Contour-Avoidance Small Text** (`layout.small.enabled`, toggle): when ON, each caption's
  bounding rect is tested against the object mask; on collision it is nudged to the nearest
  free cell so captions never sit on a silhouette. When OFF, captions are placed on the grid
  without the mask test.

## 4. State model (`state.js`)

```js
cnv     = { width, height, maxSize, scale, ratio: '3:4', preset,
            density: { base: 1, export: 2000 } }
render  = { effect: 'none'|'pixelate'|'halftone',   // state default 'none' (Original, per demo f01);
                                                    // starter preset applied on first load may set 'pixelate'
            granularity: 11,        // px, 10..28
            color: '#B8B8B8',       // silhouette color (disabled when effect==='none')
            keepOriginal: false }   // keep source texture inside cells
extract = { threshold: 233,         // 0..255 brightness cut
            merge: true }           // cross-line connected-component merge (dilate)
layout  = { mode: 'mixed'|'overlay',
            seed: <int>,
            font: { mode: 'list'|'custom', name },
            main:  { text, fontSize: 52, lineHeight: 0.9, color: '#111111' },
            small: { enabled: true, text: '<fixed caption>', fontSize: 10 } }
rec     = { type: 'image', frameRate: 30, quality: 75, format: 'mp4', frame: 0 }
```

Option maps: `RATIO_TYPES` / `RESOLUTIONS` (reuse difuso's set — 1:1, 3:4, 9:16, 4:5, …;
default `3:4`), `EFFECT_TYPES` ({ 'None (Original)': 'none', 'Pixelate': 'pixelate',
'Halftone': 'halftone' }), `LAYOUT_MODES` ({ 'Semantic image-text mixed': 'mixed',
'Original overlay': 'overlay' }).

## 5. Controls (`controls.js`, panelBuilder SECTIONS, `sl-` prefix)

| Section | Control | Path | Type | Notes |
|---|---|---|---|---|
| **Preview** | Canvas display scale | `cnv.scale` | slider | preview zoom only |
|  | Canvas Ratio | `cnv.ratio` | select | `regen: canvas` |
| **Silhouette** | Effect | `render.effect` | select | `regen: effect` |
|  | Granularity (px) | `render.granularity` | slider 10–28 | `regen: render` |
|  | Silhouette Color | `render.color` | color | disabled when `effect==='none'` |
| **Layout** | Main Layout Mode | `layout.mode` | select | `regen: layout` |
|  | Main Text Content | `layout.main.text` | **textarea** | multiline (new panel type) |
|  | Main font size | `layout.main.fontSize` | slider 40–120 | `regen: layout` |
|  | Main line height | `layout.main.lineHeight` | slider 0.7–1.4 step 0.05 | `regen: layout` |
| **Small Text** | Contour-Avoidance Small Text | `layout.small.enabled` | check | `regen: layout` |
|  | Small caption text | `layout.small.text` | textarea | `regen: layout` |
|  | Small font size | `layout.small.fontSize` | slider 8–24 | `regen: layout` |
| **Extraction** | Keep original image content | `render.keepOriginal` | check | `regen: render` |
|  | Brightness threshold | `extract.threshold` | slider 0–255 | `regen: extract` |
|  | Cross-line connected component merge | `extract.merge` | check | `regen: extract` |
| **Export** | Export Size (px) | `cnv.density.export` | slider 500–4000 | |
|  | Export Quality | `rec.quality` | slider 0–100 | MP4 only |

`regen` dispatch in `app.js applyChange`:
- `canvas` — recompute canvas size from `RESOLUTIONS[cnv.ratio]`, recreate buffers, re-extract, re-layout.
- `effect` / `render` — rebuild the silhouette buffer (shader path / granularity / color / keepOriginal).
- `extract` — re-run extract.js (threshold / merge), which invalidates render mask AND layout.
- `layout` — re-run layout.js only (text/grid), mask unchanged.

### New shared panelBuilder control: `textarea`
The Main Text field is multiline; panelBuilder currently has only single-line `text`. Add a
small `textarea` branch to `shared/ui/panelBuilder.js` mirroring the existing `text` branch
(header + `<textarea class="grafema-text-input">`, `input` → `setByPath` + `applyChange`), and
handle it in `syncUIFromState`. Clean, reusable, minimal.

## 6. File layout

```
src/silueta/
  template.html          tab panel (aside #sl-controls + footer) + <main #silueta-canvas>
  js/
    state.js             state objects + option maps
    controls.js          SECTIONS declaration
    extract.js           downscale → threshold → dilate → connected components → mask
    render.js            WEBGL buffer + pixelate/halftone/original shader dispatch + masking
    shaders.js           PIXELATE_FRAG (new); halftone reuses difuso HALFTONE_FRAG
    layout.js            grid, main/small text placement, contour avoidance
    svgExport.js         analytic vector rebuild (bg rect + mask cells + text)
    app.js               p5 lifecycle, wiring, presets, PNG/MP4/SVG export
public/assets/silueta/
    default.webp         bundled demo image (seafood-style), shown before first upload
    presets.json         a few starter presets (pixelate/halftone × mixed/overlay)
```

Reused shared utils: `shared/ui/panelBuilder.js`, `shared/utils/{persistence, presetIO,
deepMerge, exportMedia, svgDownload, debounce, dirtyLoop, panelGuard, lazyLibs}.js`.

## 7. Registration (3 edits, follows the divix pattern exactly)

1. `src/js/main.js` — add one row to `workspaces[]`:
   `{ name: 'silueta', load: () => import('../silueta/js/app.js').then(m => m.siluetaSketch), containerId: 'silueta-canvas', animated: true, shortcut: 'KeyL' }`
   (`KeyL` — S/L: S is taken by sondeo; "silueta" → L is free and mnemonic.)
2. `index.html` — add `<button id="tab-silueta" …>SILUETA</button>` to the switcher and a
   `<div id="app-silueta" class="app-view" …><!--#include file="src/silueta/template.html"--></div>`.
   Adjust the switcher capsule width (currently sized for 5 tabs) for a 6th tab.
3. No build config change needed — vite's `htmlPartialsAndCopyPlugin` handles the include;
   `public/assets/silueta/**` is copied and precached by the existing PWA glob
   (`**/*.{js,css,html,svg,json,webp}`).

## 8. Rendering / compositing (`app.js`)

Mirrors difuso's buffer + dirty-loop structure:
- `gSil` — WEBGL silhouette buffer (render.js target).
- Visible canvas (WEBGL or P2D): draw paper background → blit `gSil` (masked silhouette) →
  draw layout text on top (mixed) or interleaved with tiles (overlay).
- Static image → dirty-loop: redraw only when a control changes (`dirty.markDirty()`),
  matching difuso. MP4 export flips to a live loop.
- Canvas centered in the free area left of the 290 px panel (same offset discipline as
  difuso/divix — see the divix canvas-centering fixes in recent commits).

## 9. Export

- **PNG** — `withHighResExport` pattern (difuso): bump density, re-extract at export scale,
  re-render, re-layout, `saveCanvas(buffer, …)` via `exportPNG(p, 'silueta', buffer)`.
- **MP4** — reuse `exportMP4`. To give the recording motion, animate a subtle seeded drift
  (small oscillation of granularity and/or layout jitter) over the clip; `beforeDraw`
  advances the frame counter. Length select in the footer (2–15 s), quality from `rec.quality`.
- **SVG** — `svgExport.js` rebuilds the composition analytically:
  - background `<rect>` (paper),
  - silhouette cells from the mask grid: `<rect>` per filled cell for pixelate, `<circle>`
    per cell for halftone (radius ∝ cell darkness), colored by `render.color` (or source
    color sampled per cell when `keepOriginal`),
  - main + small text as real `<text>` elements (editable vector).
  Downloaded via the shared `saveSVG`. Fully editable in vector editors — no raster embed.

## 10. Testing

Unit tests (vitest, matching difuso's `*.test.js` precedent) for the pure layers:
- `extract.test.js` — threshold masking on a known small bitmap; component count with/without
  merge (dilate fuses two adjacent blobs into one); noise-floor discard.
- `layout.test.js` — deterministic placement for a fixed seed; contour-avoidance moves a
  caption out of a masked cell; overlay mode never overlaps a tile with text.
- `svgExport` — smoke test that output contains the expected `<text>` count and one cell
  element per filled mask cell.

Manual verification via the browser preview (dev server): upload the seafood demo image,
step through Effect (None → Pixelate → Halftone), granularity, both layout modes, the
avoidance toggle, threshold, and merge — confirming each matches the corresponding video
frame. Then export PNG/SVG/MP4 and confirm the SVG opens as editable vector.

## 11. Open risks / notes

- **Grid layout aesthetics** are the hardest part to match to the demo; the spec fixes the
  *mechanism* (implicit grid, mask-gated placement, avoidance) but the exact packing
  heuristics will be tuned during implementation against the reference frames. Determinism
  (seed) keeps it reproducible.
- **Ratio ≠ source aspect:** the poster canvas uses `RESOLUTIONS[cnv.ratio]`, independent of
  the uploaded photo's aspect; the photo is fit into the mask analysis and rendered where its
  silhouette components fall on the grid. (Chosen over source-driven sizing so the poster
  format is stable regardless of input photo.)
- **CJK fonts:** the demo mixes Chinese and Latin. v1 ships a font that covers both (or falls
  back gracefully); custom-font upload is available via the font mode toggle.
```