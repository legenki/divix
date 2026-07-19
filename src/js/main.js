import { registerSW } from 'virtual:pwa-register';
import { ensureVendorLibs, ensureNoiseLibs } from '../shared/utils/lazyLibs.js';

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
 * @property {boolean}  [needsNoise] Seeded simplex + alea (divix, sondeo).
 * @property {p5|null}  instance    Lazily created p5 instance (mutated at runtime).
 * @property {Promise<void>|null} pending  In-flight init promise; null when idle.
 * @property {number}   lastActive  performance.now() when last activated.
 */
/** @type {Workspace[]} */
const workspaces = [
  { name: 'divix',   load: () => import('../divix/js/app.js').then((m) => m.divixSketch),     containerId: 'divix-canvas',   animated: true, shortcut: 'KeyD', needsNoise: true },
  { name: 'difuso',  load: () => import('../difuso/js/app.js').then((m) => m.difusoSketch),   containerId: 'difuso-canvas',  animated: true, shortcut: 'KeyF' },
  { name: 'bandada', load: () => import('../bandada/js/app.js').then((m) => m.bandadaSketch), containerId: 'bandada-canvas', animated: true, shortcut: 'KeyB' },
  { name: 'sondeo',  load: () => import('../sondeo/js/app.js').then((m) => m.sondeoSketch),   containerId: 'sondeo-canvas',  animated: true, shortcut: 'KeyS', needsNoise: true },
  { name: 'clon',    load: () => import('../clon/js/app.js').then((m) => m.clonSketch),       containerId: 'clon-canvas',    animated: true, shortcut: 'KeyC' },
].map((w) => ({ ...w, instance: null, pending: null, lastActive: 0 }));

const workspaceByName = new Map(workspaces.map((w) => [w.name, w]));

// Idle workspaces older than this may drop their p5 instance to free GPU/CPU
// memory. State is still in localStorage and will rehydrate on next open.
const IDLE_DISPOSE_MS = 5 * 60 * 1000;

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
  ws.lastActive = performance.now();
  if (ws.instance) {
    if (currentTheme === 'dark') applyThemeToInstance(ws, currentTheme);
    return Promise.resolve();
  }
  if (ws.pending) return ws.pending;

  // Vendor globals download in parallel with the sketch chunk and p5 constructor;
  // all must be ready before the instance is created (sketches touch globals in setup()).
  const libNames = [...(ws.libs || [])];
  const prep = [
    ws.load(),
    import('p5'),
    libNames.length ? ensureVendorLibs(...libNames) : Promise.resolve(),
    ws.needsNoise ? ensureNoiseLibs() : Promise.resolve(),
  ];

  ws.pending = Promise.all(prep)
    .then(([sketch, { default: p5 }]) => {
      const container = document.getElementById(ws.containerId);
      if (container) {
        ws.instance = new p5(sketch, container);
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
 * Tear down a p5 instance so WebGL contexts and canvases can be GC'd.
 * @param {Workspace} ws
 */
function disposeApp(ws) {
  if (!ws.instance) return;
  try {
    if (typeof ws.instance.remove === 'function') ws.instance.remove();
  } catch (e) {
    console.warn(`[main] dispose "${ws.name}" failed:`, e);
  }
  ws.instance = null;
  const container = document.getElementById(ws.containerId);
  if (container) container.innerHTML = '';
}

/**
 * Drop idle non-active workspaces after IDLE_DISPOSE_MS of inactivity.
 */
function maybeDisposeIdle() {
  const now = performance.now();
  for (const ws of workspaces) {
    if (ws.name === currentApp) continue;
    if (!ws.instance) continue;
    if (now - ws.lastActive < IDLE_DISPOSE_MS) continue;
    disposeApp(ws);
  }
}

// Periodic idle cleanup (cheap; only runs dispose when thresholds hit).
setInterval(maybeDisposeIdle, 60 * 1000);

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
let activeViewTransition = null;

function switchApp(appName) {
  if (!workspaceByName.has(appName) || currentApp === appName) return;

  if (document.startViewTransition) {
    // A transition that's still snapshotting suppresses ALL page rendering
    // (including every sketch's requestAnimationFrame). If one is in flight,
    // skip it before starting the next, and swallow the "aborted" rejection
    // it throws — otherwise a fast tab double-click can freeze the page.
    if (activeViewTransition) activeViewTransition.skipTransition();
    const transition = document.startViewTransition(() => executeSwitchApp(appName));
    activeViewTransition = transition;
    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
    transition.finished
      .catch(() => {})
      .finally(() => {
        if (activeViewTransition === transition) activeViewTransition = null;
      });
    // Watchdog: if the transition hasn't finished shortly after the expected
    // animation time, force-skip it. A hung transition (seen in automated /
    // headless contexts, and possible on aborts) otherwise freezes rendering
    // for the whole page indefinitely. skipTransition() on a finished
    // transition is a no-op, so this is safe.
    setTimeout(() => transition.skipTransition(), 400);
  } else {
    executeSwitchApp(appName);
  }
}

function executeSwitchApp(appName) {
  currentApp = appName;
  const active = workspaceByName.get(appName);
  active.lastActive = performance.now();

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
