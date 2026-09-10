// @vitest-environment jsdom
/**
 * The screen as the player works it: a file chosen with the button or carried onto the
 * drop zone, the passport that comes back, and what is said when the file will not open.
 *
 * The audio context is the double the whole app is tested against — the real one decodes
 * nothing in jsdom, and what is being checked is the screen, not the codec. The waveform it
 * hands the decoded buffer to is the real component: jsdom lays it out to nothing, so it
 * draws nothing, which is exactly as much as this file has an opinion about.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { decodesWith, stubAudio } from '../../audio/fake-context';

/** How the double answers the next decode: a buffer of some length, or a refusal. */
let decodes: () => Promise<AudioBuffer>;

const $ = <T extends HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};

const file = (name: string, contents = 'hello') =>
  new File([contents], name, { type: 'audio/mpeg' });

/** The engine is a module-level singleton, so the screen is imported per test. */
async function openScreen(onBack = () => {}) {
  vi.resetModules();
  stubAudio();
  decodesWith(() => decodes());
  const { RecordingSlot } = await import('../../audio/recording');
  const releases = vi.spyOn(RecordingSlot.prototype, 'release');
  const { RecordingScreen } = await import('./RecordingScreen');
  render(<RecordingScreen onBack={onBack} />);
  return { releases };
}

/** Picking a file the way the hidden input reports it. */
function pick(picked: File): void {
  fireEvent.change($('#recordingFile'), { target: { files: [picked] } });
}

/** Carrying a file onto the zone. jsdom has no DataTransfer, so the drop states its own. */
function drop(dropped: File[]): void {
  const zone = $('.dropzone');
  fireEvent.dragOver(zone, { dataTransfer: { files: dropped, types: ['Files'] } });
  fireEvent.drop(zone, { dataTransfer: { files: dropped, types: ['Files'] } });
}

/** The passport as it reads on screen, `File Purple Haze.mp3 Length 4:31 …`. */
const passport = () => document.querySelector('.passport')?.textContent ?? '';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A decoded recording, as much of one as the screen and the waveform ever ask about. */
const decoded = (durationSec: number, sampleRate = 8000) =>
  ({
    duration: durationSec,
    sampleRate,
    length: Math.round(durationSec * sampleRate),
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(Math.round(durationSec * sampleRate)),
  }) as unknown as AudioBuffer;

beforeEach(() => {
  decodes = () => Promise.resolve(decoded(271.4));
});

describe('the recording screen', () => {
  it('opens a file chosen with the button and shows its passport', async () => {
    await openScreen();

    pick(file('Purple Haze.mp3'));

    await waitFor(() => expect(passport()).toMatch(/Purple Haze\.mp3/));
    expect(passport()).toMatch(/Length4:31/);
    expect(passport()).toMatch(/Size5 B/);
    // The digest of `hello`, shortened the way the screen shows it.
    expect(passport()).toMatch(/2cf24dba5fb0/);
    expect($('.passport__value[title]').getAttribute('title')).toHaveLength(64);
  });

  it('opens a file carried onto the drop zone', async () => {
    await openScreen();

    drop([file('dropped.mp3')]);

    await waitFor(() => expect(passport()).toMatch(/dropped\.mp3/));
  });

  it('shows the zone will take what is being carried, then stops when it leaves', async () => {
    await openScreen();
    const zone = $('.dropzone');

    fireEvent.dragOver(zone, { dataTransfer: { files: [], types: ['Files'] } });
    expect(zone.className).toMatch(/dropzone--carrying/);

    fireEvent.dragLeave(zone);
    expect(zone.className).not.toMatch(/dropzone--carrying/);
  });

  it('opens nothing when the drop carried no file', async () => {
    await openScreen();

    drop([]);

    expect(document.querySelector('.passport')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says which file it is working on while it works', async () => {
    // Held open by the test rather than by a slow decoder, and handed over before the
    // screen exists: the status has to be readable while the decoding is still running.
    let finish!: (buffer: AudioBuffer) => void;
    const decoding = new Promise<AudioBuffer>((resolve) => {
      finish = resolve;
    });
    decodes = () => decoding;
    await openScreen();

    pick(file('long.mp3'));

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Opening long.mp3…'));
    expect($<HTMLButtonElement>('#chooseRecording').disabled).toBe(true);

    finish(decoded(60));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(''));
    expect($<HTMLButtonElement>('#chooseRecording').disabled).toBe(false);
  });

  it('offers another file once one is open', async () => {
    await openScreen();
    expect($('#chooseRecording').textContent).toBe('Choose a file');

    pick(file('first.mp3'));
    await waitFor(() => expect($('#chooseRecording').textContent).toBe('Choose another file'));

    pick(file('second.mp3', 'goodbye'));
    await waitFor(() => expect(passport()).toMatch(/second\.mp3/));
    expect(passport()).not.toMatch(/first\.mp3/);
  });

  it('says what happened when the file is not audio it can decode', async () => {
    decodes = () => Promise.reject(new DOMException('Unable to decode', 'EncodingError'));
    await openScreen();

    pick(file('notes.txt', 'not audio at all'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/isn’t audio the browser can decode/),
    );
    // The screen stays where it is, with the way to try again still on it.
    expect($('#chooseRecording').textContent).toBe('Choose a file');
  });

  it('lets go of the decoded audio on the way out', async () => {
    const onBack = vi.fn();
    const { releases } = await openScreen(onBack);
    pick(file('Purple Haze.mp3'));
    await waitFor(() => expect(passport()).toMatch(/Purple Haze\.mp3/));
    const beforeLeaving = releases.mock.calls.length;

    fireEvent.click($('#backToSetup'));

    expect(releases.mock.calls.length).toBe(beforeLeaving + 1);
    expect(onBack).toHaveBeenCalledOnce();
  });
});
