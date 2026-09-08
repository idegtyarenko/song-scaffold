/**
 * Note values: the four the app can put a tempo on, and how each one reads aloud.
 *
 * They are drawn rather than typed wherever they appear — see ui/NoteGlyph.tsx for why —
 * but the values themselves are music, not markup, so they live here.
 */

export type NoteValue = 'half' | 'quarter' | 'dotted-quarter' | 'eighth';

/** How each value reads aloud, for screen readers and for running text. */
const WORDS: Record<NoteValue, string> = {
  half: 'half note',
  quarter: 'quarter note',
  'dotted-quarter': 'dotted quarter note',
  eighth: 'eighth note',
};

export function noteWord(note: NoteValue): string {
  return WORDS[note];
}
