// @vitest-environment jsdom
/**
 * The waveform as it is worked: wheel, drag, pinch, click, and the theme changing
 * underneath it.
 *
 * jsdom has no canvas and no layout, so both are doubles — a context that records what was
 * asked of it, and a rectangle the canvas claims to occupy. What is being checked is never
 * how the picture looks but what the component does: which stretch it shows, how often it
 * touches the samples, and when it repaints.
 */

import { useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Selection } from '../model/selection';
import { Waveform } from './Waveform';

const WIDTH = 500;
const HEIGHT = 100;

/** A minute of audio at a modest rate: long enough to zoom into, cheap enough to walk. */
const RATE = 8000;
const SECONDS = 60;

const context = {
  fillStyle: '',
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
};

/** The system theme, as something the test can change its mind about. */
const theme = new EventTarget() as EventTarget & { matches: boolean };

let reads: ReturnType<typeof vi.fn>;

function recording(): AudioBuffer {
  reads = vi.fn(() => new Float32Array(RATE * SECONDS));
  return {
    numberOfChannels: 1,
    length: RATE * SECONDS,
    sampleRate: RATE,
    duration: SECONDS,
    getChannelData: reads,
  } as unknown as AudioBuffer;
}

const canvas = () => screen.getByRole('img') as HTMLCanvasElement;
const range = () => screen.getByRole('figure').textContent ?? '';

/** What the last drag selected, and where the sound is — the screen's half of the wiring. */
let selected: Selection | null;
let head: number | null;
/** The one decoded recording of a case: built once, or every render would walk it again. */
let buffer: AudioBuffer;

/**
 * The waveform with the state it is normally given: the screen owns the stretch, the
 * component reports drags back to it, and both marks are read once a frame.
 */
function Wired() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const cursor = useRef<number | null>(null);
  return (
    <Waveform
      buffer={buffer}
      selection={selection}
      onSelect={(next) => {
        selected = next;
        setSelection(next);
      }}
      onSeek={(seconds) => (cursor.current = seconds)}
      cursorSec={() => cursor.current}
      playheadSec={() => head}
    />
  );
}

function draw(): void {
  selected = null;
  head = null;
  buffer = recording();
  render(<Wired />);
}

/** A vertical mark, two pixels wide, the full height — a cursor, an edge or the playhead. */
const markedAt = (x: number): boolean =>
  context.fillRect.mock.calls.some(
    ([left, top, width]) => left === x - 1 && top === 0 && width === 2,
  );

/** A pointer event as the browser would send it. jsdom has no `PointerEvent` of its own. */
function point(type: string, clientX: number, pointerId = 1): void {
  const event = new MouseEvent(type, { bubbles: true, clientX });
  Object.assign(event, { pointerId });
  fireEvent(canvas(), event);
}

