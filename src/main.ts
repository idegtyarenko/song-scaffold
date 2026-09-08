import './session-view.css';

import { audio } from './audio/engine';
import { findMeter, subdivisionAt } from './meter';
import { Metronome, type Beat } from './metronome';
import { noteGlyph } from './notes';
import { describeChunk } from './sequence';
import { Session } from './session';
import type { Settings } from './settings';

// --- Elements -------------------------------------------------------------

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found as T;
};

const sessionView = el('session');

const view = {
  chunk: el('nowChunk'),
  pips: el('pips'),
  tempo: el('nowTempo'),
  beatName: el('nowBeatName'),
  beats: el('beats'),
  stage: el('nowStage'),
  rung: el('nowRung'),
  badge: el('nowBadge'),
  live: el('live'),
  ladderBody: el<HTMLTableSectionElement>('ladderBody'),
  ladderPanel: el<HTMLDetailsElement>('ladderPanel'),
  fasterSub: el('fasterSub'),
  slowerSub: el('slowerSub'),
  subdivisionBadge: el('nowSubdivision'),
};

const buttons = {
  playPause: el<HTMLButtonElement>('playPause'),
  faster: el<HTMLButtonElement>('faster'),
  slower: el<HTMLButtonElement>('slower'),
  nextStage: el<HTMLButtonElement>('nextStage'),
  prevStage: el<HTMLButtonElement>('prevStage'),
  backToSetup: el<HTMLButtonElement>('backToSetup'),
};

// --- State ----------------------------------------------------------------

/** The settings the running session was opened with. */
let settings: Settings;
let session: Session | null = null;
let metronome: Metronome | null = null;
/** What to call when the player leaves the session, so React can put the setup back. */
let exit: (() => void) | null = null;

// --- Session view ---------------------------------------------------------

/**
 * A window wide enough for two columns shows the ladder beside the transport, where a
 * collapsed drawer would make no sense. Narrow windows keep it as a drawer.
 */
const wideLayout = matchMedia('(min-width: 62rem)');

function syncLadderLayout(): void {
  if (wideLayout.matches) view.ladderPanel.open = true;
}

wideLayout.addEventListener('change', syncLadderLayout);

/** Open a session on these settings and draw it. `onExit` fires when the player leaves. */
export function startSession(next: Settings, onExit: () => void): void {
  settings = next;
  exit = onExit;

  session = new Session({
    totalSegments: settings.totalSegments,
    backwards: settings.backwards,
    startTempo: settings.startTempo,
    targetTempo: settings.targetTempo,
    rungs: settings.rungs,
  });

  metronome = new Metronome(audio, clickConfig(session.state().rung.tempo), showBeat);

  sessionView.hidden = false;
  syncLadderLayout();
  buildBeatRow();
  render();
  buttons.playPause.focus();
}

/** Idempotent: React tears the session down again when it unmounts the screen. */
export function endSession(): void {
  metronome?.stop();
  metronome = null;
  session = null;
  sessionView.hidden = true;
}

/** The click grid for a tempo — the meter decides for itself whether to subdivide. */
function clickConfig(tempo: number) {
  const meter = findMeter(settings.meterId);
  return {
    tempo,
    beatsPerBar: meter.beatsPerBar,
    secondaryAccents: meter.secondaryAccents,
    subdivision: subdivisionAt(meter, tempo)?.count ?? 1,
    countInBars: settings.countInBars,
  };
}

/** Push the cursor's current rung to the metronome and repaint. */
function apply(): void {
  metronome!.reconfigure(clickConfig(session!.state().rung.tempo));
  render();
}

function render(): void {
  const state = session!.state();
  const { rung, ladder } = state;
  const meter = findMeter(settings.meterId);
  const subdivision = subdivisionAt(meter, rung.tempo);

  view.chunk.textContent = `Play ${describeChunk(rung.chunk)}`;
  view.tempo.textContent = String(rung.tempo);
  view.beatName.innerHTML = noteGlyph(meter.beatNote);
  view.subdivisionBadge.hidden = subdivision === null;
  view.subdivisionBadge.textContent = `+ ${subdivision?.word ?? ''}`.trim();
  view.stage.textContent = `Stage ${state.stage} of ${settings.totalSegments}`;
  view.rung.textContent = `step ${state.rungIndex + 1} of ${ladder.length}`;
  view.badge.hidden = !rung.isTail;
  buttons.playPause.textContent = metronome!.isRunning ? 'Stop' : 'Start';
  buttons.playPause.classList.toggle('button--running', metronome!.isRunning);

  const next = ladder[state.rungIndex + 1];
  const previous = ladder[state.rungIndex - 1];
  view.fasterSub.textContent = next
    ? `${next.tempo} · ${describeChunk(next.chunk)}`
    : 'stage complete';
  view.slowerSub.textContent = previous
    ? `${previous.tempo} · ${describeChunk(previous.chunk)}`
    : 'at the bottom';

  buttons.faster.disabled = !state.canGoFaster;
  buttons.slower.disabled = !state.canGoSlower;
  buttons.nextStage.disabled = !state.canGoToNextStage;
  buttons.prevStage.disabled = !state.canGoToPreviousStage;
  buttons.nextStage.classList.toggle('button--suggested', state.stageComplete && state.canGoToNextStage);

  renderPips(state.stage, rung.chunk);
  renderLadder();
  buildBeatRow();

  view.live.textContent =
    `${describeChunk(rung.chunk)} at ${rung.tempo} BPM. ` +
    `Stage ${state.stage} of ${settings.totalSegments}, step ${state.rungIndex + 1} of ${ladder.length}.` +
    (state.stageComplete && state.canGoToNextStage ? ' Stage complete — add the next segment.' : '');
}

