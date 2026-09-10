/**
 * The click that stands over the loop.
 *
 * Two numbers make it: how many beats are in the loop, and what the time signature is. The
 * tempo is neither typed nor tapped — it is division, `beats × 60 / length`, and it is shown
 * rather than edited. Counting the beats of a phrase you have just dragged out is something
 * a musician does without thinking; naming its BPM is not.
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
  beats: number;
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
  beats: 8,
  meterId: DEFAULT_METER_ID,
  level: CLICK_LEVEL.default,
};

/** Beats a loop may plausibly be said to hold. Beyond this the tempo is out of range anyway. */
const BEATS = { min: 1, max: 64 } as const;

/**
 * The tempo a click over this stretch would run at, or nothing when the answer is not one
 * anybody can practise to. Exported because the screen has to build the same grid to sound.
 */
export function tempoOf(settings: ClickSettings, selection: Selection | null): number | null {
  return selection ? tempoForBeats(selectionLength(selection), settings.beats) : null;
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
          <Field htmlFor="clickBeats" label="Beats in the loop">
            <input
              className="field__input"
              id="clickBeats"
              type="number"
              inputMode="numeric"
              min={BEATS.min}
              max={BEATS.max}
              value={settings.beats}
              onChange={(event) => onChange({ beats: Number(event.target.value) })}
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
  const beats = `${settings.beats} ${settings.beats === 1 ? 'beat' : 'beats'}`;
  if (tempo === null) {
    return `${length} s ÷ ${beats} is not a tempo to practise to. Try a different count.`;
  }

  const extra = subdivided ? `, clicking ${subdivided}` : '';
  return `${length} s ÷ ${beats} · ${settings.meterId} → ${Math.round(tempo)} BPM${extra}`;
}
