/**
 * Opening a recording to work on.
 *
 * The screen a file arrives at, and where a passage is picked out of it. It takes a file by
 * button or by drop, decodes it, and shows what came back: the recording itself as a
 * waveform, the transport under it, and the passport under that — so that what the
 * application knows about the file is visible to the person who picked it, fingerprint
 * included.
 *
 * Two things are the screen's to hold rather than the waveform's. The stretch to loop, in
 * state, because it is what the transport has to put into words. And the cursor, in a ref,
 * because it is a mark on a canvas that repaints itself and nothing in the markup reads it.
 * The playhead belongs to neither: it is asked of the player once a frame.
 */

import { useEffect, useRef, useState } from 'react';

import './RecordingScreen.css';
import { audio } from '../../audio/engine';
import { LoopPlayer } from '../../audio/player';
import { RecordingLoadError, RecordingSlot, type Recording } from '../../audio/recording';
import {
  formatBytes,
  formatDuration,
  shortFingerprint,
  type AudioPassport,
} from '../../model/recording';
import type { Selection } from '../../model/selection';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cx } from '../../ui/classes';
import { Waveform } from '../../waveform/Waveform';
import { useShortcuts } from '../useShortcuts';
import { Transport } from './Transport';

interface RecordingScreenProps {
  onBack: () => void;
}

/** Where the screen is: nothing yet, working on a file, holding one, or unable to open one. */
type Status =
  | { kind: 'empty' }
  | { kind: 'opening'; fileName: string }
  | { kind: 'open'; recording: Recording }
  | { kind: 'failed'; message: string };

const UNEXPECTED = 'The recording could not be opened. Try another file.';

