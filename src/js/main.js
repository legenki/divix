import { registerSW } from 'virtual:pwa-register';
import { ensureVendorLibs } from '../shared/utils/lazyLibs.js';

// Register Service Worker for PWA. New content shows a toast; the user
// decides when to reload so an in-progress session isn't lost.
const updateSW = registerSW({
  onNeedRefresh() {
    showUpdateToast(() => updateSW(true));
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
});

function showUpdateToast(onUpdate) {
  const toast = document.createElement('div');
  toast.style.cssText =
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
    'background:var(--color-surface,#fff);color:var(--color-text,#000);' +
    'border:1px solid var(--color-border,#ccc);border-radius:8px;' +
    'padding:10px 16px;display:flex;gap:12px;align-items:center;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:9999;font-size:13px;';
  toast.innerHTML =
    '<span>New version available</span>' +
    '<button style="padding:4px 10px;border-radius:5px;border:none;cursor:pointer;font-size:12px;">Update</button>' +
    '<button style="background:none;border:none;cursor:pointer;font-size:16px;line-height:1;" aria-label="Dismiss">✕</button>';
  document.body.appendChild(toast);
  toast.querySelectorAll('button')[0].addEventListener('click', () => { toast.remove(); onUpdate(); });
  toast.querySelectorAll('button')[1].addEventListener('click', () => toast.remove());
}

/**
 * Single source of truth for the workspaces. Adding a new workspace means
 * adding one entry here — every routine below is data-driven off this list.
 *
 * The sketch is loaded lazily via dynamic import so each workspace's code is
 * code-split into its own chunk and only fetched on first activation.
 *
 * @typedef {Object} Workspace
 * @property {string}   name        Stable id used for tabs, views and shortcuts.
 * @property {Function} load        Resolves to the named sketch factory.
 * @property {string}   containerId DOM id the p5 instance mounts into.
 * @property {boolean}  animated    Whether the sketch runs a continuous loop.
 * @property {string}   [shortcut]  KeyboardEvent.code that activates it with Alt.
 * @property {string[]} [libs]      Vendor globals the sketch needs (see lazyLibs.js);
 *                                  loaded in parallel with the chunk, ready before setup().
 * @property {boolean}  [usesOwnP5] When true, load() resolves to `{ sketch, P5 }`
 *                                  (an npm-imported p5 constructor bundled into the
 *                                  workspace's own chunk) instead of a bare sketch
 *                                  function; the instance is built with that P5
 *                                  rather than the global `p5`. DIFUSO uses this to
 *                                  run p5 2.x while the rest of Divix uses the global
 *                                  1.x — the two never share a constructor.
 * @property {p5|null}  instance    Lazily created p5 instance (mutated at runtime).
 * @property {Promise<void>|null} pending  In-flight init promise; null when idle.
 */
/** @type {Workspace[]} */
const workspaces = [
  { name: 'divix',   load: () => import('../divix/js/app.js').then((m) => m.divixSketch),     containerId: 'divix-canvas',   animated: true, shortcut: 'KeyD', libs: ['paper'] },
  { name: 'difuso',  load: () => import('../difuso/js/app.js').then((m) => m.difuso),          containerId: 'difuso-canvas',  animated: true, shortcut: 'KeyF', usesOwnP5: true },
  { name: 'bandada', load: () => import('../bandada/js/app.js').then((m) => m.bandadaSketch), containerId: 'bandada-canvas', animated: true, shortcut: 'KeyB' },
  { name: 'deriva',  load: () => import('../deriva/js/app.js').then((m) => m.derivaSketch),   containerId: 'deriva-canvas',  animated: true, shortcut: 'KeyR' },
  { name: 'sondeo',  load: () => import('../sondeo/js/app.js').then((m) => m.sondeoSketch),   containerId: 'sondeo-canvas',  animated: true, shortcut: 'KeyS' },
  { name: 'clon',    load: () => import('../clon/js/app.js').then((m) => m.clonSketch),       containerId: 'clon-canvas',    animated: true, shortcut: 'KeyC' },
].map((w) => ({ ...w, instance: null }));

const workspaceByName = new Map(workspaces.map((w) => [w.name, w]));

let currentApp = 'divix';
let currentTheme = 'light';

/**
 * Lazily loads a workspace's sketch chunk, creates its p5 instance on first
 * activation and applies the current theme. Concurrent calls share one promise
 * so a rapid double-activation can't create two instances.
 * @param {Workspace} ws
 * @returns {Promise<void>}
 */
function initApp(ws) {
  if (ws.instance) {
    if (currentTheme === 'dark') applyThemeToInstance(ws, currentTheme);
    return Promise.resolve();
  }
  if (ws.pending) return ws.pending;

  // Vendor globals download in parallel with the sketch chunk; both must be
  // ready before the instance is created (sketches touch globals in setup()).
  ws.pending = Promise.all([loadSketchChunk(ws), ensureVendorLibs(...(ws.libs || []))])
    .then(([sketch]) => {
      const container = document.getElementById(ws.containerId);
      if (container) {
        // usesOwnP5 workspaces resolve to `{ sketch, P5 }` and are constructed
        // with their own bundled p5 constructor; the rest use the global `p5`.
        ws.instance = ws.usesOwnP5
          ? new sketch.P5(sketch.sketch, container)
          : new p5(sketch, container);
      }
      if (currentTheme === 'dark') applyThemeToInstance(ws, currentTheme);
    })
    .catch((err) => console.error(`Failed to load workspace "${ws.name}":`, err))
    .finally(() => {
      ws.pending = null;
    });

  return ws.pending;
}

/**
 * Loads a workspace's sketch chunk. For `usesOwnP5` workspaces (DIFUSO runs
 * p5 2.x from npm) the global `p5` — which is the 1.x build loaded via
 * index.html's <script> tag — is hidden for the duration of the dynamic import.
 * p5 2.x's module has legacy global-mode shims (`if (typeof p5 !== 'undefined')
 * addon(p5, p5.prototype)`) that fire against whatever `window.p5` is at eval
 * time; if the 1.x global is visible they call 2.x addon fns with the wrong
 * prototype and a missing `lifecycles` arg, throwing "Cannot set properties of
 * undefined (setting 'presetup')". Hiding the global only during the import
 * (then restoring it) lets 2.x initialize cleanly without disturbing the five
 * workspaces that rely on the 1.x global. The import is memoized by the module
 * system, so this hide/restore only matters on the first (evaluating) load.
 * @param {Workspace} ws
 * @returns {Promise<*>}
 */
function loadSketchChunk(ws) {
  if (!ws.usesOwnP5) return ws.load();
  const savedGlobalP5 = window.p5;
  const hadGlobalP5 = 'p5' in window;
  try {
    delete window.p5;
  } catch {
    window.p5 = undefined;
  }
  const restore = () => {
    if (hadGlobalP5) window.p5 = savedGlobalP5;
  };
  return ws.load().then(
    (mod) => {
      restore();
      return mod;
    },
    (err) => {
      restore();
      throw err;
    }
  );
}

/**
 * Applies a theme to a workspace's p5 instance if it exposes applyTheme.
 * @param {Workspace} ws
 * @param {'light'|'dark'} theme
 */
function applyThemeToInstance(ws, theme) {
  if (ws.instance && typeof ws.instance.applyTheme === 'function') {
    ws.instance.applyTheme(theme);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize only the default app
  initApp(workspaceByName.get(currentApp));

  // 2. Setup tab switching
  workspaces.forEach((ws) => {
    const tabBtn = document.getElementById(`tab-${ws.name}`);
    if (tabBtn) tabBtn.addEventListener('click', () => switchApp(ws.name));
  });

  // 3. Setup global theme toggle
  const themeBtn = document.getElementById('btn-global-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleGlobalTheme);
  }

  // 4. Keyboard shortcuts
  window.addEventListener('keydown', handleGlobalKeys);
});

/**
 * Switches the active app, updating the UI and initializing the app if necessary.
 * @param {string} appName The name of the app to switch to
 */
function switchApp(appName) {
  if (!workspaceByName.has(appName) || currentApp === appName) return;

  if (document.startViewTransition) {
    document.startViewTransition(() => executeSwitchApp(appName));
  } else {
    executeSwitchApp(appName);
  }
}

function executeSwitchApp(appName) {
  currentApp = appName;
  const active = workspaceByName.get(appName);

  // Update tab + view visibility synchronously for an instant UI response.
  workspaces.forEach((ws) => {
    const btn = document.getElementById(`tab-${ws.name}`);
    const view = document.getElementById(`app-${ws.name}`);
    const isActive = ws.name === appName;

    if (btn) {
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    }

    if (view) {
      view.style.display = isActive ? 'block' : 'none';
      view.classList.toggle('active', isActive);
    }

    // Pause hidden instances to save cycles; the active one's loop state is
    // (re)applied below once it's guaranteed to exist.
    if (!isActive && ws.instance) ws.instance.noLoop();
  });

  // The active sketch may load asynchronously on first activation, so apply
  // its loop state and trigger the canvas resize once the instance exists.
  initApp(active).then(() => {
    if (active.instance && active.animated) active.instance.loop();

    // Fix p5.js canvas dimensions if the view was hidden during initialization.
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 10);
  });
}

/**
 * Toggles the global theme between light and dark modes.
 */
function toggleGlobalTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.body.classList.toggle('theme-dark', currentTheme === 'dark');
  document.body.classList.toggle('theme-light', currentTheme === 'light');

  workspaces.forEach((ws) => applyThemeToInstance(ws, currentTheme));
}

/**
 * Handles global keyboard shortcuts for switching apps (Alt + workspace key).
 * @param {KeyboardEvent} e The keyboard event
 */
function handleGlobalKeys(e) {
  if (!e.altKey) return;
  const ws = workspaces.find((w) => w.shortcut === e.code);
  if (ws) {
    e.preventDefault();
    switchApp(ws.name);
  }
}
