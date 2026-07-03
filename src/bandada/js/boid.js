import { V2D } from './v2d.js';
import { g, params, debug } from './state.js';
import { lerpAngle } from './utils.js';

export class Boid extends V2D {
  constructor(index, p) {
    super(g.shapePos[index].x, g.shapePos[index].y);
    this.p = p;

    this.vel = new V2D();
    this.acc = new V2D();

    this.shapeType = g.shapeTypes[index];
    this.index = index;
    this.noiseIndex = index * 0.01;
    this.angle = 0;
    this.skew = 1;
    this.colorSpeed = 0;
    this.colorAngle = 0;
    this.colorRandom = 0;
    this.frameNoise = 0;
    this.scale = 1;
    this.shapeScale = g.shapeScale[index];
    this.shapeColor = g.shapeColor[index];

    this.startX = Math.floor(this.x);
    this.startY = Math.floor(this.y);
  }

  neighbors(flock) {
    const cands = flock.candidates(this);
    const ns = [];
    const ds = [];

    const candidate_count = cands.flat().length;
    let step = g.accuracy === 0 ? 1 : Math.ceil(candidate_count / g.accuracy);
    let i = Math.floor(this.p.random(step));

    for (const c of cands) {
      for (; i < c.length; i += step) {
        if (this === c[i]) continue;

        const d = this.sqrDist(c[i]);
        if (d < g.sqVision) {
          ns.push(c[i]);
          ds.push(d);
        }
      }
      i -= c.length;
    }

    return [ns, ds];
  }

  flock(flock) {
    this.acc.zero();

    const aln = new V2D();
    const csn = new V2D();
    const sep = new V2D();

    const [ns, ds] = this.neighbors(flock);

    let i = 0;
    for (const other of ns) {
      const b = g.aligmentBias ** other.vel.dot(this.vel);
      aln.sclAdd(other.vel, b);
      csn.add(other);

      const d = 1 / (ds[i] || 0.00001);
      sep.x += (this.x - other.x) * d;
      sep.y += (this.y - other.y) * d;

      i++;
    }

    if (ns.length > 0) {
      aln.setMag(g.speedMax).sub(this.vel).max(g.steering);
      csn.div(ns.length).sub(this).setMag(g.speedMax).sub(this.vel).max(g.steering);
      sep.setMag(g.speedMax).sub(this.vel).max(g.steering);
    }

    this.acc.sclAdd(aln, g.alignment);
    this.acc.sclAdd(csn, g.cohesion);
    this.acc.sclAdd(sep, g.separation);
  }

  update() {
    this.vel.sclAdd(this.acc, g.delta);
    if (g.drag) this.vel.mult(1 - g.drag);
    if (g.noiseAngle) {
      const noiseFreq = g.frame * 0.05;
      const n = this.p.noise(this.noiseIndex, noiseFreq);
      const range = (n - 0.5) * g.noiseAngleRange;
      this.vel.rotate(range);
    }

    this.vel.min(g.speedMin);
    this.vel.max(g.speedMax);
    this.sclAdd(this.vel, g.delta);

    if (g.bounce) {
      const edgeWidth = g.minCanvasSide * g.bounceOffset;
      const edgeHeight = g.minCanvasSide * g.bounceOffset;
      const repelStrength = g.bounceEase;

      if (this.x < edgeWidth) {
        this.vel.x += repelStrength * (1 - this.x / edgeWidth);
      } else if (this.x > g.width - edgeWidth) {
        this.vel.x -= repelStrength * (1 - (g.width - this.x) / edgeWidth);
      }

      if (this.y < edgeHeight) {
        this.vel.y += repelStrength * (1 - this.y / edgeHeight);
      } else if (this.y > g.height - edgeHeight) {
        this.vel.y -= repelStrength * (1 - (g.height - this.y) / edgeHeight);
      }
    } else {
      const pad = g.gridPadding + g.scale;

      if (this.x < -pad) this.x = g.width + pad;
      if (this.x > g.width + pad) this.x = -pad;
      if (this.y < -pad) this.y = g.height + pad;
      if (this.y > g.height + pad) this.y = -pad;
    }

    this.angle = lerpAngle(this.angle, this.vel.angle(), g.steerReaction);
  }

