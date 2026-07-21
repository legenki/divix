// SILUETA — media library. A registry of poster images: bundled defaults plus
// user uploads. Modelled on lumen's createMediaRegistry (src/js/media.js): the
// registry owns entry lifecycle, the panel owns the DOM. Images are p5.Image
// instances so the render pipeline can texture them directly.
//
// Entry: { key, name, url, img, w, h, ready, user, enabled }
//   enabled — whether the layout algorithm may place this image. Toggling is
//   what lets a user curate which of the library's images appear in the poster.

/** Bundled starter set (filename stem → display name). */
export const DEFAULT_MEDIA = {
  crab: 'Blue Crab',
  parrotfish: 'Parrotfish',
  mussel: 'Mussel',
  goldfish: 'Goldfish',
  urchin: 'Sea Urchin',
  seahorse: 'Seahorse',
  shrimp: 'Shrimp',
};

/**
 * @param {object} deps
 * @param {import('p5')} deps.p     p5 instance (for loadImage)
 * @param {string} deps.baseUrl     e.g. `${import.meta.env.BASE_URL}assets/silueta/media/`
 */
export function createMediaLibrary({ p, baseUrl }) {
  /** @type {Map<string, object>} */
  const entries = new Map();
  let userCounter = 0;
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) fn();
  }

  /** Load the bundled defaults. A failed image is skipped, never fatal. */
  function loadDefaults() {
    const jobs = Object.entries(DEFAULT_MEDIA).map(([key, name]) => {
      const url = `${baseUrl}${key}.webp`;
      const entry = {
        key, name, url, img: null, w: 0, h: 0,
        ready: false, user: false, enabled: true,
      };
      entries.set(key, entry);
      return p
        .loadImage(url)
        .then((img) => {
          entry.img = img;
          entry.w = img.width;
          entry.h = img.height;
          entry.ready = true;
        })
        .catch((e) => {
          console.warn(`[silueta] media load failed: ${key}`, e);
          entries.delete(key);
        });
    });
    return Promise.all(jobs).then(notify);
  }

  /** Add a user-uploaded File. Resolves with the new entry (or rejects). */
  function addFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const img = await p.loadImage(ev.target.result);
          userCounter += 1;
          const key = `user_${userCounter}_${Date.now().toString(36)}`;
          const entry = {
            key,
            name: file.name.replace(/\.[^.]+$/, ''),
            url: ev.target.result,
            img,
            w: img.width,
            h: img.height,
            ready: true,
            user: true,
            enabled: true,
          };
          entries.set(key, entry);
          notify();
          resolve(entry);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function remove(key) {
    if (entries.delete(key)) notify();
  }

  function toggle(key, on) {
    const e = entries.get(key);
    if (!e) return;
    e.enabled = on === undefined ? !e.enabled : !!on;
    notify();
  }

  /** All entries, in insertion order. */
  function all() {
    return Array.from(entries.values());
  }

  /** Ready + enabled entries — the pool the layout algorithm draws from. */
  function active() {
    return all().filter((e) => e.ready && e.enabled);
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { loadDefaults, addFile, remove, toggle, all, active, onChange, get: (k) => entries.get(k) };
}
