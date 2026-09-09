/**
 * Opening a recording to work on.
 *
 * The screen a file arrives at, and where the loop will be drawn later. It takes a file by
 * button or by drop, decodes it, and shows what came back: the recording itself as a
 * waveform, and under it the passport — so that what the application knows about the file
 * is visible to the person who picked it, fingerprint included.
 */

import { useRef, useState } from 'react';

import './RecordingScreen.css';
import { audio } from '../../audio/engine';
import { RecordingLoadError, RecordingSlot, type Recording } from '../../audio/recording';
import {
  formatBytes,
  formatDuration,
  shortFingerprint,
  type AudioPassport,
} from '../../model/recording';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cx } from '../../ui/classes';
import { Waveform } from '../../waveform/Waveform';

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
  // Dragging over the drop zone, so it can say it will take what is being carried. Kept in
  // state rather than in a class on the node: the zone is React's, not a canvas.
  const [carrying, setCarrying] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const busy = status.kind === 'opening';

  async function open(file: File): Promise<void> {
    setStatus({ kind: 'opening', fileName: file.name });
    try {
      setStatus({ kind: 'open', recording: await slot.load(file) });
    } catch (error) {
      // Anything the loader itself raised already carries wording for a person; anything
      // else is a surprise, and a surprise still has to say something rather than nothing.
      setStatus({
        kind: 'failed',
        message: error instanceof RecordingLoadError ? error.message : UNEXPECTED,
      });
    }
  }

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
          <Waveform key={status.recording.passport.sha256} buffer={status.recording.buffer} />
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