  interact() {
    if (g.vision === 0) {
      this.acc.zero();
    }

    if (g.mouse.down && g.mouse.over) {
      const mv = new V2D(g.mouse.x, g.mouse.y);
      const d = mv.sqrDist(this);
      mv.sub(this)
        .setMag(10000 / (d || 1))
        .max(g.mouse.force);

      if (g.mouse.button === 0) this.acc.add(mv);
      else if (g.mouse.button === 2) this.acc.sub(mv);
    }
  }

  // Rendering functions
  render() {
    this.scale = 1 - this.shapeScale * g.scaleRandom;

    g.ctx.push();
    g.ctx.translate(this.x, this.y);
    g.ctx.rotate(this.angle);

    this[g.skewMode]();
    g.ctx.scale(this.scale);

    this[g.renderMode]();
    g.ctx.pop();
  }

  vectorRender() {
    const fillColor = this[g.fillStyle](g.fillColors, g.fillReaction);
    if (fillColor) g.ctx.fill(fillColor);
    else g.ctx.noFill();

    const strokeColor = this[g.strokeStyle](g.strokeColors, g.strokeReaction);
    if (strokeColor) {
      g.ctx.strokeWeight(g.strokeWeight / this.scale);
      g.ctx.stroke(strokeColor);
    } else {
      g.ctx.noStroke();
    }

    this[this.shapeType]();
  }

  imageRender() {
    const size = g.scale;
    const sizeHalf = size / 2;
    const sx = this.startX - sizeHalf;
    const sy = this.startY - sizeHalf;

    g.ctx.fill(255);
    g.ctx.beginClip();
    this[this.shapeType]();
    g.ctx.endClip();

    if (g.texture) {
      g.ctx.copy(g.texture, sx, sy, size, size, -sizeHalf, -sizeHalf, size, size);
    }
  }

  // Shaping functions
  ellipseShape() {
    g.ctx.ellipse(0, 0, g.scale, g.scale * this.skew);
  }

  rectShape() {
    g.ctx.rect(0, 0, g.scale, g.scale * this.skew);
  }

  triangleShape() {
    const sx = g.scale * 0.5;
    const sy = g.scale * this.skew * 0.5;
    g.ctx.triangle(sx, 0, -sx, -sy, -sx, sy);
  }

  // Coloring functions
  noneColor() {
    return false;
  }

  singleColor(colors) {
    return colors[0];
  }

  randomColor(colors, reaction) {
    const colorContrast = 3;
    this.frameNoise += this.p.map(reaction, 0, 0.5, 0, 0.01);

    let n = this.p.noise(this.noiseIndex, this.frameNoise);
    this.colorRandom = this.p.lerp(0.5, n, colorContrast);

    return this.p.lerpColor(colors[0], colors[1], this.colorRandom);
  }

  speedColor(colors, reaction) {
    const speedNorm = this.p.map(this.vel.mag(), g.speedMin, g.speedMax, 0, 1);
    const targetPower = this.p.lerp(0, 1, speedNorm);

    this.colorSpeed = this.p.constrain(this.p.lerp(this.colorSpeed, targetPower, reaction), 0, 1);

    return this.p.lerpColor(colors[0], colors[1], this.colorSpeed);
  }

  angleColor(colors, reaction) {
    const a = Math.abs(this.angle / (Math.PI * 2));
    this.colorAngle = this.p.lerp(this.colorAngle, a, reaction);

    const total = colors.length;
    const range = this.colorAngle * total;
    const index = Math.floor(range);
    const indexRange = range - index;

    const c1 = colors[index % total];
    const c2 = colors[(index + 1) % total];

    return this.p.lerpColor(c1, c2, indexRange);
  }

  // Skewing functions
  noneSkew() {
    this.skew = 1;
  }

  speedSkew() {
    const skewPower = 1 - g.skewValue;
    const speedRange = g.speedMax - g.speedMin;
    const speedNorm = this.p.constrain(this.vel.mag() / speedRange, 0, 1);
    const targetSkew = this.p.lerp(1, skewPower, speedNorm);

    this.skew = this.p.lerp(this.skew, targetSkew, g.skewReaction);
  }

  angleSkew() {
    const skewPower = 1 - g.skewValue;
    const perspective = Math.abs(Math.cos(this.vel.angle()));
    const targetSkew = this.p.lerp(skewPower, 1, perspective);

    this.skew = this.p.lerp(this.skew, targetSkew, g.skewReaction);
  }

  // Debug function
  showAreas() {
    g.ctx.push();
    g.ctx.noStroke();
    g.ctx.fill(255, 10);
    g.ctx.ellipse(this.x, this.y, g.vision * 2);
    g.ctx.pop();
  }
}