/** Wait until the frame loop has painted again. */
async function repainted(): Promise<void> {
  const before = context.fill.mock.calls.length;
  await waitFor(() => expect(context.fill.mock.calls.length).toBeGreaterThan(before));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: WIDTH,
    bottom: HEIGHT,
    width: WIDTH,
    height: HEIGHT,
    toJSON: () => ({}),
  });
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  theme.matches = false;
  vi.stubGlobal('matchMedia', () => theme);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the waveform', () => {
  it('draws the whole recording, a column per pixel', async () => {
    draw();

    await waitFor(() => expect(context.fill).toHaveBeenCalled());
    expect(context.rect).toHaveBeenCalledTimes(WIDTH);
    expect(range()).toBe('Showing 0:00 – 1:00');
  });

  it('zooms around the pointer on the wheel', async () => {
    draw();

    // A notch in, with the pointer on the middle of the canvas.
    fireEvent.wheel(canvas(), { deltaY: -100, clientX: WIDTH / 2 });

    // Narrower than the minute it started at, and still centred on the half-minute mark.
    await waitFor(() => expect(range()).toBe('Showing 0:05 – 0:55'));
  });

  it('zooms without going back to the samples', async () => {
    draw();
    await waitFor(() => expect(context.fill).toHaveBeenCalled());

    for (let notch = 0; notch < 10; notch += 1) {
      fireEvent.wheel(canvas(), { deltaY: -100, clientX: WIDTH / 2 });
    }

    await waitFor(() => expect(range()).not.toBe('Showing 0:00 – 1:00'));
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('pans sideways on a horizontal wheel', async () => {
    draw();
    fireEvent.wheel(canvas(), { deltaY: -400, clientX: WIDTH / 2 });
    await waitFor(() => expect(range()).toMatch(/^Showing 0:1/));

    fireEvent.wheel(canvas(), { deltaX: -300, deltaY: 0 });

    await waitFor(() => expect(range()).toBe('Showing 0:00 – 0:27'));
  });

  it('drags the waveform under two fingers', async () => {
    draw();
    fireEvent.wheel(canvas(), { deltaY: -400, clientX: WIDTH / 2 });
    await waitFor(() => expect(range()).toBe('Showing 0:17 – 0:43'));

    point('pointerdown', 400, 1);
    point('pointerdown', 420, 2);
    point('pointermove', 450, 1);
    point('pointermove', 470, 2);
    point('pointerup', 450, 1);
    point('pointerup', 470, 2);

    // Dragged to the right by a tenth of the canvas: the view moved back by a tenth of it.
    await waitFor(() => expect(range()).toBe('Showing 0:14 – 0:41'));
    // And what the fingers were over was never mistaken for a stretch to loop.
    expect(selected).toBeNull();
  });

  it('pinches two fingers apart to zoom in', async () => {
    draw();

    point('pointerdown', 200, 1);
    point('pointerdown', 300, 2);
    point('pointermove', 100, 1);
    point('pointermove', 400, 2);
    point('pointerup', 100, 1);
    point('pointerup', 400, 2);

    // Three times as far apart: a third of the recording, still centred where the fingers were.
    await waitFor(() => expect(range()).toBe('Showing 0:20 – 0:40'));
  });

  it('puts the cursor down where it was clicked, without a render', async () => {
    draw();
    await waitFor(() => expect(context.fill).toHaveBeenCalled());
    const before = range();

    point('pointerdown', 250);
    point('pointerup', 250);

    // Two pixels wide, the full height of the canvas, half way across it.
    await waitFor(() => expect(context.fillRect).toHaveBeenCalledWith(249, 0, 2, HEIGHT));
    expect(range()).toBe(before);
  });

  it('selects the stretch a finger was dragged across', async () => {
    draw();
    await waitFor(() => expect(context.fill).toHaveBeenCalled());

    point('pointerdown', 100);
    point('pointermove', 300);
    point('pointerup', 300);

    // A fifth of the minute in, to three fifths of the way across it.
    expect(selected).toEqual({ fromSec: 12, toSec: 36 });
    // Drawn as a band the height of the canvas, with a mark on each edge.
    await waitFor(() => expect(context.fillRect).toHaveBeenCalledWith(100, 0, 200, HEIGHT));
    expect(markedAt(100)).toBe(true);
    expect(markedAt(300)).toBe(true);
    // The drag was a selection, not a click: the cursor stayed where it was not.
    expect(range()).toBe('Showing 0:00 – 1:00');
  });

  it('selects the same stretch dragged the other way', async () => {
    draw();

    point('pointerdown', 300);
    point('pointermove', 100);
    point('pointerup', 100);

    expect(selected).toEqual({ fromSec: 12, toSec: 36 });
  });

  it('takes hold of an edge to move it, leaving the other one where it is', async () => {
    draw();
    point('pointerdown', 100);
    point('pointermove', 300);
    point('pointerup', 300);
    expect(selected).toEqual({ fromSec: 12, toSec: 36 });

    // Landing within reach of the far edge and dragging it further out.
    point('pointerdown', 303);
    point('pointermove', 400);
    point('pointerup', 400);

    expect(selected).toEqual({ fromSec: 12, toSec: 48 });
  });

  it('gives the stretch back when a second finger turns the drag into a pinch', async () => {
    draw();
    point('pointerdown', 100);
    point('pointermove', 300);
    point('pointerup', 300);
    const before = selected;

    point('pointerdown', 200, 1);
    point('pointermove', 250, 1);
    expect(selected).not.toEqual(before);

    point('pointerdown', 300, 2);
    point('pointermove', 200, 1);
    point('pointermove', 400, 2);
    point('pointerup', 200, 1);
    point('pointerup', 400, 2);

    // The pinch zoomed, and the stretch that was showing survived it untouched.
    await waitFor(() => expect(range()).not.toBe('Showing 0:00 – 1:00'));
    expect(selected).toEqual(before);
  });

  it('moves the playhead without a render', async () => {
    draw();
    await waitFor(() => expect(context.fill).toHaveBeenCalled());
    const settled = range();

    head = 30;
    await waitFor(() => expect(markedAt(WIDTH / 2)).toBe(true));

    head = 45;
    await waitFor(() => expect(markedAt((WIDTH * 3) / 4)).toBe(true));
    expect(range()).toBe(settled);
  });

  it('paints nothing new while nothing moves', async () => {
    draw();
    await waitFor(() => expect(context.fill).toHaveBeenCalled());
    const settled = context.fill.mock.calls.length;

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(context.fill.mock.calls.length).toBe(settled);
  });

  it('repaints when the system changes theme', async () => {
    draw();
    await waitFor(() => expect(context.fill).toHaveBeenCalled());
    const settled = context.fill.mock.calls.length;

    theme.matches = true;
    theme.dispatchEvent(new Event('change'));

    await repainted();
    // Nothing else moved: the repaint is the palette being read again, not a new view.
    expect(context.fill.mock.calls.length).toBe(settled + 1);
  });

  it('moves along the recording from the keyboard', async () => {
    draw();

    fireEvent.keyDown(canvas(), { key: '+' });
    await waitFor(() => expect(range()).toBe('Showing 0:10 – 0:50'));

    fireEvent.keyDown(canvas(), { key: 'ArrowRight' });
    await waitFor(() => expect(range()).toBe('Showing 0:18 – 0:58'));

    fireEvent.keyDown(canvas(), { key: 'Home' });
    await waitFor(() => expect(range()).toBe('Showing 0:00 – 1:00'));
  });
});
