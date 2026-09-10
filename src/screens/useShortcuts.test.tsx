// @vitest-environment jsdom
/**
 * The keyboard on its own, away from any screen.
 *
 * What the session does with the keys is checked through the screen, in
 * session/SessionScreen.test.tsx. What is checked here is the part no screen shows: which
 * presses the hook answers to and which it deliberately lets past.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useShortcuts } from './useShortcuts';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

/** A press as the browser delivers it: on the focused element, on its way up to the document. */
function press(init: KeyboardEventInit, from: EventTarget = document): boolean {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    from.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

/** The element the browser would call the target while text is being typed. */
function typingIn(tag: 'input' | 'select' | 'textarea'): HTMLElement {
  const field = document.createElement(tag);
  document.body.append(field);
  return field;
}

describe('useShortcuts', () => {
  it('runs the shortcut named by the key, wherever the focus is', () => {
    const faster = vi.fn();
    renderHook(() => useShortcuts({ ArrowUp: faster }));

    expect(press({ key: 'ArrowUp' })).toBe(true);
    expect(faster).toHaveBeenCalledOnce();
  });

  it('runs one named by the code, for a key with no name of its own', () => {
    const toggle = vi.fn();
    renderHook(() => useShortcuts({ Space: toggle }));

    expect(press({ key: ' ', code: 'Space' })).toBe(true);
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('matches Shift exactly, so the shifted and plain keys stay two shortcuts', () => {
    const plain = vi.fn();
    const shifted = vi.fn();
    renderHook(() => useShortcuts({ ArrowRight: plain, 'Shift+ArrowLeft': shifted }));

    press({ key: 'ArrowRight', shiftKey: true });
    press({ key: 'ArrowLeft' });
    expect(plain).not.toHaveBeenCalled();
    expect(shifted).not.toHaveBeenCalled();

    press({ key: 'ArrowRight' });
    press({ key: 'ArrowLeft', shiftKey: true });
    expect(plain).toHaveBeenCalledOnce();
    expect(shifted).toHaveBeenCalledOnce();
  });

  it('leaves browser and system chords alone', () => {
    const run = vi.fn();
    renderHook(() => useShortcuts({ ArrowUp: run }));

    for (const chord of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
      expect(press({ key: 'ArrowUp', ...chord })).toBe(false);
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('stays out of the way while text is being typed', () => {
    const run = vi.fn();
    renderHook(() => useShortcuts({ Space: run, ArrowUp: run }));

    for (const tag of ['input', 'select', 'textarea'] as const) {
      expect(press({ key: ' ', code: 'Space' }, typingIn(tag))).toBe(false);
      expect(press({ key: 'ArrowUp' }, typingIn(tag))).toBe(false);
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('leaves Space and Enter to the control that has the focus', () => {
    const run = vi.fn();
    renderHook(() => useShortcuts({ Space: run, Enter: run, ArrowUp: run }));
    const button = document.createElement('button');
    document.body.append(button);

    expect(press({ key: ' ', code: 'Space' }, button)).toBe(false);
    expect(press({ key: 'Enter' }, button)).toBe(false);
    expect(run).not.toHaveBeenCalled();

    // Only those two: a button has no claim on the arrows, and taking one from it costs
    // nothing that the button was going to do with it.
    expect(press({ key: 'ArrowUp' }, button)).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });

  it('lets a press it has no shortcut for through untouched', () => {
    renderHook(() => useShortcuts({ ArrowUp: vi.fn() }));

    expect(press({ key: 'ArrowDown' })).toBe(false);
    expect(press({ key: 'a' })).toBe(false);
  });

  it('runs what the table says now, not what it said on the first render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ run }: { run: () => void }) => useShortcuts({ Enter: run }),
      {
        initialProps: { run: first },
      },
    );

    rerender({ run: second });
    press({ key: 'Enter' });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('stops listening once the screen is gone', () => {
    const run = vi.fn();
    const { unmount } = renderHook(() => useShortcuts({ ArrowUp: run }));

    unmount();
    expect(press({ key: 'ArrowUp' })).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});
