import { anim, form, g, MOVE_TYPES, OFFSET_TYPES, ROTATE_TYPES, SCALE_TYPES, OPACITY_TYPES, TINT_TYPES, MAPPING } from './state.js';

export function randomFormCoords(p, xSize, ySize) {
  console.log('g.ctx in randomFormCoords:', !!g.ctx);
  let x = Math.round(p.random(xSize / 3, g.ctx.width - xSize / 3));
  let y = Math.round(p.random(ySize / 3, g.ctx.height - ySize / 3));
  return [x, y];
}

export function randomParameters(p) {
  if (anim.move.x.random.type !== "off") moveXTypeRandom(p);
  if (anim.move.x.random.level !== "off") moveXLevelRandom(p);
  if (anim.move.x.random.rate !== "off") moveXRateRandom(p);

  if (anim.move.y.random.type !== "off") moveYTypeRandom(p);
  if (anim.move.y.random.level !== "off") moveYLevelRandom(p);
  if (anim.move.y.random.rate !== "off") moveYRateRandom(p);

  if (anim.offset.x.random.type !== "off") offsetXTypeRandom(p);
  if (anim.offset.x.random.level !== "off") offsetXLevelRandom(p);
  if (anim.offset.x.random.rate !== "off") offsetXRateRandom(p);

  if (anim.offset.y.random.type !== "off") offsetYTypeRandom(p);
  if (anim.offset.y.random.level !== "off") offsetYLevelRandom(p);
  if (anim.offset.y.random.rate !== "off") offsetYRateRandom(p);

  if (anim.rotate.random.type !== "off") rotateTypeRandom(p);
  if (anim.rotate.random.level !== "off") rotateLevelRandom(p);
  if (anim.rotate.random.rate !== "off") rotateRateRandom(p);

  if (anim.scale.random.type !== "off") scaleTypeRandom(p);
  if (anim.scale.random.level !== "off") scaleLevelRandom(p);
  if (anim.scale.random.rate !== "off") scaleRateRandom(p);

  if (anim.opacity.random.type !== "off") opacityTypeRandom(p);
  if (anim.opacity.random.level !== "off") opacityLevelRandom(p);
  if (anim.opacity.random.rate !== "off") opacityRateRandom(p);

  if (anim.tint.random.type !== "off") tintTypeRandom(p);
  if (anim.tint.random.color !== "off") tintColorRandom(p);
  if (anim.tint.random.level !== "off") tintLevelRandom(p);
  if (anim.tint.random.rate !== "off") tintRateRandom(p);

  if (
    anim.move.x.type === "none" &&
    anim.move.y.type === "none" &&
    anim.rotate.type === "none" &&
    anim.scale.type === "none" &&
    anim.offset.x.type === "none" &&
    anim.offset.y.type === "none"
  ) {
    randomParameters(p);
  }
}

function pickRandom(p, arr) {
  return arr[Math.floor(p.random() * arr.length)];
}

function moveXTypeRandom(p) { anim.move.x.type = pickRandom(p, MOVE_TYPES); }
function moveXLevelRandom(p) { anim.move.x.level = p.random() < 0.5 ? Math.round(p.random(20, 200)) : Math.round(p.random(1, 200)); }
function moveXRateRandom(p) { anim.move.x.rate = p.random() < 0.4 ? Number(p.random(2, 5).toFixed(1)) : Number(p.random(1, 10).toFixed(1)); }

function moveYTypeRandom(p) { anim.move.y.type = pickRandom(p, MOVE_TYPES); }
function moveYLevelRandom(p) { anim.move.y.level = p.random() < 0.5 ? Math.round(p.random(20, 200)) : Math.round(p.random(1, 200)); }
function moveYRateRandom(p) { anim.move.y.rate = p.random() < 0.4 ? Number(p.random(2, 5).toFixed(1)) : Number(p.random(1, 10).toFixed(1)); }

