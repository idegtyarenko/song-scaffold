import { useEffect, useRef, type ReactNode } from 'react';

import './Controls.css';
import { describeChunk } from '../../practice/sequence';
import type { SessionState } from '../../practice/session';
import { Button } from '../../ui/Button';

interface ControlsProps {
  state: SessionState;
  running: boolean;
  onToggle: () => void;
  onFaster: () => void;
  onSlower: () => void;
  onNextStage: () => void;
  onPrevStage: () => void;
}

/**
 * Everything the player drives the session with: the click on and off, a step up or down
 * the ladder, and a segment added or dropped. The keys beside each name are handled by the
 * screen, on the document, so they work wherever the focus happens to be.
 */
export function Controls({
  state,
  running,
  onToggle,
  onFaster,
  onSlower,
  onNextStage,
  onPrevStage,
}: ControlsProps) {
  const play = useRef<HTMLButtonElement>(null);
  const next = state.ladder[state.rungIndex + 1];
  const previous = state.ladder[state.rungIndex - 1];

  // The session opens on the one thing it is waiting for.
  useEffect(() => {
    play.current?.focus();
  }, []);

  return (
    <div className="controls">
      <Button
        variant="primary"
        className={['controls__play', running && 'button--running'].filter(Boolean).join(' ')}
        ref={play}
        onClick={onToggle}
      >
        {running ? 'Stop' : 'Start'}
      </Button>
      <div className="controls__grid">
        <Action
          shortcut="↑"
          name="Faster"
          large
          sub={next ? `${next.tempo} · ${describeChunk(next.chunk)}` : 'stage complete'}
          disabled={!state.canGoFaster}
          onClick={onFaster}
        />
        <Action
          shortcut="↓"
          name="Slower"
          large
          sub={previous ? `${previous.tempo} · ${describeChunk(previous.chunk)}` : 'at the bottom'}
          disabled={!state.canGoSlower}
          onClick={onSlower}
        />
        <Action
          shortcut="⇧←"
          name="Previous stage"
          sub="drop a segment"
          disabled={!state.canGoToPreviousStage}
          onClick={onPrevStage}
        />
        <Action
          shortcut="⇧→"
          name="Next stage"
          sub="add a segment"
          disabled={!state.canGoToNextStage}
          suggested={state.stageComplete && state.canGoToNextStage}
          onClick={onNextStage}
        />
      </div>
    </div>
  );
}

interface ActionProps {
  /** The key that does the same thing, shown above the name. */
  shortcut: string;
  name: string;
  /** Where this action lands you — the tempo and chunk it leads to. */
  sub: ReactNode;
  /** The two tempo actions carry the session, and are labelled larger for it. */
  large?: boolean;
  disabled: boolean;
  /** The move the method is asking for right now. */
  suggested?: boolean;
  onClick: () => void;
}

function Action({ shortcut, name, sub, large, disabled, suggested, onClick }: ActionProps) {
  return (
    <Button
      className={['controls__action', suggested && 'button--suggested'].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="controls__key">{shortcut}</span>
      <span className={['controls__name', large && 'controls__name--large'].filter(Boolean).join(' ')}>
        {name}
      </span>
      <span className="controls__sub">{sub}</span>
    </Button>
  );
}
