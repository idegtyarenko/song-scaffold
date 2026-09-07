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
 * How much bigger the first increment is than the last.
 *
 * Increments shrink as the tempo rises, because difficulty near a motor ceiling is
 * asymptotic rather than proportional: 140→150 costs far more than 75→80 despite being the
 * smaller percentage. Low down you are nowhere near the limit and can take long strides;
 * the fine resolution belongs at the top, where the passage is actually fighting back.
 */
const TAPER = 2.5;

/**
 * The largest opening jump Auto will propose, as a fraction of the start tempo.
 *
 * At the bottom of the ladder the difficulty is still learning the notes rather than
 * playing them fast, so the first stride has to stay within reach even though the motor
 * demand there is low.
 */
const MAX_FIRST_JUMP = 0.12;

/**
 * `rungs` tempos from `start` to `target`, in increments that shrink as they climb.
 *
 * Always starts exactly on `start` and ends exactly on `target`. Rounding can collide when
 * the range is narrow and the rung count high, so repeated tempos are dropped rather than
 * handed back as two rungs at the same speed.
 */
export function tempoLadder(start: number, target: number, rungs: number): number[] {
  if (target < start) throw new RangeError('target must not be below start');
  if (target === start) return [start];

  const steps = Math.max(1, Math.round(rungs) - 1);
  const weights = Array.from({ length: steps }, (_, i) =>
    steps === 1 ? 1 : TAPER - ((TAPER - 1) * i) / (steps - 1),
  );
  const scale = (target - start) / weights.reduce((a, b) => a + b, 0);

  const tempos = [start];
  let tempo = start;
  for (const weight of weights) {
    tempo += weight * scale;
    tempos.push(Math.round(tempo));
  }
  tempos[tempos.length - 1] = target;

  return tempos.filter((t, i) => i === 0 || t > tempos[i - 1]!);
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

/**
 * A sensible default rung count: the fewest that keep the opening jump inside
 * `MAX_FIRST_JUMP`. Being relative to the range, it adapts on its own — a narrow range
 * needs fewer rungs than a doubling to stay equally gentle.
 */
export function suggestRungs(start: number, target: number): number {
  if (target <= start) return 2;
  const steps = Math.ceil(
    (2 * TAPER * (target - start)) / ((TAPER + 1) * MAX_FIRST_JUMP * start),
  );
  return Math.min(30, Math.max(2, steps + 1));
}

/** Human-readable name for a chunk, e.g. "bars 2–4" or "bar 3". */
export function describeChunk(chunk: Chunk): string {
  const first = chunk[0]!;
  const last = chunk[chunk.length - 1]!;
  return first === last ? `bar ${first}` : `bars ${first}–${last}`;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
