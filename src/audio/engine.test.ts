// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine';
import { contextsBuilt, stubAudio, type FakeAudioContext } from './fake-context';

/** Gestures are dispatched at a target of the test's own, so no test hears another's. */
let gestures: HTMLElement;

describe('AudioEngine', () => {
  beforeEach(() => {
    // A detached element, not the document: gesture listeners are never taken down, so a
    // shared target would let one test's engine hear the next test's tap.
    gestures = document.createElement('div');
    stubAudio();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hands out one context however many parts ask for it', () => {
    const engine = new AudioEngine();
    expect(engine.context).toBe(engine.context);
    expect(engine.output).toBe(engine.context.destination);
    expect(contextsBuilt()).toBe(1);
  });

  it('hands out one moment for everything that has to start together', () => {
    const engine = new AudioEngine();
    engine.context.currentTime = 4;

    // Two sounds started from two readings of the clock are two starts. Whoever wants the
    // click and the recording to begin together asks once and passes the answer to both.
    const moment = engine.soon();
    expect(moment).toBeGreaterThan(4);
    engine.context.currentTime = 4.05;
    expect(engine.soon()).toBeGreaterThan(moment);
  });

  it('builds nothing until something wants to play', () => {
    // Typing a tempo or tabbing through the setup form is a gesture like any other, and it
    // must not open a context that has nothing to play — iOS counts an idle one against us.
    const engine = new AudioEngine();
    engine.listenForGesture(gestures);

    gestures.dispatchEvent(new Event('keydown'));
    gestures.dispatchEvent(new Event('keydown'));
    gestures.dispatchEvent(new Event('pointerdown'));

    expect(contextsBuilt()).toBe(0);
    expect(engine.currentTime).toBe(0);
  });

  it('unlocks the sound on the gesture that starts it', () => {
    // The press that starts the click reaches the button first and the document listener
    // after, so the context exists by the time the unlock runs.
    const engine = new AudioEngine();
    const start = gestures.appendChild(document.createElement('button'));
    start.addEventListener('pointerdown', () => engine.context.destination);
    engine.listenForGesture(gestures);

    start.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(contextsBuilt()).toBe(1);
    expect(engine.context.state).toBe('running');
  });

  it('unlocks again after the sound is suspended from outside', () => {
    // iOS suspends the context on an interruption — a call, the lock screen — and the next
    // tap has to bring it back, or the click is silent for the rest of the session.
    const engine = new AudioEngine();
    engine.listenForGesture(gestures);
    // Asking for the context is what opens it, the way the first gesture that plays would.
    const context = engine.context as unknown as FakeAudioContext;
    gestures.dispatchEvent(new Event('keydown'));

    context.state = 'suspended';
    gestures.dispatchEvent(new Event('keydown'));

    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(engine.context.state).toBe('running');
    expect(contextsBuilt()).toBe(1);
  });
});
