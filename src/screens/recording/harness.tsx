/**
 * The recording screen as a player works it — the vocabulary its two test files share.
 *
 * Not shipped and imported by nothing the browser runs. A file is picked or carried in, a
 * stretch is dragged across the canvas with a pointer, keys go to the document. jsdom lays
 * nothing out, so the canvas is told how wide it is — without that a drag has no seconds in
 * it and there is no loop to test at all.
 *
 * The audio context is the double the whole app is tested against: the real one decodes
 * nothing in jsdom, and what is being checked is the screen, not the codec.
 */

import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';

import { decodesWith, gainsBuilt, stubAudio } from '../../audio/fake-context';

/** How wide the canvas claims to be, so a drag across it means seconds. */
export const WIDTH = 500;

/** How the double answers the next decode: a buffer of some length, or a refusal. */
let decodes: () => Promise<AudioBuffer> = () => Promise.resolve(decoded(271.4));

export function decodesInto(next: () => Promise<AudioBuffer>): void {
  decodes = next;
}

/** A decoded recording, as much of one as the screen and the waveform ever ask about. */
export const decoded = (durationSec: number, sampleRate = 8000) =>
  ({
    duration: durationSec,
    sampleRate,
    length: Math.round(durationSec * sampleRate),
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(Math.round(durationSec * sampleRate)),
  }) as unknown as AudioBuffer;

export const $ = <T extends HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};

export const file = (name: string, contents = 'hello') =>
  new File([contents], name, { type: 'audio/mpeg' });

/** The engine is a module-level singleton, so the screen is imported per test. */
export async function openScreen(onBack = () => {}) {
  vi.resetModules();
  stubAudio();
  decodesWith(() => decodes());
  const { RecordingSlot } = await import('../../audio/recording');
  const releases = vi.spyOn(RecordingSlot.prototype, 'release');
  const { RecordingScreen } = await import('./RecordingScreen');
  render(<RecordingScreen onBack={onBack} />);
  return { releases };
}

/** Give the canvas a size, so a drag across it lands on seconds of the recording. */
export function stretchCanvas(): void {
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
}

/** Picking a file the way the hidden input reports it. */
export function pick(picked: File): void {
  fireEvent.change($('#recordingFile'), { target: { files: [picked] } });
}

/** Carrying a file onto the zone. jsdom has no DataTransfer, so the drop states its own. */
export function drop(dropped: File[]): void {
  const zone = $('.dropzone');
  fireEvent.dragOver(zone, { dataTransfer: { files: dropped, types: ['Files'] } });
  fireEvent.drop(zone, { dataTransfer: { files: dropped, types: ['Files'] } });
}

/** A pointer event as the browser would send it. jsdom has no `PointerEvent` of its own. */
function point(type: string, clientX: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX });
  Object.assign(event, { pointerId: 1 });
  fireEvent($('canvas'), event);
}

/** Drag a stretch out, from one place across the canvas to another. */
export function dragAcross(from: number, to: number): void {
  point('pointerdown', from);
  point('pointermove', to);
  point('pointerup', to);
}

/** Put the cursor down at a place across the canvas. */
export function tapAt(x: number): void {
  point('pointerdown', x);
  point('pointerup', x);
}

/** A key press at the document, which is where the screen's shortcuts are listened for. */
export function press(key: string): void {
  fireEvent.keyDown(document, { key, code: key === ' ' ? 'Space' : key });
}

/** The passport as it reads on screen, `File Purple Haze.mp3 Length 4:31 …`. */
export const passport = () => document.querySelector('.passport')?.textContent ?? '';

/** What the transport says it will play. */
export const reading = () => document.querySelector('.transport__reading')?.textContent ?? '';

/** What the click panel says the tempo works out to. */
export const clickReading = () => document.querySelector('.click__reading')?.textContent ?? '';

/** The click bus — the one gain that goes somewhere and was never given a curve. */
export const bus = () =>
  gainsBuilt().find((gain) => gain.connected.length > 0 && gain.levels.length === 0)!;
