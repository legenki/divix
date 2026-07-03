export const randomSystem = {
  simplexGrain: null,
  simplexShade: null,
  simplexShiftX: null,
  simplexShiftY: null,
  simplexScale: null,
  simplexRotation: null,

  init(state) {
    this.simplexGrain = new SimplexNoise();
    this.simplexShade = new SimplexNoise(alea(state.shade.seed));
    this.simplexShiftX = new SimplexNoise(alea(state.shift.seed.x));
    this.simplexShiftY = new SimplexNoise(alea(state.shift.seed.y));
    this.simplexScale = new SimplexNoise(alea(state.scaling.seed));
    this.simplexRotation = new SimplexNoise(alea(state.rotation.seed));
  },

  updateSeed(type, seed) {
    if (type === 'shade') this.simplexShade = new SimplexNoise(alea(seed));
    if (type === 'shiftX') this.simplexShiftX = new SimplexNoise(alea(seed));
    if (type === 'shiftY') this.simplexShiftY = new SimplexNoise(alea(seed));
    if (type === 'scale') this.simplexScale = new SimplexNoise(alea(seed));
    if (type === 'rotate') this.simplexRotation = new SimplexNoise(alea(seed));
  }
};
