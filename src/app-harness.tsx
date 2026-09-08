/**
 * The app under test, booted and read back the way a player works it.
 *
 * Not shipped and not imported by anything the browser runs: this is the vocabulary the
 * screen tests are written in. Booting goes through the real setup form, because that is
 * the only way into a session, and everything is read back through what a person can
 * perceive — a control by the name it shows, a value by the words on screen. The two things
 * that carry no words, the beat dots and the segment map, are read where they are drawn.
 */

import { Profiler } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

/** One scheduled click: the pitch it sounds at, and when on the audio clock. */
export interface Click {
  frequency: number;
  at: number;
}

let scheduled: Click[] = [];
let context: FakeAudioContext | null = null;
let renders = 0;

/** Every click the metronome has scheduled since the last `forgetClicks()`, in order. */
export const clicks = (): Click[] => scheduled;
/** The same, as bare pitches — which accent fell where. */
export const heard = (): number[] => scheduled.map((click) => click.frequency);
export const forgetClicks = (): void => {
  scheduled = [];
};

/** Commits React has made since the app booted — one per render that reached the DOM. */
export const commits = (): number => renders;

/** A context that plays nothing and writes down what it was asked to play. */
class FakeAudioContext {
  currentTime = 0;

  constructor() {
    // The rule is aimed at `const self = this` closures; here the double hands itself to the
    // test so the assertions can read what was scheduled.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    context = this;
  }

  destination = {} as AudioNode;
  resume = vi.fn(async () => {});
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

/** Run the audio clock and the scheduler's lookahead timer together. */
export function runClock(seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.025) {
    context!.currentTime += 0.025;
    vi.advanceTimersByTime(25);
  }
}

/** jsdom implements no media queries, so the layout breakpoint is stated per test. */
function stubMatchMedia(wide: boolean): void {
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: wide,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(() => false),
  }));
}

/**
 * A fresh app on a fresh audio clock, with the window as wide as the test says.
 *
 * jsdom has no layout and so no scrolling, and the audio engine is a module-level singleton
 * holding one context — so the module graph is rebuilt too, or the second boot would
 * inherit the first one's clock.
 */
export async function bootApp({ wide = false } = {}): Promise<void> {
  cleanup();
  forgetClicks();
  context = null;
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.resetModules();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  stubMatchMedia(wide);
  const { App } = await import('./App');
  renders = 0;
  render(
    <Profiler id="app" onRender={() => { renders += 1; }}>
      <App />
    </Profiler>,
  );
}

/** A control by the name it shows: “↑ Faster 67 · segment 3” answers to /Faster/. */
export const button = (name: string | RegExp) =>
  screen.getByRole<HTMLButtonElement>('button', { name });

export const click = (name: string | RegExp): void => {
  fireEvent.click(button(name));
};

/**
 * The session listens on the document, so a key goes there rather than at an element —
 * wrapped in `act`, because what it reaches is React and the render has to settle first.
 */
export function press(key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
}

/**
 * Everything a sighted player can read: what is `hidden` is not shown, the line kept for
 * screen readers alone is not seen, and a note value drawn as SVG reads as the name it is
 * announced by, in brackets.
 */
export function shown(): string {
  const copy = document.body.cloneNode(true) as HTMLElement;
  for (const unseen of copy.querySelectorAll('[hidden], .visually-hidden')) unseen.remove();
  for (const glyph of copy.querySelectorAll('svg[role="img"]')) {
    glyph.replaceWith(document.createTextNode(`[${glyph.getAttribute('aria-label')}]`));
  }
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The same move spoken rather than drawn, for anyone not watching the screen. */
export const said = (): string => screen.getByRole('status').textContent?.trim() ?? '';

/** What the session is asking for right now, e.g. `Play segments 1–3`. */
export const asked = (): string => screen.getByText(/^Play /).textContent?.trim() ?? '';

/** The tempo out of the line that reads “60 ♩ = BPM”. */
export const tempo = (): number =>
  Number(screen.getByText('= BPM').closest('p')!.textContent!.replace(/\D/g, ''));

/** The drawer the ladder lives in — closed on a narrow window until the player opens it. */
export const ladderPanel = (): HTMLDetailsElement =>
  screen.getByText('Ladder for this stage').closest('details')!;

/** The ladder as it reads, `["60 · segments 1–3", ...]`, opening the drawer to see it. */
export function ladder(): string[] {
  if (!ladderPanel().open) fireEvent.click(screen.getByText('Ladder for this stage'));
  return screen
    .getAllByRole('row')
    .map((row) => within(row).queryAllByRole('cell'))
    .filter((cells) => cells.length > 0)
    .map(([, at, chunk]) => `${at!.textContent} · ${chunk!.textContent}`);
}

/** The beat dots are drawing, not words: the lit one is read where it is written. */
export const dots = (): Element[] => [...document.querySelectorAll('.beats__dot')];
export const litBeat = (): number =>
  dots().findIndex((dot) => dot.classList.contains('beats__dot--on'));

/** So is the segment map — in the stage, sounding, or the bar you are on. */
export const segments = (): Element[] => [
  ...document.querySelectorAll('.segment-map__segment'),
];
export const marks = (segment: Element, state: 'in-stage' | 'playing' | 'now'): boolean =>
  segment.classList.contains(`segment-map__segment--${state}`);

/**
 * The setup screen is React's, so its fields are filled through events: assigning to
 * `input.value` updates React's own value tracker, which then swallows the change.
 */
function setNumber(label: string, value: number): void {
  const input = screen.getByLabelText<HTMLInputElement>(label);
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

export interface Setup {
  segments?: number;
  from?: 'Top' | 'Bottom';
  start?: number;
  target?: number;
  /** 7 gives 60, 67, 73, 79, 83, 87, 90 for the 60→90 range these tests mostly use. */
  rungs?: number;
  meter?: string;
  countIn?: boolean;
}

/** Fill the setup form in, leaving it on screen — the hints are part of what it says. */
export function setUp({
  segments = 4,
  from = 'Top',
  start = 60,
  target = 90,
  rungs = 7,
  meter = '4/4',
  countIn = false,
}: Setup = {}): void {
  setNumber('Segments in the passage', segments);
  fireEvent.click(screen.getByRole('radio', { name: from }));
  setNumber('Start', start);
  setNumber('Target', target);
  setNumber('Tempo steps', rungs); // last: typing a count of your own takes it off Auto
  fireEvent.change(screen.getByLabelText('Time signature'), { target: { value: meter } });
  const box = screen.getByRole<HTMLInputElement>('checkbox');
  if (box.checked !== countIn) fireEvent.click(box);
}

/** Fill it in and go, which is the only way into a session. */
export function begin(settings: Setup = {}): void {
  setUp(settings);
  click('Start practising');
}
