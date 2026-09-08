/**
 * The one AudioContext of the application.
 *
 * The click and the reference recording have to stand on the same clock, or they drift
 * apart: two contexts are two clocks, and nothing lines them up afterwards. So the context
 * is created here, once, and everything that makes a sound is handed it.
 *
 * Autoplay policy also lives here. A fresh context is suspended until a user gesture
 * resumes it, and the first gesture anywhere in the app unlocks it — no individual button
 * has to remember to, and no sound is lost because the wrong one was pressed first.
 */

/** Gestures the autoplay policy accepts as "the user is here". */
const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'keydown'] as const;

export class AudioEngine {
  #context: AudioContext | null = null;

  /**
   * The context, created on first use.
   *
   * Deliberately lazy: a context built at page load starts suspended anyway, and on iOS an
   * unused one still counts against the app. Nothing is created until something wants to
   * play, or until the user's first gesture unlocks the sound.
   */
  get context(): AudioContext {
    this.#context ??= new AudioContext();
    return this.#context;
  }

  /** Now, on the audio clock. Zero before anything has asked for a context. */
  get currentTime(): number {
    return this.#context?.currentTime ?? 0;
  }

  /** Where everything that sounds connects. */
  get output(): AudioNode {
    return this.context.destination;
  }

  /**
   * Resume the context. Autoplay policy only lets this take effect once the user has
   * interacted with the page, and a context that is already running is left alone, so this
   * is safe to call as often as you like.
   */
  unlock(): void {
    if (this.#context?.state === 'running') return;
    void this.context.resume();
  }

  /**
   * Unlock on the user's first gesture, and on any later one that finds the sound
   * suspended — iOS suspends the context on an interruption (a call, a lock screen), and
   * the next tap is the earliest chance to bring it back.
   *
   * The listeners bubble, so a button's own handler runs first and may well start the click
   * before the sound is unlocked. That is harmless: a suspended clock does not advance, so
   * whatever was scheduled against it sounds from the top once the resume lands.
   */
  listenForGesture(target: EventTarget = document): void {
    for (const event of UNLOCK_EVENTS) target.addEventListener(event, () => this.unlock());
  }
}

/**
 * The application's engine. Modules that make sound take one as an argument rather than
 * importing this, so they can be tested against a context of the test's own making.
 */
export const audio = new AudioEngine();
