// DIFUSO — source media loading (default image, image upload/drag-drop, video
// upload/drag-drop). 3D model (.obj/.stl) loading and JSON-preset import are
// intentionally out of scope for this module — see
// docs/superpowers/specs/2026-07-02-difuso-workspace-design.md. Preset import
// is a separate concern app.js will wire up via the shared presetIO.js
// utility, not this module.
//
// p5 2.2.3 API notes (this workspace's p5 is the npm/ESM 2.x build, not the
// global 1.11.2 the rest of Divix uses — see package.json):
// - `p.loadImage(path, successCallback, failureCallback)` is `async` and
//   returns a Promise of the loaded p5.Image *in addition to* invoking
//   successCallback — both styles work. We use the Promise/await style here.
// - `p.createVideo(src, callback)` is still synchronous: it returns a
//   p5.MediaElement immediately (backed by a hidden-by-default <video> DOM
//   element) and invokes `callback` once metadata/playback is ready (the
//   'canplaythrough' event under the hood). This callback style is unchanged
//   from p5 1.x, so it is kept here (wrapped in a Promise for a uniform
//   async API alongside loadImageFile).
//
// Ported from the reference tool's media.js. Differences from the reference:
// - No 3D model (.obj/.stl) branch in the file-type dispatch.
// - No JSON-preset branch in the file-type dispatch.
// - No DOM event wiring (dragover/dragleave/drop) — the reference's
//   canvasDropEvents() attached its own listeners to canvas.elt; here that's
//   app.js's job (it owns the canvas element). This module only exposes
//   handleDroppedFile(file) for app.js's drop handler to call, matching the
//   established pattern from DIVIX's customShape.js (importSVG(svgText)
//   rather than wiring its own listeners).

const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/**
 * Builds the source-media loader: default bundled image, user-uploaded or
 * dropped image/video files, and the current-frame texture accessor that
 * effect modules (dither.js, halftone.js, etc.) read from.
 *
 * @param {object} deps
 * @param {import('p5')} deps.p         The p5 2.x instance (instance mode).
 * @param {object}       deps.state     The whole state.js module (uses `rec`, `cnv`).
 * @param {string}       deps.defaultImageUrl  URL of the bundled default image
 *   (public/assets/difuso/default.webp), shown before any user upload.
 * @param {(file: File) => void} [deps.onUnsupported]  Optional callback fired
 *   when handleDroppedFile/handleFile receives a file type this module does
 *   not handle (e.g. .obj/.stl/.json — those are other tasks' concerns, but
 *   this module still needs a way to tell app.js "I can't do anything with
 *   this" so it can surface a message however Divix's UI does). If omitted,
 *   unsupported files are silently ignored.
 * @returns {{
 *   loadDefaultImage: () => Promise<void>,
 *   loadImageFile: (file: File) => Promise<void>,
 *   loadVideoFile: (objectUrl: string) => Promise<void>,
 *   handleDroppedFile: (file: File) => void,
 *   getCurrentTexture: () => (import('p5').Image | import('p5').MediaElement | null),
 * }}
 */
