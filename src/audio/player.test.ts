// @vitest-environment jsdom
/**
 * The loop, measured rather than listened to.
 *
 * What an ear would judge — whether the seam clicks — is here two numbers: the period the
 * passes start on, and whether the outgoing level was still falling while the incoming one
 * was rising. A cut seam and a crossfaded one differ in exactly that, so that is what these
 * cases pin.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioEngine } from './engine';
import { passes, runClock, stubAudio, type Pass } from './fake-context';
import { LoopPlayer } from './player';

/** A minute of audio, as far as the player is concerned. */
const MINUTE = { duration: 60 } as AudioBuffer;

let engine: AudioEngine;
let stopped: number;

const player = () => new LoopPlayer(engine, () => (stopped += 1));

/** When each pass was scheduled to sound. */
const starts = (): number[] => passes().map((pass) => pass.at);

/** How long the sound has been going: the clock, less the moment of lead before it starts. */
const sounding = (): number => engine.currentTime - 0.08;

/** The level curve of one pass, as `[value, time]` pairs. */
const curve = (pass: Pass): [number, number][] => pass.levels.map(({ value, at }) => [value, at]);

beforeEach(() => {
  vi.useFakeTimers();
  stubAudio();
  stopped = 0;
  engine = new AudioEngine();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a loop', () => {
  it('starts a pass every length of the stretch, exactly', () => {
    player().play(MINUTE, { fromSec: 4, toSec: 8 }, { loop: true });
    runClock(20);

    const gaps = starts()
      .slice(1)
      .map((at, index) => at - starts()[index]!);
    expect(gaps.length).toBeGreaterThan(3);
    for (const gap of gaps) expect(gap).toBeCloseTo(4, 10);
  });

  it('does not drift over a long session', () => {
    player().play(MINUTE, { fromSec: 0, toSec: 0.5 }, { loop: true });
    runClock(60);

    const first = starts()[0]!;
    starts().forEach((at, index) => expect(at).toBeCloseTo(first + index * 0.5, 9));
  });

  it('reads the same stretch every time round', () => {
    player().play(MINUTE, { fromSec: 4, toSec: 8 }, { loop: true });
    runClock(12);

    for (const pass of passes()) {
      expect(pass.offsetSec).toBe(4);
      // Four seconds of the stretch, and the six milliseconds after it to fade over.
      expect(pass.durationSec).toBeCloseTo(4.006, 10);
    }
  });

  it('crossfades the seam: the outgoing pass is still sounding as the next one rises', () => {
    player().play(MINUTE, { fromSec: 4, toSec: 8 }, { loop: true });
    runClock(12);

    const [first, second] = passes();
    const fadeOutEnds = curve(first!).at(-1)!;
    const risesTo = curve(second!)[1]!;

    // The one going out reaches silence only after the one coming in has reached full
    // level: the two overlap, which is what makes a blend instead of an edge.
    expect(fadeOutEnds[0]).toBe(0);
    expect(risesTo[0]).toBe(1);
    expect(fadeOutEnds[1]).toBeCloseTo(risesTo[1], 10);
    expect(second!.at).toBeLessThan(fadeOutEnds[1]);
  });

  it('fades out inside the recording when the stretch ends with it', () => {
    player().play(MINUTE, { fromSec: 56, toSec: 60 }, { loop: true });
    runClock(9);

    const first = passes()[0]!;
    // Nothing left to fade over, so the pass is the stretch and no more, and the level
    // falls to nothing at the moment the next one starts.
    expect(first.durationSec).toBeCloseTo(4, 10);
    expect(curve(first).at(-1)![1]).toBeCloseTo(passes()[1]!.at, 10);
  });

  it('says where it has got to, wrapping round the stretch', () => {
    const loop = player();
    loop.play(MINUTE, { fromSec: 4, toSec: 8 }, { loop: true });

    // Still inside the moment of lead before the sound starts.
    expect(loop.positionSec()).toBeCloseTo(4, 10);
    runClock(5);
    expect(loop.positionSec()).toBeCloseTo(4 + (sounding() % 4), 9);
    runClock(4);
    expect(loop.positionSec()).toBeCloseTo(4 + (sounding() % 4), 9);
  });

  it('begins at the moment it was handed, so a click can begin at the same one', () => {
    const loop = player();
    const moment = engine.soon();

    loop.play(MINUTE, { fromSec: 4, toSec: 8 }, { loop: true, at: moment });

    expect(passes()[0]!.at).toBe(moment);
  });

  it('is silent, and says so, once stopped', () => {
    const loop = player();
    loop.play(MINUTE, { fromSec: 4, toSec: 8 }, { loop: true });
    runClock(5);
    const scheduled = passes().length;

    loop.stop();
    expect(loop.playing).toBe(false);
    expect(loop.positionSec()).toBeNull();
    expect(stopped).toBe(1);
    for (const pass of passes()) expect(pass.stopped).toBe(true);

    runClock(5);
    expect(passes()).toHaveLength(scheduled);
  });

  it('stops only the once, however often it is asked', () => {
    const loop = player();
    loop.play(MINUTE, { fromSec: 4, toSec: 8 }, { loop: true });
    loop.stop();
    loop.stop();
    expect(stopped).toBe(1);
  });

  it('replaces what was playing rather than piling onto it', () => {
    const loop = player();
    loop.play(MINUTE, { fromSec: 4, toSec: 8 }, { loop: true });
    runClock(5);
    const before = passes().length;

    // A new stretch is a new loop, on its own clock — and the old one is not left running
    // underneath it, which would be two recordings at once.
    loop.play(MINUTE, { fromSec: 20, toSec: 24 }, { loop: true });
    runClock(5);
    expect(
      passes()
        .slice(0, before)
        .every((pass) => pass.stopped),
    ).toBe(true);
    expect(
      passes()
        .slice(before)
        .every((pass) => pass.offsetSec === 20),
    ).toBe(true);
    // Silencing the old loop is not the transport stopping: the player is still playing.
    expect(stopped).toBe(0);
    expect(loop.playing).toBe(true);
  });

  it('plays nothing at all for a stretch of no length', () => {
    const loop = player();
    loop.play(MINUTE, { fromSec: 8, toSec: 8 }, { loop: true });
    // No clock to run: nothing was played, so no context was ever opened.
    vi.advanceTimersByTime(500);
    expect(passes()).toHaveLength(0);
    expect(loop.playing).toBe(false);
  });
});

describe('a single play', () => {
  it('sounds once and no more', () => {
    player().play(MINUTE, { fromSec: 4, toSec: 8 });
    runClock(20);
    expect(passes()).toHaveLength(1);
  });

  it('runs from the start of the stretch to its end and stays there', () => {
    const once = player();
    once.play(MINUTE, { fromSec: 4, toSec: 8 });
    runClock(2);
    expect(once.positionSec()).toBeCloseTo(4 + sounding(), 9);
    runClock(20);
    expect(once.positionSec()).toBeCloseTo(8, 10);
  });

  it('reports the transport idle when the sound runs out', () => {
    const once = player();
    once.play(MINUTE, { fromSec: 4, toSec: 8 });
    runClock(5);
    expect(once.playing).toBe(true);

    passes()[0]!.end();
    expect(once.playing).toBe(false);
    expect(stopped).toBe(1);
  });
});
