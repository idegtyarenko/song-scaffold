/** Time signatures, and how their beats are accented. */

export interface Meter {
  id: string;
  label: string;
  /** Clicks per bar. */
  beatsPerBar: number;
  /** 0-based beats carrying a secondary accent. Beat 0 always carries the main accent. */
  secondaryAccents: number[];
  /** What one click is worth, for the tempo label. */
  beatName: string;
  /** For 6/8, 9/8 and 12/8: the same bar counted in dotted beats. */
  compound?: Omit<Meter, 'id' | 'compound'>;
}

export const METERS: Meter[] = [
  { id: '2/4', label: '2/4', beatsPerBar: 2, secondaryAccents: [], beatName: '♩' },
  { id: '3/4', label: '3/4', beatsPerBar: 3, secondaryAccents: [], beatName: '♩' },
  { id: '4/4', label: '4/4', beatsPerBar: 4, secondaryAccents: [2], beatName: '♩' },
  { id: '5/4', label: '5/4', beatsPerBar: 5, secondaryAccents: [3], beatName: '♩' },
  { id: '2/2', label: '2/2', beatsPerBar: 2, secondaryAccents: [], beatName: '𝅗𝅥' },
  { id: '3/2', label: '3/2', beatsPerBar: 3, secondaryAccents: [], beatName: '𝅗𝅥' },
  { id: '3/8', label: '3/8', beatsPerBar: 3, secondaryAccents: [], beatName: '♪' },
  { id: '7/8', label: '7/8', beatsPerBar: 7, secondaryAccents: [2, 4], beatName: '♪' },
  {
    id: '6/8', label: '6/8', beatsPerBar: 6, secondaryAccents: [3], beatName: '♪',
    compound: { label: '6/8', beatsPerBar: 2, secondaryAccents: [], beatName: '♩.' },
  },
  {
    id: '9/8', label: '9/8', beatsPerBar: 9, secondaryAccents: [3, 6], beatName: '♪',
    compound: { label: '9/8', beatsPerBar: 3, secondaryAccents: [], beatName: '♩.' },
  },
  {
    id: '12/8', label: '12/8', beatsPerBar: 12, secondaryAccents: [3, 6, 9], beatName: '♪',
    compound: { label: '12/8', beatsPerBar: 4, secondaryAccents: [], beatName: '♩.' },
  },
];

export const DEFAULT_METER_ID = '4/4';

export function findMeter(id: string): Meter {
  return METERS.find((m) => m.id === id) ?? METERS.find((m) => m.id === DEFAULT_METER_ID)!;
}

/** The beat grid actually clicked, once the dotted-beat preference is applied. */
export function resolveMeter(id: string, clickDottedBeats: boolean): {
  beatsPerBar: number;
  secondaryAccents: number[];
  beatName: string;
} {
  const meter = findMeter(id);
  return clickDottedBeats && meter.compound ? meter.compound : meter;
}
