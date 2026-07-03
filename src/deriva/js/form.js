import { createNoise2D } from 'simplex-noise';
import alea from 'alea';
import { anim, form, g, MAPPING } from './state.js';
import { getTrend, randomFormCoords } from './random.js';

export class Form {
  constructor(p, isRandom) {
    this.p = p;
    
    let xTrans = Math.round(form.mouse.x);
    let yTrans = Math.round(form.mouse.y);
    let xSize = form.size.x;
    let ySize = form.size.y;

    if (isRandom) {
      let trans = randomFormCoords(p, xSize, ySize);
      xTrans = trans[0];
      yTrans = trans[1];
    }

    this.graphics = p.createGraphics(g.ctx.width, g.ctx.height);
    this.graphics.pixelDensity(1);
    this.graphics.imageMode(p.CENTER);
    this.graphics.rectMode(p.CENTER);
    this.graphics.strokeWeight(form.frame.width);
    this.graphics.noStroke();

    this.updBuffer = p.createGraphics(xSize, ySize);
    this.updBuffer.pixelDensity(1);
    this.updBuffer.ellipseMode(p.CORNER);
    this.updBuffer.noStroke();

    this.buffer = p.createGraphics(xSize, ySize);
    this.buffer.pixelDensity(1);
    this.buffer.ellipseMode(p.CORNER);
    this.buffer.noStroke();
    this.buffer.noFill();

    this.mask = form.type;
    this.content = form.content;

    this.translate = { x: xTrans, y: yTrans };

    if (isRandom) {
      this.coords = {
        x: Math.round(xTrans - xSize / 2),
        y: Math.round(yTrans - ySize / 2)
      };
    } else {
      this.coords = {
        x: form.coords.x, // Simplified preview vs live checking for now
        y: form.coords.y
      };
    }

    this.size = { x: xSize, y: ySize };
    this.frameInfo = { value: form.frame.value, color: form.frame.color };
    this.factor = { width: g.ctx.width / 2500, height: g.ctx.height / 2500 };

    this.initAnim(p);
  }

