/**
 * 2D vector
 * Ported from reference/boids/scripts/v2d.js
 */
export class V2D {
  static fromArray(array) {
    return new V2D(array[0], array[1]);
  }

  static fromObject(obj) {
    return new V2D(obj.x, obj.y);
  }

  static random(scale = 1) {
    const r = Math.random() * Math.PI * 2;
    return new V2D(Math.cos(r) * scale, Math.sin(r) * scale);
  }

  static add(a, b) {
    return new V2D(a.x + b.x, a.y + b.y);
  }

  static sub(a, b) {
    return new V2D(a.x - b.x, a.y - b.y);
  }

  static mult(v, scale) {
    return new V2D(v.x * scale, v.y * scale);
  }

  static div(v, scale) {
    return new V2D(v.x / scale, v.y / scale);
  }

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  toString(radix = 10) {
    return `${this.x.toString(radix)},${this.y.toString(radix)}`;
  }

  toArray() {
    return [this.x, this.y];
  }

  toObject() {
    return { x: this.x, y: this.y };
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  clone() {
    return new V2D(this.x, this.y);
  }

  angle() {
    return Math.atan2(this.y, this.x);
  }

  sqrMag() {
    return this.x * this.x + this.y * this.y;
  }

  mag() {
    return Math.hypot(this.x, this.y);
  }

  sqrDist(v) {
    const x = this.x - v.x,
      y = this.y - v.y;
    return x * x + y * y;
  }

  dist(v) {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  dot(v) {
    return v.x * this.x + v.y * this.y;
  }

  zero() {
    this.x = 0;
    this.y = 0;
    return this;
  }

  normalize() {
    let l = this.sqrMag();
    if (l > 0) {
      l = 1 / Math.sqrt(l);
    }
    this.x *= l;
    this.y *= l;
    return this;
  }

  random(scale) {
    const r = Math.random() * Math.PI * 2;
    this.x = Math.cos(r) * scale;
    this.y = Math.sin(r) * scale;
    return this;
  }

  rotate(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rx = this.x * cos - this.y * sin;
    this.y = this.x * sin + this.y * cos;
    this.x = rx;
    return this;
  }

  mult(scale) {
    this.x *= scale;
    this.y *= scale;
    return this;
  }

  div(scale) {
    this.x /= scale;
    this.y /= scale;
    return this;
  }

  setMag(scale) {
    let l = this.sqrMag();
    if (l > 0) {
      l = scale / Math.sqrt(l);
    }
    this.x *= l;
    this.y *= l;
    return this;
  }

  max(scale) {
    const l1 = this.sqrMag();
    const l2 = scale * scale;
    if (l1 <= l2) {
      return this;
    }
    this.setMag(scale);
    return this;
  }

  min(scale) {
    const l1 = this.sqrMag();
    const l2 = scale * scale;
    if (l1 >= l2) {
      return this;
    }
    this.setMag(scale);
    return this;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  sclAdd(v, scale) {
    this.x += v.x * scale;
    this.y += v.y * scale;
    return this;
  }
}
