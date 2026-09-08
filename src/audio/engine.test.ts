// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine';

let built = 0;
/** Gestures are dispatched at a target of the test's own, so no test hears another's. */
let gestures: HTMLElement;

class FakeAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = { id: 'destination' } as unknown as AudioNode;
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  constructor() {
    built++;
  }
}

describe('AudioEngine', () => {
  beforeEach(() => {
    built = 0;
    // A detached element, not the document: gesture listeners are never taken down, so a
    // shared target would let one test's engine hear the next test's tap.
    gestures = document.createElement('div');
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hands out one context however many parts ask for it', () => {
    const engine = new AudioEngine();
    expect(engine.context).toBe(engine.context);
    expect(engine.output).toBe(engine.context.destination);
    expect(built).toBe(1);
  });

  it('builds nothing until something wants to play', () => {
    const engine = new AudioEngine();
    engine.listenForGesture(gestures);

    expect(built).toBe(0);
    expect(engine.currentTime).toBe(0);
  });

  it('unlocks the sound on the first gesture, whatever it is', () => {
    const engine = new AudioEngine();
    engine.listenForGesture(gestures);

    gestures.dispatchEvent(new Event('pointerdown'));

    expect(built).toBe(1);
    expect(engine.context.state).toBe('running');
  });

  it('unlocks again after the sound is suspended from outside', () => {
    // iOS suspends the context on an interruption — a call, the lock screen — and the next
    // tap has to bring it back, or the click is silent for the rest of the session.
    const engine = new AudioEngine();
    engine.listenForGesture(gestures);
    gestures.dispatchEvent(new Event('keydown'));
    const context = engine.context as unknown as FakeAudioContext;

    context.state = 'suspended';
    gestures.dispatchEvent(new Event('keydown'));

    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(engine.context.state).toBe('running');
    expect(built).toBe(1);
  });
});
