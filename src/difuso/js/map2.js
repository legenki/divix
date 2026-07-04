// DIFUSO — map2.js — easing-aware map().
// Via Manohar Vanga / Jeff Thompson (sighack easing functions).
// Factory injects the p5 instance for pow/cos/sin/sqrt/PI.
//
// Ported verbatim from the original tool's map2.js. The `when` argument is
// numeric: IN = 0, OUT = 1, BOTH = 2 (matching the original, where callers
// pass e.g. `'Exponential', 1` = ease-OUT).

export function createMap2(p) {
  const IN = 0,
    OUT = 1,
    BOTH = 2;

  function map2(value, start1, stop1, start2, stop2, type, when) {
    let b = start2;
    let c = stop2 - start2;
    let t = value - start1;
    let d = stop1 - start1;
    let pw = 0.5;

    switch (type) {
      case 'Linear':
        return (c * t) / d + b;

      case 'Sqrt':
        if (when === IN) {
          t /= d;
          return c * p.pow(t, pw) + b;
        } else if (when === OUT) {
          t /= d;
          return c * (1 - p.pow(1 - t, pw)) + b;
        } else if (when === BOTH) {
          t /= d / 2;
          if (t < 1) return (c / 2) * p.pow(t, pw) + b;
          return (c / 2) * (2 - p.pow(2 - t, pw)) + b;
        }
        break;

      case 'Quadratic':
        if (when === IN) {
          t /= d;
          return c * t * t + b;
        } else if (when === OUT) {
          t /= d;
          return -c * t * (t - 2) + b;
        } else if (when === BOTH) {
          t /= d / 2;
          if (t < 1) return (c / 2) * t * t + b;
          t--;
          return (-c / 2) * (t * (t - 2) - 1) + b;
        }
        break;

      case 'Cubic':
        if (when === IN) {
          t /= d;
          return c * t * t * t + b;
        } else if (when === OUT) {
          t /= d;
          t--;
          return c * (t * t * t + 1) + b;
        } else if (when === BOTH) {
          t /= d / 2;
          if (t < 1) return (c / 2) * t * t * t + b;
          t -= 2;
          return (c / 2) * (t * t * t + 2) + b;
        }
        break;

      case 'Quartic':
        if (when === IN) {
          t /= d;
          return c * t * t * t * t + b;
        } else if (when === OUT) {
          t /= d;
          t--;
          return -c * (t * t * t * t - 1) + b;
        } else if (when === BOTH) {
          t /= d / 2;
          if (t < 1) return (c / 2) * t * t * t * t + b;
          t -= 2;
          return (-c / 2) * (t * t * t * t - 2) + b;
        }
        break;

      case 'Quintic':
        if (when === IN) {
          t /= d;
          return c * t * t * t * t * t + b;
        } else if (when === OUT) {
          t /= d;
          t--;
          return c * (t * t * t * t * t + 1) + b;
        } else if (when === BOTH) {
          t /= d / 2;
          if (t < 1) return (c / 2) * t * t * t * t * t + b;
          t -= 2;
          return (c / 2) * (t * t * t * t * t + 2) + b;
        }
        break;

      case 'Sinusoidal':
        if (when === IN) {
          return -c * p.cos((t / d) * (p.PI / 2)) + c + b;
        } else if (when === OUT) {
          return c * p.sin((t / d) * (p.PI / 2)) + b;
        } else if (when === BOTH) {
          return (-c / 2) * (p.cos((p.PI * t) / d) - 1) + b;
        }
        break;

      case 'Exponential':
        if (when === IN) {
          return c * p.pow(2, 10 * (t / d - 1)) + b;
        } else if (when === OUT) {
          return c * (-p.pow(2, (-10 * t) / d) + 1) + b;
        } else if (when === BOTH) {
          t /= d / 2;
          if (t < 1) return (c / 2) * p.pow(2, 10 * (t - 1)) + b;
          t--;
          return (c / 2) * (-p.pow(2, -10 * t) + 2) + b;
        }
        break;

      case 'Circular':
        if (when === IN) {
          t /= d;
          return -c * (p.sqrt(1 - t * t) - 1) + b;
        } else if (when === OUT) {
          t /= d;
          t--;
          return c * p.sqrt(1 - t * t) + b;
        } else if (when === BOTH) {
          t /= d / 2;
          if (t < 1) return (-c / 2) * (p.sqrt(1 - t * t) - 1) + b;
          t -= 2;
          return (c / 2) * (p.sqrt(1 - t * t) + 1) + b;
        }
        break;
    }

    return 0;
  }

  return map2;
}
