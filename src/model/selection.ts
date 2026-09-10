/**
 * A stretch of a recording: two moments, in seconds, in order.
 *
 * The same pair is read by three layers that cannot see each other — the canvas draws it,
 * the player loops it, the screen puts it into words — so the arithmetic of making one out
 * of a gesture lives here, where all three may reach it.
 *
 * There is one rule worth stating: a stretch shorter than a few hundredths of a second is
 * not a stretch. It cannot be looped (the seam alone is six milliseconds), it cannot be
 * read, and it is almost always a hand that slipped while pointing at a moment. Such a drag
 * comes back as nothing, and the caller is free to treat it as the click it really was.
 */

/** From `fromSec` to `toSec`, always in that order. */
export interface Selection {
  fromSec: number;
  toSec: number;
}

/** Shorter than this and it was a slip, not a selection. */
export const MIN_SELECTION_SEC = 0.05;

/** How long the stretch is. */
export function selectionLength(selection: Selection): number {
  return selection.toSec - selection.fromSec;
}

/**
 * The stretch between two moments dragged out in either direction, held inside the
 * recording — or nothing, when what was dragged is too short to be one.
 */
export function selectionOf(a: number, b: number, durationSec: number): Selection | null {
  const within = (seconds: number) => Math.min(Math.max(0, seconds), Math.max(0, durationSec));
  const selection = { fromSec: within(Math.min(a, b)), toSec: within(Math.max(a, b)) };
  return selectionLength(selection) < MIN_SELECTION_SEC ? null : selection;
}

/** Minutes, seconds and tenths — the way a loop is read off a waveform: `1:07.4`. */
export function formatMoment(seconds: number): string {
  const from = Math.max(0, seconds);
  const minutes = Math.floor(from / 60);
  return `${minutes}:${(from - minutes * 60).toFixed(1).padStart(4, '0')}`;
}
