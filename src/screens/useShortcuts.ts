/**
 * Whole-page keyboard shortcuts, for screens that answer to keys wherever the focus is.
 *
 * The keys are read off the document rather than off a focused element, so nothing has to
 * be clicked first. That leaves the three things every such listener needs: it steps aside
 * for browser and system chords, it stays out of the way while text is being typed, and it
 * does not take a key out of the hands of the control that has the focus.
 */

import { useEffect, useRef } from 'react';

/**
 * What a shortcut is named after: `event.key` (`ArrowUp`) or `event.code` (`Space`), with
 * an optional `Shift+`. Shift is matched exactly, so a shortcut without it stays free for
 * a shifted one — `ArrowRight` and `Shift+ArrowRight` are two different shortcuts, and a
 * key held with Shift never triggers the plain binding.
 */
export type Shortcut = `${'' | 'Shift+'}${string}`;

/** Which shortcut this press is, in the spelling the table uses, or null for a press to ignore. */
function nameOf(event: KeyboardEvent, table: Record<Shortcut, unknown>): Shortcut | null {
  const shift = event.shiftKey ? 'Shift+' : '';
  const byKey: Shortcut = `${shift}${event.key}`;
  if (byKey in table) return byKey;
  const byCode: Shortcut = `${shift}${event.code}`;
  return byCode in table ? byCode : null;
}

/**
 * A press the focused control has first claim on.
 *
 * Text being typed is text, not shortcuts. And a button that has the focus answers to Space
 * and Enter — taking those would leave a keyboard user tabbing onto "Choose a file" and
 * getting the metronome instead, with nothing on screen to explain it. The shortcut is for
 * when the focus is nowhere in particular, which is where it is nearly all the time.
 */
function isSpokenFor(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('input, select, textarea')) return true;
  const pressable = target.closest('button, a[href], summary, [role="button"]');
  return pressable !== null && (event.key === ' ' || event.key === 'Enter');
}

/**
 * Run these while the component is mounted, one shortcut per key press.
 *
 * The table may be rebuilt on every render — what a shortcut does is read at press time,
 * so the single listener never runs a stale closure and never re-subscribes.
 */
export function useShortcuts(shortcuts: Record<Shortcut, () => void>): void {
  const latest = useRef(shortcuts);
  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      // Meta, Ctrl and Alt belong to the browser and the system; taking them would shadow
      // something the player relies on more than they rely on us.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isSpokenFor(event)) return;

      const name = nameOf(event, latest.current);
      if (!name) return;
      event.preventDefault();
      latest.current[name]!();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
