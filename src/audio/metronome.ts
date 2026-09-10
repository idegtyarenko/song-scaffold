/**
 * A Web Audio metronome.
 *
 * Clicks are scheduled a little ahead of time against the engine's clock, because
 * `setInterval` alone drifts audibly under any main-thread load. The interval only tops up
 * a short scheduling horizon; the audio clock does the timekeeping.
 *
 * Knows nothing about stages or chunks — it clicks, and reports the beats it played.
 */

import type { AudioEngine } from './engine';

const LOOKAHEAD_MS = 25;
const SCHEDULE_HORIZON_S = 0.1;

export type Accent = 'strong' | 'medium' | 'weak' | 'subdivision';

export interface Beat {
  /** 0-based pulse in the bar. */
  beat: number;
  /** 0-based bar since the click started, not counting the count-in. */
  bar: number;
  accent: Accent;
  /** False for the extra clicks inside a pulse. */
  isPulse: boolean;
  isCountIn: boolean;
}

export interface MetronomeConfig {
  /** BPM of the pulse, whatever the meter counts as one. */
  tempo: number;
  beatsPerBar: number;
  secondaryAccents: number[];
  /** Clicks per pulse. 1 for just the pulse. */
  subdivision: number;
  /** Bars of clicks before bar 0 of the music. */
  countInBars: number;
}

const TONES: Record<Accent, { frequency: number; gain: number }> = {
  strong: { frequency: 1600, gain: 0.5 },
  medium: { frequency: 1200, gain: 0.34 },
  weak: { frequency: 900, gain: 0.26 },
  subdivision: { frequency: 700, gain: 0.15 },
};

export class Metronome {
  private timer: number | null = null;
  private frame: number | null = null;
  private config: MetronomeConfig;
  /** Click index since the last (re)start, count-in and subdivisions included. */
  private tick = 0;
  private nextBeatTime = 0;
  private scheduled: OscillatorNode[] = [];
  private pending: { beat: Beat; time: number }[] = [];

  constructor(
    private readonly engine: AudioEngine,
    config: MetronomeConfig,
    private readonly onBeat: (beat: Beat) => void,
  ) {
    this.config = config;
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  /**
   * Starts clicking, at `at` on the audio clock or as soon as anything can start.
   *
   * The moment is an argument so that a caller with something else to start — a recording
   * to click over — can begin both from one reading of the clock rather than two.
   *
   * The engine is what satisfies the autoplay policy, so a start outside a user gesture is
   * silent until one arrives rather than an error here.
   */
  start(at: number = this.engine.soon()): void {
    if (this.isRunning) return;
    this.tick = 0;
    this.nextBeatTime = at;
    this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.frame = requestAnimationFrame(() => this.flushPending());
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.timer = null;
    this.frame = null;
    this.silencePending();
  }

  /**
   * Apply new settings. A tempo or meter change belongs to a new repetition, so the click
   * restarts on a downbeat (with its count-in) rather than sliding mid-bar.
   */
  reconfigure(config: MetronomeConfig): void {
    this.config = config;
    if (!this.isRunning) return;
    this.silencePending();
    this.tick = 0;
    this.nextBeatTime = this.engine.soon();
    this.schedule();
  }

  private schedule(): void {
    const now = this.engine.currentTime;
    const interval = 60 / (this.config.tempo * this.config.subdivision);
    while (this.nextBeatTime < now + SCHEDULE_HORIZON_S) {
      const beat = this.describe(this.tick);
      this.click(this.nextBeatTime, beat.accent, beat.isCountIn);
      this.pending.push({ beat, time: this.nextBeatTime });
      this.nextBeatTime += interval;
      this.tick++;
    }
  }

  private describe(tick: number): Beat {
    const { beatsPerBar, secondaryAccents, subdivision, countInBars } = this.config;
    const ticksPerBar = beatsPerBar * subdivision;
    const inBar = tick % ticksPerBar;
    const beat = Math.floor(inBar / subdivision);
    const isPulse = inBar % subdivision === 0;
    const accent: Accent = !isPulse
      ? 'subdivision'
      : beat === 0
        ? 'strong'
        : secondaryAccents.includes(beat)
          ? 'medium'
          : 'weak';
    return {
      beat,
      bar: Math.floor((tick - countInBars * ticksPerBar) / ticksPerBar),
      accent,
      isPulse,
      isCountIn: tick < countInBars * ticksPerBar,
    };
  }

  private click(at: number, accent: Accent, isCountIn: boolean): void {
    const { frequency, gain } = TONES[accent];
    const oscillator = this.engine.context.createOscillator();
    const envelope = this.engine.context.createGain();

    oscillator.type = 'square';
    // The count-in sits a fifth below the music, so it is unmistakable without being a
    // different kind of sound.
    oscillator.frequency.value = isCountIn ? frequency * (2 / 3) : frequency;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);

    oscillator.connect(envelope).connect(this.engine.output);
    oscillator.start(at);
    oscillator.stop(at + 0.06);
    this.scheduled.push(oscillator);
    oscillator.onended = () => {
      this.scheduled = this.scheduled.filter((node) => node !== oscillator);
    };
  }

  /**
   * Report beats to the UI as they actually sound, not as they were scheduled.
   *
   * A throw out of `onBeat` is reported and then dropped: this loop is the only thing
   * driving the beat display, so letting one bad beat escape would freeze the display for
   * the rest of the session while the click carried on playing. Logging keeps the failure
   * visible rather than swallowing it.
   *
   * Animation frames stop in a hidden tab, which is what we want — there is no dot to
   * update — and the backlog flushes in one pass when the tab comes back.
   */
  private flushPending(): void {
    const now = this.engine.currentTime;
    while (this.pending.length > 0 && this.pending[0]!.time <= now) {
      try {
        this.onBeat(this.pending.shift()!.beat);
      } catch (error) {
        console.error('beat listener failed', error);
      }
    }
    this.frame = requestAnimationFrame(() => this.flushPending());
  }

  private silencePending(): void {
    for (const oscillator of this.scheduled) {
      try {
        oscillator.stop();
      } catch {
        // Already stopped; nothing to do.
      }
    }
    this.scheduled = [];
    this.pending = [];
  }
}
