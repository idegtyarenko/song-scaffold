import { describe, expect, it } from 'vitest';
import {
  buildStage,
  describeChunk,
  rotationPattern,
  suggestStep,
  tempoLadder,
  type Chunk,
} from './sequence';

describe('tempoLadder', () => {
  it('climbs by the step when the range divides evenly', () => {
    expect(tempoLadder(60, 80, 5)).toEqual([60, 65, 70, 75, 80]);
  });

  it('lands exactly on the target instead of overshooting', () => {
    expect(tempoLadder(75, 150, 7)).toEqual([
      75, 82, 89, 96, 103, 110, 117, 124, 131, 138, 145, 150,
    ]);
  });

  it('is a single rung when start and target are the same', () => {
    expect(tempoLadder(90, 90, 5)).toEqual([90]);
  });

  it('rejects a target below the start, and a non-positive step', () => {
    expect(() => tempoLadder(120, 100, 5)).toThrow(RangeError);
    expect(() => tempoLadder(60, 100, 0)).toThrow(RangeError);
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
  const ladder = tempoLadder(60, 90, 5); // 7 rungs

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

describe('suggestStep', () => {
  it('gives 5 for the common 75 → 150', () => {
    expect(suggestStep(75, 150)).toBe(5);
  });

  it('scales with the range and stays a value you can dial in', () => {
    expect(suggestStep(60, 90)).toBe(2);
    expect(suggestStep(60, 240)).toBe(10);
    expect(suggestStep(100, 104)).toBe(1);
  });
});

describe('describeChunk', () => {
  it('names one segment and a run differently', () => {
    expect(describeChunk([3], 'bar')).toBe('bar 3');
    expect(describeChunk([2, 3, 4], 'bar')).toBe('bars 2–4');
    expect(describeChunk([1, 2], 'phrase')).toBe('phrases 1–2');
  });
});

/** [first, ..., last] filled in, for asserting contiguity. */
function contiguous(chunk: Chunk): number[] {
  const first = chunk[0]!;
  const last = chunk[chunk.length - 1]!;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}
