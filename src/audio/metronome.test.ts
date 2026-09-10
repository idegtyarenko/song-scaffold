// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine';
import { Metronome, type Beat, type MetronomeConfig } from './metronome';
import { clicks, gainsBuilt, runClock, stubAudio } from './fake-context';

let engine: AudioEngine;

const FOUR_FOUR: MetronomeConfig = {
  tempo: 60,
  beatsPerBar: 4,
  secondaryAccents: [2],
  subdivision: 1,
  countInBars: 0,
};

describe('Metronome', () => {
  it('sounds through the click bus, so its level moves against a recording', () => {
    new Metronome(engine, FOUR_FOUR, () => {}).start();

    // The envelope of the first click, and where it goes: the bus, not the speakers.
    expect(gainsBuilt()[0]!.connected).toContain(engine.clickOut);
  });

  it('begins at the moment it was handed, so a recording can begin at the same one', () => {
    const moment = engine.soon();

    new Metronome(engine, FOUR_FOUR, () => {}).start(moment);

    expect(clicks()[0]!.at).toBe(moment);
  });

  beforeEach(() => {
    vi.useFakeTimers();
    stubAudio();
    engine = new AudioEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports every beat of the bar, in order, as it sounds', () => {
    const beats: Beat[] = [];
    const metronome = new Metronome(engine, FOUR_FOUR, (beat) => beats.push(beat));
    metronome.start();
    runClock(4.2);
    metronome.stop();

    expect(beats.slice(0, 5).map((b) => b.beat)).toEqual([0, 1, 2, 3, 0]);
    expect(beats.slice(0, 4).map((b) => b.accent)).toEqual(['strong', 'weak', 'medium', 'weak']);
    expect(beats.every((b) => b.isPulse)).toBe(true);
  });

  it('keeps delivering beats after a listener throws, and says so', () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
    const beats: Beat[] = [];
    let failures = 0;
    const metronome = new Metronome(engine, FOUR_FOUR, (beat) => {
      // The display is driven entirely by this callback, so one bad beat must not be
      // allowed to stop the loop for the rest of the session.
      if (beat.beat === 1 && failures++ === 0) throw new Error('listener blew up');
      beats.push(beat);
    });

    metronome.start();
    runClock(4.2);
    metronome.stop();

    expect(reported).toHaveBeenCalledWith('beat listener failed', expect.any(Error));
    // Beat 1 of the first bar was lost; everything after it still arrived.
    expect(beats.map((b) => b.beat)).toEqual([0, 2, 3, 0]);
    reported.mockRestore();
  });

  it('counts the count-in bar separately from the music', () => {
    const beats: Beat[] = [];
    const metronome = new Metronome(engine, { ...FOUR_FOUR, countInBars: 1 }, (b) => beats.push(b));
    metronome.start();
    runClock(8.2);
    metronome.stop();

    expect(beats.slice(0, 4).every((b) => b.isCountIn)).toBe(true);
    expect(beats.slice(0, 4).every((b) => b.bar === -1)).toBe(true);
    expect(beats[4]).toMatchObject({ beat: 0, bar: 0, isCountIn: false });
  });

  it('subdivides a compound pulse and marks which clicks are the beat', () => {
    const beats: Beat[] = [];
    const metronome = new Metronome(
      engine,
      { tempo: 60, beatsPerBar: 2, secondaryAccents: [], subdivision: 3, countInBars: 0 },
      (b) => beats.push(b),
    );
    metronome.start();
    runClock(2.2);
    metronome.stop();

    expect(beats.slice(0, 6).map((b) => b.isPulse)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(beats.slice(0, 6).map((b) => b.accent)).toEqual([
      'strong',
      'subdivision',
      'subdivision',
      'weak',
      'subdivision',
      'subdivision',
    ]);
    // Three clicks per pulse at 60 BPM is one click every 200ms.
    expect(clicks()[1]!.at - clicks()[0]!.at).toBeCloseTo(1 / 3, 5);
  });

  it('stops reporting once stopped', () => {
    const beats: Beat[] = [];
    const metronome = new Metronome(engine, FOUR_FOUR, (b) => beats.push(b));
    metronome.start();
    runClock(2.2);
    const delivered = beats.length;
    metronome.stop();
    runClock(4);

    expect(beats).toHaveLength(delivered);
    expect(metronome.isRunning).toBe(false);
  });
});
