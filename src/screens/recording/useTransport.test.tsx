// @vitest-environment jsdom
/**
 * What the recording screen sounds: the loop, and the click standing over it.
 *
 * The two are one subject because of one requirement — they begin on the same moment of the
 * audio clock — and the case that matters most here is the one that proves it: a loop left
 * running for two minutes with a downbeat, not just any click, still landing on every seam.
 * Nothing re-synchronises; the loop is a whole number of bars, so the click's period divides
 * it, and both are counted from one clock.
 *
 * Driven through the real screen rather than through the hook, because what a player has is
 * the screen: a drag, a space bar, a number typed into a field.
 */

import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clicks, forgetClicks, passes, runClock } from '../../audio/fake-context';

/** The pitch the metronome gives the first beat of a bar. */
const DOWNBEAT = 1600;
import {
  $,
  bus,
  clickReading,
  decoded,
  decodesInto,
  dragAcross,
  file,
  openScreen,
  passport,
  press,
  pick,
  reading,
  stretchCanvas,
  tapAt,
} from './harness';

beforeEach(() => {
  // A round hundred seconds, so a drag across the canvas lands on times worth reading.
  decodesInto(() => Promise.resolve(decoded(100)));
  stretchCanvas();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Open the screen with a recording already on it. */
async function withRecording() {
  const opened = await openScreen();
  pick(file('Purple Haze.mp3'));
  await waitFor(() => expect(passport()).toMatch(/Purple Haze\.mp3/));
  return opened;
}

describe('the transport', () => {
  it('plays the whole recording from the top when nothing is selected', async () => {
    await withRecording();
    expect(reading()).toBe('Drag across the waveform to loop part of it.');

    fireEvent.click($('#playRecording'));

    expect(passes()).toHaveLength(1);
    expect(passes()[0]!.offsetSec).toBe(0);
    expect(passes()[0]!.durationSec).toBeCloseTo(100, 5);
    expect($('#playRecording').textContent).toBe('Stop');
  });

  it('starts from the cursor once one has been put down', async () => {
    await withRecording();

    tapAt(250);
    fireEvent.click($('#playRecording'));

    expect(passes()[0]!.offsetSec).toBeCloseTo(50, 5);
  });

  it('loops the stretch that was dragged out, and says which one', async () => {
    await withRecording();

    dragAcross(100, 300);

    expect(reading()).toBe('Looping 0:20.0 – 1:00.0 · 40.0 s');
    expect($('#playRecording').textContent).toBe('Play the loop');

    fireEvent.click($('#playRecording'));
    expect(passes()[0]!.offsetSec).toBeCloseTo(20, 5);
    // Forty seconds of stretch, and the moment after it to fade over.
    expect(passes()[0]!.durationSec).toBeGreaterThan(40);
  });

  it('starts and stops on the space bar', async () => {
    await withRecording();
    dragAcross(100, 300);

    press(' ');
    expect($('#playRecording').textContent).toBe('Stop');
    expect(passes()).toHaveLength(1);

    press(' ');
    expect($('#playRecording').textContent).toBe('Play the loop');
    expect(passes()[0]!.silenced).toBe(true);
  });

  it('stops on Escape, and puts the loop away on the next one', async () => {
    await withRecording();
    dragAcross(100, 300);
    press(' ');

    press('Escape');
    expect($('#playRecording').textContent).toBe('Play the loop');
    expect(reading()).toMatch(/Looping/);

    press('Escape');
    expect(reading()).toBe('Drag across the waveform to loop part of it.');
  });

  it('moves a running loop onto the stretch that replaces it', async () => {
    await withRecording();
    dragAcross(100, 300);
    press(' ');

    dragAcross(200, 400);

    expect(passes()[0]!.silenced).toBe(true);
    expect(passes().at(-1)!.offsetSec).toBeCloseTo(40, 5);
    expect($('#playRecording').textContent).toBe('Stop');
  });

  it('falls silent when the loop it was playing is cleared', async () => {
    await withRecording();
    dragAcross(100, 300);
    press(' ');

    fireEvent.click($('#clearSelection'));

    expect($('#playRecording').textContent).toBe('Play');
    expect(passes().every((pass) => pass.silenced)).toBe(true);
  });

  it('leaves no sound behind on the way out', async () => {
    await withRecording();
    dragAcross(100, 300);
    press(' ');

    fireEvent.click($('#backToSetup'));

    expect(passes().every((pass) => pass.silenced)).toBe(true);
  });

  it('drops the loop and the sound when another file is opened', async () => {
    await withRecording();
    dragAcross(100, 300);
    press(' ');

    pick(file('second.mp3', 'goodbye'));

    await waitFor(() => expect(passport()).toMatch(/second\.mp3/));
    expect(reading()).toBe('Drag across the waveform to loop part of it.');
    expect(passes().every((pass) => pass.silenced)).toBe(true);
  });
});

describe('the click over the loop', () => {
  /** Open the screen with a recording and a twenty-second loop on it. */
  async function withLoop() {
    await withRecording();
    dragAcross(100, 200);
  }

  /**
   * Hand the clock over to the test. Done here rather than in `beforeEach` because opening a
   * file is asynchronous, and `waitFor` on a frozen clock waits for ever.
   */
  function takeTheClock(): void {
    vi.useFakeTimers();
  }

  it('has nothing to say until a loop has been dragged out', async () => {
    await openScreen();
    pick(file('Purple Haze.mp3'));
    await waitFor(() => expect(passport()).toMatch(/Purple Haze\.mp3/));

    expect(clickReading()).toMatch(/Drag a loop out of the waveform/);
    expect($<HTMLFieldSetElement>('.click__group').disabled).toBe(true);
  });

  it('divides the loop by the beats in it and says what that comes to', async () => {
    await withLoop();

    // Twenty seconds and two bars of 4/4 is eight beats, a beat every two and a half
    // seconds — slow enough that the meter puts a click on the upbeat as well.
    expect(clickReading()).toBe('20.0 s ÷ 2 bars of 4/4 → 24 BPM, clicking eighths');
  });

  it('says so rather than clicking when the answer is not a tempo to practise to', async () => {
    await withLoop();
    // A single bar of 4/4 across twenty seconds is twelve to the minute — a stopped clock.
    fireEvent.change($('#clickMeter'), { target: { value: '2/4' } });
    fireEvent.change($('#clickBars'), { target: { value: '1' } });

    expect(clickReading()).toMatch(/is not a tempo to practise to/);

    fireEvent.click($('#clickOn'));
    press(' ');
    expect(clicks()).toHaveLength(0);
    // The recording still plays: only the click had nothing to go on.
    expect(passes()).toHaveLength(1);
  });

  it('starts and stops with the recording, from one moment', async () => {
    await withLoop();
    fireEvent.change($('#clickBars'), { target: { value: '10' } });
    fireEvent.click($('#clickOn'));
    takeTheClock();

    press(' ');

    expect(clicks()[0]!.at).toBe(passes()[0]!.at);

    press(' ');
    expect(clicks().length).toBeGreaterThan(0);
    forgetClicks();
    runClock(2);
    expect(clicks()).toHaveLength(0);
  });

  it('keeps the downbeat on the seam of the loop, pass after pass', async () => {
    await withLoop();
    // Ten bars of 4/4 in twenty seconds is forty beats: 120 BPM, and a downbeat every fourth.
    fireEvent.change($('#clickBars'), { target: { value: '10' } });
    fireEvent.click($('#clickOn'));
    takeTheClock();
    press(' ');

    runClock(120);

    // Every moment a pass begins is a moment a *downbeat* sounds, to the microsecond — not
    // merely some click. Nothing re-synchronises: the loop is a whole number of bars, so the
    // period divides it, and both are counted from one clock.
    const downbeats = clicks()
      .filter((click) => click.frequency === DOWNBEAT)
      .map((click) => click.at);
    expect(passes().length).toBeGreaterThan(3);
    for (const pass of passes()) {
      expect(downbeats.some((at) => Math.abs(at - pass.at) < 1e-6)).toBe(true);
    }
  });

  it('moves the click against the recording without stopping either', async () => {
    await withLoop();
    fireEvent.change($('#clickBars'), { target: { value: '10' } });
    fireEvent.click($('#clickOn'));
    press(' ');
    const started = passes().length;

    fireEvent.change($('#clickLevel'), { target: { value: '0.4' } });

    expect(bus().gain.value).toBeCloseTo(0.4);
    // A knob, not a restart: the sound carries on underneath it.
    expect(passes()).toHaveLength(started);
    expect(passes().every((pass) => !pass.silenced)).toBe(true);
  });

  it('starts the loop again when the grid under it changes', async () => {
    await withLoop();
    fireEvent.change($('#clickBars'), { target: { value: '10' } });
    fireEvent.click($('#clickOn'));
    press(' ');
    const started = passes().length;

    fireEvent.change($('#clickMeter'), { target: { value: '3/4' } });

    // The click has to land back on the seam, and only a start can put it there.
    expect(passes().length).toBeGreaterThan(started);
    expect(passes()[0]!.silenced).toBe(true);
  });
});
