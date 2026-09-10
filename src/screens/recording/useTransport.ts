/**
 * Everything about a recording that makes a sound, in one place.
 *
 * The screen next door opens a file and lays things out; this holds what is playing, what is
 * looping, and the click standing over it. It is one hook rather than two because of a
 * single requirement that runs through all of it: **the recording and the click begin on the
 * same moment of the audio clock**. Split across two owners, that moment becomes two
 * readings, and two readings are two starts.
 *
 * What that moment buys is the whole of TASK-11's first criterion. The loop is measured in
 * bars, so the beats in it are a whole number of bars by construction; the click's period is
 * the length of the loop over those beats, so it divides the loop without remainder; and both
 * are counted from one clock. Therefore the **downbeat** lands on the seam of the loop on the
 * first pass and on the thousandth, with nothing to accumulate in between. Nothing
 * re-synchronises, because nothing goes out of step.
 *
 * Measured in beats it would not hold: seven beats of 4/4 puts the seam on the third beat of
 * a bar, and a click can be exactly in time without ever being on the downbeat.
 *
 * The three kinds of state here are deliberately different. What the transport says is React
 * state, because it is words on screen. The cursor is a ref, because it is a mark on a canvas
 * that repaints itself. The playhead is neither — it is asked of the player once a frame.
 */

import { useEffect, useRef, useState } from 'react';

import { audio } from '../../audio/engine';
import { Metronome } from '../../audio/metronome';
import { LoopPlayer } from '../../audio/player';
import { findMeter, subdivisionAt } from '../../model/meter';
import type { Selection } from '../../model/selection';
import { DEFAULT_CLICK, tempoOf, type ClickSettings } from './ClickTrack';

/**
 * The click grid for a tempo — the meter decides for itself whether to subdivide, exactly as
 * it does on the session screen.
 *
 * No count-in: the loop is its own, and a bar of clicks before a stretch that is about to
 * repeat forever would only be in the way.
 */
function gridFor(click: ClickSettings, tempo: number) {
  const meter = findMeter(click.meterId);
  return {
    tempo,
    beatsPerBar: meter.beatsPerBar,
    secondaryAccents: meter.secondaryAccents,
    subdivision: subdivisionAt(meter, tempo)?.count ?? 1,
    countInBars: 0,
  };
}

/** The recording being worked on, or nothing while the screen is empty. */
type Source = AudioBuffer | null;

export function useTransport(buffer: Source) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [playing, setPlaying] = useState(false);
  const [click, setClick] = useState<ClickSettings>(DEFAULT_CLICK);
  const cursor = useRef<number | null>(null);

  // The player tells the transport when the sound has run out on its own, which is the only
  // way the button gets back to "Play" after a single pass reaches the end.
  const [player] = useState(() => new LoopPlayer(audio, () => stopAll()));
  // The click lights no dots here — there is only a sound over the loop — so the beat
  // listener is empty. The tempo it is built with is replaced before it is ever heard.
  const [metronome] = useState(() => new Metronome(audio, gridFor(DEFAULT_CLICK, 60), () => {}));

  /** Everything falls silent together: the two started on one moment and end on one call. */
  function stopAll(): void {
    player.stop();
    metronome.stop();
    setPlaying(false);
  }

  /**
   * Start the recording and, if it is asked for, the click — from one reading of the clock.
   *
   * The settings come in as an argument rather than off the state, because the call that
   * changes one of them has to sound the new value, not the one React has yet to commit.
   */
  function sound(span: Selection, loop: boolean, using = click): void {
    if (!buffer) return;
    const at = audio.soon();
    player.play(buffer, span, { loop, at });
    const tempo = loop ? tempoOf(using, span) : null;
    if (using.on && tempo !== null) {
      metronome.reconfigure(gridFor(using, tempo));
      metronome.start(at);
    }
    setPlaying(true);
  }

  /**
   * Play what is asked for: the selected stretch, round and round, or the rest of the
   * recording from the cursor. Pressing it while something is playing stops it, so one
   * control and one key cover the whole transport.
   */
  function toggle(): void {
    if (playing) return stopAll();
    if (!buffer) return;
    sound(
      selection ?? { fromSec: cursor.current ?? 0, toSec: buffer.duration },
      selection !== null,
    );
  }

  /** A new stretch under a running loop is a new loop, not a loop of the old stretch. */
  function select(next: Selection | null): void {
    setSelection(next);
    if (!playing) return;
    // A restart rather than a retune: the click's period is derived from the length of the
    // stretch, so a new stretch is a new grid, and both have to begin again together.
    stopAll();
    if (next) sound(next, true);
  }

  /**
   * Change a click setting, and let the sound hear it.
   *
   * The level is a knob and takes effect where it stands — a knob that only answers on the
   * next start is a broken knob. Everything else is the grid, and a grid can only change by
   * starting again, because the click has to land back on the seam of the loop.
   */
  function adjust(patch: Partial<ClickSettings>): void {
    const next = { ...click, ...patch };
    setClick(next);

    if (patch.level !== undefined) {
      audio.clickLevel = patch.level;
      return;
    }
    if (!playing || !selection) return;
    stopAll();
    sound(selection, true, next);
  }

  /** A new recording is a new everything: what was selected belonged to audio now gone. */
  function reset(): void {
    stopAll();
    setSelection(null);
    cursor.current = null;
  }

  // Nothing outlives the screen: leaving it with a loop still running would carry the sound
  // into the setup form, which has no way to stop it.
  useEffect(
    () => () => {
      player.stop();
      metronome.stop();
    },
    [player, metronome],
  );

  return {
    selection,
    select,
    playing,
    toggle,
    stopAll,
    reset,
    click,
    adjust,
    seek: (seconds: number) => (cursor.current = seconds),
    cursorSec: () => cursor.current,
    playheadSec: () => player.positionSec(),
  };
}
