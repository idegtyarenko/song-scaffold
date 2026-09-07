/** Setup form values: defaults, validation and persistence. */

import { DEFAULT_METER_ID, findMeter } from './meter';
import { suggestStep } from './sequence';

export interface Settings {
  totalSegments: number;
  backwards: boolean;
  startTempo: number;
  targetTempo: number;
  step: number;
  /** True while `step` should keep following `suggestStep` as the tempos change. */
  stepIsAutomatic: boolean;
  meterId: string;
  clickDottedBeats: boolean;
  countInBars: number;
}

export const LIMITS = {
  totalSegments: { min: 1, max: 15 },
  tempo: { min: 20, max: 300 },
  step: { min: 1, max: 50 },
} as const;

export const DEFAULT_SETTINGS: Settings = {
  totalSegments: 4,
  backwards: false,
  startTempo: 75,
  targetTempo: 150,
  step: suggestStep(75, 150),
  stepIsAutomatic: true,
  meterId: DEFAULT_METER_ID,
  clickDottedBeats: true,
  countInBars: 1,
};

const STORAGE_KEY = 'interleaved-clicking-up:settings';

/** Clamp everything into range and keep the target at or above the start. */
export function normalize(settings: Settings): Settings {
  const startTempo = clamp(settings.startTempo, LIMITS.tempo.min, LIMITS.tempo.max);
  const targetTempo = clamp(
    Math.max(settings.targetTempo, startTempo),
    LIMITS.tempo.min,
    LIMITS.tempo.max,
  );
  const step = settings.stepIsAutomatic
    ? suggestStep(startTempo, targetTempo)
    : clamp(settings.step, LIMITS.step.min, LIMITS.step.max);

  return {
    ...settings,
    totalSegments: clamp(
      settings.totalSegments,
      LIMITS.totalSegments.min,
      LIMITS.totalSegments.max,
    ),
    startTempo,
    targetTempo,
    step,
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
