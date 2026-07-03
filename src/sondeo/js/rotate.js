import { params, rotation, scan, g } from './state.js';
import { randomSystem } from './random.js';
import { map2, IN, OUT, BOTH } from './map2.js';

export function rotationMode(p) {
  if (rotation.type === "none") {
    rotation.frame = 0;
    rotation.value = 0;
  } else {
    let scanLength, duration, start, end, mod, frame, value, freq;
    if (scan.type === "horizontal") {
      duration = scan.area.x2 - scan.area.x1;
    } else if (scan.type === "vertical") {
      duration = scan.area.y2 - scan.area.y1;
    }

    start = p.round(duration * (rotation.area.min / 100));
    end = p.round(duration * (rotation.area.max / 100));
    mod = start % scan.speed;
    start -= mod;
    mod = end % scan.speed;
    end -= mod;
    scanLength = Math.abs(end - start);

    switch (rotation.type) {
      case "linear":
        value = p.map(rotation.linear, -180, 180, -p.PI, p.PI);
        frame = value / (scanLength / scan.speed);
        rotation.value = map2(
          rotation.frame,
          0,
          value,
          0,
          value,
          rotation.transition,
          rotation.ease
        );
        if (scan.action && params.frame >= start && params.frame < end) rotation.frame += frame;
        break;

      case "periodic":
        value = p.map(rotation.period, -90, 90, p.HALF_PI, -p.HALF_PI);
        frame = rotation.cycle / (scanLength / scan.speed);
        rotation.value = Math.abs(((2 * rotation.frame + rotation.phase) % 2) - 1);
        rotation.value =
          map2(rotation.value, 0, 1, 0, 1, rotation.transition, rotation.ease) * value - value;
        if (scan.action && params.frame >= start && params.frame < end) rotation.frame += frame;
        rotation.value += value * rotation.phase;
        break;

      case "noise":
        value = p.radians(map2(rotation.noise, 0, 100, 0, p.HALF_PI, "Linear", 0));
        freq = map2(rotation.freq, 0.01, 1, 0.002, 0.5, "Quadratic", 0);
        frame = p.map(randomSystem.simplexRotation.noise2D(rotation.frame * freq, 1), -1, 1, -value, value);
        frame *= scan.speed;
        if (scan.action && params.frame >= start && params.frame < end)
          rotation.frame += scan.speed;
        if (scan.action && params.frame >= start && params.frame < end) rotation.value += frame;
        break;
    }
    g.source.rotate(rotation.value);
  }

  let target = rotation.base;
  let temp = target - rotation.start;
  rotation.start += temp * params.easing;
  if (Math.abs(rotation.base - rotation.start) < 0.001) rotation.start = rotation.base;
  g.source.rotate(p.radians(rotation.start));
}
