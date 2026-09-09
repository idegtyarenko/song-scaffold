/**
 * The shape of a recording, cheap enough to draw at any zoom.
 *
 * A five-minute stereo recording is thirteen million samples per channel, and a canvas a
 * thousand pixels wide can show a thousand columns of them. Reading the samples again for
 * every zoom step would mean walking those millions on the way to each frame, so they are
 * walked exactly once: the loudest and quietest sample of every small bucket is kept, and
 * every view afterwards is drawn by combining buckets. Two `Float32Array`s of about 51k
 * entries — some 400 kB — stand in for a hundred megabytes of audio.
 *
 * The bucket is also the limit of zooming in: below one bucket per column there is nothing
 * left to show, and the caller is expected to stop there rather than magnify a step.
 */

import type { View } from './view';

/** A bucket per 256 samples — under six milliseconds at 44.1 kHz. */
export const SAMPLES_PER_BUCKET = 256;

/** The peak envelope of a recording: what the loudest and quietest sample of each bucket was. */
export interface Peaks {
  /** Quietest sample of each bucket, at most 0. */
  min: Float32Array;
  /** Loudest sample of each bucket, at least 0. */
  max: Float32Array;
  samplesPerBucket: number;
  sampleRate: number;
  durationSec: number;
}

/** What one column of the drawing spans, vertically. */
export interface Column {
  min: number;
  max: number;
}

/**
 * Walk the samples once and keep the extremes of every bucket.
 *
 * Channels are folded together — one waveform, not one per channel: the picture is there to
 * find a bar in, and two near-identical outlines would say nothing extra about where it is.
 * The extremes start at zero rather than at infinity, so a bucket the recording never
 * reaches (the tail of the last one) reads as silence instead of as a hole.
 */
export function peaksOf(buffer: AudioBuffer, samplesPerBucket = SAMPLES_PER_BUCKET): Peaks {
  const buckets = Math.max(1, Math.ceil(buffer.length / samplesPerBucket));
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let bucket = 0; bucket < buckets; bucket += 1) {
      const from = bucket * samplesPerBucket;
      const to = Math.min(from + samplesPerBucket, samples.length);
      let low = min[bucket]!;
      let high = max[bucket]!;
      for (let at = from; at < to; at += 1) {
        const sample = samples[at]!;
        if (sample < low) low = sample;
        if (sample > high) high = sample;
      }
      min[bucket] = low;
      max[bucket] = high;
    }
  }

  return {
    min,
    max,
    samplesPerBucket,
    sampleRate: buffer.sampleRate,
    durationSec: buffer.duration,
  };
}

/** How long one bucket lasts — and so how narrow a view may usefully get. */
export function bucketSec(peaks: Peaks): number {
  return peaks.samplesPerBucket / peaks.sampleRate;
}

/**
 * The visible stretch, boiled down to one pair of extremes per column.
 *
 * Every column takes the buckets its own slice of time covers, always at least one, so a
 * view zoomed past the bucket still draws a stepped outline rather than gaps.
 */
export function envelope(peaks: Peaks, view: View, columns: number): Column[] {
  const perSecond = peaks.sampleRate / peaks.samplesPerBucket;
  const drawn: Column[] = [];

  for (let column = 0; column < columns; column += 1) {
    const from = view.start + (column / columns) * view.span;
    const to = view.start + ((column + 1) / columns) * view.span;
    const first = Math.max(0, Math.floor(from * perSecond));
    const last = Math.min(peaks.min.length - 1, Math.max(first, Math.ceil(to * perSecond) - 1));

    let low = 0;
    let high = 0;
    for (let bucket = first; bucket <= last; bucket += 1) {
      if (peaks.min[bucket]! < low) low = peaks.min[bucket]!;
      if (peaks.max[bucket]! > high) high = peaks.max[bucket]!;
    }
    drawn.push({ min: low, max: high });
  }

  return drawn;
}
