// @vitest-environment jsdom
/**
 * The waveform as it is worked: wheel, drag, click, and the theme changing underneath it.
 *
 * jsdom has no canvas and no layout, so both are doubles — a context that records what was
 * asked of it, and a rectangle the canvas claims to occupy. What is being checked is never
 * how the picture looks but what the component does: which stretch it shows, how often it
 * touches the samples, and when it repaints.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    render(<Waveform buffer={recording()} />);

    await waitFor(() => expect(context.fill).toHaveBeenCalled());
    expect(context.rect).toHaveBeenCalledTimes(WIDTH);
    expect(range()).toBe('Showing 0:00 – 1:00');
  });

  it('zooms around the pointer on the wheel', async () => {
    render(<Waveform buffer={recording()} />);

    // A notch in, with the pointer on the middle of the canvas.
    fireEvent.wheel(canvas(), { deltaY: -100, clientX: WIDTH / 2 });

    // Narrower than the minute it started at, and still centred on the half-minute mark.
    await waitFor(() => expect(range()).toBe('Showing 0:05 – 0:55'));
  });

  it('zooms without going back to the samples', async () => {
    render(<Waveform buffer={recording()} />);
    await waitFor(() => expect(context.fill).toHaveBeenCalled());

    for (let notch = 0; notch < 10; notch += 1) {
      fireEvent.wheel(canvas(), { deltaY: -100, clientX: WIDTH / 2 });
    }

    await waitFor(() => expect(range()).not.toBe('Showing 0:00 – 1:00'));
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('pans sideways on a horizontal wheel', async () => {
    render(<Waveform buffer={recording()} />);
    fireEvent.wheel(canvas(), { deltaY: -400, clientX: WIDTH / 2 });
    await waitFor(() => expect(range()).toMatch(/^Showing 0:1/));

    fireEvent.wheel(canvas(), { deltaX: -300, deltaY: 0 });

    await waitFor(() => expect(range()).toBe('Showing 0:00 – 0:27'));
  });

  it('drags the waveform under the finger', async () => {
    render(<Waveform buffer={recording()} />);
    fireEvent.wheel(canvas(), { deltaY: -400, clientX: WIDTH / 2 });
    await waitFor(() => expect(range()).toBe('Showing 0:17 – 0:43'));

    point('pointerdown', 400);
    point('pointermove', 450);
    point('pointerup', 450);

    // Dragged to the right by a tenth of the canvas: the view moved back by a tenth of it.
    await waitFor(() => expect(range()).toBe('Showing 0:14 – 0:41'));
  });

  it('pinches two fingers apart to zoom in', async () => {
    render(<Waveform buffer={recording()} />);

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
    render(<Waveform buffer={recording()} />);
    await waitFor(() => expect(context.fill).toHaveBeenCalled());
    const before = range();

    point('pointerdown', 250);
    point('pointerup', 250);

    // Two pixels wide, the full height of the canvas, half way across it.
    await waitFor(() => expect(context.fillRect).toHaveBeenCalledWith(249, 0, 2, HEIGHT));
    expect(range()).toBe(before);
  });

  it('leaves the cursor alone when the click was the end of a drag', async () => {
    render(<Waveform buffer={recording()} />);
    await waitFor(() => expect(context.fill).toHaveBeenCalled());

    point('pointerdown', 250);
    point('pointermove', 300);
    point('pointerup', 300);

    await repainted();
    expect(context.fillRect).not.toHaveBeenCalledWith(expect.anything(), 0, 2, HEIGHT);
  });

  it('repaints when the system changes theme', async () => {
    render(<Waveform buffer={recording()} />);
    await waitFor(() => expect(context.fill).toHaveBeenCalled());
    const settled = context.fill.mock.calls.length;

    theme.matches = true;
    theme.dispatchEvent(new Event('change'));

    await repainted();
    // Nothing else moved: the repaint is the palette being read again, not a new view.
    expect(context.fill.mock.calls.length).toBe(settled + 1);
  });

  it('moves along the recording from the keyboard', async () => {
    render(<Waveform buffer={recording()} />);

    fireEvent.keyDown(canvas(), { key: '+' });
    await waitFor(() => expect(range()).toBe('Showing 0:10 – 0:50'));

    fireEvent.keyDown(canvas(), { key: 'ArrowRight' });
    await waitFor(() => expect(range()).toBe('Showing 0:18 – 0:58'));

    fireEvent.keyDown(canvas(), { key: 'Home' });
    await waitFor(() => expect(range()).toBe('Showing 0:00 – 1:00'));
  });
});
