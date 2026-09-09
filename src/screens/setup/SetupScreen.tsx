import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import './SetupScreen.css';
import { METERS, findMeter, subdivisionSpan } from '../../model/meter';
import { tempoLadder } from '../../practice/sequence';
import {
  DEFAULT_SETTINGS,
  LIMITS,
  load,
  normalize,
  save,
  type Settings,
} from '../../practice/settings';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Checkbox } from '../../ui/Checkbox';
import { Field } from '../../ui/Field';
import { Note } from '../../ui/Note';
import { NoteGlyph } from '../../ui/NoteGlyph';
import { RadioGroup } from '../../ui/RadioGroup';

interface SetupScreenProps {
  onStart: (settings: Settings) => void;
  /** True when the player has just come back from a session, so the way in gets the focus. */
  focusStart?: boolean;
}

/** The number fields, which are the only ones that can hold a half-typed value. */
type NumberField = 'totalSegments' | 'startTempo' | 'targetTempo' | 'rungs';

export function SetupScreen({ onStart, focusStart = false }: SetupScreenProps) {
  const [settings, setSettings] = useState(load);
  // What has been typed but not yet left. A field is normalized the moment it loses focus,
  // never while it has it — otherwise a half-typed number gets clamped under the cursor.
  const [drafts, setDrafts] = useState<Partial<Record<NumberField, string>>>({});
  const start = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusStart) start.current?.focus();
  }, [focusStart]);

  /** Fold a change into the settings, normalized, and say what they became. */
  function change(patch: Partial<Settings>): Settings {
    const next = normalize({ ...settings, ...patch });
    setSettings(next);
    return next;
  }

  /** A change with nothing half-typed behind it — a switch, a menu, a checkbox. */
  function update(patch: Partial<Settings>): void {
    save(change(patch));
  }

  function typeInto(field: NumberField, raw: string): void {
    setDrafts((current) => ({ ...current, [field]: raw }));
    const parsed = Number.parseInt(raw, 10);
    const patch = {
      [field]: Number.isFinite(parsed) ? parsed : DEFAULT_SETTINGS[field],
    } as Partial<Settings>;
    // Typing a rung count takes it off the automatic suggestion; Auto is the way back —
    // and it stays on screen, unlike the old "clear the box" trick, which nobody would find
    // once a stale preference had been persisted.
    // Not saved: a number under the cursor is on its way somewhere, and an empty box would
    // put a default nobody chose into storage.
    change(field === 'rungs' ? { ...patch, rungsIsAutomatic: false } : patch);
  }

  /** Leaving the field is what settles the number, so that is what gets remembered. */
  function commit(field: NumberField): void {
    setDrafts((current) => ({ ...current, [field]: undefined }));
    save(settings);
  }

  function numberField(field: NumberField) {
    return {
      className: 'field__input',
      id: field,
      type: 'number' as const,
      step: 1,
      value: drafts[field] ?? String(settings[field]),
      onChange: (event: ChangeEvent<HTMLInputElement>) => typeInto(field, event.target.value),
      onBlur: () => commit(field),
    };
  }

  return (
    <Card className="setup">
      <header className="masthead">
        <h1 className="masthead__title">SongScaffold</h1>
        <p className="masthead__lede">
          <a
            className="masthead__link"
            id="methodLink"
            href="https://mollygebrian.wordpress.com/wp-content/uploads/2020/06/the-amazing-list-of-practice-techniques-with-gingold-rhythms-1.pdf#page=4"
            target="_blank"
            rel="noreferrer"
          >
            Dr. Molly Gebrian’s Interleaved Clicking Up
            <span className="visually-hidden">
              , described on page 4 of her practice techniques PDF, opens in a new tab
            </span>
          </a>{' '}
          for taking a hard passage up to tempo: add one segment at a time, and rotate through
          overlapping chunks as the metronome climbs.
        </p>
        <p className="masthead__sources">
          <a
            className="masthead__link"
            id="explainLink"
            href="https://www.youtube.com/watch?v=75OWZAq-O4U"
            target="_blank"
            rel="noreferrer"
          >
            She explains it on video
          </a>{' '}
          <span className="masthead__separator" aria-hidden="true">
            ·
          </span>{' '}
          <a
            className="masthead__link"
            id="demoLink"
            href="https://www.youtube.com/watch?v=e08zFDnLOYY"
            target="_blank"
            rel="noreferrer"
          >
            and demonstrates it
          </a>
        </p>
      </header>

      <div className="fields">
        <Field
          htmlFor="totalSegments"
          label="Segments in the passage"
          hint="How many bars or phrases you have split it into."
        >
          <input
            {...numberField('totalSegments')}
            min={LIMITS.totalSegments.min}
            max={LIMITS.totalSegments.max}
          />
        </Field>

        <Field label="Build from" hint={directionHint(settings)} hintId="directionHint">
          <RadioGroup
            name="direction"
            ariaLabel="Build from"
            value={settings.backwards ? 'bottom' : 'top'}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'bottom', label: 'Bottom' },
            ]}
            onChange={(from) => update({ backwards: from === 'bottom' })}
          />
        </Field>

        <fieldset className="group fields__item--wide">
          <legend className="group__legend">Tempo</legend>
          <div className="group__fields">
            <Field htmlFor="startTempo" label="Start" hint="BPM">
              <input {...numberField('startTempo')} min={LIMITS.tempo.min} max={LIMITS.tempo.max} />
            </Field>

            <Field htmlFor="targetTempo" label="Target" hint="BPM">
              <input
                {...numberField('targetTempo')}
                min={LIMITS.tempo.min}
                max={LIMITS.tempo.max}
              />
            </Field>

            <Field
              htmlFor="rungs"
              label="Tempo steps"
              hintId="rungsHint"
              hint={
                settings.rungsIsAutomatic
                  ? `Sized for the ${settings.startTempo}→${settings.targetTempo} range`
                  : 'Tap Auto to size for the range again'
              }
              action={
                <Button
                  variant="chip"
                  className={settings.rungsIsAutomatic ? 'button--chip-on' : undefined}
                  id="rungsAuto"
                  aria-pressed={settings.rungsIsAutomatic}
                  onClick={() => {
                    commit('rungs');
                    update({ rungsIsAutomatic: true });
                  }}
                >
                  Auto
                </Button>
              }
            >
              <input {...numberField('rungs')} min={LIMITS.rungs.min} max={LIMITS.rungs.max} />
            </Field>
          </div>

          <Note id="taperNote" summary="Why the steps aren’t all 5 BPM">
            Gebrian’s instructions say to click up “by 5s”, a constant increment. This app shrinks
            each increment as the tempo rises, because difficulty near your top speed is asymptotic
            rather than proportional: 140→150 costs far more than 75→80 even though it is the
            smaller jump. The long strides belong low down, where you are nowhere near your limit —
            so the step count changes how many rungs there are, not how evenly they are spaced.
          </Note>
        </fieldset>

        <Field htmlFor="meter" label="Time signature" hint={meterHint(settings)} hintId="meterHint">
          <select
            className="field__input"
            id="meter"
            value={settings.meterId}
            onChange={(event) => update({ meterId: event.target.value })}
          >
            {METERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="fields__item--wide">
          <Checkbox
            id="countIn"
            label="Count in one bar before each repetition"
            checked={settings.countInBars > 0}
            onChange={(on) => update({ countInBars: on ? 1 : 0 })}
          />
        </div>
      </div>

      <p className="setup__preview" id="setupPreview">
        {preview(settings)}
      </p>
      <Button
        variant="primary"
        className="setup__submit"
        id="begin"
        ref={start}
        onClick={() => onStart(settings)}
      >
        Start practising
      </Button>
    </Card>
  );
}

