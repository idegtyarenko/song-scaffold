/** Time signatures: their pulse, their accents, and when eighths are worth clicking. */

export interface Meter {
  id: string;
  label: string;
  /** Pulses per bar — what you actually count. */
  beatsPerBar: number;
  /** 0-based pulses carrying a secondary accent. Pulse 0 always carries the main accent. */
  secondaryAccents: number[];
  /** What one pulse is worth. The tempo is always this note's BPM. */
  beatName: string;
  /** Clicks per pulse available as rhythmic support. 1 means the pulse is all there is. */
  subdivision: number;
  /** What one subdivision click is worth, when there are any. */
  subdivisionName?: string;
  /** The same, as a word, for running text. */
  subdivisionWord?: string;
}

export const METERS: Meter[] = [
  { id: '2/4', label: '2/4', beatsPerBar: 2, secondaryAccents: [], beatName: '♩', subdivision: 1 },
  { id: '3/4', label: '3/4', beatsPerBar: 3, secondaryAccents: [], beatName: '♩', subdivision: 1 },
  { id: '4/4', label: '4/4', beatsPerBar: 4, secondaryAccents: [2], beatName: '♩', subdivision: 1 },
  { id: '5/4', label: '5/4', beatsPerBar: 5, secondaryAccents: [3], beatName: '♩', subdivision: 1 },
  { id: '2/2', label: '2/2', beatsPerBar: 2, secondaryAccents: [], beatName: '𝅗𝅥', subdivision: 1 },
  { id: '3/2', label: '3/2', beatsPerBar: 3, secondaryAccents: [], beatName: '𝅗𝅥', subdivision: 1 },
  { id: '3/8', label: '3/8', beatsPerBar: 3, secondaryAccents: [], beatName: '♪', subdivision: 1 },
  { id: '7/8', label: '7/8', beatsPerBar: 7, secondaryAccents: [2, 4], beatName: '♪', subdivision: 1 },
  {
    id: '6/8', label: '6/8', beatsPerBar: 2, secondaryAccents: [],
    beatName: '♩.', subdivision: 3, subdivisionName: '♪', subdivisionWord: 'eighths',
  },
  {
    id: '9/8', label: '9/8', beatsPerBar: 3, secondaryAccents: [],
    beatName: '♩.', subdivision: 3, subdivisionName: '♪', subdivisionWord: 'eighths',
  },
  {
    id: '12/8', label: '12/8', beatsPerBar: 4, secondaryAccents: [],
    beatName: '♩.', subdivision: 3, subdivisionName: '♪', subdivisionWord: 'eighths',
  },
];

export const DEFAULT_METER_ID = '4/4';

/**
 * Above roughly four clicks a second the ear stops hearing a pulse and starts hearing a
 * buzz, so subdivisions past this rate are noise rather than support.
 */
export const MAX_CLICK_RATE = 240;

export function findMeter(id: string): Meter {
  return METERS.find((m) => m.id === id) ?? METERS.find((m) => m.id === DEFAULT_METER_ID)!;
}

/**
 * How many clicks to put in each pulse at this tempo.
 *
 * Subdivisions are what you want while the passage is slow and the rhythm is still
 * uncertain; once it is fast they only get in the way of feeling the pulse. Since the
 * tempo climbs all session, the metronome makes that switch itself rather than asking.
 */
export function subdivisionAt(meter: Meter, tempo: number): number {
  return meter.subdivision > 1 && tempo * meter.subdivision <= MAX_CLICK_RATE
    ? meter.subdivision
    : 1;
}

/** The tempo above which this meter's subdivisions stop sounding, if it has any. */
export function subdivisionCrossover(meter: Meter): number | null {
  return meter.subdivision > 1 ? Math.floor(MAX_CLICK_RATE / meter.subdivision) : null;
}
