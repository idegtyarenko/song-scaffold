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

let scheduled: Click[] = [];
let built = 0;
let latest: FakeAudioContext | null = null;

/** A context that plays nothing and writes down what it was asked to play. */
export class FakeAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = { id: 'destination' } as unknown as AudioNode;

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

  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: (node: unknown) => node,
    };
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
  built = 0;
  latest = null;
  vi.stubGlobal('AudioContext', FakeAudioContext);
}

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
