import { params, shift, scan, g } from './state.js';
import { randomSystem } from './random.js';
import { map2, IN, OUT, BOTH } from './map2.js';

export function restartShiftXAnimation() {
  shift.frame.x = 0;
  shift.value.x = 0;
}

export function restartShiftYAnimation() {
  shift.frame.y = 0;
  shift.value.y = 0;
}

export function shiftXMode(p) {
  if (shift.type.x === "none") {
    shift.frame.x = 0;
    shift.value.x = 0;
    shift.size.x = 0;
  } else {
    let duration, start, end, mod, frame, value, freq;
    let scanSize = scan.area.x2 - scan.area.x1;

    if (scan.type === "horizontal") {
      duration = scan.area.x2 - scan.area.x1;
    } else if (scan.type === "vertical") {
      duration = scan.area.y2 - scan.area.y1;
    }

    start = p.round(duration * (shift.xArea.min / 100));
    end = p.round(duration * (shift.xArea.max / 100));
    mod = start % scan.speed;
    start -= mod;
    mod = end % scan.speed;
    end -= mod;
    shift.size.x = p.abs(end - start);

    switch (shift.type.x) {
      case "linear":
        value = p.map(shift.linear.x, -200, 200, -shift.size.x * 2, shift.size.x * 2) + 0.0001;
        frame = value / (shift.size.x / scan.speed);
        shift.value.x = map2(shift.frame.x, 0, value, 0, value, shift.transition.x, shift.ease.x);
        if (scan.action && params.frame >= start && params.frame < end) shift.frame.x += frame;
        break;

      case "periodic":
        value = p.map(shift.period.x, -50, 50, scanSize / 2, -scanSize / 2);
        frame = shift.cycle.x / (shift.size.x / scan.speed);
        shift.value.x = Math.abs(((2 * shift.frame.x + shift.phase.x) % 2) - 1);
        shift.value.x =
          map2(shift.value.x, 0, 1, 0, 1, shift.transition.x, shift.ease.x) * value - value * 1;
        if (scan.action && params.frame >= start && params.frame < end) shift.frame.x += frame;
        shift.value.x += value * shift.phase.x;
        break;

      case "noise":
        value = p.radians(p.map(shift.noise.x, 0, 100, 0, scanSize / 2));
        freq = map2(shift.freq.x, 0.01, 1, 0.002, 0.5, "Quadratic", 0);
        frame = p.map(randomSystem.simplexShiftX.noise2D(shift.frame.x * freq, 1), -1, 1, -value, value);
        frame *= scan.speed;
        if (scan.action && params.frame >= start && params.frame < end) shift.frame.x += scan.speed;
        if (scan.action && params.frame >= start && params.frame < end) shift.value.x += frame;
        break;
    }

    g.source.translate(shift.value.x, 0);
  }
}

export function shiftYMode(p) {
  // Animation shift Y
  if (shift.type.y === "none") {
    shift.frame.y = 0;
    shift.value.y = 0;
    shift.size.y = 0;
  } else {
    let duration, start, end, mod, frame, value, freq;
    let scanSize = scan.area.y2 - scan.area.y1;

    if (scan.type === "horizontal") {
      duration = scan.area.x2 - scan.area.x1;
    } else if (scan.type === "vertical") {
      duration = scan.area.y2 - scan.area.y1;
    }

    start = p.round(duration * (shift.yArea.min / 100));
    end = p.round(duration * (shift.yArea.max / 100));
    mod = start % scan.speed;
    start -= mod;
    mod = end % scan.speed;
    end -= mod;
    shift.size.y = Math.abs(end - start);

    switch (shift.type.y) {
      case "linear":
        value = p.map(shift.linear.y, -200, 200, -shift.size.y * 2, shift.size.y * 2) + 0.0001;
        frame = value / (shift.size.y / scan.speed);
        shift.value.y = map2(shift.frame.y, 0, value, 0, value, shift.transition.y, shift.ease.y);
        if (scan.action && params.frame >= start && params.frame < end) shift.frame.y += frame;
        break;

      case "periodic":
        value = p.map(shift.period.y, -50, 50, scanSize / 2, -scanSize / 2);
        frame = shift.cycle.y / (shift.size.y / scan.speed);
        shift.value.y = Math.abs(((2 * shift.frame.y + shift.phase.y) % 2) - 1);
        shift.value.y =
          map2(shift.value.y, 0, 1, 0, 1, shift.transition.y, shift.ease.y) * value - value * 1;
        if (scan.action && params.frame >= start && params.frame < end) shift.frame.y += frame;
        shift.value.y += value * shift.phase.y;
        break;

      case "noise":
        value = p.radians(p.map(shift.noise.y, 0, 100, 0, scanSize / 2));
        freq = map2(shift.freq.y, 0.01, 1, 0.002, 0.5, "Quadratic", 0);
        frame = p.map(randomSystem.simplexShiftY.noise2D(shift.frame.y * freq, 1), -1, 1, -value, value);
        frame *= scan.speed;
        if (scan.action && params.frame >= start && params.frame < end) shift.frame.y += scan.speed;
        if (scan.action && params.frame >= start && params.frame < end) shift.value.y += frame;
        break;
    }

    g.source.translate(0, shift.value.y);
  }

  let targetX = p.map(shift.base.x, -100, 100, -g.source.width, g.source.width);
  let targetY = p.map(shift.base.y, -100, 100, -g.source.height, g.source.height);
  let tempX = targetX - shift.start.x;
  let tempY = targetY - shift.start.y;
  shift.start.x += tempX * params.easing;
  shift.start.y += tempY * params.easing;

  if (Math.abs(shift.base.x - shift.start.x) < 0.001) shift.start.x = shift.base.x;
  if (Math.abs(shift.base.y - shift.start.y) < 0.001) shift.start.y = shift.base.y;
  shift.start.x <= 0
    ? (shift.start.x = p.ceil(p.round(shift.start.x * 100) / 100))
    : (shift.start.x = p.floor(p.round(shift.start.x * 100) / 100));
  shift.start.y <= 0
    ? (shift.start.y = p.ceil(p.round(shift.start.y * 100) / 100))
    : (shift.start.y = p.floor(p.round(shift.start.y * 100) / 100));

  g.source.translate(shift.start.x, shift.start.y);
}
