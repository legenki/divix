// SONDEO — placeholder sketch; replaced by the real port.
export function sondeoSketch(p) {
  p.setup = () => {
    const c = p.createCanvas(480, 480);
    c.parent(document.getElementById('sondeo-canvas'));
    p.noLoop();
  };
  p.draw = () => {
    p.background(244);
    p.fill(0);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(24);
    p.text('SONDEO — coming soon', p.width / 2, p.height / 2);
  };
}
