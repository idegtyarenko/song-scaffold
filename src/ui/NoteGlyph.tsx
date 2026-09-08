import { noteShape, noteWord, type NoteValue } from '../notes';

/**
 * A note value drawn rather than typed — see notes.ts for why. The shapes are plain SVG
 * markup shared with the imperative session view, hence the raw insert.
 */
export function NoteGlyph({ note }: { note: NoteValue }) {
  return (
    <svg
      className="glyph"
      viewBox="0 0 16 24"
      fill="currentColor"
      role="img"
      aria-label={noteWord(note)}
      dangerouslySetInnerHTML={{ __html: noteShape(note) }}
    />
  );
}
