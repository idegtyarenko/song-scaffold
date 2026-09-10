/**
 * Playing a stretch of a recording, over and over, without a click at the seam.
 *
 * A looping `AudioBufferSourceNode` would be the short answer, and it is the wrong one. It
 * leaves no gap in time, but it leaves one in amplitude: a cut at an arbitrary point of a
 * waveform is a step, and a step is a click. Heard once it is a tick; heard every four
 * seconds for twenty minutes it is the reason the practice stops.
 *
 * So each pass is scheduled on its own, and the seam is a crossfade. The outgoing pass
 * carries on a few milliseconds past the end of the stretch, fading out, while the incoming
 * one rises from the start of it. Both are ramps on the audio clock, so what meets in the
 * middle is a blend rather than an edge.
 *
 * What that buys, and why it is worth the arithmetic: the pass still begins exactly every
 * `length` seconds. The crossfade is spent on material *after* the stretch, never on
 * shortening it, so the loop keeps an exact period — which is what TASK-11 will need when
 * the click has to stand beside the recording for the length of a session without drifting.
 *
 * Scheduling follows the metronome next door: a timer that only tops up a short horizon,
 * and an audio clock that does the timekeeping. `setInterval` alone drifts under load; the
 * clock does not.
 */

import type { Selection } from '../model/selection';
import { selectionLength } from '../model/selection';
import type { AudioEngine } from './engine';

const LOOKAHEAD_MS = 25;
/** How far ahead passes are scheduled — a pass or two, never the whole session. */
const SCHEDULE_HORIZON_S = 0.3;

/**
 * The crossfade at the seam. Long enough that no step survives it, short enough that no
 * ear hears it as a fade: six milliseconds is about a third of one cycle of the lowest
 * note on a piano, and a couple of hundred of the highest.
 */
const SEAM_S = 0.006;

/** One scheduled pass: what it drives, and the shape it fades with. */
interface Pass {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * The one thing playing.
 *
 * A slot rather than a library of sounds: starting again replaces what is playing, and the
 * only two questions ever asked of it are whether it is playing and where it has got to.
 */
export class LoopPlayer {
  #engine: AudioEngine;
  #onStop: () => void;

  #timer: number | null = null;
  #buffer: AudioBuffer | null = null;
  #span: Selection = { fromSec: 0, toSec: 0 };
  #looping = false;

  /** When the first pass starts, on the audio clock, and when the next one will. */
  #startedAt = 0;
  #nextPassAt = 0;
  #playing: Pass[] = [];

  constructor(engine: AudioEngine, onStop: () => void = () => {}) {
    this.#engine = engine;
    this.#onStop = onStop;
  }

  get playing(): boolean {
    return this.#timer !== null;
  }

  /** The stretch being played, for a caller deciding whether it still wants this one. */
  get span(): Selection {
    return this.#span;
  }

  /**
   * Play this stretch, once or round and round, replacing whatever was playing.
   *
   * `at` is a moment on the audio clock, for a caller starting a click over the same
   * recording: one reading of the clock for both, so the two begin together rather than
   * eighty milliseconds apart in whichever direction the calls happened to fall.
   *
   * The engine is what answers the autoplay policy, so a start outside a user gesture is
   * silent until one arrives rather than an error here — the same bargain the metronome makes.
   */
  play(
    buffer: AudioBuffer,
    span: Selection,
    { loop = false, at = this.#engine.soon() } = {},
  ): void {
    this.#silence();
    if (selectionLength(span) <= 0) return;

    this.#buffer = buffer;
    this.#span = span;
    this.#looping = loop;
    this.#startedAt = at;
    this.#nextPassAt = this.#startedAt;
    this.#timer = window.setInterval(() => this.#schedule(), LOOKAHEAD_MS);
    this.#schedule();
  }

  /** Stop, and let the caller know the transport is idle again. */
  stop(): void {
    if (!this.playing) return;
    this.#silence();
    this.#onStop();
  }

  /**
   * Where the sound has got to, or null when nothing is playing.
   *
   * Asked once a frame by whatever draws the playhead, so it is arithmetic and nothing
   * else — no state of its own to fall out of step with the sound.
   */
  positionSec(): number | null {
    if (!this.playing) return null;
    const length = selectionLength(this.#span);
    const elapsed = this.#engine.currentTime - this.#startedAt;
    // Before the lead is up the sound has not started; the playhead waits at the top
    // rather than sliding backwards into the recording.
    if (elapsed <= 0) return this.#span.fromSec;
    if (!this.#looping) return this.#span.fromSec + Math.min(elapsed, length);
    return this.#span.fromSec + (elapsed % length);
  }

  /** Top up the horizon: every pass that starts before it, and no further. */
  #schedule(): void {
    const buffer = this.#buffer;
    if (!buffer) return;
    const length = selectionLength(this.#span);
    const horizon = this.#engine.currentTime + SCHEDULE_HORIZON_S;

    while (this.#nextPassAt < horizon) {
      this.#pass(this.#nextPassAt, buffer, length);
      this.#nextPassAt += length;
      // A single pass has nothing to follow it. The timer stays on until the sound is
      // actually over — the horizon is ahead of the ear, and stopping here would cut it.
      if (!this.#looping) {
        this.#buffer = null;
        return;
      }
    }
  }

  /**
   * One pass, with the seam built into it.
   *
   * The tail is material from after the stretch, played only to fade out over: it makes
   * the crossfade without moving the moment the next pass begins. A stretch that ends at
   * the end of the recording has no such material, and gets a plain fade instead — the seam
   * is then a dip rather than a blend, which is still not a click.
   */
  #pass(at: number, buffer: AudioBuffer, length: number): void {
    const context = this.#engine.context;
    const tail = Math.min(SEAM_S, Math.max(0, buffer.duration - this.#span.toSec));

    const source = context.createBufferSource();
    source.buffer = buffer;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(1, at + SEAM_S);
    gain.gain.setValueAtTime(1, at + length);
    gain.gain.linearRampToValueAtTime(0, at + length + tail);

    source.connect(gain).connect(this.#engine.musicOut);
    source.start(at, this.#span.fromSec, length + tail);
    source.stop(at + length + tail);

    const pass: Pass = { source, gain };
    this.#playing.push(pass);
    source.onended = () => {
      this.#playing = this.#playing.filter((played) => played !== pass);
      // The last pass of a single play is the end of the transport, and the button has to
      // hear about it. A loop never reaches this with the timer still on.
      if (this.#playing.length === 0 && this.#buffer === null && this.playing) this.stop();
    };
  }

  /** Cut everything scheduled, quietly — no callback, because this is how a restart begins. */
  #silence(): void {
    if (this.#timer !== null) window.clearInterval(this.#timer);
    this.#timer = null;
    this.#buffer = null;
    for (const { source } of this.#playing) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Never started, or already stopped; either way there is nothing to silence.
      }
    }
    this.#playing = [];
  }
}