  initAnim(p) {
    // Math wrappers
    const random = p.random.bind(p);
    const map = p.map.bind(p);
    const PI = Math.PI;

    this.move = {
      x: {
        type: anim.move.x.type,
        noise2D: createNoise2D(alea()),
        frame: 0,
        const: { rate: map(anim.move.x.rate, 1, 10, MAPPING.move.rate.const.min, MAPPING.move.rate.const.max) * this.factor.width },
        noise: {
          level: map(anim.move.x.level, 1, 200, g.ctx.width * MAPPING.move.level.min, g.ctx.width * MAPPING.move.level.max),
          rate: map(anim.move.x.rate, 1, 10, MAPPING.move.rate.noise.min, MAPPING.move.rate.noise.max),
          factor: anim.move.x.level
        },
        geom: {
          level: anim.move.x.level * (g.ctx.width / 100) * 0.5,
          rate: map(anim.move.x.level, 1, 200, anim.move.x.rate * 0.08, anim.move.x.rate * 0.9),
          trend: getTrend(p, anim.move.x.trend.type, anim.move.x.trend.toggle, "movex")
        }
      },
      y: {
        type: anim.move.y.type,
        noise2D: createNoise2D(alea()),
        frame: 0,
        const: { rate: map(anim.move.y.rate, 1, 10, MAPPING.move.rate.const.min, MAPPING.move.rate.const.max) * this.factor.height },
        noise: {
          level: map(anim.move.y.level, 1, 200, g.ctx.height * MAPPING.move.level.min, g.ctx.height * MAPPING.move.level.max),
          rate: map(anim.move.y.rate, 1, 10, MAPPING.move.rate.noise.min, MAPPING.move.rate.noise.max),
          factor: anim.move.y.level
        },
        geom: {
          level: anim.move.y.level * (g.ctx.height / 100) * 0.5,
          rate: map(anim.move.y.level, 1, 200, anim.move.y.rate * 0.08, anim.move.y.rate * 0.9),
          trend: getTrend(p, anim.move.y.trend.type, anim.move.y.trend.toggle, "movey")
        }
      }
    };

    this.offset = {
      x: {
        type: anim.offset.x.type,
        noise2D: createNoise2D(alea()),
        frame: 0,
        noise: {
          level: map(anim.offset.x.level, 1, 25, g.ctx.width * MAPPING.offset.level.min, g.ctx.width * MAPPING.offset.level.max),
          rate: map(anim.offset.x.rate, 1, 10, MAPPING.offset.rate.noise.min, MAPPING.offset.rate.noise.max),
          factor: anim.offset.x.level
        },
        geom: {
          level: anim.offset.x.level * (g.ctx.width / 100) * 0.5,
          rate: map(anim.offset.x.level, 1, 200, anim.offset.x.rate * 0.08, anim.offset.x.rate * 0.9),
          trend: getTrend(p, anim.offset.x.trend.type, anim.offset.x.trend.toggle, "offsetx")
        }
      },
      y: {
        type: anim.offset.y.type,
        noise2D: createNoise2D(alea()),
        frame: 0,
        noise: {
          level: map(anim.offset.y.level, 1, 25, g.ctx.height * MAPPING.offset.level.min, g.ctx.height * MAPPING.offset.level.max),
          rate: map(anim.offset.y.rate, 1, 10, MAPPING.offset.rate.noise.min, MAPPING.offset.rate.noise.max),
          factor: anim.offset.y.level
        },
        geom: {
          level: anim.offset.y.level * (g.ctx.height / 100) * 0.5,
          rate: map(anim.offset.y.level, 1, 200, anim.offset.y.rate * 0.08, anim.offset.y.rate * 0.9),
          trend: getTrend(p, anim.offset.y.trend.type, anim.offset.y.trend.toggle, "offsety")
        }
      }
    };

    this.rotate = {
      type: anim.rotate.type,
      noise2D: createNoise2D(alea()),
      frame: 0,
      noise: {
        level: anim.rotate.level,
        rate: map(anim.rotate.rate, 1, 10, MAPPING.rotate.rate.noise.min, MAPPING.rotate.rate.noise.max)
      },
      geom: {
        level: anim.rotate.level,
        rate: map(anim.rotate.rate, 1, 10, MAPPING.rotate.rate.geom.min, MAPPING.rotate.rate.geom.max),
        trend: getTrend(p, anim.rotate.trend.type, anim.rotate.trend.toggle, "rotate")
      }
    };

    this.scale = {
      type: anim.scale.type,
      noise2D: createNoise2D(alea()),
      frame: 0,
      noise: {
        level: anim.scale.level - 1,
        rate: map(anim.scale.rate, 1, 10, MAPPING.scale.rate.noise.min, MAPPING.scale.rate.noise.max),
        factor: map(anim.scale.level - 1, 0.1, 1, 1, 10)
      },
      geom: {
        level: anim.scale.level - 1,
        rate: map(anim.scale.rate, 1, 10, MAPPING.scale.rate.geom.min, MAPPING.scale.rate.geom.max),
        trend: getTrend(p, anim.scale.trend.type, anim.scale.trend.toggle, "scale")
      }
    };

    this.opacity = {
      type: anim.opacity.type,
      noise2D: createNoise2D(alea()),
      frame: 0,
      level: map(anim.opacity.level, 10, 100, MAPPING.opacity.level.min, MAPPING.opacity.level.max),
      noise: { rate: map(anim.opacity.rate, 1, 10, MAPPING.opacity.rate.noise.min, MAPPING.opacity.rate.noise.max) },
      geom: { rate: map(anim.opacity.rate, 1, 10, MAPPING.opacity.rate.geom.min, MAPPING.opacity.rate.geom.max) }
    };

    this.tint = {
      type: anim.tint.type,
      noise2D: createNoise2D(alea()),
      frame: 0,
      color: p.color(anim.tint.color),
      level: map(anim.tint.level, 1, 100, MAPPING.tint.level.min, MAPPING.tint.level.max),
      noise: { rate: map(anim.tint.rate, 1, 10, MAPPING.tint.rate.noise.min, MAPPING.tint.rate.noise.max) },
      geom: { rate: map(anim.tint.rate, 1, 10, MAPPING.tint.rate.geom.min, MAPPING.tint.rate.geom.max) }
    };
  }

