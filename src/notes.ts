/**
 * Note-value glyphs, drawn rather than typed.
 *
 * Unicode has a quarter note and an eighth note in the BMP, but no half note — that one
 * lives in the astral musical-symbols block, which no system font ships, so it lands as
 * tofu. Drawing all of them keeps the set consistent and independent of the reader's fonts.
 */

export type NoteValue = 'half' | 'quarter' | 'dotted-quarter' | 'eighth';

/** How each value reads aloud, for screen readers and for running text. */
const WORDS: Record<NoteValue, string> = {
  half: 'half note',
  quarter: 'quarter note',
  'dotted-quarter': 'dotted quarter note',
  eighth: 'eighth note',
};

const HEAD = '<ellipse cx="5.6" cy="17.4" rx="4.4" ry="3.2" transform="rotate(-20 5.6 17.4)" />';
const HEAD_HOLLOW =
  '<ellipse cx="5.6" cy="17.4" rx="3.7" ry="2.5" transform="rotate(-20 5.6 17.4)" ' +
  'fill="none" stroke="currentColor" stroke-width="1.7" />';
const STEM = '<path d="M8.9 3.4h1.5v13.6H8.9z" />';
const FLAG = '<path d="M10.4 3.4c3.7 2.1 5.2 4.9 3.6 8.4c0.6-3.2-0.8-5-3.6-5.8z" />';
const DOT = '<circle cx="13.2" cy="17.4" r="1.2" />';

const SHAPES: Record<NoteValue, string> = {
  half: HEAD_HOLLOW + STEM,
  quarter: HEAD + STEM,
  'dotted-quarter': HEAD + STEM + DOT,
  eighth: HEAD + STEM + FLAG,
};

export function noteWord(note: NoteValue): string {
  return WORDS[note];
}

/** The glyph as inline SVG markup: inherits the surrounding colour and font size. */
export function noteGlyph(note: NoteValue): string {
  return (
    `<svg class="glyph" viewBox="0 0 16 24" fill="currentColor" role="img" ` +
    `aria-label="${WORDS[note]}">${SHAPES[note]}</svg>`
  );
}
