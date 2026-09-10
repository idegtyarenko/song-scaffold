/**
 * The Web Audio context the tests hear.
 *
 * jsdom implements no Web Audio at all, so everything that reaches the engine has to stand
 * one in. This is that stand-in, in one copy: the same double written three times was three
 * slightly different browsers, and a test could pass against a fake that none of the others
 * agreed with. It plays nothing and writes down what it was asked to play.
 *
 * Test code that lives in src because the layer rule puts it here — the engine's own tests,
 * the metronome's, and the screen tests through `app-harness.tsx` all take it from here.
 */

import { vi } from 'vitest';

/** One scheduled click: the pitch it sounds at, and when on the audio clock. */
export interface Click {
  frequency: number;
  at: number;
}

/** One point of a gain curve: what the level becomes, and when it gets there. */
export interface Level {
  value: number;
  at: number;
}

/** A gain the tests can read back: the level it sits at, its curve, and where it goes. */
export interface FakeGain {
  levels: Level[];
  connected: unknown[];
  gain: { value: number } & Record<string, unknown>;
  connect: (node: unknown) => unknown;
}

/**
 * One scheduled pass of a recording: where in the recording it reads from, when it sounds,
 * how much of it is played, and the shape it is faded with. Enough to tell a loop that
 * keeps its period from one that drifts, and a crossfaded seam from a cut one.
 */
export interface Pass {
  at: number;
  offsetSec: number;
  durationSec: number;
  levels: Level[];
  /**
   * Cut off rather than left to finish.
   *
   * Every pass is told when to stop the moment it is scheduled — that is its natural end.
   * Being told to stop with no time at all is a different thing entirely: it is a silencing,
   * and it is the only one of the two worth asserting about.
   */
  silenced: boolean;
  /** When it was told to end, or `null` when it was silenced where it stood. */
  stoppedAt: number | null;
  /** Report the sound as over, the way the browser does when a source runs out. */
  end: () => void;
}

let scheduled: Click[] = [];
let played: Pass[] = [];
let gains: FakeGain[] = [];
let built = 0;
let latest: FakeAudioContext | null = null;
let decoder: ((bytes: ArrayBuffer) => Promise<AudioBuffer>) | null = null;

/** A context that plays nothing and writes down what it was asked to play. */
export class FakeAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = { id: 'destination' } as unknown as AudioNode;

  /**
   * jsdom decodes nothing, so what comes back is whatever the test said it would —
   * a buffer of its own making, or a refusal like the one a real codec gives.
   */
  decodeAudioData = (bytes: ArrayBuffer): Promise<AudioBuffer> =>
    decoder?.(bytes) ?? Promise.reject(new DOMException('no decoder', 'EncodingError'));

  /** iOS suspends the context on an interruption; the next gesture has to bring it back. */
  resume = vi.fn(async () => {
    this.state = 'running';
  });

  constructor() {
    built += 1;
    // The rule is aimed at `const self = this` closures; here the double hands itself to the
    // test so the assertions can read what was scheduled.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    latest = this;
  }

  /**
   * A gain that remembers its curve. The clicks never look at it, but a loop is judged by
   * exactly this: whether the level was on its way down while the next pass was on its way
   * up, or whether the two met at an edge.
   */
  createGain() {
    const levels: Level[] = [];
    const connected: unknown[] = [];
    const at = (value: number, when: number) => {
      levels.push({ value, at: when });
    };
    const node: FakeGain = {
      levels,
      connected,
      gain: {
        value: 1,
        setValueAtTime: vi.fn(at),
        linearRampToValueAtTime: vi.fn(at),
        exponentialRampToValueAtTime: vi.fn(at),
      },
      connect: (to: unknown) => {
        connected.push(to);
        return to;
      },
    };
    gains.push(node);
    return node;
  }

  /**
   * A source that plays nothing and writes down what it was asked to play — including the
   * gain it was routed through, so a pass and the shape it fades with are read together.
   */
  createBufferSource() {
    let levels: Level[] = [];
    let pass: Pass | null = null;
    const source = {
      buffer: null as AudioBuffer | null,
      onended: null as ((this: unknown, event: Event) => unknown) | null,
      connect: (node: unknown) => {
        const gain = node as { levels?: Level[] };
        if (Array.isArray(gain.levels)) levels = gain.levels;
        return node;
      },
      start: (at: number, offsetSec = 0, durationSec = 0) => {
        pass = {
          at,
          offsetSec,
          durationSec,
          levels,
          silenced: false,
          stoppedAt: null,
          end: () => source.onended?.call(source, new Event('ended')),
        };
        played.push(pass);
      },
      stop: (at?: number) => {
        if (!pass) return;
        pass.silenced = at === undefined;
        pass.stoppedAt = at ?? null;
      },
    };
    return source;
  }

  createOscillator() {
    const oscillator = {
      type: '',
      frequency: { value: 0 },
      onended: null,
      connect: (node: unknown) => node,
      start: (at: number) => scheduled.push({ frequency: oscillator.frequency.value, at }),
      stop: vi.fn(),
    };
    return oscillator;
  }
}

/**
 * Put the double in the window's place, on a clean slate.
 *
 * Undone by `vi.unstubAllGlobals()`, which the tests already run after each case.
 */
export function stubAudio(): void {
  forgetClicks();
  played = [];
  gains = [];
  decoder = null;
  built = 0;
  latest = null;
  vi.stubGlobal('AudioContext', FakeAudioContext);
}

/** What the next decode answers: a buffer of the test's making, or a refusal. */
export function decodesWith(decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>): void {
  decoder = decode;
}

/** Every pass of a recording scheduled since the last `stubAudio()`, in order. */
export const passes = (): Pass[] => played;

/** Every gain node built since the last `stubAudio()`, in order — buses and envelopes alike. */
export const gainsBuilt = (): FakeGain[] => gains;

/** Every click scheduled since the last `forgetClicks()`, in order. */
export const clicks = (): Click[] => scheduled;

/** The same, as bare pitches — which accent fell where. */
export const heard = (): number[] => scheduled.map((click) => click.frequency);

export const forgetClicks = (): void => {
  scheduled = [];
};

/** How many contexts have been opened since `stubAudio()` — one is the whole point of the engine. */
export const contextsBuilt = (): number => built;

/** The context in play, to read its clock or to suspend it the way a phone call would. */
export function fakeContext(): FakeAudioContext {
  if (!latest) throw new Error('no AudioContext has been opened yet');
  return latest;
}

/** Run the audio clock and the scheduler's lookahead timer together. */
export function runClock(seconds: number): void {
  const context = fakeContext();
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.025) {
    context.currentTime += 0.025;
    vi.advanceTimersByTime(25);
  }
}
