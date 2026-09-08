// @vitest-environment jsdom
/**
 * Drives the whole app as it runs: the React setup screen hands off to the session, which
 * `main.ts` still draws imperatively, and the Web Audio wiring is watched on a fake clock.
 * The setup form has its own tests in SetupScreen.test.tsx; what is checked here is the
 * session it opens.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Under the jsdom environment `import.meta.url` is an http URL, so resolve from the root.
const INDEX_HTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const BODY_HTML = /<body[^>]*>([\s\S]*)<\/body>/.exec(INDEX_HTML)![1]!;

// jsdom has no layout, so it implements no scrolling. The ladder scrolls its current row
// into view whenever it is open.
Element.prototype.scrollIntoView = vi.fn();

/** Every oscillator the metronome scheduled, in order. */
let clicks: { frequency: number; at: number }[] = [];
let audio: FakeAudioContext | null = null;

class FakeAudioContext {
  currentTime = 0;

  constructor() {
    audio = this;
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
      start: (at: number) => clicks.push({ frequency: oscillator.frequency.value, at }),
      stop: vi.fn(),
    };
    return oscillator;
  }
}

/** Run the audio clock and the scheduler's lookahead timer together. */
function runClock(seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.025) {
    audio!.currentTime += 0.025;
    vi.advanceTimersByTime(25);
  }
}

/**
 * `vi.resetModules()` gives us a fresh module but the same jsdom `document`, so each boot
 * would otherwise leave the previous instance's global key handler attached and firing at
 * detached nodes. Track what main.ts registers and take it back down.
 */
let documentListeners: [string, EventListenerOrEventListenerObject][] = [];
const addEventListenerForReal = document.addEventListener.bind(document);

function trackDocumentListeners(): void {
  for (const [type, listener] of documentListeners) document.removeEventListener(type, listener);
  documentListeners = [];
  document.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    documentListeners.push([type, listener]);
    addEventListenerForReal(type, listener, options);
  }) as typeof document.addEventListener;
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

async function bootApp({ wide = false } = {}): Promise<void> {
  cleanup();
  clicks = [];
  audio = null;
  localStorage.clear();
  vi.resetModules();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  stubMatchMedia(wide);
  trackDocumentListeners();
  // The session screen still comes from the page; React renders the rest into it.
  document.body.innerHTML = BODY_HTML;
  const { App } = await import('./App');
  render(<App />);
}

const $ = <T extends HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};

const text = (selector: string) => $(selector).textContent?.trim() ?? '';

/** Note values are drawn as SVG, so read them back through the label they carry. */
function readNotes(selector: string): string {
  const node = $(selector).cloneNode(true) as HTMLElement;
  for (const glyph of node.querySelectorAll('svg.glyph')) {
    glyph.replaceWith(node.ownerDocument.createTextNode(`[${glyph.getAttribute('aria-label')}]`));
  }
  return node.textContent?.trim() ?? '';
}
const click = (selector: string) => fireEvent.click($<HTMLButtonElement>(selector));

