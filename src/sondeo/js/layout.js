import { params, scan, maask, cnv, layout, shift, scaling, rotation, g } from './state.js';
import { scanArea } from './app.js';

export function layoutMode(p) {
  switch (layout.mode) {
    case "side":
      showImageOnCanvas(p,
        -cnv.width / 2 + cnv.uiSize,
        0,
        -cnv.offSide,
        true,
        true,
        cnv.bgSource,
        cnv.stroke,
        cnv.gap,
        g.source,
        false
      );
      showImageOnCanvas(p,
        cnv.width / 2 + cnv.uiSize,
        0,
        cnv.offSide,
        true,
        true,
        cnv.bgResult,
        cnv.stroke,
        cnv.gap,
        g.result,
        true
      );
      if (params.mode === "mask") maskMode(p);
      showSourceProgress(p, -cnv.width / 2 - cnv.offSide + cnv.uiSize, 0);
      showResultProgress(p, cnv.width / 2 + cnv.offSide + cnv.uiSize, 0);
      break;

    case "layer":
      showImageOnCanvas(p,
        cnv.uiSize,
        0,
        0,
        true,
        true,
        cnv.bgResult,
        cnv.stroke,
        cnv.gap,
        g.source,
        true
      );
      if (scan.action) {
        p.push();
        p.translate(cnv.uiSize, 0);
        p.noStroke();
        if (scan.type === "horizontal") {
          scan.line.x2 = scan.position / scan.ratio;
        } else if (scan.type === "vertical") {
          scan.line.y2 = scan.position / scan.ratio;
        }
        p.fill(maask.scanColor);
        p.rect(scan.frame.x1, scan.frame.y1, scan.line.x2, scan.line.y2);
        p.pop();
      }
      showImageOnCanvas(p,
        cnv.uiSize,
        0,
        0,
        false,
        true,
        cnv.bgResult,
        cnv.stroke,
        cnv.gap,
        g.result,
        false
      );
      if (params.mode === "mask") maskMode(p);
      showSourceProgress(p, cnv.uiSize, 0);
      break;
  }
}

export function showImageOnCanvas(
  p,
  x,
  y,
  canvasOffset,
  isFill,
  isStroke,
  fillColor,
  strokeColor,
  frameOffset,
  gImg,
  isCheckboard
) {
  p.push();
  p.translate(x + canvasOffset, y);
  if (isCheckboard) checkBoard(p, cnv.width, cnv.height, frameOffset);
  isStroke ? p.stroke(strokeColor) : p.noStroke();
  isFill ? p.fill(fillColor) : p.noFill();
  p.rect(-frameOffset, -frameOffset, cnv.width + frameOffset, cnv.height + frameOffset);
  if (gImg) {
    p.image(gImg, 0, 0, cnv.width, cnv.height);
  }
  p.pop();
}

// Draws the scan head line in #0c8ce9 with a softly pulsing glow shadow.
function drawScanLine(p, x1, y1, x2, y2) {
  const pulse = 0.5 + 0.5 * Math.sin(p.frameCount * 0.08);
  const blur  = 6 + pulse * 10;          // 6..16px
  const alpha = Math.round(120 + pulse * 100); // 120..220
  const ctx = p.drawingContext;
  ctx.save();
  ctx.shadowColor = `rgba(12,140,233,${(alpha / 255).toFixed(2)})`;
  ctx.shadowBlur  = blur;
  p.stroke(scan.lineColor);
  p.strokeWeight(1.5);
  p.line(x1, y1, x2, y2);
  ctx.restore();
}

export function showSourceProgress(p, x, y) {
  p.push();
  p.translate(x, y);

  if (params.mode === "scan") {
    p.noStroke();
    p.fill(maask.fill);
    vertexMask(p, scan.frame.x1, scan.frame.y1, scan.frame.x2, scan.frame.y2);

    if (scan.type === "horizontal") {
      scan.line.x1 = scan.position / scan.ratio;
      scan.line.x2 = scan.position / scan.ratio;
    } else if (scan.type === "vertical") {
      scan.line.y1 = scan.position / scan.ratio;
      scan.line.y2 = scan.position / scan.ratio;
    }

    drawScanLine(p, scan.line.x1, scan.line.y1, scan.line.x2, scan.line.y2);

    switch (params.aniTab) {
      case 0:
        if (shift.type.x !== "none") showTransformArea(p, shift.xArea.min, shift.xArea.max);
        break;

      case 1:
        if (shift.type.y !== "none") showTransformArea(p, shift.yArea.min, shift.yArea.max);
        break;

      case 2:
        if (scaling.type !== "none") showTransformArea(p, scaling.area.min, scaling.area.max);
        break;

      case 3:
        if (rotation.type !== "none") showTransformArea(p, rotation.area.min, rotation.area.max);
        break;
    }
  }

  if (params.mode === "mask") {
    p.stroke(maask.stroke);
    p.fill(maask.fill);
    if (p.mouseIsPressed && cnv.mouseOver) {
      p.noStroke();
      vertexMask(p,
        maask.x1 / cnv.density,
        maask.y1 / cnv.density,
        maask.x2 / cnv.density,
        maask.y2 / cnv.density
      );
      p.stroke(maask.stroke);
      p.noFill();
      p.rect(
        maask.x1 / cnv.density,
        maask.y1 / cnv.density,
        maask.x2 / cnv.density,
        maask.y2 / cnv.density
      );
    } else {
      p.noStroke();
      vertexMask(p, scan.frame.x1, scan.frame.y1, scan.frame.x2, scan.frame.y2);
      p.stroke(maask.stroke);
      p.noFill();
      p.rect(scan.frame.x1, scan.frame.y1, scan.frame.x2, scan.frame.y2);
    }
  }
  p.pop();
}

