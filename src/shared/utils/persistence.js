import { safeStorage } from './storage.js';

/**
 * Creates save/load helpers bound to one workspace.
 *
 * @param {string}   storageKey   localStorage key for this workspace
 * @param {string}   prefix       workspace id for console warnings, e.g. 'copo'
 * @param {Function} serialize    () => object — snapshot of current state
 * @param {Function} restore      (data) => void — applies a parsed snapshot
 * @returns {{ saveState, loadState }}
 */
export function createPersistence(storageKey, prefix, serialize, restore) {
  let saveTimer = null;

  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      safeStorage.setItem(storageKey, JSON.stringify(serialize()));
    }, 500);
  }

  function loadState() {
    try {
      const raw = safeStorage.getItem(storageKey);
      if (!raw) return false;
      restore(JSON.parse(raw));
      return true;
    } catch (e) {
      console.warn(`[${prefix}] state restore failed:`, e);
      return false;
    }
  }

  return { saveState, loadState };
}
