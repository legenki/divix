// DIFUSO — 3D Object mode: model loading, camera/light/transform rendering,
// mouse interaction, and motion animation. Ported from
// reference/dithr/scripts/{objects,media,var}.js.

export function createObjects({ p, state }) {
  const { obj, motion, rec } = state;

  function resetTransformState() {
    obj.rotation.x = 0;
    obj.rotation.y = 0;
    obj.translate.x = 0;
    obj.translate.y = 0;
    obj.scale.factor = obj.scale.default;
    obj.state = '';
    motion.frame = 0;
  }

  // .obj text is parsed synchronously via p5's createModel(). .stl requires
  // loadModel() with a Blob URL (p5 has no synchronous STL text parser).
  async function loadObjFile(file) {
    const text = await file.text();
    const model = p.createModel(text, '.obj', { normalize: true });
    resetTransformState();
    obj.model = model;
    rec.type = 'object';
  }

  function loadStlFile(file) {
    const url = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      p.loadModel(
        url,
        { normalize: true, fileType: 'stl' },
        (model) => {
          URL.revokeObjectURL(url);
          resetTransformState();
          obj.model = model;
          rec.type = 'object';
          resolve(model);
        },
        (err) => {
          URL.revokeObjectURL(url);
          reject(err instanceof Error ? err : new Error('Failed to load STL model'));
        }
      );
    });
  }

  // Dispatches by file extension (not MIME type — browsers don't register a
  // consistent MIME type for .obj/.stl). Returns a rejected promise for
  // unsupported extensions so callers can setStatus() uniformly.
  function loadModelFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.obj')) return loadObjFile(file);
    if (name.endsWith('.stl')) return loadStlFile(file);
    return Promise.reject(new Error('Unsupported model file type'));
  }

  // Sets the WEBGL graphics buffer's camera to orthographic, matching the
  // reference's setGraphicsOrtho(). p5's Graphics camera lives at
  // graphics._renderer.mainCamera; there's no public ortho-on-buffer API.
  function setGraphicsOrtho(graphics, left, right, bottom, top, near, far) {
    const camera = graphics?._renderer?.mainCamera;
    if (camera && typeof camera.ortho === 'function') {
      camera.ortho(left, right, bottom, top, near, far);
    }
  }

  function drawGraphicsModel(graphics, geometry) {
    if (typeof graphics.model === 'function') {
      graphics.model(geometry);
      return;
    }
    graphics?._renderer?.model(geometry);
  }

  function modelPreview(gImg) {
    gImg.ambientLight(obj.light.ambient);
    gImg.directionalLight(p.color(obj.light.one.color), obj.light.one.x, obj.light.one.y, obj.light.one.z);
    gImg.directionalLight(p.color(obj.light.two.color), obj.light.two.x, obj.light.two.y, obj.light.two.z);
    gImg.directionalLight(p.color(obj.light.three.color), obj.light.three.x, obj.light.three.y, obj.light.three.z);
    gImg.specularMaterial(obj.light.specular);
    gImg.shininess(obj.light.shininess);

    const scaleFactor =
      1 + Math.sin(p.TWO_PI * motion.frame * motion.translate.speed.z * 0.01) * motion.translate.level.z;
    gImg.scale(obj.scale.factor);
    gImg.scale(scaleFactor);

    gImg.translate(
      (0.5 * gImg.width * obj.translate.x) / obj.scale.factor,
      (0.5 * gImg.height * obj.translate.y) / obj.scale.factor
    );

    const xTranslate = (0.5 * gImg.width) / obj.scale.factor;
    const yTranslate = (0.5 * gImg.height) / obj.scale.factor;
    const xTrans = Math.sin(p.TWO_PI * motion.frame * motion.translate.speed.x * 0.01) * xTranslate * motion.translate.level.x;
    const yTrans = Math.sin(p.TWO_PI * motion.frame * motion.translate.speed.y * 0.01) * yTranslate * motion.translate.level.y;
    gImg.translate(xTrans, yTrans, 0);

    gImg.rotateX(obj.rotation.x);
    gImg.rotateY(obj.rotation.y);
    gImg.rotateZ(p.PI);

    if (motion.rotate.type === 'constant') {
      gImg.rotateX(p.TWO_PI * motion.frame * p.map(motion.rotate.speed.x, -1, 1, -0.01, 0.01));
      gImg.rotateY(p.TWO_PI * motion.frame * p.map(motion.rotate.speed.y, -1, 1, -0.01, 0.01));
      gImg.rotateZ(p.TWO_PI * motion.frame * p.map(motion.rotate.speed.z, -1, 1, -0.01, 0.01));
    } else {
      gImg.rotateX(Math.sin(p.TWO_PI * motion.frame * motion.rotate.speed.x * 0.01) * p.radians(motion.rotate.angle.x));
      gImg.rotateY(Math.sin(p.TWO_PI * motion.frame * motion.rotate.speed.y * 0.01) * p.radians(motion.rotate.angle.y));
      gImg.rotateZ(Math.sin(p.TWO_PI * motion.frame * motion.rotate.speed.z * 0.01) * p.radians(motion.rotate.angle.z));
    }

    if (motion.active) motion.frame++;
    drawGraphicsModel(gImg, obj.model);
  }

  // Renders the current model into gImg for this frame. Called from app.js's
  // drawCanvas() before the dither pipeline runs, replacing the image/video
  // texture blit for rec.type === 'object'. No-op if no model is loaded yet.
  function previewGraphics(gImg) {
    if (!obj.model) return;
    gImg.reset();
    gImg.clear();
    if (!obj.transparent) gImg.background(obj.canvas);

    gImg.push();
    if (obj.camera === 'ortho') {
      setGraphicsOrtho(
        gImg,
        -gImg.width * 0.5,
        gImg.width * 0.5,
        -gImg.height * 0.5,
        gImg.height * 0.5,
        -(gImg.width + gImg.height) * 0.5,
        (gImg.width + gImg.height) * 2
      );
    }
    modelPreview(gImg);
    gImg.pop();
  }

  // Rotates the model proportional to mouse movement. Guarded by rec.type ===
  // 'object' at the call site in app.js (same guard pattern app.js already
  // uses for other type-specific branches), so no guard duplicated here.
  function handleMouseDragged() {
    const cx = (state.cnv.sens.y * (p.mouseY - p.pmouseY)) / 75;
    const cy = (state.cnv.sens.x * (p.mouseX - p.pmouseX)) / 75;
    obj.rotation.x += cx;
    obj.rotation.y += cy;
    obj.rotation.x %= p.TWO_PI;
    obj.rotation.y %= p.TWO_PI;
    updateObjectState();
  }

  // Zooms via scale.factor, clamped to scale.min/max. `event` is the p5
  // WheelEvent passed through from app.js's mouseWheel callback.
  function handleMouseWheel(event) {
    obj.scale.factor -= event.delta * state.cnv.sens.scale;
    if (obj.scale.factor > obj.scale.max) obj.scale.factor = obj.scale.max;
    if (obj.scale.factor < obj.scale.min) obj.scale.factor = obj.scale.min;
    updateObjectState();
  }

  // Human-readable status string for a status readout in the panel — mirrors
  // the reference's checkObjectState().
  function updateObjectState() {
    obj.state = `Rotation: ${Math.round(p.degrees(obj.rotation.x))}˚ | ${Math.round(
      p.degrees(obj.rotation.y)
    )}˚\nScale: ${Math.round(obj.scale.factor * 100) / 100}`;
  }

  function resetLights() {
    obj.light.ambient = 50;
    obj.light.specular = 200;
    obj.light.shininess = 12;

    obj.light.one.color = '#ff0000';
    obj.light.one.x = 0;
    obj.light.one.y = 1;
    obj.light.one.z = -1;

    obj.light.two.color = '#00ff00';
    obj.light.two.x = -0.1;
    obj.light.two.y = 0;
    obj.light.two.z = -0.1;

    obj.light.three.color = '#0000ff';
    obj.light.three.x = 0.5;
    obj.light.three.y = 0;
    obj.light.three.z = -0.5;
  }

  function resetObjectMotions() {
    motion.frame = 0;
    motion.rotate.type = 'constant';
    motion.rotate.angle.x = 45;
    motion.rotate.angle.y = 45;
    motion.rotate.angle.z = 45;
    motion.rotate.speed.x = 0;
    motion.rotate.speed.y = 0;
    motion.rotate.speed.z = 0;

    motion.translate.level.x = 0.25;
    motion.translate.level.y = 0.25;
    motion.translate.level.z = 0.25;
    motion.translate.speed.x = 0;
    motion.translate.speed.y = 0;
    motion.translate.speed.z = 0;
  }

  function resetObjectCoordinates() {
    obj.rotation.x = 0;
    obj.rotation.y = 0;
    obj.translate.x = 0;
    obj.translate.y = 0;
    obj.scale.factor = obj.scale.default;
    updateObjectState();
  }

  return {
    loadModelFile,
    previewGraphics,
    handleMouseDragged,
    handleMouseWheel,
    resetLights,
    resetObjectMotions,
    resetObjectCoordinates,
  };
}
