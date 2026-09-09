// @vitest-environment jsdom
/**
 * The ways between the screens. Each screen is tested on its own elsewhere; what is checked
 * here is that there is a way into it and a way back — a screen nobody can reach is the same
 * as no screen at all, and the recording workspace is reachable by its route alone.
 */

import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bootApp } from './app-harness';

/** Follow a link, the way the address bar does it — the router answers on its own turn. */
async function goTo(hash: string): Promise<void> {
  await act(async () => {
    location.hash = hash;
    await new Promise((settled) => setTimeout(settled, 0));
  });
}

afterEach(() => {
  location.hash = '';
  vi.unstubAllGlobals();
});

const onSetup = () => screen.queryByRole('button', { name: 'Start practising' }) !== null;
const onRecording = () => screen.queryByText('Drop an audio file here') !== null;

describe('the app', () => {
  it('opens on the setup form', async () => {
    await bootApp();

    expect(onSetup()).toBe(true);
  });

  it('opens straight into the recording workspace when the address says so', async () => {
    location.hash = '#/recording';

    await bootApp();

    expect(onRecording()).toBe(true);
    // Nothing on the setup form points at it yet: the route is the only way in.
    expect(screen.queryByRole('button', { name: /recording/i })).toBeNull();
  });

  it('follows the address bar there and back', async () => {
    await bootApp();

    await goTo('#/recording');
    expect(onRecording()).toBe(true);

    await goTo('#/');
    expect(onSetup()).toBe(true);
  });

  it('treats an address it does not know as the setup form', async () => {
    location.hash = '#/nowhere';

    await bootApp();

    expect(onSetup()).toBe(true);
  });
});
