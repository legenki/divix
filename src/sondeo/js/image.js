function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  imageAdjust(imgSource);
  scanArea();
}

function copyResult() {
  // imgSource = gResult.get(maask.x1, maask.y1, maask.x2, maask.y2);
  // imageReadytoUse(imgSource);
  imgSource = gResult.get();
  gResult.clear();
  params.mode = "scan";
  params.frame = 0;
  shade.frame = 0;
  maask.x1 = 0;
  maask.y1 = 0;
  maask.x2 = imgSource.width;
  maask.y2 = imgSource.height;
  maapClear();
  scanArea();
  restartShiftXAnimation();
  restartShiftYAnimation();
  restartScalingAnimation();
  restartRotationAnimation();
}

function showImageSize(isLoading) {
  if (isLoading) {
    params.imgLoad = "loading image ...";
  } else {
    params.imgLoad = `${imgSource.width} x ${imgSource.height} px`;
  }
}

function loadNewImage() {
  showImageSize(true);
  loadImage(coverImageURL, (loadedImage) => {
    imageReadytoUse(loadedImage);
  });
}

function imageAdjust(loadedImage) {
  if (layout.mode === "side") cnv.multWidth = cnv.multSide;
  if (layout.mode === "layer") cnv.multWidth = cnv.multLayer;

  let maxWidth = min(cnv.maxWidth, floor(window.innerWidth * cnv.multWidth) + cnv.uiSize);
  let maxHeight = min(cnv.maxHeight, floor(window.innerHeight * cnv.multHeight));

  let w = maxWidth / loadedImage.width;
  let h = maxHeight / loadedImage.height;
  let density;
  let minRatio = min(w, h);
  minRatio === w
    ? (density = loadedImage.width / maxWidth)
    : (density = loadedImage.height / maxHeight);

  cnv.width = loadedImage.width * minRatio;
  cnv.height = loadedImage.height * minRatio;
  cnv.density = density;
}

function imageReadytoUse(loadedImage) {
  imageAdjust(loadedImage);
  imgSource = loadedImage.get();

  if (gSource != null) gSource.remove();
  gSource = createGraphics(imgSource.width, imgSource.height);
  gSource.pixelDensity(1);
  gSource.noStroke();
  gSource.imageMode(CENTER);

  if (gResult != null) gResult.remove();
  gResult = createGraphics(imgSource.width, imgSource.height);
  gResult.pixelDensity(1);
  gResult.noStroke();

  maask.x1 = 0;
  maask.y1 = 0;
  maask.x2 = imgSource.width;
  maask.y2 = imgSource.height;

  prepareShade();

  showImageSize(false);
  params.frame = 0;
  shade.frame = 0;
  restartShiftXAnimation();
  restartShiftYAnimation();
  restartScalingAnimation();
  restartRotationAnimation();
  maapClear();
  scanArea();
  readyToDraw = true;
}

function loadUserImage() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      loadImage(e.target.result, (loadedImage) => {
        imageReadytoUse(loadedImage);
      });
    };
    fileReader.readAsDataURL(file);
  };
  input.addEventListener("cancel", (event) => {
    showImageSize(false);
    readyToDraw = true;
  });
  input.click();
}

function saveMaskImage() {
  let s = createGraphics(maask.x2 - maask.x1, maask.y2 - maask.y1);
  let img = createImage(maask.x2 - maask.x1, maask.y2 - maask.y1);
  s.pixelDensity(1);
  img.copy(
    gResult,
    maask.x1,
    maask.y1,
    maask.x2 - maask.x1,
    maask.y2 - maask.y1,
    0,
    0,
    maask.x2 - maask.x1,
    maask.y2 - maask.y1
  );
  s.background(cnv.bgResult);
  s.image(img, 0, 0);
  s.save(`skaaan-${getTimestamp()}.png`);
  s.remove();
}

function saveImage() {
  let s = createGraphics(gResult.width, gResult.height);
  s.pixelDensity(1);
  s.background(cnv.bgResult);
  s.image(gResult, 0, 0);
  s.save(`skaaan-${getTimestamp()}.png`);
  s.remove();
}

function getTimestamp() {
  return `${year()}-${month()}-${day()}_${hour()}-${minute()}-${second()}`;
}
