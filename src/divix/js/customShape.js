// DIVIX — custom SVG import → shape path (instance mode).
//
// Ported from the original tool's global-mode path script. Imports a
// user-uploaded SVG via paper.js, normalizes it to the canvas default size,
// and writes it into the mutable 'custom' slot of the shape dictionaries.
//
// Stripped from the original: the Tweakpane `shapeTypeSelector.refresh()` call
// (UI concern) and the hardcoded `showPopupAlert('emptySvgNotice')` toast. The
// empty-SVG condition is preserved but surfaced through an optional `onError`
// callback and a boolean return so app.js can present failure however Divix's
// UI does. `getSvgDimensions` was dead code in the original (commented out at
// its only call site) and is intentionally not ported.

/**
 * Builds the custom-shape importer.
 *
 * @param {object} deps
 * @param {import('p5')} deps.p            The p5 instance (instance mode); used for `p.round`.
 * @param {object}       deps.state        The whole state.js module (SHAPE_PATHS, SHAPE_SIZE, form, cnv).
 * @param {() => void}   deps.switchForm   `form.js`'s switchForm; re-run after SHAPE_PATHS.custom
 *   changes so `form.shape.path` picks up the new geometry. Accepted as a
 *   single function reference to keep this module's dependency surface minimal
 *   (rather than the whole form factory).
 * @param {(message: string) => void} [deps.onError]  Optional callback invoked
 *   with an error key when the imported SVG yields no usable path.
 * @returns {{ importSVG: (svgFileContents: string) => void }}
 */
export function createCustomShape({ p, state, switchForm, onError }) {
  const { SHAPE_PATHS, SHAPE_SIZE, form, cnv } = state;

  /**
   * Imports SVG markup, normalizes it, and installs it as the 'custom' shape.
   * @param {string} svgFileContents Raw SVG text (the file contents).
   */
  function importSVG(svgFileContents) {
    paper.setup();
    paper.pixelRatio = 1;

    paper.project.importSVG(svgFileContents, {
      expandShapes: true,
      onLoad(item) {
        const bounds = item.bounds;

        // Guard against a zero-dimension import → division by zero / NaN scale.
        const widthMultiplier = bounds.width > 0 ? cnv.defaultSize / bounds.width : 1;
        const heightMultiplier = bounds.height > 0 ? cnv.defaultSize / bounds.height : 1;
        const multiplier = Math.min(widthMultiplier, heightMultiplier);

        item.scale(multiplier);
        item.position = new paper.Point(
          (bounds.width * multiplier) / 2,
          (bounds.height * multiplier) / 2
        );

        const svgPath = item.exportSVG({ asString: true });
        convertPathToShape(svgPath);
      },
      onError(err) {
        console.error(`Error importing SVG: ${err}`);
        if (typeof onError === 'function') onError('svgImportError');
      },
    });
  }

  /**
   * Extracts path data from an SVG string and installs it as the 'custom'
   * shape. Returns true on success, false (and fires onError) when the SVG has
   * no drawable path.
   * @param {string} data SVG markup.
   * @returns {boolean}
   */
  function convertPathToShape(data) {
    const shapeData = getPathFromSVG(data);
    if (shapeData.path.length > 0) {
      SHAPE_PATHS.custom = shapeData.path.join(' ');
      SHAPE_SIZE.custom.width = shapeData.width * 0.5;
      SHAPE_SIZE.custom.height = shapeData.height * 0.5;

      form.type = 'custom';
      switchForm();
      return true;
    }

    if (typeof onError === 'function') onError('emptySvgNotice');
    return false;
  }

  function getPathFromSVG(svgText) {
    const pathData = svgToPathDataArray(svgText);
    let maxWidth = 0;
    let maxHeight = 0;

    pathData.forEach((d) => {
      const bbox = getPathBoundingBox(d);
      maxWidth = Math.max(maxWidth, bbox.x + bbox.width);
      maxHeight = Math.max(maxHeight, bbox.y + bbox.height);
    });

    return {
      path: pathData,
      width: p.round(maxWidth, 4),
      height: p.round(maxHeight, 4),
    };
  }

  function svgToPathDataArray(svgText) {
    const pathDataArray = [];
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const paths = svgDoc.querySelectorAll('path:not(clipPath path)');

    paths.forEach((path) => {
      const pathData = path.getAttribute('d');
      if (pathData) pathDataArray.push(pathData);
    });

    return pathDataArray;
  }

  function getPathBoundingBox(svgPathData) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', svgPathData);
    svg.appendChild(path);

    const bbox = path.getBBox();
    svg.remove();

    return bbox;
  }

  return { importSVG };
}
