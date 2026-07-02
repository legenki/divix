/**
 * Safe local storage wrapper
 * Provides error handling and fallbacks for localStorage operations
 * to prevent crashes if quota is exceeded or storage is disabled.
 */

export const safeStorage = {
  /**
   * Safe setItem
   * @param {string} key
   * @param {string} value
   * @returns {boolean} true if successful, false otherwise
   */
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`[safeStorage] Failed to save to localStorage (${key}):`, e);
      return false;
    }
  },

  /**
   * Safe getItem
   * @param {string} key
   * @returns {string|null}
   */
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Failed to read from localStorage (${key}):`, e);
      return null;
    }
  },

  /**
   * Safe removeItem
   * @param {string} key
   */
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Failed to remove from localStorage (${key}):`, e);
    }
  },
};