  run() {
    if (form.rendering === "canvas") this.graphics.clear();
    let _moveX, _moveY, _rotate, _scale, _offsetX, _offsetY, _opacity, _tint;
    const PI = Math.PI;

    // Move X
    switch (this.move.x.type) {
      case "none": _moveX = 0; break;
      case "const": _moveX = this.move.x.frame * this.move.x.geom.trend; this.move.x.frame += this.move.x.const.rate; break;
      case "noise":
        let noiseValue = this.move.x.noise.rate / this.move.x.noise.factor;
        _moveX = this.move.x.noise2D(this.move.x.frame * noiseValue, 0) * this.move.x.noise.level;
        this.move.x.frame++; break;
      case "sin":
        let sinValue = Math.round(this.move.x.geom.level / (this.move.x.geom.rate * this.factor.width));
        let sinFrame = this.move.x.frame / sinValue;
        _moveX = this.p.map(Math.sin(2*PI * sinFrame), 1, -1, this.move.x.geom.level, -this.move.x.geom.level) * this.move.x.geom.trend;
        sinFrame >= 1 ? (this.move.x.frame = 1) : this.move.x.frame++; break;
      case "cos":
        let cosValue = Math.round(this.move.x.geom.level / (this.move.x.geom.rate * this.factor.width));
        let cosFrame = this.move.x.frame / cosValue;
        _moveX = this.p.map(1 - Math.cos(2*PI * cosFrame), 1, -1, this.move.x.geom.level, -this.move.x.geom.level) * this.move.x.geom.trend;
        cosFrame >= 1 ? (this.move.x.frame = 1) : this.move.x.frame++; break;
    }

    // Move Y
    switch (this.move.y.type) {
      case "none": _moveY = 0; break;
      case "const": _moveY = this.move.y.frame * this.move.y.geom.trend; this.move.y.frame += this.move.y.const.rate; break;
      case "noise":
        let noiseValue = this.move.y.noise.rate / this.move.y.noise.factor;
        _moveY = this.move.y.noise2D(this.move.y.frame * noiseValue, 0) * this.move.y.noise.level;
        this.move.y.frame++; break;
      case "sin":
        let sinValue = Math.round(this.move.y.geom.level / (this.move.y.geom.rate * this.factor.height));
        let sinFrame = this.move.y.frame / sinValue;
        _moveY = this.p.map(Math.sin(2*PI * sinFrame), 1, -1, this.move.y.geom.level, -this.move.y.geom.level) * this.move.y.geom.trend;
        sinFrame >= 1 ? (this.move.y.frame = 1) : this.move.y.frame++; break;
      case "cos":
        let cosValue = Math.round(this.move.y.geom.level / (this.move.y.geom.rate * this.factor.height));
        let cosFrame = this.move.y.frame / cosValue;
        _moveY = this.p.map(1 - Math.cos(2*PI * cosFrame), 1, -1, this.move.y.geom.level, -this.move.y.geom.level) * this.move.y.geom.trend;
        cosFrame >= 1 ? (this.move.y.frame = 1) : this.move.y.frame++; break;
    }

    // Offset X
    switch (this.offset.x.type) {
      case "none": _offsetX = 0; break;
      case "noise":
        let noiseValue = this.offset.x.noise.rate / this.offset.x.noise.factor;
        _offsetX = this.offset.x.noise2D(this.offset.x.frame * noiseValue, 0) * this.offset.x.noise.level;
        this.offset.x.frame++; break;
      case "sin":
        let sinValue = Math.round(this.offset.x.geom.level / (this.offset.x.geom.rate * this.factor.width));
        let sinFrame = this.offset.x.frame / sinValue;
        _offsetX = this.p.map(Math.sin(2*PI * sinFrame), 1, -1, this.offset.x.geom.level, -this.offset.x.geom.level) * this.offset.x.geom.trend;
        sinFrame >= 1 ? (this.offset.x.frame = 0) : this.offset.x.frame++; break;
      case "cos":
        let cosValue = Math.round(this.offset.x.geom.level / (this.offset.x.geom.rate * this.factor.width));
        let cosFrame = this.offset.x.frame / cosValue;
        _offsetX = this.p.map(1 - Math.cos(2*PI * cosFrame), 1, -1, this.offset.x.geom.level, -this.offset.x.geom.level) * this.offset.x.geom.trend;
        cosFrame >= 1 ? (this.offset.x.frame = 0) : this.offset.x.frame++; break;
    }

    // Offset Y
    switch (this.offset.y.type) {
      case "none": _offsetY = 0; break;
      case "noise":
        let noiseValue = this.offset.y.noise.rate / this.offset.y.noise.factor;
        _offsetY = this.offset.y.noise2D(this.offset.y.frame * noiseValue, 0) * this.offset.y.noise.level;
        this.offset.y.frame++; break;
      case "sin":
        let sinValue = Math.round(this.offset.y.geom.level / (this.offset.y.geom.rate * this.factor.height));
        let sinFrame = this.offset.y.frame / sinValue;
        _offsetY = this.p.map(Math.sin(2*PI * sinFrame), 1, -1, this.offset.y.geom.level, -this.offset.y.geom.level) * this.offset.y.geom.trend;
        sinFrame >= 1 ? (this.offset.y.frame = 0) : this.offset.y.frame++; break;
      case "cos":
        let cosValue = Math.round(this.offset.y.geom.level / (this.offset.y.geom.rate * this.factor.height));
        let cosFrame = this.offset.y.frame / cosValue;
        _offsetY = this.p.map(1 - Math.cos(2*PI * cosFrame), 1, -1, this.offset.y.geom.level, -this.offset.y.geom.level) * this.offset.y.geom.trend;
        cosFrame >= 1 ? (this.offset.y.frame = 0) : this.offset.y.frame++; break;
    }

    // Rotate
    switch (this.rotate.type) {
      case "none": _rotate = 0; break;
      case "const": _rotate = this.rotate.frame * this.rotate.geom.trend; this.rotate.frame += this.rotate.geom.rate; break;
      case "noise":
        let noiseValue = this.rotate.noise.rate / this.rotate.noise.level;
        _rotate = this.rotate.noise2D(this.rotate.frame * noiseValue, 0) * this.rotate.noise.level;
        this.rotate.frame++; break;
      case "sin":
        let sinValue = this.rotate.geom.rate / this.rotate.geom.level;
        _rotate = Math.sin(this.rotate.frame * sinValue) * this.rotate.geom.level * this.rotate.geom.trend;
        this.rotate.frame++; break;
      case "cos":
        let cosValue = this.rotate.geom.rate / this.rotate.geom.level;
        _rotate = (1 - Math.cos(this.rotate.frame * cosValue)) * this.rotate.geom.level * this.rotate.geom.trend;
        this.rotate.frame++; break;
    }

    // Scale
    switch (this.scale.type) {
      case "none": _scale = 1; break;
      case "noise":
        let noiseValue = this.scale.noise.rate / this.scale.noise.factor;
        _scale = 1 + this.scale.noise2D(this.scale.frame * noiseValue, 0) * this.scale.noise.level;
        this.scale.frame++; break;
      case "sin":
        _scale = 1 + Math.sin(this.scale.frame * this.scale.geom.rate) * this.scale.geom.level * this.scale.geom.trend;
        this.scale.frame++; break;
      case "cos":
        _scale = (1 - Math.cos(this.scale.frame * this.scale.geom.rate)) * this.scale.geom.level * this.scale.geom.trend;
        _scale = 1 + _scale - _scale / 2;
        this.scale.frame++; break;
    }

    // Opacity
    switch (this.opacity.type) {
      case "none": _opacity = 255; break;
      case "const": _opacity = 255 - this.opacity.level; break;
      case "noise":
        _opacity = 255 - Math.abs(this.opacity.noise2D(this.opacity.frame * this.opacity.noise.rate, 0)) * this.opacity.level;
        this.opacity.frame++; break;
      case "sin":
        _opacity = 255 - Math.abs(Math.sin(this.opacity.frame * this.opacity.geom.rate)) * this.opacity.level;
        this.opacity.frame++; break;
      case "cos":
        _opacity = 255 - Math.abs(Math.cos(this.opacity.frame * this.opacity.geom.rate)) * this.opacity.level;
        this.opacity.frame++; break;
    }

    // Tint
    switch (this.tint.type) {
      case "none": _tint = 0; break;
      case "const": _tint = this.tint.level; break;
      case "noise":
        _tint = Math.abs(this.tint.noise2D(this.tint.frame * this.tint.noise.rate, 0)) * this.tint.level;
        this.tint.frame++; break;
      case "sin":
        _tint = Math.abs(Math.cos(this.tint.frame * this.tint.geom.rate)) * this.tint.level;
        this.tint.frame++; break;
      case "cos":
        _tint = Math.abs(Math.sin(this.tint.frame * this.tint.geom.rate)) * this.tint.level;
        this.tint.frame++; break;
    }

    let moveBufferX, moveBufferY, bufferX, bufferY;
    
    // Simplification for live vs static drawing
    if (this.content === "live") {
      moveBufferX = ((this.translate.x + _moveX) % (g.ctx.width + this.size.x / 2)) - this.size.x / 2;
      moveBufferY = ((this.translate.y + _moveY) % (g.ctx.height + this.size.y / 2)) - this.size.y / 2;
      bufferX = moveBufferX - _offsetX;
      bufferY = moveBufferY - _offsetY;
    } else {
      bufferX = this.coords.x - _offsetX;
      bufferY = this.coords.y - _offsetY;
    }

    this.updBuffer.clear();
    
    if (this.mask === "rect") {
      this.updBuffer.rect(0, 0, this.size.x, this.size.y);
    } else {
      this.updBuffer.ellipse(0, 0, this.size.x, this.size.y);
    }
    this.updBuffer.drawingContext.clip();

    if (g.texture.data) {
      this.updBuffer.image(g.texture.data, 0, 0, this.size.x, this.size.y, bufferX, bufferY, this.size.x, this.size.y);
    }

    this.buffer.clear();
    this.buffer.image(this.updBuffer, 0, 0);

    if (this.tint.type !== "none") {
      this.buffer.push();
      this.buffer.tint(this.tint.color.levels[0], this.tint.color.levels[1], this.tint.color.levels[2], _tint);
      this.buffer.image(this.updBuffer, 0, 0);
      this.buffer.pop();
    }

    if (this.frameInfo.value === "on") {
      this.buffer.strokeWeight(form.frame.width);
      this.buffer.stroke(this.frameInfo.color);
      if (this.mask === "rect") {
        this.buffer.rect(0, 0, this.size.x, this.size.y);
      } else {
        this.buffer.ellipse(0, 0, this.size.x, this.size.y);
      }
    }

    this.graphics.push();
    this.graphics.translate(this.translate.x, this.translate.y);
    
    if (this.content === "live") {
      this.graphics.translate(
        _moveX % (g.ctx.width + this.size.x),
        _moveY % (g.ctx.height + this.size.y)
      );
    } else {
      this.graphics.translate(_moveX, _moveY);
    }
    
    this.graphics.rotate(this.p.radians(_rotate));
    this.graphics.scale(_scale);
    this.graphics.tint(255, _opacity);
    this.graphics.image(this.buffer, 0, 0);
    this.graphics.pop();
  }

  remove() {
    if (this.graphics) this.graphics.remove();
    if (this.updBuffer) this.updBuffer.remove();
    if (this.buffer) this.buffer.remove();
  }
}
