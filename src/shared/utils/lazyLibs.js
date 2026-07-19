/**
 * On-demand loader for heavyweight vendor scripts that should not block
 * first paint. Each script is injected once; concurrent callers share the
 * same promise.
 */

const pending = new Map();

function loadScript(src) {
  if (pending.has(src)) return pending.get(src);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => {
      // Allow a retry after a network failure instead of caching the rejection.
      pending.delete(src);
      script.remove();
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });
  pending.set(src, promise);
  return promise;
}

/**
 * Resolves to the HME global from h264-mp4-encoder (1.7 MB). Loaded on first
 * video export instead of at app startup.
 * @returns {Promise<typeof HME>}
 */
export async function ensureHME() {
  if (window.HME) return window.HME;
  await loadScript(`${import.meta.env.BASE_URL}lib/vendor/h264-mp4-encoder.web.js`);
  return window.HME;
}

/**
 * Heavyweight vendor globals loaded per workspace / feature on demand
 * (see the workspace registry in src/js/main.js) instead of blocking the
 * initial page load. Sketch code must not touch these globals until the
 * corresponding ensure* promise resolves.
 */
const VENDOR_LIBS = {
  paper: 'lib/vendor/paper-full.min.js',
  color: 'lib/vendor/color.global.min.js',
  alea: 'lib/vendor/alea.js',
  simplex: 'lib/vendor/simplex-noise.min.js',
};

/**
 * Loads the named vendor libraries (keys of VENDOR_LIBS) in parallel.
 * @param {...keyof VENDOR_LIBS} names
 * @returns {Promise<void[]>}
 */
export function ensureVendorLibs(...names) {
  return Promise.all(
    names.map((name) => {
      if (!VENDOR_LIBS[name]) {
        return Promise.reject(new Error(`Unknown vendor lib: ${name}`));
      }
      return loadScript(`${import.meta.env.BASE_URL}${VENDOR_LIBS[name]}`);
    })
  );
}

/** Seeded simplex + alea PRNG used by Divix and Sondeo. */
export function ensureNoiseLibs() {
  return ensureVendorLibs('alea', 'simplex');
}

/** paper.js — only needed for SVG import/export in Divix. */
export function ensurePaper() {
  return ensureVendorLibs('paper');
}
