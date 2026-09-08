import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the project site under the repository name, so this has to track it.
  base: '/song-scaffold/',
  build: { target: 'es2022' },
});
