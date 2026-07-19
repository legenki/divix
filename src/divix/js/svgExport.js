// DIVIX — SVG export (instance mode).
//
// Ported from the original tool's global-mode svg script. Rebuilds the current
// composition in paper.js off-DOM and downloads it as an SVG file.
//
// Stripped from the original:
//   - the license gate in `startSvgExport` (Divix has no licensing — export is
//     unconditional);
//   - the hand-rolled Blob/anchor download in `saveSVG` (replaced with the
//     shared `saveSVG` util);
//   - the `baseFilename()`/p5 date helpers (replaced with the shared
//     `timestamp()` util).
// The `setTimeout(generateSVG, 100)` delay from the original is preserved: it
// lets any pending UI update (e.g. a "exporting..." status) flush to the DOM
// before the potentially-slow paper.js rebuild blocks the main thread.

import { saveSVG } from '../../shared/utils/svgDownload.js';
import { timestamp } from '../../shared/utils/datetime.js';
import { ensurePaper } from '../../shared/utils/lazyLibs.js';

/**
 * Builds the SVG exporter bound to a p5 instance, shared state and buffers.
 *
 * @param {object} deps
 * @param {import('p5')} deps.p            The p5 instance (instance mode); used for `p.hex`.
 * @param {object}       deps.state        The whole state.js module (form, cnv, palette, rec, SHAPE_PATHS).
 * @param {object}       deps.buffers      Graphics buffers: `{ gForm }` (used for canvas dimensions).
 * @param {() => object} deps.getFormData  Returns form.js's current `formData` render state, so this
 *   module reuses the already-computed parameters instead of recomputing them. Only valid after
 *   form.js's drawForms() has run at least once (formData is `{}` before the first draw) and after
 *   its split/clip loop has populated `formData.clip` — export renders nothing until then.
 * @param {string}       [deps.filenamePrefix]  Prefix for the downloaded file (default 'divix').
 * @returns {{ startSvgExport: () => void }}
 */
export function createSvgExport({ p, state, buffers, getFormData, filenamePrefix = 'divix' }) {
  const { form, cnv, palette, rec, SHAPE_PATHS } = state;
  const { gForm } = buffers;

  function getShapeForm() {
    return form.type in SHAPE_PATHS ? SHAPE_PATHS[form.type] : '';
  }

  async function generateSVG() {
    await ensurePaper();
    const formData = getFormData();

    const paperCanvas = document.createElement('canvas');
    paperCanvas.width = gForm.width;
    paperCanvas.height = gForm.height;
    paperCanvas.style.display = 'none';
    document.body.appendChild(paperCanvas);

    paper.setup(paperCanvas);
    paper.pixelRatio = 1;

    paper.view.translate(gForm.width / 2, gForm.height / 2);

    if (cnv.color.mode !== 'transparent') {
      const background = new paper.Shape.Rectangle(
        new paper.Rectangle(-gForm.width / 2, -gForm.height / 2, gForm.width, gForm.height)
      );
      background.fillColor =
        cnv.color.mode === 'custom' ? cnv.color.custom : palette.array[cnv.color.slot];
      // Wrapped in a layer to match the original's stacking behavior.
      new paper.Layer({ position: paper.view.center, children: [background] });
    }

    const shapeColors = formData.color.map(convertColor);

    for (let i = 0; i < formData.clip.length; i++) {
      const group = new paper.Group({
        position: new paper.Point(formData.position.x, formData.position.y),
        scaling: formData.scale,
        rotation: formData.rotation,
        applyMatrix: false,
      });

      const shapeArray = [];
      for (let j = 0; j < form.count.base; j++) {
        shapeArray[j] = new paper.CompoundPath(getShapeForm());
        shapeArray[j].translate(
          new paper.Point(formData.transform.transition.x[j], formData.transform.transition.y[j])
        );
        shapeArray[j].translate(
          new paper.Point(formData.transform.move.x[j], formData.transform.move.y[j])
        );
        shapeArray[j].scale(formData.transform.scale[j]);
        shapeArray[j].rotate(formData.transform.rotate[j]);
        shapeArray[j].translate(new paper.Point(formData.shape.width, formData.shape.height));
        if (form.color.type === 'fill') {
          shapeArray[j].fillColor = shapeColors[j];
        } else {
          shapeArray[j].strokeWidth = form.stroke.width * formData.transform.scale[j];
          shapeArray[j].strokeColor = shapeColors[j];
        }
      }

      const isXorFill = form.color.mode === 'xor' && form.color.type === 'fill';
      if (isXorFill) {
        const paperCompoundPath = new paper.CompoundPath({
          children: shapeArray,
          fillColor: palette.array[palette.index],
          fillRule: 'evenodd',
          selected: true,
        });
        group.addChild(paperCompoundPath);
      } else {
        group.addChildren(shapeArray);
      }

      const layerGroup = new paper.Layer({ position: paper.view.center, children: [group] });
      layerGroup.scale(formData.clip[i].scale.x, formData.clip[i].scale.y, paper.view.center);

      const mask = new paper.Path.Rectangle({
        from: new paper.Point(
          formData.clip[i].x - gForm.width / 2,
          formData.clip[i].y - gForm.height / 2
        ),
        to: new paper.Point(
          formData.clip[i].width - gForm.width / 2,
          formData.clip[i].height - gForm.height / 2
        ),
      });

      const layer = new paper.Layer({ position: paper.view.center, children: [mask, layerGroup] });
      layer.clipped = true;
    }

    paper.view.draw();

    const svg = paper.project.exportSVG({ asString: true });

    saveSVG(svg, `${filenamePrefix}-${timestamp()}.svg`);
    finishSVGExport();

    document.body.removeChild(paperCanvas);
    paper.project.clear();
    paper.view.remove();
  }

  function startSvgExport() {
    // Defer so any "exporting" UI status can paint before paper.js blocks.
    setTimeout(generateSVG, 100);
  }

  function finishSVGExport() {
    rec.svg = false;
    rec.capture = false;
  }

  // Converts a hex string or p5.Color to a hex string for paper.js. `p5.Color`
  // is a class on the p5 constructor and is valid to reference in instance
  // mode (it is not per-instance state).
  function convertColor(c) {
    if (typeof c === 'string' && c.startsWith('#')) {
      return c;
    } else if (c instanceof p5.Color) {
      const [r, g, b] = c.levels;
      return '#' + p.hex(r, 2) + p.hex(g, 2) + p.hex(b, 2);
    }
    console.warn('Unsupported color format:', c);
    return '#000000';
  }

  return { startSvgExport };
}
