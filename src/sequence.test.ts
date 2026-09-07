import { describe, expect, it } from 'vitest';
import {
  buildStage,
  describeChunk,
  rotationPattern,
  suggestRungs,
  tempoLadder,
  type Chunk,
} from './sequence';

describe('tempoLadder', () => {
  it('opens with long strides and eases into the target', () => {
    expect(tempoLadder(75, 150, 13)).toEqual([
      75, 84, 92, 100, 108, 115, 121, 127, 133, 138, 142, 146, 150,
    ]);
  });

  it('shrinks every increment as the tempo rises', () => {
    const tempos = tempoLadder(60, 200, 12);
    const jumps = tempos.slice(1).map((t, i) => t - tempos[i]!);
    for (let i = 1; i < jumps.length; i++) {
      expect(jumps[i]!).toBeLessThanOrEqual(jumps[i - 1]!);
    }
  });

  it('always begins on the start tempo and ends on the target', () => {
    for (const rungs of [2, 3, 5, 8, 13, 30]) {
      const tempos = tempoLadder(75, 150, rungs);
      expect(tempos[0]).toBe(75);
      expect(tempos[tempos.length - 1]).toBe(150);
      expect(tempos).toHaveLength(rungs);
    }
  });

  it('never repeats a tempo when the range is too narrow for the rungs asked for', () => {
    const tempos = tempoLadder(100, 104, 20);
    expect(tempos).toEqual([...new Set(tempos)]);
    expect(tempos[0]).toBe(100);
    expect(tempos[tempos.length - 1]).toBe(104);
  });

  it('is a single rung when start and target are the same', () => {
    expect(tempoLadder(90, 90, 10)).toEqual([90]);
  });

  it('rejects a target below the start', () => {
    expect(() => tempoLadder(120, 100, 5)).toThrow(RangeError);
  });
});

describe('rotationPattern', () => {
  it('matches Gebrian’s sequence for the first five stages', () => {
    expect(rotationPattern(1)).toEqual([[1]]);
    expect(rotationPattern(2)).toEqual([[1, 2], [2]]);
    expect(rotationPattern(3)).toEqual([[1, 2, 3], [3], [2, 3], [3]]);
    expect(rotationPattern(4)).toEqual([
      [1, 2, 3, 4], [4], [3, 4], [4], [2, 3, 4], [4],
    ]);
    expect(rotationPattern(5)).toEqual([
      [1, 2, 3, 4, 5], [5], [4, 5], [5], [3, 4, 5], [5], [2, 3, 4, 5], [5],
    ]);
  });

  it('alternates the newest segment with every longer run reaching it', () => {
    const pattern = rotationPattern(6);
    expect(pattern).toHaveLength(2 * (6 - 1));
    for (let i = 1; i < pattern.length; i += 2) expect(pattern[i]).toEqual([6]);
    // Every run ends on the newest segment and is contiguous.
    for (let i = 0; i < pattern.length; i += 2) {
      const chunk = pattern[i]!;
      expect(chunk[chunk.length - 1]).toBe(6);
      expect(chunk).toEqual(contiguous(chunk));
    }
  });
});

describe('buildStage', () => {
  // An explicit ladder: these tests are about the rotation, not the tempo spacing.
  const ladder = [60, 65, 70, 75, 80, 85, 90];

  it('advances chunk and tempo together, wrapping the rotation', () => {
    expect(buildStage(3, 4, ladder, false).slice(0, 7)).toEqual([
      { tempo: 60, chunk: [1, 2, 3], isTail: false },
      { tempo: 65, chunk: [3], isTail: false },
      { tempo: 70, chunk: [2, 3], isTail: false },
      { tempo: 75, chunk: [3], isTail: false },
      { tempo: 80, chunk: [1, 2, 3], isTail: false },
      { tempo: 85, chunk: [3], isTail: false },
      { tempo: 90, chunk: [2, 3], isTail: false },
    ]);
  });

  it('plays on at the target tempo until the stage closes on the whole passage', () => {
    const rungs = buildStage(3, 4, ladder, false);
    expect(rungs.slice(7)).toEqual([
      { tempo: 90, chunk: [3], isTail: true },
      { tempo: 90, chunk: [1, 2, 3], isTail: true },
    ]);
  });

  it('always ends on the whole passage-so-far, for every stage and ladder length', () => {
    for (let stage = 1; stage <= 8; stage++) {
      for (const rungCount of [1, 2, 3, 5, 7, 12, 16]) {
        const rungs = buildStage(stage, 8, Array.from({ length: rungCount }, (_, i) => 60 + i), false);
        expect(rungs[rungs.length - 1]!.chunk).toEqual(contiguous([1, stage]));
        expect(rungs.length).toBeGreaterThanOrEqual(rungCount);
      }
    }
  });

  it('adds no tail when the ladder already lands on the whole passage', () => {
    // Stage 3 has a 4-chunk rotation; 5 rungs land back on index 0.
    const rungs = buildStage(3, 4, [60, 65, 70, 75, 80], false);
    expect(rungs).toHaveLength(5);
    expect(rungs.some((r) => r.isTail)).toBe(false);
  });

  it('works backwards from the end of the piece', () => {
    // 7 segments, stage 3: bars 5-7 are in play and bar 5 is the newly added one, so the
    // runs grow forward out of it.
    const rungs = buildStage(3, 7, ladder, true);
    expect(rungs.slice(0, 4).map((r) => r.chunk)).toEqual([
      [5, 6, 7], [5], [5, 6], [5],
    ]);
  });

  it('starts a backwards session on the very last segment', () => {
    expect(buildStage(1, 7, ladder, true)[0]!.chunk).toEqual([7]);
    expect(buildStage(2, 7, ladder, true).slice(0, 2).map((r) => r.chunk)).toEqual([
      [6, 7], [6],
    ]);
  });

  it('keeps every backwards chunk contiguous and in musical order', () => {
    for (let stage = 1; stage <= 7; stage++) {
      for (const rung of buildStage(stage, 7, ladder, true)) {
        expect(rung.chunk).toEqual(contiguous(rung.chunk));
        expect(rung.chunk[rung.chunk.length - 1]).toBeLessThanOrEqual(7);
      }
    }
  });

  it('rejects a stage larger than the passage', () => {
    expect(() => buildStage(5, 4, ladder, false)).toThrow(RangeError);
  });
});

describe('suggestRungs', () => {
  it('keeps the opening jump inside about a tenth of the start tempo', () => {
    for (const [start, target] of [[75, 150], [60, 90], [120, 200], [40, 60]] as const) {
      const tempos = tempoLadder(start, target, suggestRungs(start, target));
      expect((tempos[1]! - tempos[0]!) / tempos[0]!).toBeLessThanOrEqual(0.125);
    }
  });

  it('needs fewer rungs for a narrow range than for a doubling', () => {
    expect(suggestRungs(75, 150)).toBe(13);
    expect(suggestRungs(60, 90)).toBe(7);
    expect(suggestRungs(100, 104)).toBe(2);
  });

  it('stays inside a workable count even for an extreme range', () => {
    expect(suggestRungs(40, 240)).toBeLessThanOrEqual(30);
  });
});

describe('describeChunk', () => {
  it('names one bar and a run of bars differently', () => {
    expect(describeChunk([3])).toBe('bar 3');
    expect(describeChunk([2, 3, 4])).toBe('bars 2–4');
  });
});

/** [first, ..., last] filled in, for asserting contiguity. */
function contiguous(chunk: Chunk): number[] {
  const first = chunk[0]!;
  const last = chunk[chunk.length - 1]!;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}