/** Every segment of the passage, showing which are in play and which you play now. */
function renderPips(stage: number, chunk: number[]): void {
  const inStage = new Set(stageSegments(stage));
  const playing = new Set(chunk);
  view.pips.replaceChildren(
    ...Array.from({ length: settings.totalSegments }, (_, i) => {
      const index = i + 1;
      const pip = document.createElement('span');
      pip.className = 'pips__pip';
      pip.classList.toggle('pips__pip--in-stage', inStage.has(index));
      pip.classList.toggle('pips__pip--playing', playing.has(index));
      pip.textContent = String(index);
      return pip;
    }),
  );
}

function stageSegments(stage: number): number[] {
  const first = settings.backwards ? settings.totalSegments - stage + 1 : 1;
  return Array.from({ length: stage }, (_, i) => first + i);
}

function renderLadder(): void {
  const state = session!.state();
  view.ladderBody.replaceChildren(
    ...state.ladder.map((rung, index) => {
      const row = document.createElement('tr');
      row.className = 'ladder__row';
      row.classList.toggle('ladder__row--current', index === state.rungIndex);
      row.classList.toggle('ladder__row--tail', rung.isTail);
      for (const text of [String(index + 1), String(rung.tempo), describeChunk(rung.chunk)]) {
        const cell = document.createElement('td');
        cell.className = 'ladder__cell';
        cell.textContent = text;
        row.append(cell);
      }
      return row;
    }),
  );
  if (view.ladderPanel.open) {
    view.ladderBody.querySelector('.ladder__row--current')?.scrollIntoView({ block: 'nearest' });
  }
}

function buildBeatRow(): void {
  const { beatsPerBar } = findMeter(settings.meterId);
  if (view.beats.childElementCount === beatsPerBar) return;
  view.beats.replaceChildren(
    ...Array.from({ length: beatsPerBar }, () => {
      const dot = document.createElement('span');
      dot.className = 'beats__dot';
      return dot;
    }),
  );
}

function showBeat(beat: Beat): void {
  // Beats are reported from an animation frame, which can outlive the session that asked
  // for them — leaving the setup form mid-bar used to land here with no session at all.
  if (!session) return;
  // The dots show the pulse, so the display stays put when subdivisions come and go.
  if (!beat.isPulse) return;
  const dots = view.beats.children;
  for (const dot of dots) dot.classList.remove('beats__dot--on', 'beats__dot--count-in');
  dots[beat.beat]?.classList.add('beats__dot--on');
  if (beat.isCountIn) dots[beat.beat]?.classList.add('beats__dot--count-in');

  // Which bar of the chunk we are on, so a multi-bar chunk stays legible. Nothing is
  // marked during the count-in — you are not playing yet.
  const length = session.state().rung.chunk.length;
  const barInChunk = beat.isCountIn ? -1 : beat.bar % length;
  view.pips
    .querySelectorAll('.pips__pip--playing')
    .forEach((pip, index) => pip.classList.toggle('pips__pip--now', index === barInChunk));
}

// --- Transport ------------------------------------------------------------

function togglePlay(): void {
  if (!metronome) return;
  if (metronome.isRunning) metronome.stop();
  else metronome.start();
  render();
}

buttons.playPause.addEventListener('click', togglePlay);
buttons.faster.addEventListener('click', () => {
  session!.goFaster();
  apply();
});
buttons.slower.addEventListener('click', () => {
  session!.goSlower();
  apply();
});
buttons.nextStage.addEventListener('click', () => {
  session!.nextStage();
  apply();
});
buttons.prevStage.addEventListener('click', () => {
  session!.previousStage();
  apply();
});
buttons.backToSetup.addEventListener('click', () => {
  endSession();
  exit?.();
});

// Stage moves need Shift, so a mis-aimed arrow key cannot throw away a stage's work.
const SHORTCUTS: Record<string, { shift: boolean; press: () => HTMLButtonElement }> = {
  ArrowUp: { shift: false, press: () => buttons.faster },
  ArrowDown: { shift: false, press: () => buttons.slower },
  ArrowRight: { shift: true, press: () => buttons.nextStage },
  ArrowLeft: { shift: true, press: () => buttons.prevStage },
};

document.addEventListener('keydown', (event) => {
  if (!session || sessionView.hidden || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea')) return;

  if (event.code === 'Space') {
    event.preventDefault();
    togglePlay();
    return;
  }

  const shortcut = SHORTCUTS[event.key];
  if (!shortcut || shortcut.shift !== event.shiftKey) return;
  event.preventDefault();
  shortcut.press().click();
});

// --- Boot -----------------------------------------------------------------

// The sound is unlocked by whichever gesture comes first, so pressing Start — or Space,
// or a tempo arrow — plays immediately instead of losing its first bar to autoplay policy.
audio.listenForGesture();
