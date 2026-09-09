/**
 * Putting the waveform on the canvas. Imperative on purpose, and the only place that is.
 *
 * React owns the size of the canvas and the numbers going into it; from here down it is a
 * drawing, redrawn whole every time anything about it changes. There is no state to keep —
 * the same scene always paints the same picture — which is what makes the loop that calls
 * this safe to run on every frame.
 */

import { envelope, type Peaks } from './peaks';
import { offsetOf, type View } from './view';

/** The three colours the picture is made of, taken from the page rather than fixed here. */
export interface Colors {
  ink: string;
  axis: string;
  cursor: string;
}

/** Everything the drawing depends on, and nothing else. */
export interface Scene {
  peaks: Peaks;
  view: View;
  /** In CSS pixels — the size the canvas occupies on the page. */
  width: number;
  height: number;
  /** Device pixels per CSS pixel, so the outline is sharp on a retina screen. */
  dpr: number;
  colors: Colors;
  /** Where the cursor stands, in seconds, or nowhere yet. */
  cursorSec: number | null;
}

/**
 * The colours of the block, as the stylesheet has them now.
 *
 * Read from the element rather than hard-coded, so the light and dark palettes stay in the
 * one place they are declared and the canvas cannot drift from the page around it. The
 * fallbacks are for a browser that will not give us computed custom properties at all —
 * a grey waveform is better than an invisible one.
 */
export function colorsOf(element: Element): Colors {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    ink: read('--wave-ink', '#8a8f99'),
    axis: read('--wave-axis', '#5b6472'),
    cursor: read('--wave-cursor', '#ffc857'),
  };
}

/** How much of the half-height the loudest sample reaches, leaving the peaks room to breathe. */
const REACH = 0.94;

/** Draw the scene, whole. */
export function paint(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { width, height, dpr, colors } = scene;
  // The context is measured in CSS pixels from here on; the backing store is denser, and
  // the transform is what keeps that a detail of the setup rather than of the drawing.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const middle = height / 2;
  // One device pixel: the thinnest line that is still a line, and the height silence gets
  // so that a quiet passage stays a visible thread instead of a gap in the waveform.
  const hair = 1 / dpr;

  ctx.fillStyle = colors.axis;
  ctx.fillRect(0, middle - hair / 2, width, hair);

  const columns = Math.max(1, Math.round(width));
  const reach = middle * REACH;
  ctx.fillStyle = colors.ink;
  ctx.beginPath();
  envelope(scene.peaks, scene.view, columns).forEach((column, x) => {
    const top = middle - Math.min(1, column.max) * reach;
    const bottom = middle - Math.max(-1, column.min) * reach;
    ctx.rect(x, top, 1, Math.max(bottom - top, hair));
  });
  // One path for the whole outline: a thousand separate fills a frame is how a waveform
  // starts costing more than the audio it is drawing.
  ctx.fill();

  if (scene.cursorSec !== null) {
    const x = offsetOf(scene.view, scene.cursorSec) * width;
    if (x >= 0 && x <= width) {
      ctx.fillStyle = colors.cursor;
      ctx.fillRect(x - 1, 0, 2, height);
    }
  }
}
