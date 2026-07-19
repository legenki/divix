/**
 * Dirty-flag draw loop helpers for p5 sketches.
 *
 * When animation is off, the sketch should not burn a full redraw every frame.
 * Call `markDirty()` after any state change; call `tickAnimation(isAnimating)`
 * once per draw to advance the frame counter / decide whether to keep looping.
 *
 * @param {object} p  p5 instance
 * @returns {{ markDirty: () => void, needsDraw: () => boolean, consume: () => void, setAnimating: (on: boolean) => void, isAnimating: () => boolean }}
 */
export function createDirtyLoop(p) {
  let dirty = true;
  let animating = true;

  function markDirty() {
    dirty = true;
    // Wake a paused sketch so the pending change paints once.
    if (!animating && typeof p.loop === 'function') {
      try {
        p.loop();
      } catch {
        /* instance may not be fully ready */
      }
    }
  }

  function needsDraw() {
    return dirty || animating;
  }

  function consume() {
    dirty = false;
  }

  function setAnimating(on) {
    animating = !!on;
    if (animating) {
      dirty = true;
      if (typeof p.loop === 'function') p.loop();
    } else if (typeof p.noLoop === 'function') {
      // One final frame will run if we're mid-draw; after consume the next
      // draw returns early and we pause. Request one paint if still dirty.
      if (dirty) p.loop();
      else p.noLoop();
    }
  }

  function isAnimating() {
    return animating;
  }

  /** Call at end of draw: pause if nothing left to paint. */
  function afterDraw() {
    if (!animating && !dirty && typeof p.noLoop === 'function') {
      p.noLoop();
    }
  }

  return { markDirty, needsDraw, consume, setAnimating, isAnimating, afterDraw };
}
