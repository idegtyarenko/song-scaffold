// @vitest-environment jsdom
/**
 * Drives the real DOM through the real `main.ts` — the setup form, the four transport
 * buttons, the ladder table and the Web Audio wiring — so the app is verified as it runs
 * rather than as it reads.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Under the jsdom environment `import.meta.url` is an http URL, so resolve from the root.
const INDEX_HTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

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

async function bootApp(): Promise<void> {
  clicks = [];
  audio = null;
  localStorage.clear();
  vi.resetModules();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  document.body.innerHTML = INDEX_HTML.split('<body>')[1]!.split('</body>')[0]!;
  await import('./main');
}

const $ = <T extends HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};

const text = (selector: string) => $(selector).textContent?.trim() ?? '';
const click = (selector: string) => $<HTMLButtonElement>(selector).click();

function setNumber(selector: string, value: number): void {
  const input = $<HTMLInputElement>(selector);
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

function choose(name: string, value: string): void {
  const input = $<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** The visible ladder, as `["60 · bars 1–3", ...]`. */
function ladder(): string[] {
  return [...document.querySelectorAll('#ladderBody tr')].map((row) => {
    const cells = [...row.querySelectorAll('td')].map((cell) => cell.textContent);
    return `${cells[1]} · ${cells[2]}`;
  });
}

function setUp(segments: number, from: 'top' | 'bottom', start: number, target: number): void {
  setNumber('#totalSegments', segments);
  choose('direction', from);
  setNumber('#startTempo', start);
  setNumber('#targetTempo', target);
  setNumber('#rungs', 7); // 60, 67, 73, 79, 83, 87, 90 for a 60->90 range
  $<HTMLSelectElement>('#meter').value = '4/4';
  $('#meter').dispatchEvent(new Event('change', { bubbles: true }));
}

