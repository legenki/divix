/**
 * Pure date/time helpers shared across workspaces (no p5 dependency).
 */

/**
 * Filename-safe local timestamp: `YYYY-MM-DD_HH-MM-SS`.
 * Used to suffix exported file names.
 * @returns {string}
 */
export function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
