// @vitest-environment jsdom
/**
 * Proves the React toolchain end to end — the JSX transform, the DOM renderer and
 * Testing Library — so the screens that move here later start on ground that works.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { App } from './App';

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(cleanup);

it('renders the empty root without touching the page', () => {
  const { container } = render(<App />);

  expect(container.innerHTML).toBe('');
});
