import { params, scaling, scan, g } from './state.js';
import { randomSystem } from './random.js';
import { map2, IN, OUT, BOTH } from './map2.js';

export function scalingMode(p) {
  if (scaling.type === "none") {
    scaling.frame = 0;
    scaling.value = 0;
  } else {
    let scanLength, duration, start, end, mod, frame, value, freq;
    if (scan.type === "horizontal") {
      duration = scan.area.x2 - scan.area.x1;
    } else if (scan.type === "vertical") {
      duration = scan.area.y2 - scan.area.y1;
    }

    start = p.round(duration * (scaling.area.min / 100));
    end = p.round(duration * (scaling.area.max / 100));
    mod = start % scan.speed;
    start -= mod;
    mod = end % scan.speed;
    end -= mod;
    scanLength = Math.abs(end - start);

    switch (scaling.type) {
      case "linear":
        scaling.linear <= 100
          ? (value = p.map(scaling.linear, 50, 100, -0.5, 0))
          : (value = p.map(scaling.linear, 100, 200, 0, 1));
        frame = value / (scanLength / scan.speed);
        scaling.value = map2(scaling.frame, 0, value, 0, value, scaling.transition, scaling.ease);
        if (scan.action && params.frame >= start && params.frame < end) scaling.frame += frame;
        break;

      case "periodic":
        scaling.period <= 100
          ? (value = p.map(scaling.period, 50, 100, 0.5, 0))
          : (value = p.map(scaling.period, 100, 200, 0, -1));
        frame = scaling.cycle / (scanLength / scan.speed);
        scaling.value = Math.abs(((2 * scaling.frame + scaling.phase) % 2) - 1);
        scaling.value =
          map2(scaling.value, 0, 1, 0, 1, scaling.transition, scaling.ease) * value - value;
        if (scan.action && params.frame >= start && params.frame < end) scaling.frame += frame;
        scaling.value += value * scaling.phase;
        break;

      case "noise":
        value = p.radians(map2(scaling.noise, 0, 100, 0, 0.5, "Linear", 0));
        freq = map2(scaling.freq, 0.01, 1, 0.002, 0.5, "Quadratic", 0);
        frame = p.map(randomSystem.simplexScale.noise2D(scaling.frame * freq, 1), -1, 1, -value, value);
        frame *= scan.speed;
        if (scan.action && params.frame >= start && params.frame < end) scaling.frame += scan.speed;
        if (scan.action && params.frame >= start && params.frame < end) scaling.value += frame;
        break;
    }
    g.source.scale(1 + scaling.value);
  }

  let s;
  let target = scaling.base;
  let temp = target - scaling.start;
  scaling.start += temp * params.easing;
  if (Math.abs(scaling.base - scaling.start) < 0.001) scaling.start = scaling.base;
  scaling.start <= 100
    ? (s = p.map(scaling.start, 50, 100, 0.5, 1))
    : (s = p.map(scaling.start, 100, 200, 1, 2));
  g.source.scale(s);
}
