/**
 * Triggers a browser download of an SVG string as a file.
 * Shared by the workspace SVG exporters.
 * @param {string} svgString Serialized SVG markup.
 * @param {string} [filename] Download name; defaults to output.svg.
 */
export function saveSVG(svgString, filename) {
  const svgDataURI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  const link = document.createElement('a');
  link.download = filename || 'output.svg';
  link.href = svgDataURI;
  link.click();
}
