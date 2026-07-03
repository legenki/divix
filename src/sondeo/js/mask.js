function maskMode() {
  if (mouseIsPressed && cnv.mouseOver) {
    maskDraw();
    maask.draw = true;
  } else {
    maask.first = true;
    if (maask.draw) {
      maask.draw = false;
      checkMask();
      scanArea();
    }
  }
}

function maskDraw() {
  if (maask.first) {
    maask.x1 = params.mouse.x;
    maask.y1 = params.mouse.y;
    maask.first = false;
  }
  maask.x2 = params.mouse.x;
  maask.y2 = params.mouse.y;
}

function checkMask() {
  if (maask.x1 - maask.x2 > 0) [maask.x1, maask.x2] = [maask.x2, maask.x1];
  if (maask.y1 - maask.y2 > 0) [maask.y1, maask.y2] = [maask.y2, maask.y1];
}

function resetMask() {
  scan.action = false;
  maask.x1 = 0;
  maask.y1 = 0;
  maask.x2 = imgSource.width;
  maask.y2 = imgSource.height;
  scanArea();
  params.mode = "scan";
}
