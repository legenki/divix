// DIVIX — easing catalog.

export const easeFunctions = {
  // Linear
  none: (t) => t,
  Linear: (t) => t,

  // Sine
  'Sine In': (t) => -1 * Math.cos(t * (Math.PI / 2)) + 1,
  'Sine Out': (t) => Math.sin(t * (Math.PI / 2)),
  'Sine In Out': (t) => -0.5 * (Math.cos(Math.PI * t) - 1),

  // Quad
  'Quad In': (t) => t * t,
  'Quad Out': (t) => t * (2 - t),
  'Quad In Out': (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  // Cubic
  'Cubic In': (t) => t * t * t,
  'Cubic Out': (t) => {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
  },
  'Cubic In Out': (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),

  // Quart
  'Quart In': (t) => t * t * t * t,
  'Quart Out': (t) => {
    const t1 = t - 1;
    return 1 - t1 * t1 * t1 * t1;
  },
  'Quart In Out': (t) => {
    const t1 = t - 1;
    return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
  },

  // Quint
  'Quint In': (t) => t * t * t * t * t,
  'Quint Out': (t) => {
    const t1 = t - 1;
    return 1 + t1 * t1 * t1 * t1 * t1;
  },
  'Quint In Out': (t) => {
    const t1 = t - 1;
    return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * t1 * t1 * t1 * t1 * t1;
  },

  // Expo
  'Expo In': (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  'Expo Out': (t) => (t === 1 ? 1 : -Math.pow(2, -10 * t) + 1),
  'Expo In Out': (t) => {
    if (t === 0 || t === 1) return t;

    const scaledTime = t * 2;
    const scaledTime1 = scaledTime - 1;

    if (scaledTime < 1) {
      return 0.5 * Math.pow(2, 10 * scaledTime1);
    }

    return 0.5 * (-Math.pow(2, -10 * scaledTime1) + 2);
  },

  // Circ
  'Circ In': (t) => -1 * (Math.sqrt(1 - t * t) - 1),
  'Circ Out': (t) => {
    const t1 = t - 1;
    return Math.sqrt(1 - t1 * t1);
  },
  'Circ In Out': (t) => {
    const scaledTime = t * 2;
    const scaledTime1 = scaledTime - 2;

    if (scaledTime < 1) {
      return -0.5 * (Math.sqrt(1 - scaledTime * scaledTime) - 1);
    }

    return 0.5 * (Math.sqrt(1 - scaledTime1 * scaledTime1) + 1);
  },

  // Back
  'Back In': (t) => {
    const magnitude = 1.70158;
    return t * t * ((magnitude + 1) * t - magnitude);
  },
  'Back Out': (t) => {
    const magnitude = 1.70158;
    const scaledTime = t - 1;
    return scaledTime * scaledTime * ((magnitude + 1) * scaledTime + magnitude) + 1;
  },
  'Back In Out': (t) => {
    const magnitude = 1.70158;
    const scaledTime = t * 2;
    const scaledTime2 = scaledTime - 2;
    const s = magnitude * 1.525;

    if (scaledTime < 1) {
      return 0.5 * scaledTime * scaledTime * ((s + 1) * scaledTime - s);
    }

    return 0.5 * (scaledTime2 * scaledTime2 * ((s + 1) * scaledTime2 + s) + 2);
  },

  // Elastic
  'Elastic In': (t) => {
    const magnitude = 0.7;

    if (t === 0 || t === 1) return t;

    const scaledTime1 = t - 1;
    const p = 1 - magnitude;
    const s = (p / (2 * Math.PI)) * Math.asin(1);

    return -(Math.pow(2, 10 * scaledTime1) * Math.sin(((scaledTime1 - s) * (2 * Math.PI)) / p));
  },
  'Elastic Out': (t) => {
    const magnitude = 0.7;
    const p = 1 - magnitude;
    const scaledTime = t * 2;

    if (t === 0 || t === 1) return t;

    const s = (p / (2 * Math.PI)) * Math.asin(1);
    return Math.pow(2, -10 * scaledTime) * Math.sin(((scaledTime - s) * (2 * Math.PI)) / p) + 1;
  },
  'Elastic In Out': (t) => {
    const magnitude = 0.65;
    const p = 1 - magnitude;

    if (t === 0 || t === 1) return t;

    const scaledTime = t * 2;
    const scaledTime1 = scaledTime - 1;
    const s = (p / (2 * Math.PI)) * Math.asin(1);

    if (scaledTime < 1) {
      return (
        -0.5 * (Math.pow(2, 10 * scaledTime1) * Math.sin(((scaledTime1 - s) * (2 * Math.PI)) / p))
      );
    }

    return (
      Math.pow(2, -10 * scaledTime1) * Math.sin(((scaledTime1 - s) * (2 * Math.PI)) / p) * 0.5 + 1
    );
  },

  // Bounce
  'Bounce In': (t) => 1 - easeFunctions['Bounce Out'](1 - t),
  'Bounce Out': (t) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      const scaledTime = t - 1.5 / 2.75;
      return 7.5625 * scaledTime * scaledTime + 0.75;
    } else if (t < 2.5 / 2.75) {
      const scaledTime = t - 2.25 / 2.75;
      return 7.5625 * scaledTime * scaledTime + 0.9375;
    } else {
      const scaledTime = t - 2.625 / 2.75;
      return 7.5625 * scaledTime * scaledTime + 0.984375;
    }
  },
  'Bounce In Out': (t) =>
    t < 0.5
      ? easeFunctions['Bounce In'](t * 2) * 0.5
      : easeFunctions['Bounce Out'](t * 2 - 1) * 0.5 + 0.5,
};
