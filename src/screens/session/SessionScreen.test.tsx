// @vitest-environment jsdom
/**
 * The practice session as the player works it: the setup screen hands off to it, and the
 * cursor moves under the buttons and the keys.
 *
 * Everything is reached the way a person reaches it — see `app-harness.tsx`, which holds
 * the boot and the vocabulary. The setup form has its own tests in setup/SetupScreen.test.tsx,
 * and the click has its own in SessionClick.test.tsx; what is checked here is what the screen
 * shows and what the controls do to it.
 */

import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  asked,
  begin,
  bootApp,
  button,
  click,
  ladder,
  ladderPanel,
  marks,
  press,
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
});
