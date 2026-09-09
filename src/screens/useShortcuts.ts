/**
 * Whole-page keyboard shortcuts, for screens that answer to keys wherever the focus is.
 *
 * The keys are read off the document rather than off a focused element, so nothing has to
 * be clicked first. That leaves the two things every such listener needs: it steps aside
 * for browser and system chords, and it stays out of the way while text is being typed.
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

/** Text being typed is text, not shortcuts. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('input, select, textarea') !== null;
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
      if (isTyping(event.target)) return;

      const name = nameOf(event, latest.current);
      if (!name) return;
      event.preventDefault();
      latest.current[name]!();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
