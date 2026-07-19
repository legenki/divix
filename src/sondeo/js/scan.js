import { scan, shade, grain, shift, scaling, rotation, maap, g } from './state.js';
import { randomSystem } from './random.js';
import { map2 } from './map2.js';
import { scanComplete } from './app.js';

/**
 * Fast strip copy via a canvas blit when shade/grain are off. Avoids the
 * intermediate p5.Image allocations from get()/set() on every scan step.
 * The strip is cleared first because image() alpha-blends over the previous
 * result, while this path must replace pixels (incl. alpha) like set() did.
 */
function copyStripPixels(sx, sy, sw, sh) {
  if (!g.source || !g.result) return false;
  g.result.drawingContext.clearRect(sx, sy, sw, sh);
  g.result.image(g.source, sx, sy, sw, sh, sx, sy, sw, sh);
  return true;
}

export function startScanning(p) {
  let size, mod;
  const needsModify = shade.apply !== 'none' || grain.type !== 'none';
  switch (scan.type) {
    case "horizontal":
      size = scan.area.x2 - scan.area.x1;
      mod = size % scan.speed;
      if (scan.position <= scan.area.x2 - mod) {
        const sw = scan.speed;
        const sh = scan.area.y2 - scan.area.y1;
        if (!needsModify) {
          copyStripPixels(scan.position, scan.area.y1, sw, sh);
        } else {
          let c = g.source.get(scan.position, scan.area.y1, sw, sh);
          c = modifyScan(p, c);
          // Clear first: alpha shade mode must replace the strip, not blend
          // into the previous scan's pixels (see copyStripPixels).
          g.result.drawingContext.clearRect(scan.position, scan.area.y1, sw, sh);
          g.result.image(c, scan.position, scan.area.y1);
        }
        scan.position += scan.speed;
      } else {
        scanComplete();
      }
      break;

    case "vertical":
      size = scan.area.y2 - scan.area.y1;
      mod = size % scan.speed;
      if (scan.position <= scan.area.y2 - mod) {
        const sw = scan.area.x2 - scan.area.x1;
        const sh = scan.speed;
        if (!needsModify) {
          copyStripPixels(scan.area.x1, scan.position, sw, sh);
        } else {
          let c = g.source.get(scan.area.x1, scan.position, sw, sh);
          c = modifyScan(p, c);
          g.result.drawingContext.clearRect(scan.area.x1, scan.position, sw, sh);
          g.result.image(c, scan.area.x1, scan.position);
        }
        scan.position += scan.speed;
      } else {
        scanComplete();
      }
      break;
  }
}

