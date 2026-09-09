// @vitest-environment jsdom
/**
 * The setup form as the player works it: typing, tabbing away, tapping Auto, and coming
 * back to it after a reload. Everything here is driven through the rendered screen rather
 * than through the settings module, so the normalization and the persistence are checked
 * where they are actually reached.
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SetupScreen } from './SetupScreen';

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(cleanup);

const user = userEvent.setup();

const $ = <T extends HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};

const value = (selector: string) => $<HTMLInputElement>(selector).value;
const text = (selector: string) => $(selector).textContent?.trim() ?? '';

/** Type a number in and leave the field, which is when it gets normalized. */
async function setNumber(selector: string, next: number): Promise<void> {
  const input = $<HTMLInputElement>(selector);
  await user.clear(input);
  await user.type(input, String(next));
  await user.tab();
}

async function setUp(segments: number, from: 'top' | 'bottom', start: number, target: number) {
  await setNumber('#totalSegments', segments);
  await user.click($(`input[name="direction"][value="${from}"]`));
  await setNumber('#startTempo', start);
  await setNumber('#targetTempo', target);
  await setNumber('#rungs', 7); // 60, 67, 73, 79, 83, 87, 90 for a 60->90 range
}

/** Same storage, fresh screen — what a reload does. */
function reload(): void {
  cleanup();
  render(<SetupScreen onStart={() => {}} />);
}

describe('the setup screen', () => {
  beforeEach(() => {
    localStorage.clear();
    render(<SetupScreen onStart={() => {}} />);
  });

  it('sizes the rung count to the tempo range until you say otherwise', async () => {
    await setNumber('#startTempo', 60);
    await setNumber('#targetTempo', 90);
    expect(value('#rungs')).toBe('7');

    await setNumber('#targetTempo', 120);
    expect(value('#rungs')).toBe('13');

    await setNumber('#rungs', 5);
    await setNumber('#targetTempo', 90);
    expect(value('#rungs')).toBe('5');
    expect($('#rungsAuto').getAttribute('aria-pressed')).toBe('false');
  });

  it('hands the rung count back to the tempo range when you tap Auto', async () => {
    await setNumber('#startTempo', 60);
    await setNumber('#targetTempo', 90);
    await setNumber('#rungs', 20);
    expect(value('#rungs')).toBe('20');

    await user.click($('#rungsAuto'));
    expect(value('#rungs')).toBe('7');
    expect($('#rungsAuto').getAttribute('aria-pressed')).toBe('true');

    await setNumber('#targetTempo', 120);
    expect(value('#rungs')).toBe('13');
  });

  it('shows a manual rung count as manual after a reload, and can still recover it', async () => {
    await setNumber('#startTempo', 60);
    await setNumber('#targetTempo', 90);
    await setNumber('#rungs', 20);

    reload();

    expect(value('#rungs')).toBe('20');
    expect($('#rungsAuto').getAttribute('aria-pressed')).toBe('false');
    await user.click($('#rungsAuto'));
    expect(value('#rungs')).toBe('7');
  });

  it('leaves a half-typed number alone until you leave the field', async () => {
    await setNumber('#startTempo', 100);
    await setNumber('#targetTempo', 120);

    const target = $<HTMLInputElement>('#targetTempo');
    await user.clear(target);
    await user.type(target, '4');
    // Clamped in the settings behind the field, but not under the cursor.
    expect(value('#targetTempo')).toBe('4');
    expect(text('#setupPreview')).toContain('from 100 to 100 BPM');

    await user.tab();
    expect(value('#targetTempo')).toBe('100');
  });

  it('remembers the number you stopped on, not the ones you passed through', async () => {
    await setNumber('#startTempo', 90);

    const input = $<HTMLInputElement>('#startTempo');
    await user.clear(input);
    await user.type(input, '12');

    // Neither the empty box's default nor the 12 on the way to 120 has been settled on.
    reload();
    expect(value('#startTempo')).toBe('90');

    await setNumber('#startTempo', 120);
    reload();
    expect(value('#startTempo')).toBe('120');
  });

  it('keeps a switch as soon as it is flipped, there being no field to leave', async () => {
    await user.click($('input[name="direction"][value="bottom"]'));
    await user.click($('#countIn'));

    reload();

    expect($<HTMLInputElement>('input[name="direction"][value="bottom"]').checked).toBe(true);
    expect($<HTMLInputElement>('#countIn').checked).toBe(false);
  });

  it('credits the method and points at Gebrian’s own sources', () => {
    const link = (selector: string) => $<HTMLAnchorElement>(selector);
    expect(link('#methodLink').textContent).toContain('Molly Gebrian');
    // Page 4 is where she writes the method out; Part II explains it and Part III demos it.
    expect(link('#methodLink').getAttribute('href')).toMatch(/\.pdf#page=4$/);
    expect(link('#explainLink').getAttribute('href')).toContain('75OWZAq-O4U');
    expect(link('#demoLink').getAttribute('href')).toContain('e08zFDnLOYY');
    for (const selector of ['#methodLink', '#explainLink', '#demoLink']) {
      expect(link(selector).getAttribute('rel')).toBe('noreferrer');
      expect(link(selector).getAttribute('target')).toBe('_blank');
    }
  });

  it('explains where the ladder departs from Gebrian’s instructions, without taking up room', () => {
    const note = $<HTMLDetailsElement>('#taperNote');
    expect(note.open).toBe(false);
    const summary = note.querySelector('.note__summary')!.textContent!;
    const body = note.querySelector('.note__body')!.textContent!.replace(/\s+/g, ' ');
    // It must name the difference and give the reason, not just assert the difference.
    expect(summary).toContain('5 BPM');
    expect(body).toContain('by 5s');
    expect(body).toContain('140');
    expect(body).toMatch(/asymptotic|top speed/);
  });

  it('previews the shape of the session before you commit to it', async () => {
    await setUp(4, 'top', 60, 90);
    expect(text('#setupPreview')).toBe(
      '4 stages · 7 steps from 60 to 90 BPM in each, opening at +12% and easing to the target.',
    );
    expect(text('#directionHint')).toContain('Start on segment 1');
  });

  it('remembers the setup across a reload', async () => {
    await setUp(7, 'bottom', 80, 120);
    await user.selectOptions($('#meter'), '3/4');

    reload();

    expect(value('#totalSegments')).toBe('7');
    expect(value('#startTempo')).toBe('80');
    expect(value('#targetTempo')).toBe('120');
    expect($<HTMLSelectElement>('#meter').value).toBe('3/4');
    expect($<HTMLInputElement>('input[name="direction"][value="bottom"]').checked).toBe(true);
  });

  it('keeps the target at or above the start tempo', async () => {
    await setUp(4, 'top', 100, 120);
    await setNumber('#targetTempo', 40);
    expect(value('#targetTempo')).toBe('100');
  });

  it('hands the settings over as they stand when you start practising', async () => {
    cleanup();
    const onStart = vi.fn();
    render(<SetupScreen onStart={onStart} />);

    await setUp(3, 'bottom', 60, 90);
    fireEvent.click($('#begin'));

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        totalSegments: 3,
        backwards: true,
        startTempo: 60,
        targetTempo: 90,
        rungs: 7,
      }),
    );
  });
});
