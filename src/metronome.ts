/**
 * A Web Audio metronome.
 *
 * Clicks are scheduled a little ahead of time against `AudioContext.currentTime`, because
 * `setInterval` alone drifts audibly under any main-thread load. The interval only tops up
 * a short scheduling horizon; the audio clock does the timekeeping.
 *
 * Knows nothing about stages or chunks — it clicks, and reports the beats it played.
 */

const LOOKAHEAD_MS = 25;
const SCHEDULE_HORIZON_S = 0.1;

export type Accent = 'strong' | 'medium' | 'weak';

export interface Beat {
  /** 0-based position in the bar. */
  beat: number;
  /** 0-based bar since the click started, not counting the count-in. */
  bar: number;
  accent: Accent;
  isCountIn: boolean;
}

export interface MetronomeConfig {
  tempo: number;
  beatsPerBar: number;
  secondaryAccents: number[];
  /** Bars of clicks before bar 0 of the music. */
  countInBars: number;
}

const TONES: Record<Accent, { frequency: number; gain: number }> = {
  strong: { frequency: 1600, gain: 0.5 },
  medium: { frequency: 1200, gain: 0.34 },
  weak: { frequency: 900, gain: 0.26 },
};

export class Metronome {
  private context: AudioContext | null = null;
  private timer: number | null = null;
  private frame: number | null = null;
  private config: MetronomeConfig;
  /** Beat index since the last (re)start, count-in included. */
  private beatNumber = 0;
  private nextBeatTime = 0;
  private scheduled: OscillatorNode[] = [];
  private pending: { beat: Beat; time: number }[] = [];

  constructor(
    config: MetronomeConfig,
    private readonly onBeat: (beat: Beat) => void,
  ) {
    this.config = config;
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  /** Must be called from a user gesture the first time, to satisfy autoplay policy. */
  start(): void {
    if (this.isRunning) return;
    const context = this.ensureContext();
    void context.resume();
    this.beatNumber = 0;
    this.nextBeatTime = context.currentTime + 0.08;
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
    this.beatNumber = 0;
    this.nextBeatTime = this.ensureContext().currentTime + 0.08;
    this.schedule();
  }

  private ensureContext(): AudioContext {
    this.context ??= new AudioContext();
    return this.context;
  }

  private schedule(): void {
    const context = this.ensureContext();
    while (this.nextBeatTime < context.currentTime + SCHEDULE_HORIZON_S) {
      const beat = this.describe(this.beatNumber);
      this.click(context, this.nextBeatTime, beat.accent, beat.isCountIn);
      this.pending.push({ beat, time: this.nextBeatTime });
      this.nextBeatTime += 60 / this.config.tempo;
      this.beatNumber++;
    }
  }

  private describe(beatNumber: number): Beat {
    const { beatsPerBar, secondaryAccents, countInBars } = this.config;
    const countInBeats = countInBars * beatsPerBar;
    const beat = beatNumber % beatsPerBar;
    const accent: Accent =
      beat === 0 ? 'strong' : secondaryAccents.includes(beat) ? 'medium' : 'weak';
    return {
      beat,
      bar: Math.floor((beatNumber - countInBeats) / beatsPerBar),
      accent,
      isCountIn: beatNumber < countInBeats,
    };
  }

  private click(context: AudioContext, at: number, accent: Accent, isCountIn: boolean): void {
    const { frequency, gain } = TONES[accent];
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = 'square';
    // The count-in sits a fifth below the music, so it is unmistakable without being a
    // different kind of sound.
    oscillator.frequency.value = isCountIn ? frequency * (2 / 3) : frequency;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);

    oscillator.connect(envelope).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.06);
    this.scheduled.push(oscillator);
    oscillator.onended = () => {
      this.scheduled = this.scheduled.filter((node) => node !== oscillator);
    };
  }

  /** Report beats to the UI as they actually sound, not as they were scheduled. */
  private flushPending(): void {
    const now = this.context?.currentTime ?? 0;
    while (this.pending.length > 0 && this.pending[0]!.time <= now) {
      this.onBeat(this.pending.shift()!.beat);
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
