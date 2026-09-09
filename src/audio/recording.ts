/**
 * Opening a recording: a file the player picked, read into memory and decoded.
 *
 * Nothing is uploaded and nothing is stored yet — the file is read, fingerprinted and
 * decoded, and that is the whole life of it for now. Two rules shape what is below.
 *
 * Only one recording is ever decoded. Five minutes of stereo at 44.1 kHz is around 105 MB
 * of float32; the compressed file it came from is under ten. Holding two of those at once
 * is how a phone runs out of memory, so the previous buffer is dropped before the next file
 * is even read, rather than after the new one succeeds.
 *
 * The fingerprint is taken before decoding, because `decodeAudioData` detaches the
 * `ArrayBuffer` it is given: afterwards there are no bytes left to hash.
 */

import type { AudioPassport } from '../model/recording';
import type { AudioEngine } from './engine';

/** A recording as the application holds it: what it is, and the sound itself. */
export interface Recording {
  passport: AudioPassport;
  buffer: AudioBuffer;
}

/**
 * A failure the player is meant to read. The message says what happened to them and what
 * to do about it; the browser's own wording is kept as the `cause` for the console.
 */
export class RecordingLoadError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'RecordingLoadError';
  }
}

const UNREADABLE =
  'The file couldn’t be read. If it moved or was deleted since you picked it, pick it again.';

const UNDECODABLE =
  'This isn’t audio the browser can decode. MP3, M4A, WAV and OGG open everywhere; ' +
  'anything else may need converting first.';

/** SHA-256 of these bytes, lower-case hex — the same digest `shasum -a 256` prints. */
async function fingerprint(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The one decoded recording of the application.
 *
 * A slot rather than a loader: what matters is not that it can open a file but that it
 * holds at most one open at a time, and that the way to open the next is to let go of this
 * one first.
 */
export class RecordingSlot {
  #engine: AudioEngine;
  #open: Recording | null = null;

  constructor(engine: AudioEngine) {
    this.#engine = engine;
  }

  /** What is decoded right now, if anything. */
  get open(): Recording | null {
    return this.#open;
  }

  /** Let go of the decoded audio. The passport is cheap; the buffer is not. */
  release(): void {
    this.#open = null;
  }

  /**
   * Read, fingerprint and decode a file, and keep it. Releases first, so the peak is one
   * buffer and not two — a failed open therefore also leaves the slot empty, which is the
   * honest state: the player asked for a different recording and did not get one.
   */
  async load(file: File): Promise<Recording> {
    this.release();

    let bytes: ArrayBuffer;
    try {
      bytes = await file.arrayBuffer();
    } catch (cause) {
      throw new RecordingLoadError(UNREADABLE, cause);
    }

    const sha256 = await fingerprint(bytes);

    let buffer: AudioBuffer;
    try {
      buffer = await this.#engine.context.decodeAudioData(bytes);
    } catch (cause) {
      throw new RecordingLoadError(UNDECODABLE, cause);
    }

    this.#open = {
      passport: {
        fileName: file.name,
        bytes: file.size,
        durationSec: buffer.duration,
        sha256,
      },
      buffer,
    };
    return this.#open;
  }
}
