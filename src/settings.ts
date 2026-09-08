/** Setup form values: defaults, validation and persistence. */

import { DEFAULT_METER_ID, findMeter } from './meter';
import { suggestRungs } from './sequence';

export interface Settings {
  totalSegments: number;
  backwards: boolean;
  startTempo: number;
  targetTempo: number;
  /** Notches from the start tempo to the target. */
  rungs: number;
  /** True while `rungs` should keep following `suggestRungs` as the tempos change. */
  rungsIsAutomatic: boolean;
  meterId: string;
  countInBars: number;
}

export const LIMITS = {
  totalSegments: { min: 1, max: 15 },
  tempo: { min: 20, max: 300 },
  rungs: { min: 2, max: 30 },
} as const;

export const DEFAULT_SETTINGS: Settings = {
  totalSegments: 4,
  backwards: false,
  startTempo: 75,
  targetTempo: 150,
  rungs: suggestRungs(75, 150),
  rungsIsAutomatic: true,
  meterId: DEFAULT_METER_ID,
  countInBars: 1,
};

const STORAGE_KEY = 'song-scaffold:settings';

/** Clamp everything into range and keep the target at or above the start. */
export function normalize(settings: Settings): Settings {
  const startTempo = clamp(settings.startTempo, LIMITS.tempo.min, LIMITS.tempo.max);
  const targetTempo = clamp(
    Math.max(settings.targetTempo, startTempo),
    LIMITS.tempo.min,
    LIMITS.tempo.max,
  );
  const rungs = settings.rungsIsAutomatic
    ? suggestRungs(startTempo, targetTempo)
    : clamp(settings.rungs, LIMITS.rungs.min, LIMITS.rungs.max);

  return {
    ...settings,
    totalSegments: clamp(
      settings.totalSegments,
      LIMITS.totalSegments.min,
      LIMITS.totalSegments.max,
    ),
    startTempo,
    targetTempo,
    rungs,
    meterId: findMeter(settings.meterId).id,
    countInBars: clamp(settings.countInBars, 0, 2),
  };
}

export function load(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return normalize({ ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as Partial<Settings>) });
  } catch {
    // Corrupt or unavailable storage is not worth failing over.
    return DEFAULT_SETTINGS;
  }
}

export function save(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing, quota, or storage blocked entirely — the app still works.
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
