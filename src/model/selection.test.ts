/**
 * The arithmetic of a dragged-out stretch: which way it was dragged, where it is held, and
 * when it is too short to be one at all.
 */

import { describe, expect, it } from 'vitest';

import { formatMoment, MIN_SELECTION_SEC, selectionLength, selectionOf } from './selection';

describe('a selection', () => {
  it('reads the same dragged either way', () => {
    expect(selectionOf(12, 4, 60)).toEqual({ fromSec: 4, toSec: 12 });
    expect(selectionOf(4, 12, 60)).toEqual({ fromSec: 4, toSec: 12 });
  });

  it('is held inside the recording, however far the hand went', () => {
    expect(selectionOf(-30, 90, 60)).toEqual({ fromSec: 0, toSec: 60 });
  });

  it('is nothing when it is shorter than a loop can be', () => {
    expect(selectionOf(4, 4 + MIN_SELECTION_SEC / 2, 60)).toBeNull();
    expect(selectionOf(4, 4, 60)).toBeNull();
  });

  it('survives once it is past the shortest it may be', () => {
    expect(selectionOf(4, 4 + MIN_SELECTION_SEC * 1.5, 60)).not.toBeNull();
  });

  it('is nothing when the clamp leaves nothing, however wide the drag', () => {
    // Both ends fall past the same edge of a recording, so what is left is a point on it.
    expect(selectionOf(80, 200, 60)).toBeNull();
  });

  it('knows how long it is', () => {
    expect(selectionLength({ fromSec: 4, toSec: 12.5 })).toBeCloseTo(8.5);
  });
});

describe('a moment', () => {
  it('reads in minutes, seconds and tenths', () => {
    expect(formatMoment(67.44)).toBe('1:07.4');
    expect(formatMoment(0)).toBe('0:00.0');
    expect(formatMoment(9.96)).toBe('0:10.0');
  });

  it('never reads as a negative time', () => {
    expect(formatMoment(-3)).toBe('0:00.0');
  });
});