function modifyScan(p, c) {
  c.loadPixels();
  let noise,
    shading,
    n1,
    n2,
    width,
    height,
    offset,
    shadeOffset,
    grainShading,
    grainNoise,
    grainOpacity;
  let linearType = 0;

  grain.type === "none" ? (grainOpacity = 0) : (grainOpacity = grain.opacity);
  let coarseLevel = getCoarse(p);

  if (scan.type === "horizontal") {
    width = c.width;
    height = c.height;
    shadeOffset = c.height;
  } else if (scan.type === "vertical") {
    width = c.height;
    height = c.width;
    shadeOffset = c.width;
  }

  switch (shade.apply) {
    case "none":
      shading = 0;
      offset = 0;
      break;

    case "mouse":
      if (scan.type === "horizontal") {
        shading = map2(
          maap.shade.x * 0.25 + maap.shade.y,
          -c.height,
          c.height,
          -shade.mult,
          shade.mult,
          "Cubic",
          2
        );
        offset = -(maap.shade.y * shade.angle) / shadeOffset;
      } else if (scan.type === "vertical") {
        shading = map2(
          maap.shade.x + maap.shade.y * 0.25,
          -c.width,
          c.width,
          -shade.mult,
          shade.mult,
          "Cubic",
          2
        );
        offset = -(maap.shade.x * shade.angle) / shadeOffset;
      }
      break;

    case "aShiftX":
      if (shift.type.x === "none") shading = 0;
      if (shift.type.x === "linear") {
        shift.linear.x < 0 ? (shading = shade.mult * 0.1) : (shading = -shade.mult * 0.1);
        linearType = 1;
        if (shift.size.x === 0) shading = 0;
      }
      if (shift.type.x === "periodic") {
        shift.type.x < 0
          ? (shading = map2(
              shift.value.x,
              p.map(shift.period.x, -50, 0, (scan.area.x2 - scan.area.x1) * 0.5, 0),
              0,
              shade.mult * 0.2,
              0,
              "Cubic",
              2
            ))
          : (shading = map2(
              shift.value.x,
              0,
              p.map(shift.period.x, 0, 50, 0, (scan.area.x2 - scan.area.x1) * 0.5),
              0,
              -shade.mult * 0.2,
              "Cubic",
              2
            ));
        if (shift.period.x === 0) shading = 0;
      }
      if (shift.type.x === "noise")
        shading = map2(
          shift.value.x,
          -g.source.width,
          g.source.width,
          shade.mult,
          -shade.mult,
          "Cubic",
          2
        );
      offset = -(shift.value.x * shade.angle) / shadeOffset;
      break;

    case "aShiftY":
      if (shift.type.y === "none") shading = 0;
      if (shift.type.y === "linear") {
        shift.linear.y < 0 ? (shading = shade.mult * 0.1) : (shading = -shade.mult * 0.1);
        linearType = 1;
        if (shift.size.y === 0) shading = 0;
      }
      if (shift.type.y === "periodic") {
        shift.type.y < 0
          ? (shading = map2(
              shift.value.y,
              p.map(shift.period.y, -50, 0, (scan.area.y2 - scan.area.y1) * 0.5, 0),
              0,
              shade.mult * 0.2,
              0,
              "Cubic",
              2
            ))
          : (shading = map2(
              shift.value.y,
              0,
              p.map(shift.period.y, 0, 50, 0, (scan.area.y2 - scan.area.y1) * 0.5),
              0,
              -shade.mult * 0.2,
              "Cubic",
              2
            ));
        if (shift.period.y === 0) shading = 0;
      }
      if (shift.type.y === "noise")
        shading = map2(
          shift.value.y,
          -g.source.height,
          g.source.height,
          shade.mult,
          -shade.mult,
          "Cubic",
          2
        );
      offset = -(shift.value.y * shade.angle) / shadeOffset;
      break;

    case "aScale":
      if (scaling.type === "none") shading = 0;
      if (scaling.type === "linear") {
        scaling.linear < 100 ? (shading = shade.mult * 0.1) : (shading = -shade.mult * 0.1);
        linearType = 1;
        if (scaling.linear === 100) shading = 0;
      }
      if (scaling.type === "periodic") {
        scaling.period < 100
          ? (shading = map2(
              scaling.value,
              p.map(scaling.period, 50, 100, -0.5, 0),
              0,
              -shade.mult * 0.2,
              0,
              "Cubic",
              2
            ))
          : (shading = map2(
              scaling.value,
              0,
              p.map(scaling.period, 100, 200, 0, 1),
              0,
              shade.mult * 0.2,
              "Cubic",
              2
            ));
        if (scaling.period === 100) shading = 0;
      }
      if (scaling.type === "noise")
        shading = map2(scaling.value, -1, 1, -shade.mult * 0.5, shade.mult * 0.25, "Cubic", 2);
      offset = -(p.map(scaling.value, -1, 1, -shadeOffset, shadeOffset) * shade.angle) / shadeOffset;
      break;

    case "aRotate":
      if (rotation.type === "none") shading = 0;
      if (rotation.type === "linear") {
        rotation.linear < 0 ? (shading = shade.mult * 0.1) : (shading = -shade.mult * 0.1);
        linearType = 1;
        if (rotation.linear === 0) shading = 0;
      }
      if (rotation.type === "periodic") {
        rotation.period < 0
          ? (shading = map2(
              rotation.value,
              p.map(rotation.period, -90, 0, -p.HALF_PI, 0),
              0,
              shade.mult * 0.2,
              0,
              "Cubic",
              2
            ))
          : (shading = map2(
              rotation.value,
              0,
              p.map(rotation.period, 0, 90, 0, p.HALF_PI),
              0,
              -shade.mult * 0.2,
              "Cubic",
              2
            ));
        if (rotation.period === 0) shading = 0;
      }
      if (rotation.type === "noise")
        shading = map2(
          rotation.value,
          -p.HALF_PI,
          p.HALF_PI,
          shade.mult * 0.4,
          -shade.mult * 0.4,
          "Cubic",
          2
        );
      offset =
        -(p.map(rotation.value, -p.PI, p.PI, -shadeOffset, shadeOffset) * shade.angle) / shadeOffset;
      break;
  }

  shading = Math.min(Math.max(shading, -5), 5);
  shading *= shade.level;

  if (shade.type === "light" || shade.type === "dark") {
    shading = Math.abs(shading);
    linearType = 0;
  }

  grain.type === "shade" ? (grainShading = Math.abs(shading * 0.5) + 0.25) : (grainShading = 1);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let i;
      if (scan.type === "horizontal") {
        i = (x + y * c.width) * 4;
      } else if (scan.type === "vertical") {
        i = (y + x * c.width) * 4;
      }

      grainNoise = randomSystem.simplexGrain.noise2D(grain.xoff - offset, grain.yoff);
      noise = randomSystem.simplexShade.noise2D(shade.xoff - offset, shade.frame);
      noise = (noise + (1 - linearType)) / (2 - linearType);

      n1 = 128 * shading * noise;
      n2 = 96 * grainShading * grainNoise * grainOpacity;

      switch (shade.type) {
        case "light":
        case "light/dark":
          c.pixels[i + 0] += n1;
          c.pixels[i + 1] += n1;
          c.pixels[i + 2] += n1;
          break;

        case "dark":
        case "dark/light":
          c.pixels[i + 0] -= n1;
          c.pixels[i + 1] -= n1;
          c.pixels[i + 2] -= n1;
          break;

        case "alpha":
          c.pixels[i + 3] -= Math.abs(n1);
          break;
      }

      if (shade.type === "alpha") {
        c.pixels[i + 3] -= Math.abs(n2);
      } else {
        c.pixels[i + 0] += n2;
        c.pixels[i + 1] += n2;
        c.pixels[i + 2] += n2;
      }

      grain.xoff += coarseLevel;
      shade.xoff += shade.freqFine / shade.freqMult;
    }

    grain.xoff = 0;
    grain.yoff += coarseLevel;
    shade.xoff = 0;
    shade.frame += shade.freq / shade.freqMult;
  }
  c.updatePixels();
  return c;
}

export function prepareShade(imgSource) {
  let multX, multY, widthCheck, heightCheck, multXFreq, multYFreq;

  multX = multY = 0;
  multXFreq = multYFreq = 50;

  do {
    multX++;
    widthCheck = multX * 1000;
    if (imgSource.width >= imgSource.height) shade.freqMult = multXFreq * multX;
  } while (widthCheck < imgSource.width);

  do {
    multY++;
    heightCheck = multY * 1000;
    if (imgSource.height >= imgSource.width) shade.freqMult = multYFreq * multY;
  } while (heightCheck < imgSource.height);
}

function getCoarse(p) {
  let n;
  switch (Math.round(grain.coarse)) {
    case 1:
      n = 1 + p.random(10);
      break;
    case 2:
      n = 0.23 + p.random(0.03);
      break;
    case 3:
      n = 0.16 + p.random(0.02);
      break;
    case 4:
      n = 0.1 + p.random(0.01);
      break;
  }
  return n;
}
