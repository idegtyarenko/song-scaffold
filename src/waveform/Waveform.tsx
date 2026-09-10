import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import './Waveform.css';
import type { Selection } from '../model/selection';
import { colorsOf, paint, type Colors } from './draw';
import { useWaveformGestures } from './gestures';
import { bucketSec, peaksOf, type Peaks } from './peaks';
import { clampView, panBy, whole, zoomAt, type View } from './view';

interface WaveformProps {
  /**
   * The decoded recording. A different recording is a different waveform: the screen gives
   * this component a `key`, so a new file arrives as a fresh one, zoomed out and with no
   * cursor, rather than as an old view pointing into audio that is no longer there.
   */
  buffer: AudioBuffer;
  /** The stretch that would be looped. Owned by the screen, which also has to say it aloud. */
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  /** A click on a moment: where a play with nothing selected would begin. */
  onSeek: (seconds: number) => void;
  /**
   * Where the sound is now, asked once a frame rather than passed as a value. A playhead
   * sliding across a minute of audio is a hundred answers a second, and a hundred renders
   * a second to move one line would be a hundred renders too many.
   */
  cursorSec: () => number | null;
  playheadSec: () => number | null;
}

/** How fast the wheel zooms — an ordinary notch of about 100 units moves roughly a fifth. */
const ZOOM_PER_UNIT = 0.002;
/** A trackpad pinch arrives as a wheel with `ctrlKey`, in much smaller steps. */
const PINCH_PER_UNIT = 0.01;
/** A wheel that reports lines instead of pixels, as Firefox does, at about a line of text. */
const PIXELS_PER_LINE = 16;
/** A keyboard step: an arrow moves a fifth of the view, plus and minus change it by half. */
const PACE = 0.2;
const STEP = 1.5;

/**
 * How far in a canvas this wide may be zoomed: one bucket of the envelope per column, and
 * no further. Past that there is nothing left in the envelope to show, only wider steps.
 */
function floorSpan(peaks: Peaks, width: number): number {
  return bucketSec(peaks) * Math.max(1, Math.round(width));
}

/**
 * The recording, drawn.
 *
 * The canvas is imperative and lives behind this one component: React owns its size and the
 * numbers going into it, and everything below that is a picture redrawn from scratch. Three
 * things keep that honest.
 *
 * The peak envelope is built once, when the recording opens, and every zoom is drawn by
 * combining its buckets — the samples themselves are walked exactly once.
 *
 * The visible stretch is React state, and so is the selection, because both change when a
 * person turns a wheel or drags — which is not something that happens per frame. The two
 * marks are not: they are read through functions once a frame, because the playhead moves on
 * the Web Audio clock, and a hundred renders a second to slide one line would be a hundred
 * renders too many.
 *
 * Redrawing happens in one animation frame loop that paints only when something changed —
 * so a resize, a theme switch, a zoom, a new selection and a moving playhead all arrive
 * through the same door.
 */
