import type { ReactNode } from 'react';

import './Card.css';

interface CardProps {
  /** The block modifier this card carries, e.g. `setup`. */
  className?: string;
  id?: string;
  children: ReactNode;
}

/** A screen's surface. Each screen is one card on the page. */
export function Card({ className, id, children }: CardProps) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')} id={id}>
      {children}
    </section>
  );
}
