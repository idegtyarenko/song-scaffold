/**
 * The layer rule, enforced rather than remembered.
 *
 * `_internal/solution-design.md`, section 3: model and practice know nothing of the DOM or
 * Web Audio, audio knows nothing of the method, ui knows about everyone. A rule that only
 * lives in a document holds until the first hurried import; this reads the imports back.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');

/**
 * What each layer is allowed to reach for, itself included. `root` is the entry point and
 * the screen switcher, which sit above everything; `screens` draw with all of it.
 */
const ALLOWED: Record<string, string[]> = {
  model: ['model'],
  practice: ['model', 'practice'],
  // Meters and note values are music, not the method — a click grid may know them.
  audio: ['model', 'audio'],
  ui: ['model', 'ui'],
  // The canvas is drawing, not method: it may know what a recording is and lean on the
  // shared components, and nothing about how a passage is practised.
  waveform: ['model', 'ui', 'waveform'],
  screens: ['model', 'practice', 'audio', 'ui', 'waveform', 'screens', 'root'],
  root: ['model', 'practice', 'audio', 'ui', 'waveform', 'screens', 'root'],
};

/**
 * Browser globals the pure layers must not touch. `localStorage` is deliberately absent:
 * the rule names the DOM and Web Audio, and practice/settings.ts persists a handful of
 * numbers through it. Widen this list only by widening the rule first.
 */
const FORBIDDEN_GLOBALS = [
  'document',
  'window',
  'matchMedia',
  'requestAnimationFrame',
  'HTMLElement',
  'AudioContext',
  'AudioBuffer',
  'AudioWorklet',
];

const PURE_LAYERS = ['model', 'practice'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Which layer a file belongs to — its first folder under src, or `root` if it has none. */
function layerOf(path: string): string {
  const [head, ...rest] = relative(SRC, path).split('/');
  return rest.length === 0 ? 'root' : head!;
}

/** Every relative specifier a file imports, static and dynamic alike. */
function importsOf(path: string): string[] {
  const source = readFileSync(path, 'utf8');
  const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)];
  return specifiers.map((match) => match[1]!).filter((specifier) => specifier.startsWith('.'));
}

const FILES = sourceFiles(SRC);

describe('the layers', () => {
  it('has files to check, so a broken walk cannot pass silently', () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  it('only import downwards', () => {
    const violations = FILES.flatMap((path) => {
      const from = layerOf(path);
      return importsOf(path)
        .map((specifier) => layerOf(resolve(dirname(path), specifier)))
        .filter((to) => !ALLOWED[from]!.includes(to))
        .map((to) => `${relative(SRC, path)} imports ${to}/, but ${from}/ may not`);
    });

    expect(violations).toEqual([]);
  });

  it('keep the DOM and Web Audio out of model and practice', () => {
    const violations = FILES.filter((path) => PURE_LAYERS.includes(layerOf(path))).flatMap(
      (path) => {
        const source = readFileSync(path, 'utf8');
        return FORBIDDEN_GLOBALS.filter((global) => new RegExp(`\\b${global}\\b`).test(source)).map(
          (global) => `${relative(SRC, path)} touches ${global}`,
        );
      },
    );

    expect(violations).toEqual([]);
  });
});
