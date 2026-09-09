/**
 * The stretch of the recording currently on screen, and the arithmetic of moving it.
 *
 * A view is a start and a span in seconds — never pixels: the same view survives the window
 * being resized, and the canvas is free to be any width. Everything here is pure, so the
 * awkward parts (zooming around a point, running into either end) are settled in tests
 * rather than argued about while watching a waveform slide the wrong way.
 *
 * Every function ends in the same clamp, and the clamp is the whole policy: the view never
 * shows less than one bucket per column, never more than the recording, and never hangs off
 * either end. A gesture that would break one of those is quietly held at the limit, because
 * a pinch that stops responding says "this is as far as it goes" better than a jump back.
 */

/** What is on screen: from `start`, for `span` seconds. */
export interface View {
  start: number;
  span: number;
}

/** The whole recording at once, which is where every recording opens. */
export function whole(durationSec: number): View {
  return { start: 0, span: Math.max(durationSec, 0) };
}

/**
 * The nearest view that is actually allowed. A recording shorter than `minSpan` is shown
 * whole: the floor exists to stop pointless magnification, not to invent time that is
 * not there.
 */
export function clampView(view: View, durationSec: number, minSpan: number): View {
  const span = Math.min(durationSec, Math.max(minSpan, view.span));
  const start = Math.min(Math.max(0, view.start), durationSec - span);
  return { start, span };
}

/**
 * Zoom by `factor` — above one shows more — keeping the moment under `at` where it is.
 * `at` is where the pointer sits across the canvas, from 0 at the left edge to 1 at the
 * right, so the waveform grows out of the finger rather than out of the middle.
 */
export function zoomAt(
  view: View,
  factor: number,
  at: number,
  durationSec: number,
  minSpan: number,
): View {
  const anchor = view.start + at * view.span;
  const span = Math.min(durationSec, Math.max(minSpan, view.span * factor));
  return clampView({ start: anchor - at * span, span }, durationSec, minSpan);
}

/** Slide the view along the recording, keeping its width. */
export function panBy(view: View, seconds: number, durationSec: number): View {
  return clampView({ start: view.start + seconds, span: view.span }, durationSec, view.span);
}

/** The moment at `at` across the canvas, from 0 at the left edge to 1 at the right. */
export function timeAt(view: View, at: number): number {
  return view.start + at * view.span;
}

/** Where a moment falls across the canvas — outside 0…1 when it is off screen. */
export function offsetOf(view: View, seconds: number): number {
  return view.span > 0 ? (seconds - view.start) / view.span : 0;
}
