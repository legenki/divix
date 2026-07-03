export const IN = 0;
export const OUT = 1;
export const BOTH = 2;

export function map2(value, start1, stop1, start2, stop2, type, when) {
  let b = start2;
  let c = stop2 - start2;
  let t = value - start1;
  let d = stop1 - start1;
  let p = 0.5;

  switch (type) {
    case "Linear":
      return (c * t) / d + b;

    case "Sqrt":
      if (when === IN) {
        t /= d;
        return c * Math.pow(t, p) + b;
      } else if (when === OUT) {
        t /= d;
        return c * (1 - Math.pow(1 - t, p)) + b;
      } else if (when === BOTH) {
        t /= d / 2;
        if (t < 1) return (c / 2) * Math.pow(t, p) + b;
        return (c / 2) * (2 - Math.pow(2 - t, p)) + b;
      }
      break;

    case "Quadratic":
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

    case "Cubic":
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

    case "Quartic":
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

    case "Quintic":
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

    case "Sinusoidal":
      if (when === IN) {
        return -c * Math.cos((t / d) * (Math.PI / 2)) + c + b;
      } else if (when === OUT) {
        return c * Math.sin((t / d) * (Math.PI / 2)) + b;
      } else if (when === BOTH) {
        return (-c / 2) * (Math.cos((Math.PI * t) / d) - 1) + b;
      }
      break;

    case "Exponential":
      if (when === IN) {
        return c * Math.pow(2, 10 * (t / d - 1)) + b;
      } else if (when === OUT) {
        return c * (-Math.pow(2, (-10 * t) / d) + 1) + b;
      } else if (when === BOTH) {
        t /= d / 2;
        if (t < 1) return (c / 2) * Math.pow(2, 10 * (t - 1)) + b;
        t--;
        return (c / 2) * (-Math.pow(2, -10 * t) + 2) + b;
      }
      break;

    case "Circular":
      if (when === IN) {
        t /= d;
        return -c * (Math.sqrt(1 - t * t) - 1) + b;
      } else if (when === OUT) {
        t /= d;
        t--;
        return c * Math.sqrt(1 - t * t) + b;
      } else if (when === BOTH) {
        t /= d / 2;
        if (t < 1) return (-c / 2) * (Math.sqrt(1 - t * t) - 1) + b;
        t -= 2;
        return (c / 2) * (Math.sqrt(1 - t * t) + 1) + b;
      }
      break;
  }

  return 0;
}