export function RecordingScreen({ onBack }: RecordingScreenProps) {
  const [slot] = useState(() => new RecordingSlot(audio));
  const [status, setStatus] = useState<Status>({ kind: 'empty' });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [playing, setPlaying] = useState(false);
  const cursor = useRef<number | null>(null);
  // The player tells the screen when the sound has run out on its own, which is the only
  // way the button gets back to "Play" after a single pass reaches the end.
  const [player] = useState(() => new LoopPlayer(audio, () => setPlaying(false)));
  // Dragging over the drop zone, so it can say it will take what is being carried. Kept in
  // state rather than in a class on the node: the zone is React's, not a canvas.
  const [carrying, setCarrying] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const busy = status.kind === 'opening';

  async function open(file: File): Promise<void> {
    setStatus({ kind: 'opening', fileName: file.name });
    try {
      const recording = await slot.load(file);
      // A new recording is a new everything: the stretch and the cursor belonged to audio
      // that is no longer open, and so did whatever was playing.
      stop();
      setSelection(null);
      cursor.current = null;
      setStatus({ kind: 'open', recording });
    } catch (error) {
      // Anything the loader itself raised already carries wording for a person; anything
      // else is a surprise, and a surprise still has to say something rather than nothing.
      setStatus({
        kind: 'failed',
        message: error instanceof RecordingLoadError ? error.message : UNEXPECTED,
      });
    }
  }

  function stop(): void {
    player.stop();
    setPlaying(false);
  }

  /**
   * Play what is asked for: the selected stretch, round and round, or the rest of the
   * recording from the cursor. Pressing it while something is playing stops it, so one
   * control and one key cover the whole transport.
   */
  function toggle(): void {
    if (playing) return stop();
    if (status.kind !== 'open') return;
    const buffer = status.recording.buffer;
    const span = selection ?? { fromSec: cursor.current ?? 0, toSec: buffer.duration };
    player.play(buffer, span, { loop: selection !== null });
    setPlaying(true);
  }

  /** A new stretch under a running loop is a new loop, not a loop of the old stretch. */
  function select(next: Selection | null): void {
    setSelection(next);
    if (!playing || status.kind !== 'open') return;
    if (next) player.play(status.recording.buffer, next, { loop: true });
    else stop();
  }

  // Nothing outlives the screen: leaving it with a loop still running would carry the sound
  // into the setup form, which has no way to stop it.
  useEffect(() => () => player.stop(), [player]);

  useShortcuts({
    Space: toggle,
    // One key for both, in the order a hand reaches for it: stop what is playing, and press
    // it again to put the loop away.
    Escape: () => (playing ? stop() : select(null)),
  });

  function choose(file: File | undefined): void {
    // One file: a drop of several is a slip, and picking one of them for the player would
    // be guessing. Nothing opens until they drop the one they meant.
    if (!file || busy) return;
    void open(file);
  }

  return (
    <Card className="recording">
      <header className="recording__header">
        <h1 className="recording__title">Open a recording</h1>
        <p className="recording__lede">
          The file stays on this device: it is read into memory to work on, and nothing is uploaded
          anywhere.
        </p>
      </header>

      <div
        className={cx('dropzone', carrying && 'dropzone--carrying')}
        onDragOver={(event) => {
          // Without this the browser takes the drop itself and navigates to the file.
          event.preventDefault();
          setCarrying(true);
        }}
        onDragLeave={() => setCarrying(false)}
        onDrop={(event) => {
          event.preventDefault();
          setCarrying(false);
          choose(event.dataTransfer.files[0]);
        }}
      >
        <p className="dropzone__lede">Drop an audio file here</p>
        <Button
          variant="primary"
          id="chooseRecording"
          disabled={busy}
          onClick={() => picker.current?.click()}
        >
          {status.kind === 'open' ? 'Choose another file' : 'Choose a file'}
        </Button>
        {/* Hidden rather than styled away: the button above is the control, and a second
            tab stop landing on an invisible input would be a trap with no way to tell. */}
        <input
          hidden
          ref={picker}
          id="recordingFile"
          type="file"
          // A hint for the picker, not a filter of our own: an mp3 dragged out of some
          // applications arrives with no type at all, and the decoder is the real judge.
          accept="audio/*"
          onChange={(event) => {
            choose(event.target.files?.[0]);
            // So that picking the same file twice in a row is still a change.
            event.target.value = '';
          }}
        />
      </div>

      <p className="recording__status" role="status">
        {busy ? `Opening ${status.fileName}…` : ''}
      </p>

      {status.kind === 'failed' && (
        <p className="recording__error" role="alert">
          {status.message}
        </p>
      )}

      {status.kind === 'open' && (
        <>
          {/* Keyed by the recording it draws: a new file is a new waveform, zoomed out and
              with no cursor, rather than an old view pointing into audio that is gone. */}
          <Waveform
            key={status.recording.passport.sha256}
            buffer={status.recording.buffer}
            selection={selection}
            onSelect={select}
            onSeek={(seconds) => (cursor.current = seconds)}
            cursorSec={() => cursor.current}
            playheadSec={() => player.positionSec()}
          />
          <Transport
            playing={playing}
            selection={selection}
            onToggle={toggle}
            onClear={() => select(null)}
          />
          <Passport passport={status.recording.passport} />
        </>
      )}

      <Button
        variant="secondary"
        className="recording__back"
        id="backToSetup"
        onClick={() => {
          // The decoded audio goes with the screen: leaving it behind would keep a hundred
          // megabytes alive for a session that has no use for it.
          stop();
          slot.release();
          onBack();
        }}
      >
        Back
      </Button>
    </Card>
  );
}

/** What the application knows about the recording, in the order a person would ask. */
function Passport({ passport }: { passport: AudioPassport }) {
  return (
    <dl className="passport">
      <div className="passport__entry">
        <dt className="passport__term">File</dt>
        <dd className="passport__value">{passport.fileName}</dd>
      </div>
      <div className="passport__entry">
        <dt className="passport__term">Length</dt>
        <dd className="passport__value">{formatDuration(passport.durationSec)}</dd>
      </div>
      <div className="passport__entry">
        <dt className="passport__term">Size</dt>
        <dd className="passport__value">{formatBytes(passport.bytes)}</dd>
      </div>
      <div className="passport__entry">
        <dt className="passport__term">Fingerprint</dt>
        {/* Shortened to what an eye can compare; the whole digest is there for anyone
            checking it against a shell. */}
        <dd className="passport__value" title={passport.sha256}>
          {shortFingerprint(passport.sha256)}
        </dd>
      </div>
    </dl>
  );
}