export function Waveform({
  buffer,
  selection,
  onSelect,
  onSeek,
  cursorSec,
  playheadSec,
}: WaveformProps) {
  const peaks = useMemo(() => peaksOf(buffer), [buffer]);
  const [view, setView] = useState<View>(() => whole(buffer.duration));

  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = useRef(view);
  const colors = useRef<Colors | null>(null);
  const stale = useRef(true);
  // What the marks read the last time anything was painted, so a frame that would draw the
  // same picture draws nothing at all.
  const painted = useRef<{ cursor: number | null; head: number | null }>({
    cursor: null,
    head: null,
  });

  // The moving parts are read through refs so the frame loop never runs a stale closure,
  // and the component need not re-render for the marks to move.
  const marks = useRef({ cursorSec, playheadSec, selection });
  useEffect(() => {
    marks.current = { cursorSec, playheadSec, selection };
  });

  /** The recording is never narrower than a bucket, or a one-frame file would divide by zero. */
  const duration = Math.max(peaks.durationSec, bucketSec(peaks));

  useEffect(() => {
    shown.current = view;
    stale.current = true;
  }, [view, selection]);

  // The frame loop. It measures the canvas itself rather than watching for resizes: it is
  // already running, and a rectangle read is cheaper than the second observer it replaces.
  useEffect(() => {
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const element = canvas.current;
      if (!element) return;

      const box = element.getBoundingClientRect();
      const nextWidth = Math.round(box.width);
      const nextHeight = Math.round(box.height);
      const nextDpr = window.devicePixelRatio || 1;
      // Laid out to nothing — a collapsed panel, or a test with no layout at all. There is
      // no picture to draw, and resizing the backing store to zero would only throw.
      if (!nextWidth || !nextHeight) return;

      if (nextWidth !== width || nextHeight !== height || nextDpr !== dpr) {
        width = nextWidth;
        height = nextHeight;
        dpr = nextDpr;
        element.width = Math.round(width * dpr);
        element.height = Math.round(height * dpr);
        stale.current = true;
      }

      const cursor = marks.current.cursorSec();
      const head = marks.current.playheadSec();
      if (cursor !== painted.current.cursor || head !== painted.current.head) {
        painted.current = { cursor, head };
        stale.current = true;
      }

      if (!stale.current) return;
      const ctx = element.getContext('2d');
      if (!ctx) return;

      stale.current = false;
      colors.current ??= colorsOf(element);
      paint(ctx, {
        peaks,
        view: shown.current,
        width,
        height,
        dpr,
        colors: colors.current,
        cursorSec: cursor,
        playheadSec: head,
        selection: marks.current.selection,
      });
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [peaks]);

  // The palette lives in the stylesheet, and the stylesheet answers to the system. Read
  // again when that changes, rather than on every frame: it is a style recalculation.
  useEffect(() => {
    // Optional because jsdom has no media queries; every browser does, and the theme is
    // the browser's answer to the system.
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!dark) return;
    const repaint = () => {
      colors.current = null;
      stale.current = true;
    };
    dark.addEventListener('change', repaint);
    return () => dark.removeEventListener('change', repaint);
  }, []);

  // Wheel and pinch. Bound by hand because React listens for wheel passively, and a
  // passive listener may not call `preventDefault` — without which the page scrolls away
  // underneath the gesture.
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      if (!box.width) return;
      const scale = event.deltaMode === 1 ? PIXELS_PER_LINE : 1;

      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        const shift = (event.deltaX * scale) / box.width;
        setView((from) => panBy(from, shift * from.span, duration));
        return;
      }

      const at = (event.clientX - box.left) / box.width;
      const per = event.ctrlKey ? PINCH_PER_UNIT : ZOOM_PER_UNIT;
      const factor = Math.exp(event.deltaY * scale * per);
      setView((from) => zoomAt(from, factor, at, duration, floorSpan(peaks, box.width)));
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [peaks, duration]);

  const gestures = useWaveformGestures({
    canvas,
    view,
    durationSec: duration,
    selection,
    floorSpan: (width) => floorSpan(peaks, width),
    show: setView,
    onSelect,
    onTap: onSeek,
  });

  /** The same moves as the wheel, for a keyboard: a fifth of the view at a time. */
  function onKeyDown(event: KeyboardEvent<HTMLCanvasElement>): void {
    const floor = floorSpan(peaks, canvas.current?.getBoundingClientRect().width ?? 1);

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const way = event.key === 'ArrowLeft' ? -1 : 1;
      setView((from) => panBy(from, way * from.span * PACE, duration));
    } else if (event.key === '+' || event.key === '=' || event.key === '-') {
      setView((from) => zoomAt(from, event.key === '-' ? STEP : 1 / STEP, 0.5, duration, floor));
    } else if (event.key === 'Home') {
      setView(clampView(whole(duration), duration, floor));
    } else {
      return;
    }

    event.preventDefault();
  }

  return (
    <figure className="waveform">
      <canvas
        className="waveform__canvas"
        ref={canvas}
        tabIndex={0}
        role="img"
        aria-label={
          'The recording, drawn. Drag across it to select a stretch to loop. Arrow keys ' +
          'move along it, plus and minus zoom, Home shows the whole recording.'
        }
        {...gestures}
        onKeyDown={onKeyDown}
      />
      <figcaption className="waveform__range">
        Showing {timecode(view.start, view.span)} – {timecode(view.start + view.span, view.span)}
      </figcaption>
    </figure>
  );
}

/** A time to read off a waveform: tenths once the view is short enough for them to mean something. */
function timecode(seconds: number, span: number): string {
  const from = Math.max(0, seconds);
  const minutes = Math.floor(from / 60);
  const rest = from - minutes * 60;
  const decimals = span < 20 ? 1 : 0;
  return `${minutes}:${rest.toFixed(decimals).padStart(decimals ? 4 : 2, '0')}`;
}
