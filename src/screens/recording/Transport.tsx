/**
 * Starting and stopping the recording, and saying what will be played.
 *
 * The one control the screen needs and the one sentence that makes the waveform legible:
 * whether a stretch has been dragged out, and what it is. A loop that is playing is read off
 * the canvas — the playhead is there — so nothing here has to move, and this can be words
 * and two buttons.
 */

import './Transport.css';
import { formatMoment, selectionLength, type Selection } from '../../model/selection';
import { Button } from '../../ui/Button';

interface TransportProps {
  playing: boolean;
  /** The stretch to loop, if one has been dragged out. */
  selection: Selection | null;
  onToggle: () => void;
  onClear: () => void;
}

/** `0:12.4 – 0:36.0 · 23.6 s`, which is everything there is to say about a stretch. */
function readSelection(selection: Selection): string {
  const from = formatMoment(selection.fromSec);
  const to = formatMoment(selection.toSec);
  return `${from} – ${to} · ${selectionLength(selection).toFixed(1)} s`;
}

export function Transport({ playing, selection, onToggle, onClear }: TransportProps) {
  return (
    <div className="transport">
      <div className="transport__controls">
        {/* The label names what pressing it does now, and the loop is named in it rather
            than left to the waveform: pressing Play with a stretch selected does something
            different from pressing Play without one, and it should say so. */}
        <Button variant="primary" id="playRecording" onClick={onToggle}>
          {playing ? 'Stop' : selection ? 'Play the loop' : 'Play'}
        </Button>
        {selection && (
          <Button variant="secondary" id="clearSelection" onClick={onClear}>
            Clear the loop
          </Button>
        )}
      </div>

      {/* Not a live region: it changes on every pointer move of a drag, and a screen reader
          reading a stretch out forty times a second is worse than not reading it at all. The
          button beside it says what pressing it would do, and that is the announcement. */}
      <p className="transport__reading">
        {selection
          ? `Looping ${readSelection(selection)}`
          : 'Drag across the waveform to loop part of it.'}
      </p>

      <p className="keys keyboard-only">
        <kbd className="keys__key">Space</kbd> play/stop · <kbd className="keys__key">Esc</kbd>{' '}
        stop, then clear the loop
      </p>
    </div>
  );
}
