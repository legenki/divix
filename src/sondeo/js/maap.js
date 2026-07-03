import { params, scan, maap, cnv, g } from './state.js';

export function maapUse(p) {
  if (p.mouseIsPressed && cnv.mouseOver) {
    maap.raw.x = p.map(p.mouseX, 0, cnv.width, 0, g.source.width);
    maap.raw.y = p.map(p.mouseY, 0, cnv.height, 0, g.source.height);
    let tempX = maap.raw.x - maap.mouse.x;
    let tempY = maap.raw.y - maap.mouse.y;
    maap.mouse.x += tempX * params.easing;
    maap.mouse.y += tempY * params.easing;

    if (maap.bool) {
      maap.bool = false;
      maap.delta.x = -maap.raw.x;
      maap.delta.y = -maap.raw.y;
      maap.mouse.x = maap.raw.x;
      maap.mouse.y = maap.raw.y;
      if (scan.action) maap.pos.x = maap.translate.x + maap.remaind.x;
      if (scan.action) maap.pos.y = maap.translate.y + maap.remaind.y;
    } else {
      if (!scan.action) maap.pos.x = maap.translate.x + maap.remaind.x;
      if (!scan.action) maap.pos.y = maap.translate.y + maap.remaind.y;
      if (scan.action) maap.shade.x = maap.pos.x - maap.translate.x;
      if (scan.action) maap.shade.y = maap.pos.y - maap.translate.y;
    }
    maap.translate.x = maap.mouse.x + maap.delta.x + maap.on.x;
    maap.translate.y = maap.mouse.y + maap.delta.y + maap.on.y;
  } else {
    if (!maap.bool) {
      maap.off.x = maap.on.x;
      maap.off.y = maap.on.y;
      maap.remaind.x = maap.shade.x;
      maap.remaind.y = maap.shade.y;
    }
    maap.bool = true;
    maap.on.x = maap.mouse.x + maap.delta.x + maap.off.x;
    maap.on.y = maap.mouse.y + maap.delta.y + maap.off.y;
    maap.translate.x = maap.mouse.x + maap.delta.x + maap.off.x;
    maap.translate.y = maap.mouse.y + maap.delta.y + maap.off.y;
  }

  let scanFade = 1.0 - scan.speed * 0.008;
  if (scan.type === "horizontal") {
    if (scan.action) maap.shade.x *= scanFade;
    if (scan.action) maap.remaind.x *= scanFade;
  } else if (scan.type === "vertical") {
    if (scan.action) maap.shade.y *= scanFade;
    if (scan.action) maap.remaind.y *= scanFade;
  }
}

export function maapClear() {
  maap.bool = true;
  maap.raw.x = 0;
  maap.raw.y = 0;
  maap.mouse.x = 0;
  maap.mouse.y = 0;
  maap.delta.x = 0;
  maap.delta.y = 0;
  maap.on.x = 0;
  maap.on.y = 0;
  maap.off.x = 0;
  maap.off.y = 0;
  maap.pos.x = 0;
  maap.pos.y = 0;
  maap.shade.x = 0;
  maap.shade.y = 0;
  maap.remaind.x = 0;
  maap.remaind.y = 0;
}
