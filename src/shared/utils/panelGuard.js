/**
 * Returns true when the mouse cursor is over the right sidebar panel
 * (or any other UI overlay element within the workspace's app-view).
 * Used by every workspace to prevent mouse interactions on the canvas
 * from firing when the user clicks/drags sliders and buttons.
 *
 * @param {string} appId  The DOM id of the workspace's app-view, e.g. 'app-bandada'.
 * @param {number} mx     p.mouseX (viewport-relative)
 * @param {number} my     p.mouseY (viewport-relative)
 * @returns {boolean}
 */
export function isOverPanel(appId, mx, my) {
  const el = document.elementFromPoint(mx, my);
  if (!el) return false;
  const sidebar = document.querySelector(`#${appId} .right-sidebar`);
  if (sidebar && sidebar.contains(el)) return true;
  // Also block clicks on the top tab-switcher bar.
  const switcher = document.querySelector('.app-switcher');
  if (switcher && switcher.contains(el)) return true;
  return false;
}
