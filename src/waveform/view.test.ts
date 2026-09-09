/**
 * The arithmetic of the visible stretch — mostly the awkward parts, which are the edges:
 * what happens at either end of the recording, and at either end of zooming.
 */

import { describe, expect, it } from 'vitest';

import { clampView, offsetOf, panBy, timeAt, whole, zoomAt } from './view';

/** Four minutes, and a floor of one second — a canvas a thousand columns wide. */
const DURATION = 240;
const FLOOR = 1;

describe('a view', () => {
  it('opens on the whole recording', () => {
    expect(whole(DURATION)).toEqual({ start: 0, span: 240 });
  });

  it('never shows more than there is', () => {
    expect(clampView({ start: 0, span: 900 }, DURATION, FLOOR)).toEqual({ start: 0, span: 240 });
  });

  it('never hangs off either end', () => {
    expect(clampView({ start: -30, span: 60 }, DURATION, FLOOR).start).toBe(0);
    expect(clampView({ start: 300, span: 60 }, DURATION, FLOOR).start).toBe(180);
  });

  it('never gets narrower than the floor', () => {
    expect(clampView({ start: 10, span: 0.01 }, DURATION, FLOOR).span).toBe(1);
  });

  it('shows a recording shorter than the floor whole, rather than inventing time', () => {
    expect(clampView({ start: 0, span: 0.1 }, 0.4, FLOOR)).toEqual({ start: 0, span: 0.4 });
  });
});

describe('zooming', () => {
  const view = { start: 60, span: 60 };

  it('keeps the moment under the pointer where it is', () => {
    // A quarter across the view is 1:15; after zooming in it is still a quarter across.
    const closer = zoomAt(view, 0.5, 0.25, DURATION, FLOOR);

    expect(closer.span).toBe(30);
    expect(timeAt(closer, 0.25)).toBeCloseTo(75, 6);
  });

  it('pulls back around the pointer as well', () => {
    const wider = zoomAt(view, 2, 0.75, DURATION, FLOOR);

    expect(wider.span).toBe(120);
    expect(timeAt(wider, 0.75)).toBeCloseTo(105, 6);
  });

  it('holds at the floor rather than magnifying a step', () => {
    const held = zoomAt({ start: 60, span: FLOOR }, 0.5, 0.5, DURATION, FLOOR);

    expect(held.span).toBe(FLOOR);
  });

  it('slides back onto the recording when pulling back at the end', () => {
    const wider = zoomAt({ start: 200, span: 40 }, 4, 1, DURATION, FLOOR);

    expect(wider).toEqual({ start: 80, span: 160 });
  });
});

describe('panning', () => {
  it('slides the view along, keeping its width', () => {
    expect(panBy({ start: 60, span: 30 }, 15, DURATION)).toEqual({ start: 75, span: 30 });
  });

  it('stops at the ends instead of running past them', () => {
    expect(panBy({ start: 10, span: 30 }, -60, DURATION).start).toBe(0);
    expect(panBy({ start: 200, span: 30 }, 60, DURATION).start).toBe(210);
  });
});

describe('a moment and a place', () => {
  const view = { start: 60, span: 30 };

  it('reads a moment off a place across the canvas', () => {
    expect(timeAt(view, 0)).toBe(60);
    expect(timeAt(view, 1)).toBe(90);
  });

  it('puts a moment back where it came from', () => {
    expect(offsetOf(view, timeAt(view, 0.4))).toBeCloseTo(0.4, 6);
  });

  it('says where a moment off screen would be, rather than pretending it is on it', () => {
    expect(offsetOf(view, 30)).toBe(-1);
  });

  it('puts everything at the left edge of a view with no width, rather than dividing by it', () => {
    expect(offsetOf({ start: 0, span: 0 }, 12)).toBe(0);
  });
});