function offsetXTypeRandom(p) { anim.offset.x.type = pickRandom(p, OFFSET_TYPES); }
function offsetXLevelRandom(p) { anim.offset.x.level = p.random() < 0.4 ? Number(p.random(1, 8).toFixed(1)) : Number(p.random(1, 25).toFixed(1)); }
function offsetXRateRandom(p) { anim.offset.x.rate = p.random() < 0.4 ? Number(p.random(1, 3).toFixed(1)) : Number(p.random(1, 10).toFixed(1)); }

function offsetYTypeRandom(p) { anim.offset.y.type = pickRandom(p, OFFSET_TYPES); }
function offsetYLevelRandom(p) { anim.offset.y.level = p.random() < 0.4 ? Number(p.random(1, 8).toFixed(1)) : Number(p.random(1, 25).toFixed(1)); }
function offsetYRateRandom(p) { anim.offset.y.rate = p.random() < 0.4 ? Number(p.random(1, 3).toFixed(1)) : Number(p.random(1, 10).toFixed(1)); }

function rotateTypeRandom(p) { anim.rotate.type = pickRandom(p, ROTATE_TYPES); }
function rotateLevelRandom(p) { anim.rotate.level = Math.round(p.random(5, 180)); }
function rotateRateRandom(p) { anim.rotate.rate = Number(p.random(1, 10).toFixed(1)); }

function scaleTypeRandom(p) { anim.scale.type = pickRandom(p, SCALE_TYPES); }
function scaleLevelRandom(p) { anim.scale.level = p.random() < 0.25 ? Number(p.random(1.1, 1.5).toFixed(2)) : Number(p.random(1.1, 2).toFixed(2)); }
function scaleRateRandom(p) { anim.scale.rate = p.random() < 0.5 ? Number(p.random(1, 3).toFixed(1)) : Number(p.random(1, 10).toFixed(1)); }

function opacityTypeRandom(p) { anim.opacity.type = p.random() < 0.5 ? OPACITY_TYPES[0] : pickRandom(p, OPACITY_TYPES); }
function opacityLevelRandom(p) { anim.opacity.level = p.random() < 0.5 ? Math.round(p.random(25, 50)) : Math.round(p.random(10, 100)); }
function opacityRateRandom(p) { anim.opacity.rate = p.random() < 0.5 ? Number(p.random(1, 3).toFixed(1)) : Number(p.random(1, 10).toFixed(1)); }

function tintTypeRandom(p) { anim.tint.type = p.random() < 0.5 ? TINT_TYPES[0] : pickRandom(p, TINT_TYPES); }
function tintColorRandom(p) { anim.tint.color = `#${Math.floor(p.random()*16777215).toString(16).padStart(6, '0')}`; }
function tintLevelRandom(p) { anim.tint.level = p.random() < 0.5 ? Math.round(p.random(1, 50)) : Math.round(p.random(1, 100)); }
function tintRateRandom(p) { anim.tint.rate = p.random() < 0.4 ? Number(p.random(1, 3).toFixed(1)) : Number(p.random(1, 10).toFixed(1)); }

export function getTrend(p, trend, toggle, id) {
  if (trend === "pos") return 1;
  if (trend === "neg") return -1;
  if (trend === "random") return p.random() < 0.5 ? -1 : 1;
  if (trend === "toggle") {
    let result = toggle === "pos" ? [-1, "neg"] : [1, "pos"];
    switch (id) {
      case "movex": anim.move.x.trend.toggle = result[1]; return result[0];
      case "movey": anim.move.y.trend.toggle = result[1]; return result[0];
      case "offsetx": anim.offset.x.trend.toggle = result[1]; return result[0];
      case "offsety": anim.offset.y.trend.toggle = result[1]; return result[0];
      case "rotate": anim.rotate.trend.toggle = result[1]; return result[0];
      case "scale": anim.scale.trend.toggle = result[1]; return result[0];
    }
  }
}
