/**
 * The click that stands over the loop.
 *
 * Two numbers make it: how many bars are in the loop, and what the time signature is. The
 * tempo is neither typed nor tapped — it is division, `bars × beats-per-bar × 60 / length`,
 * and it is shown rather than edited. Counting the bars of a phrase you have just dragged out
 * is something a musician does without thinking; naming its BPM is not.
 *
 * Bars rather than beats, and the difference is not only convenience. A loop measured in
 * bars holds a whole number of them by construction, so the downbeat falls on the seam every
 * time round. Measured in beats it need not: seven beats of 4/4 puts the seam on the third
 * beat of a bar, and the click would be in the music without being in time with it.
 *
 * Without a stretch there is no length to divide, so there is no click here. That is not a
 * gap: practising to a click with no recording is the session screen, which is a first-class
 * mode of its own and always was.
 */

import './ClickTrack.css';
import { CLICK_LEVEL } from '../../audio/engine';
import { DEFAULT_METER_ID, findMeter, METERS, subdivisionAt } from '../../model/meter';
import { selectionLength, type Selection } from '../../model/selection';
import { tempoForBeats } from '../../model/tempo';
import { Checkbox } from '../../ui/Checkbox';
import { Field } from '../../ui/Field';

/** What the click is set to, and what the screen has to hand back when it changes. */
export interface ClickSettings {
  on: boolean;
  bars: number;
  meterId: string;
  level: number;
}

interface ClickTrackProps {
  settings: ClickSettings;
  /** The stretch the click stands over, if one has been dragged out. */
  selection: Selection | null;
  onChange: (patch: Partial<ClickSettings>) => void;
}

export const DEFAULT_CLICK: ClickSettings = {
  on: false,
  bars: 2,
  meterId: DEFAULT_METER_ID,
  level: CLICK_LEVEL.default,
};

/** Bars a loop may plausibly be said to hold. Beyond this the tempo is out of range anyway. */
const BARS = { min: 1, max: 32 } as const;

/**
 * The tempo a click over this stretch would run at, or nothing when the answer is not one
 * anybody can practise to. Exported because the screen has to build the same grid to sound.
 */
export function tempoOf(settings: ClickSettings, selection: Selection | null): number | null {
  if (!selection) return null;
  const beats = settings.bars * findMeter(settings.meterId).beatsPerBar;
  return tempoForBeats(selectionLength(selection), beats);
}

export function ClickTrack({ settings, selection, onChange }: ClickTrackProps) {
  const meter = findMeter(settings.meterId);
  const tempo = tempoOf(settings, selection);
  const subdivision = tempo === null ? null : subdivisionAt(meter, tempo);

  return (
    <section className="click">
      {/* A fieldset rather than a `disabled` on each control: without a stretch there is no
          length to divide and nothing here means anything, and the browser already knows how
          to turn a group of controls off as one. */}
      <fieldset className="click__group" disabled={!selection}>
        <Checkbox
          id="clickOn"
          checked={settings.on}
          onChange={(on) => onChange({ on })}
          label="Click over the loop"
        />

        <div className="click__fields">
          <Field htmlFor="clickBars" label="Bars in the loop">
            <input
              className="field__input"
              id="clickBars"
              type="number"
              inputMode="numeric"
              min={BARS.min}
              max={BARS.max}
              value={settings.bars}
              onChange={(event) => onChange({ bars: Number(event.target.value) })}
            />
          </Field>

          <Field htmlFor="clickMeter" label="Time signature">
            <select
              className="field__input"
              id="clickMeter"
              value={settings.meterId}
              onChange={(event) => onChange({ meterId: event.target.value })}
            >
              {METERS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field htmlFor="clickLevel" label="Click level">
            <input
              className="click__slider"
              id="clickLevel"
              type="range"
              min={CLICK_LEVEL.min}
              max={CLICK_LEVEL.max}
              step={0.05}
              value={settings.level}
              onChange={(event) => onChange({ level: Number(event.target.value) })}
            />
          </Field>
        </div>
      </fieldset>

      <p className="click__reading">{reading(selection, settings, tempo, subdivision?.word)}</p>
    </section>
  );
}

/** The arithmetic said out loud, so a tempo that looks wrong can be traced to what made it. */
function reading(
  selection: Selection | null,
  settings: ClickSettings,
  tempo: number | null,
  subdivided: string | undefined,
): string {
  if (!selection) return 'Drag a loop out of the waveform, and the click will follow it.';

  const length = selectionLength(selection).toFixed(1);
  const bars = `${settings.bars} ${settings.bars === 1 ? 'bar' : 'bars'} of ${settings.meterId}`;
  if (tempo === null) {
    return `${length} s ÷ ${bars} is not a tempo to practise to. Try a different count.`;
  }

  const extra = subdivided ? `, clicking ${subdivided}` : '';
  return `${length} s ÷ ${bars} → ${Math.round(tempo)} BPM${extra}`;
}
