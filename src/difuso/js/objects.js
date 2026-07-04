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

  return {
    loadModelFile,
  };
}
