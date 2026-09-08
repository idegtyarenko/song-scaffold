import { useEffect, useRef } from 'react';

import './Ladder.css';
import { describeChunk, type Rung } from '../../practice/sequence';

interface LadderProps {
  rungs: Rung[];
  /** Index of the rung being played. */
  current: number;
}

/** A window wide enough for two columns shows the ladder beside the controls. */
const WIDE_LAYOUT = '(min-width: 62rem)';

/**
 * Every rung of the current stage — the whole climb, so you can see what is coming and how
 * far the tail runs on at the target tempo.
 */
export function Ladder({ rungs, current }: LadderProps) {
  const panel = useRef<HTMLDetailsElement>(null);
  const body = useRef<HTMLTableSectionElement>(null);

  // Wide enough for two columns and a collapsed drawer makes no sense: there is nothing for
  // it to give room back to. Narrow windows keep it as a drawer, opened or not by the player.
  useEffect(() => {
    const wide = matchMedia(WIDE_LAYOUT);
    const sync = () => {
      if (wide.matches && panel.current) panel.current.open = true;
    };
    sync();
    wide.addEventListener('change', sync);
    return () => wide.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!panel.current?.open) return;
    body.current?.querySelector('.ladder__row--current')?.scrollIntoView({ block: 'nearest' });
  }, [rungs, current]);

  return (
    <details className="ladder" ref={panel}>
      <summary className="ladder__summary">Ladder for this stage</summary>
      <div className="ladder__scroll">
        <table className="ladder__table">
          <thead>
            <tr className="ladder__row">
              <th className="ladder__heading" scope="col">
                #
              </th>
              <th className="ladder__heading" scope="col">
                Tempo
              </th>
              <th className="ladder__heading" scope="col">
                Play
              </th>
            </tr>
          </thead>
          <tbody ref={body}>
            {rungs.map((rung, index) => (
              <tr
                key={index}
                className={[
                  'ladder__row',
                  index === current && 'ladder__row--current',
                  rung.isTail && 'ladder__row--tail',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <td className="ladder__cell">{index + 1}</td>
                <td className="ladder__cell">{rung.tempo}</td>
                <td className="ladder__cell">{describeChunk(rung.chunk)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
