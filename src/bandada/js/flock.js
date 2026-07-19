import { Boid } from './boid.js';
import { g, params, debug } from './state.js';

export class Flock {
  constructor(boids, p) {
    this.p = p;
    this.length = boids;
    this.shape = params.shape;
    this.boids = [];
    this.buckets = [];
    this.space = {
      scale: null,
      gwidth: null,
      gheight: null,
      width: null,
      height: null
    };
    this.organize();
    this.reset();
  }

  update() {
    if (this.length !== g.boidsCount) {
      this.resize(g.boidsCount);
    }

    if (this.shape !== params.shape) {
      let i = 0;
      for (const boid of this.boids) {
        boid.shapeType = g.shapeTypes[i];
        i++;
      }
      this.shape = params.shape;
    }

    for (const boid of this.boids) {
      boid.update();
    }

    this.organize();
    for (const boid of this.boids) {
      boid.flock(this);
      boid.interact();
    }
  }

  draw() {
    if (debug.areas) {
      for (const boid of this.boids) {
        boid.showAreas();
      }
    }

    for (const boid of this.boids) {
      boid.render();
    }

    if (debug.buckets) {
      if (g.vision === 0) return;

      const s = g.vision;
      const pad = g.gridPadding;

      g.ctx.stroke(255, 50);
      g.ctx.strokeWeight(0.5);
      g.ctx.noFill();

      for (let x = -pad; x <= g.width + pad; x += s) {
        g.ctx.line(x, -pad, x, g.height + pad);
      }

      for (let y = -pad; y <= g.height + pad; y += s) {
        g.ctx.line(-pad, y, g.width + pad, y);
      }
    }
  }

  resize(num) {
    this.length = num;

    if (this.boids.length > num) {
      while (this.boids.length > num) {
        this.boids.pop();
      }
    } else {
      for (let i = this.boids.length; i < num; i++) {
        const b = new Boid(i, this.p);
        b.vel = g.shapeVelocity[i];
        this.boids.push(b);
      }
    }
  }

  reset() {
    this.resize(0);
    this.resize(this.length);
  }

  organize() {
    const s = g.vision;
    const pad = g.gridPadding;

    let rebuild = false;
    if (
      this.space.scale !== s ||
      this.space.gwidth !== g.width ||
      this.space.gheight !== g.height
    ) {
      const newWidth = g.width + pad * 2;
      const newHeight = g.height + pad * 2;
      this.space.scale = s;
      this.space.gwidth = g.width;
      this.space.gheight = g.height;
      this.space.width = Math.ceil(newWidth / s) * s;
      this.space.height = Math.ceil(newHeight / s) * s;
      rebuild = true;
    }

    const cols = Math.ceil(this.space.width / s);
    const rows = Math.ceil(this.space.height / s);
    
    if (rebuild || !this.buckets.length) {
      this.buckets = Array.from({ length: rows }, () => Array.from({ length: cols }, () => []));
    } else {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.buckets[r][c].length = 0;
        }
      }
    }

    for (const boid of this.boids) {
      const row = Math.floor((boid.y + pad) / s);
      const col = Math.floor((boid.x + pad) / s);

      if (this.buckets[row] && this.buckets[row][col]) {
        this.buckets[row][col].push(boid);
      }
    }
  }

  _b(r, c, a) {
    // Push the cell array itself (neighbors() iterates each cell). Avoids
    // flattening thousands of boid refs into one list every frame.
    const cell = this.buckets[r]?.[c];
    if (cell && cell.length) a.push(cell);
  }

  candidates(boid) {
    // Reuse one scratch list of cell arrays (9 cells max) — no new Array
    // per boid per frame.
    const cand = this._cand || (this._cand = []);
    cand.length = 0;
    const pad = g.gridPadding;
    const scale = this.space.scale || 1;
    const row = Math.floor((boid.y + pad) / scale);
    const col = Math.floor((boid.x + pad) / scale);

    this._b(row, col, cand);
    this._b(row, col + 1, cand);
    this._b(row, col - 1, cand);
    this._b(row + 1, col, cand);
    this._b(row + 1, col + 1, cand);
    this._b(row + 1, col - 1, cand);
    this._b(row - 1, col, cand);
    this._b(row - 1, col + 1, cand);
    this._b(row - 1, col - 1, cand);

    return cand;
  }
}
