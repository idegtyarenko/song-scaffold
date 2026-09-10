/**
 * Putting the waveform on the canvas. Imperative on purpose, and the only place that is.
 *
 * React owns the size of the canvas and the numbers going into it; from here down it is a
 * drawing, redrawn whole every time anything about it changes. There is no state to keep —
 * the same scene always paints the same picture — which is what makes the loop that calls
 * this safe to run on every frame.
 */

import type { Selection } from '../model/selection';
import { envelope, type Peaks } from './peaks';
import { offsetOf, type View } from './view';

/** The colours the picture is made of, taken from the page rather than fixed here. */
export interface Colors {
  ink: string;
  axis: string;
  cursor: string;
  selection: string;
  edge: string;
  head: string;
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
  /** The stretch that would be looped, if one has been dragged out. */
  selection: Selection | null;
  /** Where the sound has got to, while there is any. */
  playheadSec: number | null;
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
    cursor: read('--wave-cursor', '#6f7889'),
    selection: read('--wave-selection', 'rgba(255, 200, 87, 0.16)'),
    edge: read('--wave-edge', '#ffc857'),
    head: read('--wave-head', '#ffc857'),
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

  // The selected stretch goes down first, so the waveform reads on top of it rather than
  // through it: a band behind the ink, not a wash over it.
  if (scene.selection) {
    const from = offsetOf(scene.view, scene.selection.fromSec) * width;
    const to = offsetOf(scene.view, scene.selection.toSec) * width;
    ctx.fillStyle = colors.selection;
    ctx.fillRect(from, 0, to - from, height);
  }

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

  // The edges of the selection are what a finger aims at to resize it, so they are lines in
  // their own right rather than where the band happens to stop.
  if (scene.selection) {
    ctx.fillStyle = colors.edge;
    mark(ctx, scene, offsetOf(scene.view, scene.selection.fromSec) * width);
    mark(ctx, scene, offsetOf(scene.view, scene.selection.toSec) * width);
  }

  // Two marks, not one, and they mean different things: the cursor is where a play would
  // begin, the playhead is where the sound is now. Keeping them apart is what saves a rule
  // about what a tap does in the middle of a loop — it moves the cursor, and the loop
  // carries on. The playhead goes last, over everything, because it is the moving one.
  if (scene.cursorSec !== null) {
    ctx.fillStyle = colors.cursor;
    mark(ctx, scene, offsetOf(scene.view, scene.cursorSec) * width);
  }

  if (scene.playheadSec !== null) {
    ctx.fillStyle = colors.head;
    mark(ctx, scene, offsetOf(scene.view, scene.playheadSec) * width);
  }
}

/** A vertical line the height of the canvas, drawn only when it is on screen at all. */
function mark(ctx: CanvasRenderingContext2D, scene: Scene, x: number): void {
  if (x < 0 || x > scene.width) return;
  ctx.fillRect(x - 1, 0, 2, scene.height);
}