/** The shape of the session this setup would open, before committing to it. */
function preview(settings: Settings): string {
  const ladder = tempoLadder(settings.startTempo, settings.targetTempo, settings.rungs);
  const firstJump = ladder.length > 1 ? (ladder[1]! - ladder[0]!) / ladder[0]! : 0;
  return (
    `${settings.totalSegments} stages · ${ladder.length} steps from ` +
    `${settings.startTempo} to ${settings.targetTempo} BPM in each, ` +
    `opening at +${Math.round(firstJump * 100)}% and easing to the target.`
  );
}

function directionHint(settings: Settings): string {
  return settings.backwards
    ? `Start on segment ${settings.totalSegments} and add the segment before it each stage — ` +
        'backward chaining, so you always end up in music you already know.'
    : 'Start on segment 1 and add the next segment each stage.';
}

function meterHint(settings: Settings) {
  const meter = findMeter(settings.meterId);
  const span = subdivisionSpan(meter);
  return (
    <>
      {`Counted in ${meter.beatsPerBar} · tempo is `}
      <NoteGlyph note={meter.beatNote} />
      {' = BPM.'}
      {span && (
        <>
          {` The ${span.subdivision.word} click too up to `}
          <NoteGlyph note={meter.beatNote} />
          {`=${span.upTo}, then drop away so you can feel the pulse.`}
        </>
      )}
    </>
  );
}
