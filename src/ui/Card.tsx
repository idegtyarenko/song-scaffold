import type { ReactNode } from 'react';

import './Card.css';
import { cx } from './classes';

interface CardProps {
  /** The screen's own block, riding on the same element to take its layout from the
   * screen's stylesheet, e.g. `session` — a two-column grid, not a kind of card. */
  className?: string;
  children: ReactNode;
}

/** A screen's surface. Each screen is one card on the page. */
export function Card({ className, children }: CardProps) {
  return <section className={cx('card', className)}>{children}</section>;
}
