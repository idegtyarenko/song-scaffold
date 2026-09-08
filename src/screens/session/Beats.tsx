import { useImperativeHandle, useRef, type RefObject } from 'react';

import './Beats.css';
import type { Beat } from '../../audio/metronome';

export interface BeatsHandle {
  /** Light the dot this beat falls on. Only pulses are shown, never subdivisions. */
  show(beat: Beat): void;
}

interface BeatsProps {
  beatsPerBar: number;
  ref?: RefObject<BeatsHandle | null>;
}

/**
 * One dot per pulse in the bar, lit as the click sounds.
 *
 * Beats arrive several times a second, so the lit dot is written straight to the DOM
 * through the handle rather than through React state. The dots show the pulse and nothing
 * else, so the row does not reshuffle underneath you when subdivisions come and go.
 */
export function Beats({ beatsPerBar, ref }: BeatsProps) {
  const row = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      show(beat) {
        if (!beat.isPulse) return;
        const dots = row.current?.children;
        if (!dots) return;
        for (const dot of dots) dot.classList.remove('beats__dot--on', 'beats__dot--count-in');
        dots[beat.beat]?.classList.add('beats__dot--on');
        if (beat.isCountIn) dots[beat.beat]?.classList.add('beats__dot--count-in');
      },
    }),
    [],
  );

  return (
    <div className="beats" ref={row} aria-hidden="true">
      {Array.from({ length: beatsPerBar }, (_, index) => (
        <span key={index} className="beats__dot" />
      ))}
    </div>
  );
}
