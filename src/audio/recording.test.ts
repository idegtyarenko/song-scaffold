// @vitest-environment jsdom
/**
 * Opening a file, as far as this layer goes: the passport it produces, the one buffer it
 * allows itself, and what a person is told when the file will not open.
 */

import { describe, expect, it, vi } from 'vitest';

import type { AudioEngine } from './engine';
import { RecordingLoadError, RecordingSlot } from './recording';

/** SHA-256 of the five bytes of `hello`, as `shasum -a 256` prints it. */
const HELLO_SHA = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

const file = (name: string, contents = 'hello') =>
  new File([contents], name, { type: 'audio/mpeg' });

/** An engine whose context decodes however the test says, and nothing else. */
function engineDecoding(decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>) {
  const decodeAudioData = vi.fn(decode);
  const engine = { context: { decodeAudioData } } as unknown as AudioEngine;
  return { engine, decodeAudioData };
}

/** A buffer with the only property this layer reads off it. */
const decoded = (duration: number) => ({ duration }) as AudioBuffer;

describe('RecordingSlot', () => {
  it('builds the passport out of the file and the decoded sound', async () => {
    const { engine } = engineDecoding(async () => decoded(271.4));
    const slot = new RecordingSlot(engine);

    const recording = await slot.load(file('Purple Haze.mp3'));

    expect(recording.passport).toEqual({
      fileName: 'Purple Haze.mp3',
      bytes: 5,
      durationSec: 271.4,
      sha256: HELLO_SHA,
    });
    expect(slot.open).toBe(recording);
  });

  it('fingerprints the bytes, not the name — a renamed file is the same recording', async () => {
    const { engine } = engineDecoding(async () => decoded(1));
    const slot = new RecordingSlot(engine);

    const first = await slot.load(file('take-1.mp3'));
    const second = await slot.load(file('take-1 (copy).mp3'));
    const other = await slot.load(file('take-2.mp3', 'goodbye'));

    expect(second.passport.sha256).toBe(first.passport.sha256);
    expect(other.passport.sha256).not.toBe(first.passport.sha256);
  });

  it('lets go of the previous buffer before it decodes the next one', async () => {
    // The point of the whole class: not that the old buffer is replaced, but that there is
    // never a moment when both are in memory — which is exactly the moment of decoding.
    let openWhileDecoding: unknown = 'never asked';
    const { engine } = engineDecoding(async () => {
      openWhileDecoding = slot.open;
      return decoded(1);
    });
    const slot = new RecordingSlot(engine);

    await slot.load(file('first.mp3'));
    expect(slot.open).not.toBeNull();
    await slot.load(file('second.mp3'));

    expect(openWhileDecoding).toBeNull();
  });

  it('empties on release', async () => {
    const { engine } = engineDecoding(async () => decoded(1));
    const slot = new RecordingSlot(engine);

    await slot.load(file('first.mp3'));
    slot.release();

    expect(slot.open).toBeNull();
  });

  it('says what to do when the browser cannot decode the file', async () => {
    const { engine } = engineDecoding(() =>
      Promise.reject(new DOMException('Unable to decode audio data', 'EncodingError')),
    );
    const slot = new RecordingSlot(engine);

    const failure = await slot.load(file('notes.txt')).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RecordingLoadError);
    expect((failure as Error).message).toMatch(/isn’t audio the browser can decode/);
    // The browser's own wording is kept for the console, not shown to the player.
    expect((failure as Error).cause).toBeInstanceOf(DOMException);
    expect(slot.open).toBeNull();
  });

  it('says what to do when the file itself will not read', async () => {
    // What a file picked and then moved does: the handle is still there, the bytes are not.
    const gone = {
      name: 'moved.mp3',
      size: 5,
      arrayBuffer: () => Promise.reject(new DOMException('The file was moved', 'NotReadableError')),
    } as unknown as File;
    const { engine, decodeAudioData } = engineDecoding(async () => decoded(1));
    const slot = new RecordingSlot(engine);

    const failure = await slot.load(gone).catch((error: unknown) => error);

    expect((failure as Error).message).toMatch(/couldn’t be read/);
    expect(decodeAudioData).not.toHaveBeenCalled();
  });

  it('leaves nothing decoded when the next file fails to open', async () => {
    let decodes = 0;
    const { engine } = engineDecoding(async () => {
      decodes += 1;
      if (decodes === 2) throw new DOMException('Unable to decode audio data', 'EncodingError');
      return decoded(1);
    });
    const slot = new RecordingSlot(engine);

    await slot.load(file('good.mp3'));
    await expect(slot.load(file('bad.mp3'))).rejects.toBeInstanceOf(RecordingLoadError);

    expect(slot.open).toBeNull();
  });
});
