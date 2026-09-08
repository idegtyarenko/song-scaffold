// @vitest-environment jsdom
/**
 * The practice session as the player works it: the setup screen hands off to it, the cursor
 * moves under the buttons and the keys, and the click is watched on a fake clock.
 *
 * Everything is reached the way a person reaches it — see `app-harness.tsx`, which holds
 * the boot and the vocabulary. The setup form has its own tests in setup/SetupScreen.test.tsx;
 * what is checked here is the session it opens.
 */

import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  asked,
  begin,
  bootApp,
  button,
  click,
  clicks,
  commits,
  dots,
  forgetClicks,
  heard,
  ladder,
  ladderPanel,
  litBeat,
  marks,
  press,
  runClock,
  said,
  segments,
  setUp,
  shown,
  tempo,
} from '../../app-harness';

describe('the practice session', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await bootApp();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('opens on the first segment at the start tempo', () => {
    begin();
    // The form is behind us: what is on screen now is the session.
    expect(screen.queryByLabelText('Segments in the passage')).toBeNull();
    expect(asked()).toBe('Play segment 1');
    expect(tempo()).toBe(60);
    expect(shown()).toContain('Stage 1 of 4');
    expect(shown()).toContain('step 1 of 7');
    expect(shown()).not.toContain('at target');
  });

  it('shows the whole stage-3 ladder, tail included', () => {
    begin();
    click(/Next stage/);
    click(/Next stage/);

    expect(shown()).toContain('Stage 3 of 4');
    expect(asked()).toBe('Play segments 1–3');
    expect(tempo()).toBe(60);
    expect(ladder()).toEqual([
      '60 · segments 1–3',
      '67 · segment 3',
      '73 · segments 2–3',
      '79 · segment 3',
      '83 · segments 1–3',
      '87 · segment 3',
      '90 · segments 2–3',
      '90 · segment 3',
      '90 · segments 1–3',
    ]);
  });

  it('walks chunk and tempo together, and back again', () => {
    begin();
    click(/Next stage/);
    click(/Next stage/);

    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      click(/Faster/);
      seen.push(`${tempo()} · ${asked()}`);
    }
    expect(seen).toEqual(['67 · Play segment 3', '73 · Play segments 2–3', '79 · Play segment 3']);

    click(/Slower/);
    expect(`${tempo()} · ${asked()}`).toBe('73 · Play segments 2–3');
    expect(shown()).toContain('step 3 of 9');
  });

  it('drops back to the start tempo when you add a segment mid-climb', () => {
    begin();
    click(/Faster/);
    click(/Faster/);
    expect(tempo()).toBe(73);

    click(/Next stage/);
    expect(shown()).toContain('Stage 2 of 4');
    expect(tempo()).toBe(60);
    expect(asked()).toBe('Play segments 1–2');
  });

  it('badges the rungs that run on at the target tempo', () => {
    begin();
    click(/Next stage/);
    click(/Next stage/);
    for (let i = 0; i < 7; i++) click(/Faster/);
    expect(shown()).toContain('at target');
    expect(tempo()).toBe(90);

    click(/Faster/);
    expect(asked()).toBe('Play segments 1–3');
    expect(button(/Faster/).disabled).toBe(true);
    // The stage has come back round to everything built so far, so the one move left is
    // held out — on screen, and to anyone listening rather than looking.
    expect(button(/Next stage/).className).toContain('button--suggested');
    expect(said()).toContain('Stage complete — add the next segment.');
  });

  it('stops at both ends instead of wrapping', () => {
    begin();
    expect(button(/Slower/).disabled).toBe(true);
    expect(button(/Previous stage/).disabled).toBe(true);

    for (let i = 0; i < 10; i++) click(/Next stage/);
    expect(shown()).toContain('Stage 4 of 4');
    expect(button(/Next stage/).disabled).toBe(true);
  });

  it('builds from the bottom of the passage when asked', () => {
    begin({ from: 'Bottom' });
    expect(asked()).toBe('Play segment 4');

    click(/Next stage/);
    expect(asked()).toBe('Play segments 3–4');
    click(/Faster/);
    expect(asked()).toBe('Play segment 3');
  });

  it('marks which segments are in the stage and which are sounding', () => {
    begin();
    click(/Next stage/);
    click(/Faster/); // stage 2, chunk [2]
    expect(
      segments().map((segment) => ({
        label: segment.textContent,
        inStage: marks(segment, 'in-stage'),
        playing: marks(segment, 'playing'),
      })),
    ).toEqual([
      { label: '1', inStage: true, playing: false },
      { label: '2', inStage: true, playing: true },
      { label: '3', inStage: false, playing: false },
      { label: '4', inStage: false, playing: false },
    ]);
  });

  it('clicks a 4/4 bar with a count-in, and restarts on the downbeat at a new tempo', () => {
    begin({ countIn: true });

    click('Start');
    expect(button('Stop')).toBeTruthy();
    expect(dots()).toHaveLength(4);

    // A whole count-in bar a fifth below, then the music, one beat a second at 60 BPM.
    runClock(5);
    expect(heard().slice(0, 4).every((frequency) => frequency < 1200)).toBe(true);
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

  it('draws the half note of 2/2, which no font would render', () => {
    setUp({ meter: '2/2' });
    expect(shown()).toContain(
      'Counted in 2 · tempo is [half note] = BPM. The quarters click too up to ' +
        '[half note]=59, then drop away so you can feel the pulse.',
    );

    click('Start practising');
    // Drawn rather than typed, and named for anyone who cannot see the drawing.
    expect(screen.getAllByRole('img', { name: 'half note' }).length).toBeGreaterThan(0);
    expect(shown()).toContain('[half note]');
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

  it('leaves the ladder collapsed on a narrow window', () => {
    begin();
    expect(ladderPanel().open).toBe(false);
  });

  it('opens the ladder as a side column on a wide window', async () => {
    await bootApp({ wide: true });
    begin();
    expect(ladderPanel().open).toBe(true);
  });

  it('drives the transport from the keyboard', () => {
    begin();
    press('ArrowUp');
    expect(tempo()).toBe(67);
    press('ArrowDown');
    expect(tempo()).toBe(60);

    press('ArrowRight'); // no Shift: must not change stage
    expect(shown()).toContain('Stage 1 of 4');
    press('ArrowRight', { shiftKey: true });
    expect(shown()).toContain('Stage 2 of 4');
    press('ArrowLeft', { shiftKey: true });
    expect(shown()).toContain('Stage 1 of 4');

    press(' ', { code: 'Space' });
    expect(button('Stop')).toBeTruthy();
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
});
