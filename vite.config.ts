import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the project site under the repository name, so this has to track it.
  base: '/song-scaffold/',
  build: { target: 'es2022' },
  plugins: [react()],
  test: {
    /**
     * Coverage as a tripwire, not a target.
     *
     * The floors are per file and deliberately low: what they catch is a module arriving with
     * no tests at all, which a project-wide percentage stops noticing as the tree grows — one
     * untested file dilutes 500 statements visibly and 5000 not at all. Raising these numbers
     * to chase a total would invite tests that execute lines without asserting anything, which
     * is the one thing the other gates in `structure.test.ts` and `layers.test.ts` cannot be
     * passed by. The floors sit below today's worst file rather than snug against it, so they
     * fail on an absence of tests and not on a defensive branch nobody can reach — branches
     * stays the lowest of the three because a guard against a state the caller cannot produce
     * is good code that no honest test will ever reach.
     *
     * Every exclusion below costs a written reason.
     */
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        // Bootstrap: reads #root, unlocks audio, mounts App. No branch worth asserting.
        'src/main.tsx',
        // The vocabulary the screen tests are written in — test code that happens to live in src.
        'src/app-harness.tsx',
        // The same, for the recording screen's two test files, which share a way of driving it.
        'src/screens/recording/harness.tsx',
        // The Web Audio double the tests hear. Test code too; it sits in the audio layer
        // because the layer rule puts it there, not because the app ever runs it.
        'src/audio/fake-context.ts',
      ],
      reporter: ['text-summary'],
      thresholds: { perFile: true, statements: 80, branches: 60, functions: 70 },
    },
  },
});