export function createSource({ p, state, defaultImageUrl, onUnsupported }) {
  const { rec, cnv } = state;

  /** @type {import('p5').Image | null} High-quality (un-resized) source image. */
  let sourceImage = null;

  /**
   * Loads the bundled default image as the initial source, before any user
   * upload. Sets rec.type = 'image'. Rejects if the fetch/decode fails (e.g.
   * network failure, missing/corrupt bundled asset) — the caller must catch
   * this, since a failure here means the workspace has nothing to show yet.
   * @returns {Promise<void>}
   */
  async function loadDefaultImage() {
    const loadedImage = await p.loadImage(defaultImageUrl);
    sourceImage = loadedImage;
    rec.type = 'image';
  }

  /**
   * Reads a user-selected/dropped image File and loads it as the current
   * source. Sets rec.type = 'image'.
   * @param {File} file
   * @returns {Promise<void>}
   */
  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const loadedImage = await p.loadImage(event.target.result);
          sourceImage = loadedImage;
          rec.type = 'image';
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Loads a video from an object URL (typically `URL.createObjectURL(file)`)
   * as the current source. Mutes, loops and hides the underlying <video> DOM
   * element (it's sampled as a WebGL texture by the shaders, not displayed
   * directly). Sets rec.type = 'video'. Removes any previously loaded video
   * element first, matching the reference's cleanup-before-replace behavior.
   * Rejects if the video fails to load/decode (p5's createVideo() has no
   * failure callback of its own, so this listens to the underlying <video>
   * element's native 'error' event directly — without this, a corrupt file
   * or unsupported codec would leave the returned promise pending forever).
   * @param {string} objectUrl
   * @returns {Promise<void>}
   */
  function loadVideoFile(objectUrl) {
    return new Promise((resolve, reject) => {
      if (rec.video !== undefined) rec.video.remove();

      rec.video = p.createVideo(objectUrl, () => {
        rec.video.volume(0);
        rec.video.loop();
        rec.video.hide();
        rec.type = 'video';
        resolve();
      });
      rec.video.elt.addEventListener('error', () => {
        reject(rec.video.elt.error || new Error('Failed to load video'));
      });
    });
  }

  /**
   * Dispatches a File to the appropriate loader by MIME type: image/* →
   * loadImageFile, video/mp4|webm|quicktime → loadVideoFile. Any other file
   * type (including 3D models and JSON presets — not this module's job) is
   * reported via onUnsupported if provided, otherwise silently ignored.
   * @param {File} file
   */
  function handleDroppedFile(file) {
    if (file.type.startsWith('image/')) {
      loadImageFile(file);
    } else if (VIDEO_MIME_TYPES.some((type) => file.type.startsWith(type))) {
      loadVideoFile(URL.createObjectURL(file));
    } else if (typeof onUnsupported === 'function') {
      onUnsupported(file);
    }
  }

  /**
   * Returns the current source (image or video), resized to fit within the
   * canvas while preserving aspect ratio (dimensions rounded down to even
   * numbers), ready to feed the shaders. Returns null until a source has
   * actually finished loading (loadDefaultImage/loadImageFile/loadVideoFile
   * resolved) — callers must treat null as "not ready" and skip drawing,
   * rather than dividing by a 1x1 placeholder's width/height and producing
   * Infinity/NaN in shader math.
   * @returns {import('p5').Image | import('p5').MediaElement | null}
   */
  function getCurrentTexture() {
    let source = null;

    if (rec.type === 'image' && sourceImage) {
      source = sourceImage;
    } else if (rec.type === 'video' && rec.video && rec.video.loadedmetadata) {
      source = rec.video;
    }

    if (!source || !source.width || !source.height) return null;

    const canvasWidth = cnv.width;
    const canvasHeight = cnv.height;

    const widthRatio = canvasWidth / source.width;
    const heightRatio = canvasHeight / source.height;
    const ratio = Math.min(widthRatio, heightRatio);

    let newWidth = source.width * ratio;
    let newHeight = source.height * ratio;
    newWidth = newWidth - (newWidth % 2);
    newHeight = newHeight - (newHeight % 2);

    if (rec.type === 'video') {
      // Video elements are sampled directly by the shaders at draw time (no
      // per-frame image copy) — return the live element; callers read
      // getCurrentTexture() alongside cnv.width/cnv.height (already sized to
      // this same aspect-preserving fit) for draw dimensions.
      return source;
    }

    const resizedImage = p.createImage(newWidth, newHeight);
    resizedImage.copy(source, 0, 0, source.width, source.height, 0, 0, newWidth, newHeight);
    return resizedImage;
  }

  return { loadDefaultImage, loadImageFile, loadVideoFile, handleDroppedFile, getCurrentTexture };
}
