/**
 * Dr. Molly Gebrian's "Interleaved Clicking Up #1"
 * (Learn Faster, Perform Better: A Musician's Guide to the Neuroscience of Practicing,
 *  Oxford University Press 2024, ch. 16).
 *
 * Split a hard passage into N segments. Work up to the full passage one segment at a
 * time: a *stage* of size c has segments 1..c in play. Within a stage you rotate through
 * a fixed pattern of overlapping chunks while the metronome climbs one notch per
 * repetition. Consecutive repetitions therefore differ in both what you play and how
 * fast — the interleaving that makes the practice stick overnight.
 *
 * Everything here is pure: no DOM, no audio, no clock.
 */

/** Segment indices, 1-based and ascending. 1 is always the first bar of the music. */
export type Chunk = number[];

/** One repetition: what to play, and how fast. */
export interface Rung {
  tempo: number;
  chunk: Chunk;
  /** True once the ladder has topped out and we are playing on to close the stage. */
  isTail: boolean;
}

/**
 * Tempos from `start` up to `target` in increments of `step`.
 *
 * A final increment that would overshoot is replaced by `target` itself, so the ladder
 * always ends exactly on the tempo the player asked for and never above it.
 */
export function tempoLadder(start: number, target: number, step: number): number[] {
  if (step <= 0) throw new RangeError('step must be positive');
  if (target < start) throw new RangeError('target must not be below start');

  const tempos = [start];
  let t = start;
  while (t < target) {
    t = Math.min(t + step, target);
    tempos.push(t);
  }
  return tempos;
}

/**
 * The rotation for a stage of `stageSize` segments, in local indices 1..stageSize.
 *
 * Segment `stageSize` is the one just added, so it alternates with runs that reach it
 * from one segment further back each time:
 *
 *   1  [1]
 *   2  [1,2] [2]
 *   3  [1,2,3] [3] [2,3] [3]
 *   4  [1,2,3,4] [4] [3,4] [4] [2,3,4] [4]
 */
export function rotationPattern(stageSize: number): Chunk[] {
  if (stageSize < 1) throw new RangeError('stageSize must be at least 1');

  const whole = range(1, stageSize);
  if (stageSize === 1) return [whole];
  if (stageSize === 2) return [whole, [2]];

  const pattern: Chunk[] = [whole, [stageSize]];
  for (let from = stageSize - 1; from >= 2; from--) {
    pattern.push(range(from, stageSize));
    pattern.push([stageSize]);
  }
  return pattern;
}

/**
 * The full list of repetitions for one stage.
 *
 * Rung i pairs `ladder[i]` with the i-th chunk of the rotation, wrapping the rotation as
 * often as the ladder needs. Once the ladder is exhausted the rotation carries on at the
 * target tempo until it lands back on the whole passage-so-far, so a stage always ends
 * by playing everything you have built.
 *
 * With `backwards`, stage 1 is the *last* segment of the music and each stage prepends
 * the segment before it. Indices stay in musical order either way.
 */
export function buildStage(
  stageSize: number,
  totalSegments: number,
  ladder: number[],
  backwards: boolean,
): Rung[] {
  if (stageSize > totalSegments) throw new RangeError('stageSize exceeds totalSegments');
  if (ladder.length === 0) throw new RangeError('ladder must not be empty');

  const pattern = rotationPattern(stageSize);
  const finalTempo = ladder[ladder.length - 1]!;
  const isWhole = (chunk: Chunk) => chunk.length === stageSize;

  const rungs: Rung[] = ladder.map((tempo, i) => ({
    tempo,
    chunk: pattern[i % pattern.length]!,
    isTail: false,
  }));

  for (let i = ladder.length; !isWhole(rungs[rungs.length - 1]!.chunk); i++) {
    rungs.push({ tempo: finalTempo, chunk: pattern[i % pattern.length]!, isTail: true });
  }

  if (!backwards) return rungs;

  // Mirror the whole piece: local 1 is its last segment, local `stageSize` its
  // (totalSegments - stageSize + 1)-th. So the newest segment of a backwards stage is the
  // *earliest* one, and the runs that reach it now run forward out of it into music you
  // already know. Chunks stay contiguous and listed in musical order.
  return rungs.map((rung) => ({
    ...rung,
    chunk: rung.chunk.map((v) => totalSegments - v + 1).reverse(),
  }));
}

const NICE_STEPS = [1, 2, 3, 4, 5, 6, 8, 10];

/**
 * A sensible default increment: roughly fifteen rungs from start to target, rounded to a
 * value a musician would actually dial into a metronome.
 */
export function suggestStep(start: number, target: number): number {
  const ideal = (target - start) / 15;
  return NICE_STEPS.reduce((best, candidate) =>
    Math.abs(candidate - ideal) < Math.abs(best - ideal) ? candidate : best,
  );
}

/** Human-readable name for a chunk, e.g. "bars 2-4" or "bar 3". */
export function describeChunk(chunk: Chunk, unit: 'bar' | 'phrase'): string {
  const first = chunk[0]!;
  const last = chunk[chunk.length - 1]!;
  return first === last ? `${unit} ${first}` : `${unit}s ${first}–${last}`;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
