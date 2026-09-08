/**
 * The practice session: what to play, how fast, and the controls that move you.
 *
 * It owns the two things that outlive a render — the `Session` cursor and the `Metronome` —
 * and hands React only what changes when the cursor moves. Beats arrive several times a
 * second and never pass through state; they go to the dots and the segment map directly.
 */

import { useEffect, useRef, useState } from 'react';

import './SessionScreen.css';
import { audio } from '../../audio/engine';
import { Metronome, type Beat } from '../../audio/metronome';
import { findMeter, subdivisionAt } from '../../model/meter';
import { describeChunk } from '../../practice/sequence';
import { Session, type SessionState } from '../../practice/session';
import type { Settings } from '../../practice/settings';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { NoteGlyph } from '../../ui/NoteGlyph';
import { Beats, type BeatsHandle } from './Beats';
import { Controls } from './Controls';
import { Ladder } from './Ladder';
import { SegmentMap, type SegmentMapHandle } from './SegmentMap';

interface SessionScreenProps {
  /** The settings the session was opened with; changing them means going back to setup. */
  settings: Settings;
  onExit: () => void;
}

/** What each key does, and whether it needs Shift — a stage is too much work to lose. */
type Move = 'toggle' | 'faster' | 'slower' | 'nextStage' | 'previousStage';

const SHORTCUTS: Record<string, { shift: boolean; move: Move }> = {
  ArrowUp: { shift: false, move: 'faster' },
  ArrowDown: { shift: false, move: 'slower' },
  ArrowRight: { shift: true, move: 'nextStage' },
  ArrowLeft: { shift: true, move: 'previousStage' },
};

export function SessionScreen({ settings, onExit }: SessionScreenProps) {
  const meter = findMeter(settings.meterId);

  const [session] = useState(() => new Session({ ...settings }));
  const [cursor, setCursor] = useState(() => session.state());
  const [running, setRunning] = useState(false);
  const [metronome] = useState(
    () => new Metronome(audio, clickConfig(cursor.rung.tempo), showBeat),
  );

  const beats = useRef<BeatsHandle>(null);
  const segments = useRef<SegmentMapHandle>(null);
  /** Bars in the chunk being played, so a multi-bar chunk stays legible under the beat. */
  const chunkBars = useRef(cursor.rung.chunk.length);

  /** The click grid for a tempo — the meter decides for itself whether to subdivide. */
  function clickConfig(tempo: number) {
    return {
      tempo,
      beatsPerBar: meter.beatsPerBar,
      secondaryAccents: meter.secondaryAccents,
      subdivision: subdivisionAt(meter, tempo)?.count ?? 1,
      countInBars: settings.countInBars,
    };
  }

  // Reads refs only, so the copy the metronome was built with stays correct for the whole
  // session — and a beat arriving after the screen is gone finds nulls and does nothing.
  function showBeat(beat: Beat): void {
    if (!beat.isPulse) return;
    beats.current?.show(beat);
    // Nothing is marked during the count-in — you are not playing yet.
    segments.current?.markBar(beat.isCountIn ? -1 : beat.bar % chunkBars.current);
  }

  /** The one way the cursor moves: act, re-read it, and take the metronome with it. */
  function move(step: () => void): void {
    step();
    const next = session.state();
    chunkBars.current = next.rung.chunk.length;
    segments.current?.markBar(-1);
    metronome.reconfigure(clickConfig(next.rung.tempo));
    setCursor(next);
  }

  function toggle(): void {
    if (metronome.isRunning) metronome.stop();
    else metronome.start();
    setRunning(metronome.isRunning);
  }

  const moves: Record<Move, () => void> = {
    toggle,
    faster: () => move(() => session.goFaster()),
    slower: () => move(() => session.goSlower()),
    nextStage: () => move(() => session.nextStage()),
    previousStage: () => move(() => session.previousStage()),
  };

  // The keys are read off the document, so they work wherever the focus is. What they do
  // is taken from a ref, so the one listener never goes stale.
  const latest = useRef(moves);
  useEffect(() => {
    latest.current = moves;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea')) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        latest.current.toggle();
        return;
      }

      const shortcut = SHORTCUTS[event.key];
      if (!shortcut || shortcut.shift !== event.shiftKey) return;
      event.preventDefault();
      latest.current[shortcut.move]();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => () => metronome.stop(), [metronome]);

  const subdivision = subdivisionAt(meter, cursor.rung.tempo);
  const first = settings.backwards ? settings.totalSegments - cursor.stage + 1 : 1;
  const inStage = Array.from({ length: cursor.stage }, (_, index) => first + index);

  return (
    <Card className="session">
      <div className="session__main">
        <div className="now">
          <p className="now__chunk">Play {describeChunk(cursor.rung.chunk)}</p>
          <SegmentMap
            ref={segments}
            total={settings.totalSegments}
            inStage={inStage}
            playing={cursor.rung.chunk}
          />
          <p className="now__tempo">
            <strong className="now__bpm">{cursor.rung.tempo}</strong>
            <span className="now__unit">
              <NoteGlyph note={meter.beatNote} />
            </span>
            <span className="now__unit">= BPM</span>
          </p>
          <Beats ref={beats} beatsPerBar={meter.beatsPerBar} />
          <p className="now__where">
            <span>
              Stage {cursor.stage} of {settings.totalSegments}
            </span>
            <span className="now__dot">·</span>
            <span>
              step {cursor.rungIndex + 1} of {cursor.ladder.length}
            </span>
            {cursor.rung.isTail && <span className="badge">at target</span>}
            {subdivision && <span className="badge badge--quiet">+ {subdivision.word}</span>}
          </p>
        </div>

        <p className="visually-hidden" role="status" aria-live="polite">
          {announce(cursor, settings.totalSegments)}
        </p>

        <Controls
          state={cursor}
          running={running}
          onToggle={moves.toggle}
          onFaster={moves.faster}
          onSlower={moves.slower}
          onNextStage={moves.nextStage}
          onPrevStage={moves.previousStage}
        />
      </div>

      <Ladder rungs={cursor.ladder} current={cursor.rungIndex} />

      <footer className="session__footer">
        <Button variant="secondary" onClick={onExit}>
          ← Change setup
        </Button>
        <p className="keys">
          <kbd className="keys__key">Space</kbd> start/stop · <kbd className="keys__key">↑</kbd>
          <kbd className="keys__key">↓</kbd> tempo · <kbd className="keys__key">⇧</kbd>+
          <kbd className="keys__key">←</kbd>
          <kbd className="keys__key">→</kbd> stage
        </p>
      </footer>
    </Card>
  );
}

/** The same move, spoken rather than drawn, for anyone not watching the screen. */
function announce(cursor: SessionState, totalSegments: number): string {
  return (
    `${describeChunk(cursor.rung.chunk)} at ${cursor.rung.tempo} BPM. ` +
    `Stage ${cursor.stage} of ${totalSegments}, ` +
    `step ${cursor.rungIndex + 1} of ${cursor.ladder.length}.` +
    (cursor.stageComplete && cursor.canGoToNextStage
      ? ' Stage complete — add the next segment.'
      : '')
  );
}
