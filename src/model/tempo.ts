/**
 * The tempo a stretch of music implies.
 *
 * A loop of known length holding a known number of beats has exactly one tempo, and it is
 * division: no tapping, no guessing, no listening. Which is the useful direction, because
 * counting the beats in a phrase you have just dragged out is something a musician does
 * without thinking, and naming its BPM is not.
 *
 * What that buys is worth saying: a click at this tempo has a period of exactly
 * `length / beats`, so it divides the loop without remainder. The downbeat lands on the seam
 * on the first pass and on the thousandth — not because anything re-synchronises, but
 * because there is nothing to accumulate. Both are counted from one audio clock.
 */

/** The tempos a metronome is worth having. Below is a stopped clock; above is a buzz. */
export const TEMPO_RANGE = { min: 20, max: 300 } as const;

/**
 * The BPM of a loop this long holding this many beats, or null when the answer is not a
 * tempo anybody can practise to — too few beats in a long stretch, or too many in a short
 * one. Null rather than a clamp: a clamped tempo would no longer divide the loop, which is
 * the one property this whole arrangement exists for.
 */
export function tempoForBeats(lengthSec: number, beats: number): number | null {
  if (!(lengthSec > 0) || !Number.isFinite(beats) || beats < 1) return null;
  const tempo = (beats * 60) / lengthSec;
  return tempo < TEMPO_RANGE.min || tempo > TEMPO_RANGE.max ? null : tempo;
}

/** How many beats of this tempo fit in a stretch this long, to the nearest whole one. */
export function beatsInLength(lengthSec: number, tempo: number): number {
  return Math.max(1, Math.round((lengthSec * tempo) / 60));
}
