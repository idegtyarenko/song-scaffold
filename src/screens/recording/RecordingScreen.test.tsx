// @vitest-environment jsdom
/**
 * The screen as the player works it: a file chosen with the button or carried onto the
 * drop zone, the passport that comes back, and what is said when the file will not open.
 *
 * The transport is driven the way a player drives it: a stretch dragged across the canvas
 * with a pointer, the space bar, the buttons. jsdom lays nothing out, so the canvas is told
 * how wide it is — without that a drag has no seconds in it and there is no loop to test.
 *
 * The audio context is the double the whole app is tested against — the real one decodes
 * nothing in jsdom, and what is being checked is the screen, not the codec. The waveform it
 * hands the decoded buffer to is the real component: jsdom lays it out to nothing, so it
 * draws nothing, which is exactly as much as this file has an opinion about.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { decodesWith, passes, stubAudio } from '../../audio/fake-context';

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

/** What the transport says it will play. */
const reading = () => document.querySelector('.transport__reading')?.textContent ?? '';

/** How wide the canvas claims to be, so a drag across it means seconds. */
const WIDTH = 500;

/** A pointer event as the browser would send it. jsdom has no `PointerEvent` of its own. */
function point(type: string, clientX: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX });
  Object.assign(event, { pointerId: 1 });
  fireEvent($('canvas'), event);
}

/** Drag a stretch out, from one place across the canvas to another. */
function dragAcross(from: number, to: number): void {
  point('pointerdown', from);
  point('pointermove', to);
  point('pointerup', to);
}

/** A key press at the document, which is where the screen's shortcuts are listened for. */
function press(key: string): void {
  fireEvent.keyDown(document, { key, code: key === ' ' ? 'Space' : key });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: WIDTH,
    bottom: 100,
    width: WIDTH,
    height: 100,
    toJSON: () => ({}),
  });
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

describe('the transport', () => {
  /** A round hundred seconds, so a drag across the canvas lands on times worth reading. */
  beforeEach(() => {
    decodes = () => Promise.resolve(decoded(100));
  });

  /** Open the screen with a recording already on it. */
  async function withRecording() {
    const opened = await openScreen();
    pick(file('Purple Haze.mp3'));
    await waitFor(() => expect(passport()).toMatch(/Purple Haze\.mp3/));
    return opened;
  }

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

    point('pointerdown', 250);
    point('pointerup', 250);
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
    expect(passes()[0]!.stopped).toBe(true);
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

    expect(passes()[0]!.stopped).toBe(true);
    expect(passes().at(-1)!.offsetSec).toBeCloseTo(40, 5);
    expect($('#playRecording').textContent).toBe('Stop');
  });

  it('falls silent when the loop it was playing is cleared', async () => {
    await withRecording();
    dragAcross(100, 300);
    press(' ');

    fireEvent.click($('#clearSelection'));

    expect($('#playRecording').textContent).toBe('Play');
    expect(passes().every((pass) => pass.stopped)).toBe(true);
  });

  it('leaves no sound behind on the way out', async () => {
    await withRecording();
    dragAcross(100, 300);
    press(' ');

    fireEvent.click($('#backToSetup'));

    expect(passes().every((pass) => pass.stopped)).toBe(true);
  });

  it('drops the loop and the sound when another file is opened', async () => {
    await withRecording();
    dragAcross(100, 300);
    press(' ');

    pick(file('second.mp3', 'goodbye'));

    await waitFor(() => expect(passport()).toMatch(/second\.mp3/));
    expect(reading()).toBe('Drag across the waveform to loop part of it.');
    expect(passes().every((pass) => pass.stopped)).toBe(true);
  });
});
