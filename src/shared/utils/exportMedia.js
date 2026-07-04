import { ensureHME } from './lazyLibs.js';
import { timestamp } from './datetime.js';

/**
 * Saves a canvas as PNG. saveCanvas() only exists on the main p5 instance —
 * a p5.Graphics buffer has no such method of its own — so when exporting a
 * composited offscreen buffer, pass the main instance as `p` and the buffer
 * as `source`; p5 reads `source.canvas` internally.
 * @param {object} p        p5 instance
 * @param {string} prefix   filename prefix, e.g. 'copo'
 * @param {object} [source] p5.Graphics buffer to save instead of the main canvas
 */
export function exportPNG(p, prefix, source) {
  if (source) {
    // saveCanvas() only special-cases HTMLCanvasElement / p5.Element — a
    // p5.Graphics instance falls through to neither, so pass its raw canvas.
    p.saveCanvas(source.canvas, `${prefix}-${timestamp()}`, 'png');
  } else {
    p.saveCanvas(`${prefix}-${timestamp()}`, 'png');
  }
}

/**
 * Encodes and downloads an MP4 from a sequence of frames rendered by drawFrame.
 *
 * @param {object} opts
 * @param {object}   opts.p            p5 instance
 * @param {string}   opts.prefix       filename prefix
 * @param {object}   opts.cnv          shared cnv state (frame, animation, density)
 * @param {object}   opts.rec          shared rec state (frameRate, length)
 * @param {object}   opts.recVideo     { active: bool, seconds: number }
 * @param {Function} opts.drawComposite () => void — renders one frame to p.canvas
 * @param {Function} opts.setStatus    (msg: string) => void
 * @param {Function} [opts.getSize]    () => { w, h } — override canvas size (default: p.width × density)
 * @param {Function} [opts.beforeDraw] async (frameNum) => void — awaited before drawComposite() runs for
 *                                     this frame. Use this to seek a video element and wait for its
 *                                     'seeked' event: video.time(...) is asynchronous, and drawComposite()
 *                                     samples whatever frame the video element currently has decoded, so
 *                                     the seek must land before drawComposite() runs, not after.
 * @param {Function} [opts.onDone]     () => void — called after export finishes or fails
 */
export async function exportMP4({
  p,
  prefix,
  cnv,
  rec,
  recVideo,
  drawComposite,
  setStatus,
  getSize,
  getCanvas,
  beforeDraw,
  onDone,
}) {
  if (recVideo.active) return;
  recVideo.active = true;
  if (cnv && cnv.frame === undefined) cnv.frame = 0;
  if (rec && rec.frame === undefined) rec.frame = 0;
  setStatus('Preparing video…');

  let { w, h } = getSize
    ? getSize()
    : { w: Math.floor(p.width * (cnv.density?.base ?? 1)), h: Math.floor(p.height * (cnv.density?.base ?? 1)) };

  // H264 encoder requires width and height to be multiples of 2
  w = w % 2 === 0 ? w : w - 1;
  h = h % 2 === 0 ? h : h - 1;

  const copy = document.createElement('canvas');
  copy.width = w;
  copy.height = h;
  const copyCtx = copy.getContext('2d');

  let encoder;
  try {
    encoder = await (await ensureHME()).createH264MP4Encoder();
  } catch (e) {
    console.error(e);
    setStatus('Video export failed');
    recVideo.active = false;
    return;
  }

  const filename = `${prefix}-${timestamp()}.mp4`;
  encoder.outputFilename = filename;
  encoder.width = w;
  encoder.height = h;
  encoder.frameRate = rec.frameRate;
  // rec.quality (0-100), where 100 is best quality (quantization parameter 10) and 0 is worst (51)
  encoder.quantizationParameter = Math.round(p.map(rec.quality ?? 80, 0, 100, 51, 10));
  encoder.groupOfPictures = 1;
  encoder.initialize();

  const totalFrames = recVideo.seconds * rec.frameRate;
  const savedFrame = cnv.frame;
  const savedAnimation = cnv.animation;
  cnv.animation = false;

  try {
    for (let f = 0; f < totalFrames; f++) {
      const recLength = typeof rec.length === 'object' ? rec.length.value : (rec.length || recVideo.seconds || 4);
      const frameNum = f % Math.max(1, (recLength * rec.frameRate));
      if (cnv) cnv.frame = frameNum;
      if (rec) rec.frame = frameNum;
      if (beforeDraw) await beforeDraw(frameNum);
      drawComposite();
      copyCtx.clearRect(0, 0, w, h);
      const targetCanvas = getCanvas ? getCanvas() : p.canvas;
      copyCtx.drawImage(targetCanvas, 0, 0, w, h);
      encoder.addFrameRgba(copyCtx.getImageData(0, 0, w, h).data);
      if (f % 10 === 0) setStatus(`Encoding ${f}/${totalFrames}`);
      if (f % 15 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    setStatus('Finalizing…');
    encoder.finalize();
    const uint8 = encoder.FS.readFile(filename);
    const blob = new Blob([uint8], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('Video exported ✓');
  } catch (e) {
    console.error(`[${prefix}] MP4 export failed:`, e);
    setStatus('Video export failed');
  } finally {
    try { encoder.delete(); } catch { /* encoder may already be gone */ }
    cnv.frame = savedFrame;
    cnv.animation = savedAnimation;
    recVideo.active = false;
    onDone?.();
    setTimeout(() => setStatus(''), 3000);
  }
}
