/**
 * Size, enforced rather than remembered.
 *
 * `_internal/solution-design.md`, section 3: a source file stays under 300 lines, a test under
 * 400, a folder under 12 entries. These are not laws — a long file is sometimes the right
 * answer — so what fails here is never the size itself but the absence of a decision about it.
 * Cross a threshold and this test fails until the exception is written down with a reason and a
 * ceiling; written down, it passes and says so out loud on every run.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');

const MAX_LINES = 300;
/** Tests are longer by nature: a case per behaviour, spelled out rather than factored. */
const MAX_TEST_LINES = 400;
const MAX_CHILDREN = 12;

/** How far this one may go, and why it was allowed to. */
type Allowance = { limit: number; why: string };

/**
 * Files allowed past the threshold. The ceiling is granted, not observed: raise it only by
 * deciding again, and delete the entry once the file no longer needs it.
 */
const APPROVED_FILES: Record<string, Allowance> = {};

/** Folders allowed past the threshold, under the same terms. */
const APPROVED_DIRS: Record<string, Allowance> = {
  'src/': {
    limit: 13,
    why: 'six layers of the design, plus the entry point, the routes, their tests and the page stylesheet',
  },
  'ui/': {
    limit: 16,
    why: 'a component and its stylesheet are two files each — seven components and a helper, not fifteen',
  },
};

/** Every source file under a directory, and every directory including the one we started at. */
function walk(dir: string): { files: string[]; dirs: string[] } {
  const files: string[] = [];
  const dirs: string[] = [dir];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const below = walk(path);
      files.push(...below.files);
      dirs.push(...below.dirs);
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      files.push(path);
    }
  }

  return { files, dirs };
}

/** Lines the way `wc -l` counts them, so the number here matches the number in the shell. */
function lineCount(path: string): number {
  const source = readFileSync(path, 'utf8');
  return source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
}

/** One thing that was measured: how big it is, what it may be, and what it was granted. */
type Item = { name: string; size: number; limit: number; allowance: Allowance | undefined };

/** The words a verdict is phrased in — files are long, folders are crowded. */
type Kind = { verb: string; unit: string; list: string; fix: string };

const AS_FILES: Kind = { verb: 'is', unit: 'lines', list: 'APPROVED_FILES', fix: 'split it' };
const AS_DIRS: Kind = { verb: 'holds', unit: 'entries', list: 'APPROVED_DIRS', fix: 'regroup it' };

/**
 * Sort the measurements into what breaks the run, what stays visible as a warning, and which
 * allowances are no longer earning their line.
 */
function judge(items: Item[], kind: Kind) {
  const violations: string[] = [];
  const stale: string[] = [];
  const warnings: string[] = [];

  for (const { name, size, limit, allowance } of items) {
    const measured = `${name} ${kind.verb} ${size} ${kind.unit}`;

    if (!allowance) {
      if (size > limit) {
        violations.push(
          `${measured}, over ${limit} — ${kind.fix}, or add it to ${kind.list} with a reason`,
        );
      }
    } else if (size > allowance.limit) {
      violations.push(
        `${measured}, over its approved ${allowance.limit} — ` +
          `${kind.fix}, or raise the allowance deliberately`,
      );
    } else if (size <= limit) {
      stale.push(`${measured}, back under ${limit} — drop its entry from ${kind.list}`);
    } else {
      warnings.push(
        `⚠ approved: ${name} ${size}/${allowance.limit} ${kind.unit} — ${allowance.why}`,
      );
    }
  }

  return { violations, stale, warnings };
}

const tree = walk(SRC);

const FILES: Item[] = tree.files.map((path) => {
  const name = relative(SRC, path);
  return {
    name,
    size: lineCount(path),
    limit: /\.test\.tsx?$/.test(name) ? MAX_TEST_LINES : MAX_LINES,
    allowance: APPROVED_FILES[name],
  };
});

// A trailing slash, so `ui/` reads as a folder in both the list and the failure; `src` itself
// is relative to nothing and would otherwise come out as a bare slash.
const DIRS: Item[] = tree.dirs.map((path) => {
  const name = `${relative(SRC, path) || 'src'}/`;
  return {
    name,
    size: readdirSync(path).length,
    limit: MAX_CHILDREN,
    allowance: APPROVED_DIRS[name],
  };
});

const byLength = judge(FILES, AS_FILES);
const byFanOut = judge(DIRS, AS_DIRS);

describe('the tree', () => {
  it('has files and folders to measure, so a broken walk cannot pass silently', () => {
    expect(FILES.length).toBeGreaterThan(20);
    expect(DIRS.length).toBeGreaterThan(4);
  });

  it('keeps files short enough to hold in the head', () => {
    expect(byLength.violations).toEqual([]);
  });

  it('keeps folders small enough to scan', () => {
    expect(byFanOut.violations).toEqual([]);
  });

  it('names every allowance out loud, and keeps none it no longer needs', () => {
    // Written straight to stderr, not through console.warn: the default reporter drops a
    // passing test's console output when it is not on a terminal, which is exactly CI.
    for (const warning of [...byLength.warnings, ...byFanOut.warnings]) {
      process.stderr.write(`${warning}\n`);
    }

    expect([...byLength.stale, ...byFanOut.stale]).toEqual([]);
  });
});