describe('the app', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await bootApp();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sizes the rung count to the tempo range until you say otherwise', () => {
    setNumber('#startTempo', 60);
    setNumber('#targetTempo', 90);
    expect($<HTMLInputElement>('#rungs').value).toBe('7');

    setNumber('#targetTempo', 120);
    expect($<HTMLInputElement>('#rungs').value).toBe('13');

    setNumber('#rungs', 5);
    setNumber('#targetTempo', 90);
    expect($<HTMLInputElement>('#rungs').value).toBe('5');
    expect($('#rungsAuto').getAttribute('aria-pressed')).toBe('false');
  });

  it('hands the rung count back to the tempo range when you tap Auto', () => {
    setNumber('#startTempo', 60);
    setNumber('#targetTempo', 90);
    setNumber('#rungs', 20);
    expect($<HTMLInputElement>('#rungs').value).toBe('20');

    click('#rungsAuto');
    expect($<HTMLInputElement>('#rungs').value).toBe('7');
    expect($('#rungsAuto').getAttribute('aria-pressed')).toBe('true');

    setNumber('#targetTempo', 120);
    expect($<HTMLInputElement>('#rungs').value).toBe('13');
  });

  it('shows a manual rung count as manual after a reload, and can still recover it', async () => {
    setNumber('#startTempo', 60);
    setNumber('#targetTempo', 90);
    setNumber('#rungs', 20);

    vi.resetModules();
    document.body.innerHTML = INDEX_HTML.split('<body>')[1]!.split('</body>')[0]!;
    await import('./main');

    expect($<HTMLInputElement>('#rungs').value).toBe('20');
    expect($('#rungsAuto').getAttribute('aria-pressed')).toBe('false');
    click('#rungsAuto');
    expect($<HTMLInputElement>('#rungs').value).toBe('7');
  });

  it('previews the shape of the session before you commit to it', () => {
    setUp(4, 'top', 60, 90);
    expect(text('#setupPreview')).toBe(
      '4 stages · 7 rungs from 60 to 90 BPM in each, opening at +12% and easing to the target.',
    );
    expect(text('#directionHint')).toContain('Start on bar 1');
  });

  it('opens the session on the first segment at the start tempo', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    expect($('#session').hidden).toBe(false);
    expect(text('#nowChunk')).toBe('Play bar 1');
    expect(text('#nowTempo')).toBe('60');
    expect(text('#nowStage')).toBe('Stage 1 of 4');
    expect(text('#nowRung')).toBe('rung 1 of 7');
  });

  it('shows the whole stage-3 ladder, tail included', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    click('#nextStage');
    click('#nextStage');

    expect(text('#nowStage')).toBe('Stage 3 of 4');
    expect(text('#nowChunk')).toBe('Play bars 1–3');
    expect(text('#nowTempo')).toBe('60');
    expect(ladder()).toEqual([
      '60 · bars 1–3',
      '67 · bar 3',
      '73 · bars 2–3',
      '79 · bar 3',
      '83 · bars 1–3',
      '87 · bar 3',
      '90 · bars 2–3',
      '90 · bar 3',
      '90 · bars 1–3',
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
    expect(seen).toEqual(['67 · Play bar 3', '73 · Play bars 2–3', '79 · Play bar 3']);

    click('#slower');
    expect(`${text('#nowTempo')} · ${text('#nowChunk')}`).toBe('73 · Play bars 2–3');
    expect(text('#nowRung')).toBe('rung 3 of 9');
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
    expect(text('#nowChunk')).toBe('Play bars 1–2');
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
    expect(text('#nowChunk')).toBe('Play bars 1–3');
    expect($<HTMLButtonElement>('#faster').disabled).toBe(true);
    expect($<HTMLButtonElement>('#nextStage').classList.contains('is-suggested')).toBe(true);
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
    expect(text('#nowChunk')).toBe('Play bar 4');

    click('#nextStage');
    expect(text('#nowChunk')).toBe('Play bars 3–4');
    click('#faster');
    expect(text('#nowChunk')).toBe('Play bar 3');
  });

  it('marks which segments are in the stage and which are sounding', () => {
    setUp(4, 'top', 60, 90);
    click('#begin');
    click('#nextStage');
    click('#faster'); // stage 2, chunk [2]
    const pips = [...document.querySelectorAll('#pips .pip')].map((pip) => ({
      label: pip.textContent,
      inStage: pip.classList.contains('pip--in-stage'),
      playing: pip.classList.contains('pip--playing'),
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
    $<HTMLInputElement>('#countIn').checked = true;
    $('#countIn').dispatchEvent(new Event('change', { bubbles: true }));
    click('#begin');

    click('#playPause');
    expect(text('#playPause')).toBe('Stop');
    expect(document.querySelectorAll('#beats .beat')).toHaveLength(4);

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
    $<HTMLInputElement>('#countIn').checked = false;
    $('#countIn').dispatchEvent(new Event('change', { bubbles: true }));
    click('#begin');
    click('#nextStage');
    click('#nextStage'); // stage 3, chunk [1,2,3]
    click('#playPause');

    const lit = () => [...document.querySelectorAll('#beats .beat')].findIndex((dot) =>
      dot.classList.contains('is-on'),
    );
    const barNow = () => [...document.querySelectorAll('#pips .pip--playing')].findIndex((pip) =>
      pip.classList.contains('is-now'),
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
    $<HTMLInputElement>('#countIn').checked = false;
    $('#countIn').dispatchEvent(new Event('change', { bubbles: true }));
    click('#begin');
    click('#playPause');
    runClock(5);
    expect(clicks.slice(0, 4).map((c) => c.frequency)).toEqual([1600, 900, 1200, 900]);
  });

  it('subdivides 6/8 while it is slow and drops to the pulse once it is fast', () => {
    setUp(4, 'top', 60, 90);
    $<HTMLInputElement>('#countIn').checked = false;
    $('#countIn').dispatchEvent(new Event('change', { bubbles: true }));
    $<HTMLSelectElement>('#meter').value = '6/8';
    $('#meter').dispatchEvent(new Event('change', { bubbles: true }));
    expect(text('#meterHint')).toBe(
      'Counted in 2 · tempo is ♩. = BPM. The eighths click too up to ♩.=80, ' +
        'then drop away so you can feel the pulse.',
    );

    click('#begin');
    // Two dots for the two dotted beats, whatever the click grid is doing.
    expect(document.querySelectorAll('#beats .beat')).toHaveLength(2);
    expect(text('#nowBeatName')).toBe('♩.');
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
    expect(document.querySelectorAll('#beats .beat')).toHaveLength(2);
  });

  it('leaves simple meters alone at any tempo', () => {
    setUp(4, 'top', 60, 90);
    $<HTMLInputElement>('#countIn').checked = false;
    $('#countIn').dispatchEvent(new Event('change', { bubbles: true }));
    click('#begin');
    expect($('#nowSubdivision').hidden).toBe(true);
    click('#playPause');
    runClock(5);
    expect(clicks.slice(0, 4).map((c) => c.frequency)).toEqual([1600, 900, 1200, 900]);
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

  it('remembers the setup across a reload', async () => {
    setUp(7, 'bottom', 80, 120);
    $<HTMLSelectElement>('#meter').value = '3/4';
    $('#meter').dispatchEvent(new Event('change', { bubbles: true }));

    // Same storage, fresh module and DOM.
    vi.resetModules();
    document.body.innerHTML = INDEX_HTML.split('<body>')[1]!.split('</body>')[0]!;
    await import('./main');

    expect($<HTMLInputElement>('#totalSegments').value).toBe('7');
    expect($<HTMLInputElement>('#startTempo').value).toBe('80');
    expect($<HTMLInputElement>('#targetTempo').value).toBe('120');
    expect($<HTMLSelectElement>('#meter').value).toBe('3/4');
    expect($<HTMLInputElement>('input[name="direction"][value="bottom"]').checked).toBe(true);
  });

  it('keeps the target at or above the start tempo', () => {
    setUp(4, 'top', 100, 120);
    setNumber('#targetTempo', 40);
    expect($<HTMLInputElement>('#targetTempo').value).toBe('100');
  });
});

function press(key: string, init: KeyboardEventInit = {}): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}
