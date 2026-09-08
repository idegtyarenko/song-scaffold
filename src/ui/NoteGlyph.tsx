/**
 * Note-value glyphs, drawn rather than typed.
 *
 * Unicode has a quarter note and an eighth note in the BMP, but no half note — that one
 * lives in the astral musical-symbols block, which no system font ships, so it lands as
 * tofu. Drawing all of them keeps the set consistent and independent of the reader's fonts.
 */

import './NoteGlyph.css';
import { noteWord, type NoteValue } from '../model/notes';

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

/** A note value as JSX. The shapes are plain SVG markup, hence the raw insert. */
export function NoteGlyph({ note }: { note: NoteValue }) {
  return (
    <svg
      className="glyph"
      viewBox="0 0 16 24"
      fill="currentColor"
      role="img"
      aria-label={noteWord(note)}
      dangerouslySetInnerHTML={{ __html: SHAPES[note] }}
    />
  );
}

/**
 * The same glyph as an inline SVG string, for the session screen, which still writes its
 * markup by hand. It goes away with that screen.
 */
export function noteGlyphMarkup(note: NoteValue): string {
  return (
    `<svg class="glyph" viewBox="0 0 16 24" fill="currentColor" role="img" ` +
    `aria-label="${noteWord(note)}">${SHAPES[note]}</svg>`
  );
}
