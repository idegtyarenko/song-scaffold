/**
 * Dragging, pinching and selecting on the waveform, with one arithmetic for all of it.
 *
 * A finger and a mouse are the same thing here: a set of points on the canvas. What the
 * points are doing decides what the gesture is, and there is one rule to remember — **one
 * pointer selects, two pan and zoom**. Panning is the centre of two pointers moving; zooming
 * is the distance between them changing; two fingers do both at once and need no branch of
 * their own. Selecting is the primary act on this screen, so it gets the primary gesture,
 * and mouse and touch then work identically, which is what makes the loop reachable on a
 * phone at all. Panning with one finger is what that costs; the wheel, the keys and two
 * fingers all still do it.
 *
 * Everything is measured from a snapshot taken when the gesture started, not from the
 * previous frame. Accumulating the moves instead would drift — the view is clamped at the
 * ends, and a clamped step that is then built upon never comes back.
 */

import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

import { selectionOf, type Selection } from '../model/selection';
import { offsetOf, panBy, timeAt, zoomAt, type View } from './view';

/** Farther than this and the gesture was a drag, not a click on a spot. */
const SLIP = 3;

/** Within this of an edge of the selection, a drag takes hold of that edge instead of starting anew. */
const GRAB = 8;

/** The gesture in progress: where it started from, and what it has done since. */
interface Gesture {
  /** Where each pointer is now, by its id, in client pixels across the screen. */
  points: Map<number, number>;
  /** The view when the gesture, or this stage of it, began. */
  from: View;
  /** The middle of the pointers when it began. */
  center: number;
  /** How far apart the outermost pointers were — zero while there is only one. */
  spread: number;
  /** Where that middle sat across the canvas, from 0 at the left edge to 1 at the right. */
  anchor: number;
  /** Whether this gesture has moved far enough to be a drag rather than a click. */
  moved: boolean;
  /**
   * The moment a one-pointer drag is pinned to: where it started, or the far edge of the
   * selection when it took hold of the near one. Null once a second pointer has turned the
   * gesture into a pan.
   */
  heldAt: number | null;
  /** The selection as it was, to put back if the gesture turns out to be a pan after all. */
  before: Selection | null;
}

interface PanZoom {
  canvas: RefObject<HTMLCanvasElement | null>;
  /** The view as it stands now, for a click that has to name a moment. */
  view: View;
  durationSec: number;
  /** The stretch selected right now, so a drag can take hold of one of its edges. */
  selection: Selection | null;
  /** The narrowest view this canvas may be zoomed to, given how wide it is. */
  floorSpan: (width: number) => number;
  show: (view: View) => void;
  /** A stretch dragged out, or nothing when the drag came to less than a stretch. */
  onSelect: (selection: Selection | null) => void;
  /** A click rather than a drag, at this moment of the recording. */
  onTap: (seconds: number) => void;
}

/** The middle of the pointers, and how far apart the outermost of them are. */
function reach(points: Iterable<number>): { center: number; spread: number } {
  const xs = [...points];
  const low = Math.min(...xs);
  const high = Math.max(...xs);
  return { center: (low + high) / 2, spread: xs.length > 1 ? high - low : 0 };
}

/**
 * Pointer handlers for the canvas: drag to select, pinch to pan and zoom, click to put the
 * cursor down.
 *
 * The handlers are rebuilt on every render and hold nothing but the gesture itself, so they
 * always read the view and the selection the component is actually showing.
 */
export function useWaveformGestures({
  canvas,
  view,
  durationSec,
  selection,
  floorSpan,
  show,
  onSelect,
  onTap,
}: PanZoom) {
  const gesture = useRef<Gesture>({
    points: new Map(),
    from: view,
    center: 0,
    spread: 0,
    anchor: 0.5,
    moved: false,
    heldAt: null,
    before: null,
  });

  /** Start measuring again from here — on the first finger down, and whenever one joins or leaves. */
  function restart(from: View): void {
    const now = gesture.current;
    const box = canvas.current?.getBoundingClientRect();
    const { center, spread } = reach(now.points.values());
    now.from = from;
    now.center = center;
    now.spread = spread;
    now.anchor = box?.width ? (center - box.left) / box.width : 0.5;
  }

  /**
   * Where a drag from `x` is pinned. Landing within reach of an edge of the selection takes
   * hold of that edge, and pins the drag to the opposite one — which is the same thing as
   * having dragged from there, so resizing needs no mode of its own.
   */
  function pinOf(x: number, width: number): number {
    const at = timeAt(view, x / width);
    if (!selection) return at;
    const from = offsetOf(view, selection.fromSec) * width;
    const to = offsetOf(view, selection.toSec) * width;
    if (Math.abs(x - from) <= GRAB) return selection.toSec;
    if (Math.abs(x - to) <= GRAB) return selection.fromSec;
    return at;
  }

  return {
    onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
      const element = canvas.current;
      if (!element) return;
      // So the gesture keeps arriving once the finger leaves the canvas. Focus is left to
      // the browser: it moves it here on a click anyway, and asking for it outright is what
      // turns the click into a keyboard focus and draws a ring nobody asked for.
      element.setPointerCapture(event.pointerId);
      const now = gesture.current;
      const box = element.getBoundingClientRect();

      if (now.points.size === 0) {
        now.moved = false;
        now.before = selection;
        now.heldAt = box.width ? pinOf(event.clientX - box.left, box.width) : null;
      } else if (now.heldAt !== null) {
        // A second pointer joined: this is a pan, not a selection. Put back whatever was
        // selected before the drag started, or a pinch begun on the waveform would eat it.
        now.heldAt = null;
        onSelect(now.before);
      }

      now.points.set(event.pointerId, event.clientX);
      restart(view);
    },

    onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
      const now = gesture.current;
      if (!now.points.has(event.pointerId)) return;
      const box = canvas.current?.getBoundingClientRect();
      if (!box?.width) return;

      now.points.set(event.pointerId, event.clientX);
      const { center, spread } = reach(now.points.values());
      if (Math.abs(center - now.center) > SLIP || Math.abs(spread - now.spread) > SLIP) {
        now.moved = true;
      }

      if (now.heldAt !== null) {
        if (now.moved) {
          onSelect(
            selectionOf(now.heldAt, timeAt(view, (center - box.left) / box.width), durationSec),
          );
        }
        return;
      }

      const floor = floorSpan(box.width);
      const zoomed =
        now.spread > 0 && spread > 0
          ? zoomAt(now.from, now.spread / spread, now.anchor, durationSec, floor)
          : now.from;
      // The waveform follows the finger, so the view moves against it.
      const shift = (center - now.center) / box.width;
      show(panBy(zoomed, -shift * zoomed.span, durationSec));
    },

    onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
      const now = gesture.current;
      if (!now.points.delete(event.pointerId)) return;

      if (now.points.size > 0) {
        // A finger left mid-pinch: carry on from where the remaining ones are, or the view
        // would jump by whatever the departing one was contributing.
        restart(view);
        return;
      }

      const box = canvas.current?.getBoundingClientRect();
      now.heldAt = null;
      if (!now.moved && box?.width) onTap(timeAt(view, (event.clientX - box.left) / box.width));
    },

    onPointerCancel(event: ReactPointerEvent<HTMLCanvasElement>) {
      const now = gesture.current;
      now.points.delete(event.pointerId);
      now.moved = true;
      if (now.points.size > 0) restart(view);
      else now.heldAt = null;
    },
  };
}
