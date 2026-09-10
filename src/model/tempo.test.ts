/**
 * The tempo a loop implies, and the reason it is null rather than clamped when the answer
 * is not one anybody can practise to.
 */

import { describe, expect, it } from 'vitest';

import { beatsInLength, TEMPO_RANGE, tempoForBeats } from './tempo';

describe('the tempo of a loop', () => {
  it('is the beats it holds over the time it takes', () => {
    // Eight beats in four seconds is two a second.
    expect(tempoForBeats(4, 8)).toBeCloseTo(120);
    expect(tempoForBeats(10, 10)).toBeCloseTo(60);
  });

  it('divides the loop without remainder, which is the whole point', () => {
    const length = 10.4;
    const tempo = tempoForBeats(length, 8)!;

    // Eight periods of the click land exactly on the end of the loop, so the downbeat is on
    // the seam on every pass and not only the first.
    expect(8 * (60 / tempo)).toBeCloseTo(length, 12);
  });

  it('is nothing when it falls outside what a metronome is for', () => {
    // Two beats in a minute is a stopped clock.
    expect(tempoForBeats(60, 2)).toBeNull();
    // A thousand beats in ten seconds is a buzz.
    expect(tempoForBeats(10, 1000)).toBeNull();
  });

  it('holds at the ends of the range rather than just inside them', () => {
    expect(tempoForBeats(60, 20)).toBe(TEMPO_RANGE.min);
    expect(tempoForBeats(60, 300)).toBe(TEMPO_RANGE.max);
  });

  it('is nothing for a stretch of no length or a count of no beats', () => {
    expect(tempoForBeats(0, 4)).toBeNull();
    expect(tempoForBeats(4, 0)).toBeNull();
    expect(tempoForBeats(4, Number.NaN)).toBeNull();
  });

  it('counts the beats of a tempo that fit in a stretch, never fewer than one', () => {
    expect(beatsInLength(4, 120)).toBe(8);
    expect(beatsInLength(0.1, 60)).toBe(1);
  });
});
