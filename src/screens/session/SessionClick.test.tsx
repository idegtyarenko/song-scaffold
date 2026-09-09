// @vitest-environment jsdom
/**
 * The click of a running session, watched on a fake clock: the count-in, the accents of a
 * meter, the subdivisions that come and go with the tempo, and what a move — or a move that
 * goes nowhere — does to the bar that is already sounding.
 *
 * The same vocabulary as SessionScreen.test.tsx, which is where the rest of the session is
 * worked; see `app-harness.tsx`. Clicks are read as the pitches they were scheduled at and
 * the times they were scheduled for, because that is what a player hears.
 */

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  begin,
  bootApp,
  button,
  click,
  clicks,
  commits,
  dots,
  forgetClicks,
  heard,
  litBeat,
  marks,
  press,
  runClock,
  segments,
  setUp,
  shown,
  tempo,
} from '../../app-harness';

describe('the click of a practice session', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await bootApp();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('clicks a 4/4 bar with a count-in, and restarts on the downbeat at a new tempo', () => {
    begin({ countIn: true });

    click('Start');
    expect(button('Stop')).toBeTruthy();
    expect(dots()).toHaveLength(4);

    // A whole count-in bar a fifth below, then the music, one beat a second at 60 BPM.
    runClock(5);
    expect(
      heard()
        .slice(0, 4)
        .every((frequency) => frequency < 1200),
    ).toBe(true);
    expect(heard()[0]).toBeCloseTo(1600 * (2 / 3), 5);
    expect(heard()[4]).toBe(1600);
    expect(clicks()[1]!.at - clicks()[0]!.at).toBeCloseTo(1, 5);

    // A new rung starts its own bar from the top, at the new tempo.
    forgetClicks();
    click(/Faster/);
    expect(tempo()).toBe(67);
    runClock(2);
    expect(heard()[0]).toBeCloseTo(1600 * (2 / 3), 5);
    expect(clicks()[1]!.at - clicks()[0]!.at).toBeCloseTo(60 / 67, 5);

    click('Stop');
    expect(button('Start')).toBeTruthy();
  });

  /**
   * A key at the edge of the ladder moves nothing, so the click must carry on: no count-in
   * tone (a fifth below the music), and every beat still on the same grid rather than the
   * bar restarting a fraction of a second after the press.
   */
  function expectClickUndisturbed(secondsPerBeat: number): void {
    expect(clicks().length).toBeGreaterThan(1);
    expect(heard().every((frequency) => [1600, 1200, 900].includes(frequency))).toBe(true);
    for (const [index, sounded] of clicks().slice(1).entries()) {
      expect(sounded.at - clicks()[index]!.at).toBeCloseTo(secondsPerBeat, 5);
    }
  }

  /** Press a key mid-repetition and listen to the three seconds that follow. */
  function afterPressing(key: string, init: KeyboardEventInit = {}): void {
    forgetClicks();
    press(key, init);
    runClock(3);
  }

  it('takes no notice of ↓ or ⇧← at the bottom of the first stage', () => {
    begin({ countIn: true });
    click('Start');
    runClock(5); // the count-in bar, and into the music

    afterPressing('ArrowDown');
    expectClickUndisturbed(1);
    afterPressing('ArrowLeft', { shiftKey: true });
    expectClickUndisturbed(1);
    expect(tempo()).toBe(60);
    expect(shown()).toContain('Stage 1 of 4');
  });

  it('takes no notice of ↑ or ⇧→ at the top of the last stage', () => {
    begin({ countIn: true });
    for (let i = 0; i < 3; i++) press('ArrowRight', { shiftKey: true });
    while (!button(/Faster/).disabled) press('ArrowUp');
    expect(shown()).toContain('Stage 4 of 4');
    expect(tempo()).toBe(90);

    click('Start');
    runClock(4); // the count-in bar at 90, and into the music

    afterPressing('ArrowUp');
    expectClickUndisturbed(60 / 90);
    afterPressing('ArrowRight', { shiftKey: true });
    expectClickUndisturbed(60 / 90);
    expect(tempo()).toBe(90);
    expect(shown()).toContain('Stage 4 of 4');
  });

  it('lights the beat dots and the bar you are on as the click sounds', () => {
    begin();
    click(/Next stage/);
    click(/Next stage/); // stage 3, chunk [1,2,3]
    click('Start');

    const barNow = () =>
      segments()
        .filter((segment) => marks(segment, 'playing'))
        .findIndex((segment) => marks(segment, 'now'));

    runClock(0.2);
    expect(litBeat()).toBe(0);
    expect(barNow()).toBe(0);

    runClock(1.05); // one beat later, still bar 1 of the chunk
    expect(litBeat()).toBe(1);
    expect(barNow()).toBe(0);

    runClock(3.05); // into the next bar of a three-bar chunk
    expect(litBeat()).toBe(0);
    expect(barNow()).toBe(1);
  });

  it('accents 4/4 on one and three', () => {
    begin();
    click('Start');
    runClock(5);
    expect(heard().slice(0, 4)).toEqual([1600, 900, 1200, 900]);
  });

  it('subdivides 6/8 while it is slow and drops to the pulse once it is fast', () => {
    setUp({ meter: '6/8' });
    expect(shown()).toContain(
      'Counted in 2 · tempo is [dotted quarter note] = BPM. The eighths click too up to ' +
        '[dotted quarter note]=80, then drop away so you can feel the pulse.',
    );

    click('Start practising');
    // Two dots for the two dotted beats, whatever the click grid is doing.
    expect(dots()).toHaveLength(2);
    expect(shown()).toContain('[dotted quarter note]');
    expect(shown()).toContain('+ eighths');

    // At ♩.=60 the eighths click too: strong, two quiet, weak, two quiet.
    click('Start');
    runClock(3);
    expect(heard().slice(0, 6)).toEqual([1600, 700, 700, 900, 700, 700]);

    // Climb past ♩.=80 and they drop away, leaving the two dotted beats.
    for (let i = 0; i < 5; i++) click(/Faster/);
    expect(tempo()).toBe(87);
    expect(shown()).not.toContain('+ eighths');
    forgetClicks();
    runClock(3);
    // Nothing but the two dotted beats, alternating strong and weak.
    expect(heard().length).toBeGreaterThanOrEqual(4);
    expect([...new Set(heard())].sort((a, b) => a - b)).toEqual([900, 1600]);
    expect(dots()).toHaveLength(2);
  });

  it('leaves a simple meter to its own pulse once it is at speed', () => {
    begin();
    expect(shown()).not.toContain('+ eighths');
    click('Start');
    runClock(5);
    expect(heard().slice(0, 4)).toEqual([1600, 900, 1200, 900]);
  });

  it('clicks the upbeats of a simple meter while the pulse is slower than a second', () => {
    setUp({ start: 40 }); // ladder: 40, 52, 62, 71, 79, 85, 90
    expect(shown()).toContain(
      'Counted in 4 · tempo is [quarter note] = BPM. The eighths click too up to ' +
        '[quarter note]=59, then drop away so you can feel the pulse.',
    );

    click('Start practising');
    // Four dots for the four quarters, whatever the click grid is doing.
    expect(dots()).toHaveLength(4);
    expect(shown()).toContain('+ eighths');

    // At ♩=40 an eighth falls between every pair of quarters.
    click('Start');
    runClock(6.2);
    expect(heard().slice(0, 8)).toEqual([1600, 700, 900, 700, 1200, 700, 900, 700]);

    // Cross ♩=60 and the upbeats drop away, leaving the four quarters.
    click(/Faster/);
    click(/Faster/);
    expect(tempo()).toBe(62);
    expect(shown()).not.toContain('+ eighths');
    forgetClicks();
    runClock(9);
    // Clearing lands mid-bar, so read the bar that starts at the next downbeat.
    const tones = heard();
    expect(tones.slice(tones.indexOf(1600), tones.indexOf(1600) + 4)).toEqual([
      1600, 900, 1200, 900,
    ]);
    expect(tones).not.toContain(700);
  });

  it('moves the beat display without rendering, however fast the click goes', async () => {
    begin({ start: 200, target: 200 }); // 300 ms a beat, the fastest anyone practises to
    click('Start');

    // The dots keep up at speed, driven straight from the beat.
    runClock(0.2);
    expect(litBeat()).toBe(0);
    runClock(0.31);
    expect(litBeat()).toBe(1);
    runClock(0.31);
    expect(litBeat()).toBe(2);

    // And they cost nothing. `runClock` drives a fake clock, under which React never gets
    // to finish work anyway — so the count is only worth reading once the real event loop
    // has had a turn. Ten more beats, and React has still not been asked to do anything:
    // a setState per beat shows up here as a commit, batched or not.
    const before = commits();
    runClock(3);
    vi.useRealTimers();
    await new Promise((settle) => setTimeout(settle, 0));
    expect(commits()).toBe(before);
  });

  it('lights the dot on the pulse alone, while the eighths click between', () => {
    setUp({ meter: '6/8' });
    click('Start practising');
    click('Start');

    runClock(0.2);
    expect(litBeat()).toBe(0);

    // An eighth has sounded in between, and the row has not answered it: the dots show the
    // pulse, so the lit one stays put until the next dotted beat.
    runClock(0.4);
    expect(heard()).toContain(700);
    expect(litBeat()).toBe(0);

    // Which is what moves it.
    runClock(0.5);
    expect(litBeat()).toBe(1);
  });
});
