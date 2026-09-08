import type { ReactNode } from 'react';

import './Note.css';

interface NoteProps {
  id?: string;
  summary: string;
  children: ReactNode;
}

/**
 * An aside that stays out of the way: collapsed it costs one small line, which is all the
 * room a screen read from a music stand has to spare.
 */
export function Note({ id, summary, children }: NoteProps) {
  return (
    <details className="note" id={id}>
      <summary className="note__summary">{summary}</summary>
      <p className="note__body">{children}</p>
    </details>
  );
}
