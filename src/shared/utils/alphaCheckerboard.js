// Creates a checkerboard transparency pattern as a p5.Graphics buffer.
// Shared by copo and refrac (identical algorithm).
export function createAlphaImage(p, width, height, density) {
  const buffer = p.createGraphics(width, height);
  buffer.pixelDensity(density);
  buffer.noStroke();
  buffer.push();
  buffer.fill(255);
  buffer.rect(0, 0, width, height);

  const size = (height + width) / 100;
  let xBool = true;
  let yBool;
  const modY = height % size;
  const modX = width % size;
  const divY = modY / (height / size);
  const divX = modX / (width / size);

  for (let y = 0; y < height - modY; y += size + divY) {
    xBool = !xBool;
    yBool = xBool;
    for (let x = 0; x < width - modX; x += size + divX) {
      yBool = !yBool;
      buffer.fill(yBool ? 255 : 220);
      buffer.rect(x, y, size + divX, size + divY);
    }
  }
  buffer.pop();
  return buffer;
}