// The setup screen is React's, so its fields are set through Testing Library: assigning to
// `input.value` updates React's own value tracker, which then swallows the event.
function setNumber(selector: string, value: number): void {
  const input = $<HTMLInputElement>(selector);
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

function choose(name: string, value: string): void {
  fireEvent.click($(`input[name="${name}"][value="${value}"]`));
}

function selectMeter(id: string): void {
  fireEvent.change($('#meter'), { target: { value: id } });
}

function setCountIn(on: boolean): void {
  const box = $<HTMLInputElement>('#countIn');
  if (box.checked !== on) fireEvent.click(box);
}

/** The visible ladder, as `["60 · segments 1–3", ...]`. */
function ladder(): string[] {
  return [...document.querySelectorAll('#ladderBody .ladder__row')].map((row) => {
    const cells = [...row.querySelectorAll('.ladder__cell')].map((cell) => cell.textContent);
    return `${cells[1]} · ${cells[2]}`;
  });
}

function setUp(segments: number, from: 'top' | 'bottom', start: number, target: number): void {
  setNumber('#totalSegments', segments);
  choose('direction', from);
  setNumber('#startTempo', start);
  setNumber('#targetTempo', target);
  setNumber('#rungs', 7); // 60, 67, 73, 79, 83, 87, 90 for a 60->90 range
  selectMeter('4/4');
}

describe('the app', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await bootApp();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('opens the session on the first segment at the start tempo', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    expect($('#session').hidden).toBe(false);
    expect(text('#nowChunk')).toBe('Play segment 1');
    expect(text('#nowTempo')).toBe('60');
    expect(text('#nowStage')).toBe('Stage 1 of 4');
    expect(text('#nowRung')).toBe('step 1 of 7');
  });

  it('shows the whole stage-3 ladder, tail included', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    click('#nextStage');
    click('#nextStage');

    expect(text('#nowStage')).toBe('Stage 3 of 4');
    expect(text('#nowChunk')).toBe('Play segments 1–3');
    expect(text('#nowTempo')).toBe('60');
    expect(ladder()).toEqual([
      '60 · segments 1–3',
      '67 · segment 3',
      '73 · segments 2–3',
      '79 · segment 3',
      '83 · segments 1–3',
      '87 · segment 3',
      '90 · segments 2–3',
      '90 · segment 3',
      '90 · segments 1–3',
    ]);
  });

  it('walks chunk and tempo together, and back again', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    click('#nextStage');
    click('#nextStage');

    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      click('#faster');
      seen.push(`${text('#nowTempo')} · ${text('#nowChunk')}`);
    }
    expect(seen).toEqual(['67 · Play segment 3', '73 · Play segments 2–3', '79 · Play segment 3']);

    click('#slower');
    expect(`${text('#nowTempo')} · ${text('#nowChunk')}`).toBe('73 · Play segments 2–3');
    expect(text('#nowRung')).toBe('step 3 of 9');
  });

  it('drops back to the start tempo when you add a segment mid-climb', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    click('#faster');
    click('#faster');
    expect(text('#nowTempo')).toBe('73');
    click('#nextStage');
    expect(text('#nowStage')).toBe('Stage 2 of 4');
    expect(text('#nowTempo')).toBe('60');
    expect(text('#nowChunk')).toBe('Play segments 1–2');
  });

  it('badges the rungs that run on at the target tempo', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    click('#nextStage');
    click('#nextStage');
    for (let i = 0; i < 7; i++) click('#faster');
    expect($('#nowBadge').hidden).toBe(false);
    expect(text('#nowTempo')).toBe('90');

    click('#faster');
    expect(text('#nowChunk')).toBe('Play segments 1–3');
    expect($<HTMLButtonElement>('#faster').disabled).toBe(true);
    expect($<HTMLButtonElement>('#nextStage').classList.contains('button--suggested')).toBe(true);
  });

  it('stops at both ends instead of wrapping', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    expect($<HTMLButtonElement>('#slower').disabled).toBe(true);
    expect($<HTMLButtonElement>('#prevStage').disabled).toBe(true);
    for (let i = 0; i < 10; i++) click('#nextStage');
    expect(text('#nowStage')).toBe('Stage 4 of 4');
    expect($<HTMLButtonElement>('#nextStage').disabled).toBe(true);
  });

  it('builds from the bottom of the passage when asked', () => {
    setUp(4, 'bottom', 60, 90);
    click('#begin');
    expect(text('#nowChunk')).toBe('Play segment 4');

    click('#nextStage');
    expect(text('#nowChunk')).toBe('Play segments 3–4');
    click('#faster');
    expect(text('#nowChunk')).toBe('Play segment 3');
  });

  it('marks which segments are in the stage and which are sounding', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    click('#nextStage');
    click('#faster'); // stage 2, chunk [2]
    const pips = [...document.querySelectorAll('#pips .pips__pip')].map((pip) => ({
      label: pip.textContent,
      inStage: pip.classList.contains('pips__pip--in-stage'),
      playing: pip.classList.contains('pips__pip--playing'),
    }));
    expect(pips).toEqual([
      { label: '1', inStage: true, playing: false },
      { label: '2', inStage: true, playing: true },
      { label: '3', inStage: false, playing: false },
      { label: '4', inStage: false, playing: false },
    ]);
  });

  it('clicks a 4/4 bar with a count-in, and restarts on the downbeat at a new tempo', () => {
    setUp(4, 'top', 60, 90);
    setCountIn(true);
    click('#begin');

    click('#playPause');
    expect(text('#playPause')).toBe('Stop');
    expect(document.querySelectorAll('#beats .beats__dot')).toHaveLength(4);

    // A whole count-in bar a fifth below, then the music, one beat a second at 60 BPM.
    runClock(5);
    const countIn = clicks.slice(0, 4).map((c) => c.frequency);
    expect(countIn.every((f) => f < 1200)).toBe(true);
    expect(countIn[0]).toBeCloseTo(1600 * (2 / 3), 5);
    expect(clicks[4]!.frequency).toBe(1600);
    expect(clicks[1]!.at - clicks[0]!.at).toBeCloseTo(1, 5);

    // A new rung starts its own bar from the top, at the new tempo.
    clicks = [];
    click('#faster');
    expect(text('#nowTempo')).toBe('67');
    runClock(2);
    expect(clicks[0]!.frequency).toBeCloseTo(1600 * (2 / 3), 5);
    expect(clicks[1]!.at - clicks[0]!.at).toBeCloseTo(60 / 67, 5);

    click('#playPause');
    expect(text('#playPause')).toBe('Start');
  });

  it('lights the beat dots and the bar you are on as the click sounds', () => {
    setUp(4, 'top', 60, 90);
    setCountIn(false);
    click('#begin');
    click('#nextStage');
    click('#nextStage'); // stage 3, chunk [1,2,3]
    click('#playPause');

    const lit = () => [...document.querySelectorAll('#beats .beats__dot')].findIndex((dot) =>
      dot.classList.contains('beats__dot--on'),
    );
    const barNow = () => [...document.querySelectorAll('#pips .pips__pip--playing')].findIndex(
      (pip) => pip.classList.contains('pips__pip--now'),
    );

    runClock(0.2);
    expect(lit()).toBe(0);
    expect(barNow()).toBe(0);

    runClock(1.05); // one beat later, still bar 1 of the chunk
    expect(lit()).toBe(1);
    expect(barNow()).toBe(0);

    runClock(3.05); // into the next bar of a three-bar chunk
    expect(lit()).toBe(0);
    expect(barNow()).toBe(1);
  });

  it('accents 4/4 on one and three', () => {
    setUp(4, 'top', 60, 90);
    setCountIn(false);
    click('#begin');
    click('#playPause');
    runClock(5);
    expect(clicks.slice(0, 4).map((c) => c.frequency)).toEqual([1600, 900, 1200, 900]);
  });

  it('draws the half note of 2/2, which no font would render', () => {
    setUp(4, 'top', 60, 90);
    selectMeter('2/2');
    expect(readNotes('#meterHint')).toBe(
      'Counted in 2 · tempo is [half note] = BPM. The quarters click too up to ' +
        '[half note]=59, then drop away so you can feel the pulse.',
    );

    click('#begin');
    expect(readNotes('#nowBeatName')).toBe('[half note]');
    expect($('#nowBeatName svg.glyph')).toBeTruthy();
  });

  it('subdivides 6/8 while it is slow and drops to the pulse once it is fast', () => {
    setUp(4, 'top', 60, 90);
    setCountIn(false);
    selectMeter('6/8');
    expect(readNotes('#meterHint')).toBe(
      'Counted in 2 · tempo is [dotted quarter note] = BPM. The eighths click too up to ' +
        '[dotted quarter note]=80, then drop away so you can feel the pulse.',
    );

    click('#begin');
    // Two dots for the two dotted beats, whatever the click grid is doing.
    expect(document.querySelectorAll('#beats .beats__dot')).toHaveLength(2);
    expect(readNotes('#nowBeatName')).toBe('[dotted quarter note]');
    expect($('#nowSubdivision').hidden).toBe(false);
    expect(text('#nowSubdivision')).toBe('+ eighths');

    // At ♩.=60 the eighths click too: strong, two quiet, weak, two quiet.
    click('#playPause');
    runClock(3);
    expect(clicks.slice(0, 6).map((c) => c.frequency)).toEqual([
      1600, 700, 700, 900, 700, 700,
    ]);

    // Climb past ♩.=80 and they drop away, leaving the two dotted beats.
    for (let i = 0; i < 5; i++) click('#faster');
    expect(text('#nowTempo')).toBe('87');
    expect($('#nowSubdivision').hidden).toBe(true);
    clicks = [];
    runClock(3);
    // Nothing but the two dotted beats, alternating strong and weak.
    expect(clicks.length).toBeGreaterThanOrEqual(4);
    expect([...new Set(clicks.map((c) => c.frequency))].sort((a, b) => a - b)).toEqual([
      900, 1600,
    ]);
    expect(document.querySelectorAll('#beats .beats__dot')).toHaveLength(2);
  });

  it('leaves a simple meter to its own pulse once it is at speed', () => {
    setUp(4, 'top', 60, 90);
    setCountIn(false);
    click('#begin');
    expect($('#nowSubdivision').hidden).toBe(true);
    click('#playPause');
    runClock(5);
    expect(clicks.slice(0, 4).map((c) => c.frequency)).toEqual([1600, 900, 1200, 900]);
  });

  it('clicks the upbeats of a simple meter while the pulse is slower than a second', () => {
    setUp(4, 'top', 40, 90); // ladder: 40, 52, 62, 71, 79, 85, 90
    setCountIn(false);
    expect(readNotes('#meterHint')).toBe(
      'Counted in 4 · tempo is [quarter note] = BPM. The eighths click too up to ' +
        '[quarter note]=59, then drop away so you can feel the pulse.',
    );

    click('#begin');
    // Four dots for the four quarters, whatever the click grid is doing.
    expect(document.querySelectorAll('#beats .beats__dot')).toHaveLength(4);
    expect($('#nowSubdivision').hidden).toBe(false);
    expect(text('#nowSubdivision')).toBe('+ eighths');

    // At ♩=40 an eighth falls between every pair of quarters.
    click('#playPause');
    runClock(6.2);
    expect(clicks.slice(0, 8).map((c) => c.frequency)).toEqual([
      1600, 700, 900, 700, 1200, 700, 900, 700,
    ]);

    // Cross ♩=60 and the upbeats drop away, leaving the four quarters.
    click('#faster');
    click('#faster');
    expect(text('#nowTempo')).toBe('62');
    expect($('#nowSubdivision').hidden).toBe(true);
    clicks = [];
    runClock(9);
    // Clearing lands mid-bar, so read the bar that starts at the next downbeat.
    const tones = clicks.map((c) => c.frequency);
    expect(tones.slice(tones.indexOf(1600), tones.indexOf(1600) + 4)).toEqual([
      1600, 900, 1200, 900,
    ]);
    expect(tones).not.toContain(700);
  });

  it('leaves the ladder collapsed on a narrow window', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    expect($<HTMLDetailsElement>('#ladderPanel').open).toBe(false);
  });

  it('opens the ladder as a side column on a wide window', async () => {
    await bootApp({ wide: true });
    setUp(4, 'top', 60, 90);
    click('#begin');
    expect($<HTMLDetailsElement>('#ladderPanel').open).toBe(true);
  });

  it('drives the transport from the keyboard', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    press('ArrowUp');
    expect(text('#nowTempo')).toBe('67');
    press('ArrowDown');
    expect(text('#nowTempo')).toBe('60');

    press('ArrowRight'); // no Shift: must not change stage
    expect(text('#nowStage')).toBe('Stage 1 of 4');
    press('ArrowRight', { shiftKey: true });
    expect(text('#nowStage')).toBe('Stage 2 of 4');
    press('ArrowLeft', { shiftKey: true });
    expect(text('#nowStage')).toBe('Stage 1 of 4');

    press(' ', { code: 'Space' });
    expect(text('#playPause')).toBe('Stop');
  });

});

function press(key: string, init: KeyboardEventInit = {}): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}
