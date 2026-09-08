/** Time signatures: their pulse, their accents, and when the pulse gets extra clicks. */

import type { NoteValue } from './notes';

/** Extra clicks inside one pulse. */
export interface Subdivision {
  /** Clicks per pulse, the pulse itself included. */
  count: number;
  /** What one of those clicks is worth, as a plural word for running text. */
  word: string;
}

export interface Meter {
  id: string;
  label: string;
  /** Pulses per bar — what you actually count. */
  beatsPerBar: number;
  /** 0-based pulses carrying a secondary accent. Pulse 0 always carries the main accent. */
  secondaryAccents: number[];
  /** What one pulse is worth. The tempo is always this note's BPM. */
  beatNote: NoteValue;
  /** The three-way split of a compound pulse. Absent on meters whose pulse splits in two. */
  compound?: Subdivision;
}

const TRIPLE: Subdivision = { count: 3, word: 'eighths' };

export const METERS: Meter[] = [
  { id: '2/4', label: '2/4', beatsPerBar: 2, secondaryAccents: [], beatNote: 'quarter' },
  { id: '3/4', label: '3/4', beatsPerBar: 3, secondaryAccents: [], beatNote: 'quarter' },
  { id: '4/4', label: '4/4', beatsPerBar: 4, secondaryAccents: [2], beatNote: 'quarter' },
  { id: '5/4', label: '5/4', beatsPerBar: 5, secondaryAccents: [3], beatNote: 'quarter' },
  { id: '2/2', label: '2/2', beatsPerBar: 2, secondaryAccents: [], beatNote: 'half' },
  { id: '3/2', label: '3/2', beatsPerBar: 3, secondaryAccents: [], beatNote: 'half' },
  { id: '3/8', label: '3/8', beatsPerBar: 3, secondaryAccents: [], beatNote: 'eighth' },
  { id: '7/8', label: '7/8', beatsPerBar: 7, secondaryAccents: [2, 4], beatNote: 'eighth' },
  {
    id: '6/8', label: '6/8', beatsPerBar: 2, secondaryAccents: [],
    beatNote: 'dotted-quarter', compound: TRIPLE,
  },
  {
    id: '9/8', label: '9/8', beatsPerBar: 3, secondaryAccents: [],
    beatNote: 'dotted-quarter', compound: TRIPLE,
  },
  {
    id: '12/8', label: '12/8', beatsPerBar: 4, secondaryAccents: [],
    beatNote: 'dotted-quarter', compound: TRIPLE,
  },
];

export const DEFAULT_METER_ID = '4/4';

/**
 * Above roughly four clicks a second the ear stops hearing a pulse and starts hearing a
 * buzz, so subdivisions past this rate are noise rather than support.
 */
export const MAX_CLICK_RATE = 240;

/**
 * Below one click a second the gap between pulses is longer than the ear will hold, and
 * the player fills it by guessing. A pulse this slow gets a click on the upbeat.
 */
export const MIN_PULSE_RATE = 60;

/**
 * Halving the pulse: what the halves are worth. A compound pulse is missing here on
 * purpose — it splits three ways, and its own `compound` clicks already cover slow tempos.
 */
const HALVES: Partial<Record<NoteValue, Subdivision>> = {
  half: { count: 2, word: 'quarters' },
  quarter: { count: 2, word: 'eighths' },
  eighth: { count: 2, word: 'sixteenths' },
};

export function findMeter(id: string): Meter {
  return METERS.find((m) => m.id === id) ?? METERS.find((m) => m.id === DEFAULT_METER_ID)!;
}

/**
 * The extra clicks to put inside each pulse at this tempo, if any.
 *
 * Subdivisions are what you want while the passage is slow and the rhythm is still
 * uncertain; once it is fast they only get in the way of feeling the pulse. Since the
 * tempo climbs all session, the metronome makes that switch itself rather than asking.
 */
export function subdivisionAt(meter: Meter, tempo: number): Subdivision | null {
  const subdivision = subdivisionSpan(meter);
  return subdivision && tempo <= subdivision.upTo ? subdivision.subdivision : null;
}

/** What this meter's extra clicks are, and the top tempo at which they still sound. */
export function subdivisionSpan(
  meter: Meter,
): { subdivision: Subdivision; upTo: number } | null {
  if (meter.compound) {
    return {
      subdivision: meter.compound,
      upTo: Math.floor(MAX_CLICK_RATE / meter.compound.count),
    };
  }
  const halves = HALVES[meter.beatNote];
  return halves ? { subdivision: halves, upTo: MIN_PULSE_RATE - 1 } : null;
}