export function showResultProgress(p, x, y) {
  p.push();
  p.translate(x, y);

  if (params.mode === "scan") {
    if (scan.type === "horizontal") {
      scan.line.x1 = scan.position / scan.ratio;
      scan.line.x2 = scan.position / scan.ratio;
    } else if (scan.type === "vertical") {
      scan.line.y1 = scan.position / scan.ratio;
      scan.line.y2 = scan.position / scan.ratio;
    }
    drawScanLine(p, scan.line.x1, scan.line.y1, scan.line.x2, scan.line.y2);
  }

  if (params.mode === "mask") {
    p.stroke(maask.stroke);
    p.noFill();
    if (p.mouseIsPressed && cnv.mouseOver) {
      p.rect(
        maask.x1 / cnv.density,
        maask.y1 / cnv.density,
        maask.x2 / cnv.density,
        maask.y2 / cnv.density
      );
    } else {
      p.drawingContext.setLineDash([0, 0]);
      p.rect(scan.frame.x1, scan.frame.y1, scan.frame.x2, scan.frame.y2);
    }
    p.line(params.cmouse.x - 5, params.cmouse.y, params.cmouse.x + 5, params.cmouse.y);
    p.line(params.cmouse.x, params.cmouse.y - 5, params.cmouse.x, params.cmouse.y + 5);
  }

  p.pop();
}

function vertexMask(p, x1, y1, x2, y2) {
  if (x1 - x2 > 0) [x1, x2] = [x2, x1];
  if (y1 - y2 > 0) [y1, y2] = [y2, y1];
  p.beginShape();
  p.vertex(0, cnv.height);
  p.vertex(cnv.width, cnv.height);
  p.vertex(cnv.width, 0);
  p.vertex(0, 0);
  p.beginContour();
  p.vertex(x1, y1);
  p.vertex(x2, y1);
  p.vertex(x2, y2);
  p.vertex(x1, y2);
  p.endContour();
  p.endShape(p.CLOSE);
}

function checkBoard(p, width, height, frameOffset) {
  p.push();
  p.noStroke();
  p.fill(cnv.bgSource);
  p.rect(-frameOffset, -frameOffset, cnv.width + frameOffset, cnv.height + frameOffset);
  let size = 11;
  let xBool = true;
  let yBool;

  let modY = height % size;
  let modX = width % size;
  let divY = modY / (height / size);
  let divX = modX / (width / size);

  for (let y = 0; y < height - modY; y += size + divY) {
    xBool = !xBool;
    yBool = !xBool;
    for (let x = 0; x < width - modX; x += size + divX) {
      yBool = !yBool;
      yBool ? p.fill(255) : p.fill(220);
      p.rect(x, y, x + (size + divX), y + (size + divY));
    }
  }
  p.pop();
}

function showTransformArea(p, areaMin, areaMax) {
  p.push();
  let rArray;
  p.drawingContext.setLineDash([4, 4]);
  p.stroke(scan.lineColor);
  if (scan.type === "horizontal") {
    rArray = showBoundaries(p, areaMin / 100, areaMax / 100, scan.area.x2 - scan.area.x1);
    p.line(scan.frame.x1 + rArray[0], scan.frame.y1, scan.frame.x1 + rArray[0], scan.frame.y2);
    p.line(scan.frame.x1 + rArray[1], scan.frame.y1, scan.frame.x1 + rArray[1], scan.frame.y2);
  } else if (scan.type === "vertical") {
    rArray = showBoundaries(p, areaMin / 100, areaMax / 100, scan.area.y2 - scan.area.y1);
    p.line(scan.frame.x1, scan.frame.y1 + rArray[0], scan.frame.x2, scan.frame.y1 + rArray[0]);
    p.line(scan.frame.x1, scan.frame.y1 + rArray[1], scan.frame.x2, scan.frame.y1 + rArray[1]);
  }
  p.pop();
}

function showBoundaries(p, min, max, duration) {
  let start, end, mod;
  start = p.round(duration * min);
  end = p.round(duration - duration * max);
  mod = start % scan.speed;
  start -= mod;
  mod = end % scan.speed;
  end -= mod;
  return [start / scan.ratio, (duration - end) / scan.ratio];
}

export function maskMode(p) {
  if (p.mouseIsPressed && cnv.mouseOver) {
    if (maask.first) {
      maask.x1 = params.mouse.x;
      maask.y1 = params.mouse.y;
      maask.first = false;
    }
    maask.x2 = params.mouse.x;
    maask.y2 = params.mouse.y;
    maask.draw = true;
  } else {
    maask.first = true;
    if (maask.draw) {
      maask.draw = false;
      if (maask.x1 - maask.x2 > 0) [maask.x1, maask.x2] = [maask.x2, maask.x1];
      if (maask.y1 - maask.y2 > 0) [maask.y1, maask.y2] = [maask.y2, maask.y1];
      scanArea();
    }
  }
}
