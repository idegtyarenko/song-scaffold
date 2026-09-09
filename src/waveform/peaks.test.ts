/**
 * The envelope: what it keeps of the samples, and what a view makes of it afterwards.
 *
 * The point of the whole module is that the samples are read once, so that is checked here
 * as directly as it can be — by counting the reads.
 */

import { describe, expect, it, vi } from 'vitest';

import { bucketSec, envelope, peaksOf } from './peaks';

/** An `AudioBuffer` as far as this module is concerned: channels of samples, and a rate. */
function recording(channels: number[][], sampleRate = 8) {
  const reads = vi.fn((channel: number) => Float32Array.from(channels[channel]!));
  const length = channels[0]!.length;
  return {
    reads,
    buffer: {
      numberOfChannels: channels.length,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: reads,
    } as unknown as AudioBuffer,
  };
}

/** Four buckets of two samples: loud, silent, quiet, and one that is only half there. */
const RAMP = [0.5, -0.5, 0, 0, 0.25, -0.125, 1];

describe('the envelope', () => {
  it('keeps the extremes of every bucket', () => {
    const peaks = peaksOf(recording([RAMP]).buffer, 2);

    expect([...peaks.max]).toEqual([0.5, 0, 0.25, 1]);
    expect([...peaks.min]).toEqual([-0.5, 0, -0.125, 0]);
  });

  it('folds the channels into one outline', () => {
    const peaks = peaksOf(
      recording([
        [0.5, 0.25],
        [-0.75, 0.625],
      ]).buffer,
      2,
    );

    expect([...peaks.min]).toEqual([-0.75]);
    expect([...peaks.max]).toEqual([0.625]);
  });

  it('reads each channel exactly once', () => {
    const { buffer, reads } = recording([RAMP, RAMP]);

    peaksOf(buffer, 2);

    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('keeps at least one bucket, even for a recording of nothing', () => {
    const peaks = peaksOf(recording([[]]).buffer, 2);

    expect(peaks.min).toHaveLength(1);
    expect(peaks.durationSec).toBe(0);
  });

  it('says how long a bucket lasts', () => {
    expect(bucketSec(peaksOf(recording([RAMP], 100).buffer, 25))).toBe(0.25);
  });
});

describe('a view of the envelope', () => {
  const peaks = peaksOf(recording([RAMP]).buffer, 2);

  it('gives a column per column asked for', () => {
    expect(envelope(peaks, { start: 0, span: 1 }, 3)).toHaveLength(3);
  });

  it('combines the buckets each column covers', () => {
    // The whole recording in one column: the loudest and quietest of all of it.
    expect(envelope(peaks, { start: 0, span: 1 }, 1)).toEqual([{ min: -0.5, max: 1 }]);
  });

  it('shows only what the view is looking at', () => {
    // The second half — the silent bucket and the quiet one, not the loud opening.
    expect(envelope(peaks, { start: 0.5, span: 0.25 }, 1)).toEqual([{ min: -0.125, max: 0.25 }]);
  });

  it('repeats a bucket rather than leaving a gap when zoomed past it', () => {
    const columns = envelope(peaks, { start: 0, span: 0.05 }, 4);

    expect(columns).toEqual(Array(4).fill({ min: -0.5, max: 0.5 }));
  });

  it('reads silence past the end of the recording instead of running off the array', () => {
    const columns = envelope(peaks, { start: 0.8, span: 0.4 }, 2);

    expect(columns[1]).toEqual({ min: 0, max: 0 });
  });
});
