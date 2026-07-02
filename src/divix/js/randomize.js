// DIVIX — parameter randomization (instance mode).
//
// Ported from the original tool's global-mode random script. The original's
// Tweakpane coupling (`pane.refresh()`) and the `isReady` draw-loop gate were
// stripped — refreshing the panel and gating the draw loop are app.js concerns
// (the caller decides when it is safe to randomize and refreshes its own UI
// afterwards). All p5 globals (`random`, `floor`, `map`, `min`, `round`,
// `shuffle`) are namespaced through the injected p5 instance.

/**
 * Builds the randomizer bound to a p5 instance, shared state and the loaded
 * palette catalog.
 *
 * @param {object} deps
 * @param {import('p5')} deps.p         The p5 instance (instance mode).
 * @param {object}       deps.state     The whole state.js module.
 * @param {object}       deps.ease      The ease.js module (`{ easeFunctions }`).
 * @param {Array<string[]>} deps.palettes  Palette catalog: array of 5-hex-color arrays.
 *   Passed in (not fetched) so this module has no I/O dependency — loading is
 *   an app.js concern.
 * @returns {{ randomizeAll: () => void, randomizePalette: () => void, randomizeTransform: (obj: object, includeOff?: boolean) => void }}
 */
export function createRandomize({ p, state, ease, palettes }) {
  const {
    palette,
    cnv,
    form,
    split,
    rec,
    SHAPE_TYPES,
    SPLIT_TYPES,
    COLOR_STYLE_TYPES,
    FORM_FILL_MODES,
    TRANSFORM_TYPES,
    ORDER_TYPES,
  } = state;

  const easeInCubic = ease.easeFunctions['Cubic In'];
  const easeOutSine = ease.easeFunctions['Sine Out'];

  function randomizeAll() {
    if (rec.type === 'svg' || rec.type === 'image') {
      cnv.frame = p.floor(p.random(rec.length.value * rec.frameRate));
    } else {
      // Randomize the clip length.
      const length = p.random() < 0.75 ? p.random(0.1, 0.5) : p.random();
      rec.length.value = p.floor(p.map(length, 0, 1, rec.length.min, rec.length.max));
    }

    const shape = Object.values(SHAPE_TYPES);
    form.type = shape[p.floor(p.random(shape.length))];

    form.count.base = 2 + p.floor(p.random() * form.count.max);

    randomizeColor();
    randomizeSequence();
    randomizeTransition();
    randomizeSplit();
    randomizeTransform(form.scale, true);
    randomizeTransform(form.xmove, true);
    randomizeTransform(form.ymove, true);
    randomizeTransform(form.rotate, true);
  }

  function randomizeSequence() {
    form.sequence = p.random() < 0.25 ? 0 : 1;
    form.sequence = p.random() < 0.5 ? form.sequence : p.random();
  }

  function randomizeTransition() {
    form.transition.x = 0;
    form.transition.y = 0;
    form.transition.x = p.random() < 0.5 ? form.transition.x : p.random(-1, 1);
    form.transition.y = p.random() < 0.5 ? form.transition.y : p.random(-1, 1);
  }

  function randomizeSplit() {
    const splits = Object.values(SPLIT_TYPES);
    split.type = p.random(splits);

    split.offset.x = 0;
    split.offset.y = 0;
    split.mask.x = 0;
    split.mask.y = 0;

    cnv.scale.value = 1;
    cnv.rotation.value = 0;
    cnv.position.x = 0;
    cnv.position.y = 0;

    if (split.type !== 'none') {
      const scaleMax = form.sequence < 0.5 ? 1 + cnv.scale.max * form.sequence : cnv.scale.max;
      cnv.scale.value = p.random() < 0.33 ? cnv.scale.value : p.random(1, scaleMax);
      cnv.rotation.value =
        p.random() < 0.33 ? cnv.rotation.value : p.random(cnv.rotation.min, cnv.rotation.max);
      cnv.position.x = p.random() < 0.5 ? cnv.position.x : p.random(-0.75, 0.2);
      cnv.position.y = p.random() < 0.5 ? cnv.position.y : p.random(-0.75, 0.2);
    }
  }

  function randomizeColor() {
    const colorTypes = Object.values(COLOR_STYLE_TYPES);
    form.color.type = p.random(colorTypes);

    const fillModes = Object.values(FORM_FILL_MODES);
    form.color.mode = p.random(fillModes);

    randomizePalette();

    palette.index = p.floor(p.random(palette.array.length));
    const index = (palette.index + 1) % palette.array.length;
    cnv.color.slot = index;
  }

  /**
   * Clean port of the original's `getRandomPalette` (which lived in form.js and
   * was Tweakpane-coupled). Picks a random palette from the injected catalog,
   * applies the original's shuffle/reverse variation, and writes it to
   * `palette.array`. No UI refresh — that is the caller's job.
   */
  function randomizePalette() {
    if (!palettes || palettes.length === 0) return;

    palette.array = [];
    const index = p.floor(p.random(palettes.length));
    // Copy so we never mutate (reverse/shuffle) the shared source catalog.
    let randomPalette = palettes[index].slice();
    randomPalette =
      p.random() < 0.4
        ? randomPalette
        : p.random() < 0.5
          ? randomPalette.reverse()
          : p.shuffle(randomPalette, true);
    for (let i = 0; i < randomPalette.length; i++) {
      palette.array.push(randomPalette[i]);
    }
  }

  /**
   * Randomizes one transform axis object (form.scale / xmove / ymove / rotate).
   *
   * @param {object}  obj          The transform sub-object to mutate.
   * @param {boolean} [includeOff] When true, 'Off' is a possible random type;
   *   when false, the transform is guaranteed active (Off excluded). Renamed
   *   from the original's confusingly-named `isOff`. Every call site in
   *   `randomizeAll` passes true (matching the original); Task 9's per-axis
   *   "Get Random Values" buttons can pass false to force an active transform.
   */
  function randomizeTransform(obj, includeOff = true) {
    let useType;

    if (includeOff) {
      useType = Object.values(TRANSFORM_TYPES);
    } else {
      // Drop the first entry ('Off') and randomize among the remaining types.
      const [, ...restEntries] = Object.entries(TRANSFORM_TYPES);
      useType = Object.values(Object.fromEntries(restEntries));
    }

    const order = Object.values(ORDER_TYPES);

    obj.type = useType[p.floor(p.random(useType.length))];
    obj.order = order[p.floor(p.random(order.length))];
    obj.seed = p.round(p.random(state.simplex.max));
    obj.amp = p.random(0.1, 1);
    obj.freq = easeInCubic(p.random());
    obj.phase = p.random(-0.5, 0.5);
    obj.speed = p.random(0.1, 1);

    const cycle = easeOutSine(p.random()) * rec.length.value;
    obj.cycle = p.min(form.cycleMax + 2, p.floor(cycle));
  }

  return { randomizeAll, randomizePalette, randomizeTransform };
}
