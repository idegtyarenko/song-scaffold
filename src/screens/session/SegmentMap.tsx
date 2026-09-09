import { useImperativeHandle, useRef, type RefObject } from 'react';

import './SegmentMap.css';
import { cx } from '../../ui/classes';

export interface SegmentMapHandle {
  /**
   * Ring the segment of the current chunk that is sounding, by its position in the chunk.
   * `-1` clears it — during a count-in, and while the cursor is between chunks.
   */
  markBar(barInChunk: number): void;
}

interface SegmentMapProps {
  /** Segments in the whole passage. */
  total: number;
  /** Segments the current stage has in play, 1-based. */
  inStage: number[];
  /** Segments of the chunk being played right now, 1-based. */
  playing: number[];
  ref?: RefObject<SegmentMapHandle | null>;
}

/**
 * Every segment of the passage, showing which are in play and which you play now.
 *
 * The ring on the sounding segment arrives with the beat, several times a second, so it is
 * written straight to the DOM through the handle rather than through React state.
 */
export function SegmentMap({ total, inStage, playing, ref }: SegmentMapProps) {
  const map = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      markBar(barInChunk) {
        map.current
          ?.querySelectorAll('.segment-map__segment--playing')
          .forEach((segment, index) =>
            segment.classList.toggle('segment-map__segment--now', index === barInChunk),
          );
      },
    }),
    [],
  );

  const stage = new Set(inStage);
  const sounding = new Set(playing);

  return (
    <div className="segment-map" ref={map} aria-hidden="true">
      {Array.from({ length: total }, (_, index) => index + 1).map((segment) => (
        <span
          key={segment}
          className={cx(
            'segment-map__segment',
            stage.has(segment) && 'segment-map__segment--in-stage',
            sounding.has(segment) && 'segment-map__segment--playing',
          )}
        >
          {segment}
        </span>
      ))}
    </div>
  );
}
