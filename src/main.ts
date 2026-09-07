import './styles.css';

import { METERS, findMeter, subdivisionAt, subdivisionCrossover } from './meter';
import { Metronome, type Beat } from './metronome';
import { describeChunk, tempoLadder } from './sequence';
import { Session } from './session';
import {
  DEFAULT_SETTINGS,
  LIMITS,
  load,
  normalize,
  save,
  type Settings,
} from './settings';

// --- Elements -------------------------------------------------------------

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found as T;
};

const setupView = el('setup');
const sessionView = el('session');

const fields = {
  totalSegments: el<HTMLInputElement>('totalSegments'),
  startTempo: el<HTMLInputElement>('startTempo'),
  targetTempo: el<HTMLInputElement>('targetTempo'),
  rungs: el<HTMLInputElement>('rungs'),
  rungsAuto: el<HTMLButtonElement>('rungsAuto'),
  meter: el<HTMLSelectElement>('meter'),
  countIn: el<HTMLInputElement>('countIn'),
};
const directionRadios = radios('direction');

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
  rungsHint: el('rungsHint'),
  directionHint: el('directionHint'),
  setupPreview: el('setupPreview'),
  meterHint: el('meterHint'),
  subdivisionBadge: el('nowSubdivision'),
};

const buttons = {
  begin: el<HTMLButtonElement>('begin'),
  playPause: el<HTMLButtonElement>('playPause'),
  faster: el<HTMLButtonElement>('faster'),
  slower: el<HTMLButtonElement>('slower'),
  nextStage: el<HTMLButtonElement>('nextStage'),
  prevStage: el<HTMLButtonElement>('prevStage'),
  backToSetup: el<HTMLButtonElement>('backToSetup'),
};

// --- State ----------------------------------------------------------------

let settings: Settings = load();
let session: Session | null = null;
let metronome: Metronome | null = null;

// --- Setup view -----------------------------------------------------------

for (const meter of METERS) {
  const option = document.createElement('option');
  option.value = meter.id;
  option.textContent = meter.label;
  fields.meter.append(option);
}

function writeSetupForm(): void {
  fields.totalSegments.value = String(settings.totalSegments);
  fields.startTempo.value = String(settings.startTempo);
  fields.targetTempo.value = String(settings.targetTempo);
  fields.rungs.value = String(settings.rungs);
  fields.meter.value = settings.meterId;
  fields.countIn.checked = settings.countInBars > 0;
  check(directionRadios, settings.backwards ? 'bottom' : 'top');

  view.directionHint.textContent = directionHint();
  view.meterHint.textContent = meterHint();
  writeRungsHint();
}

function writeRungsHint(): void {
  fields.rungsAuto.setAttribute('aria-pressed', String(settings.rungsIsAutomatic));
  fields.rungsAuto.classList.toggle('is-on', settings.rungsIsAutomatic);
  view.rungsHint.textContent = settings.rungsIsAutomatic
    ? `Notches to the target, sized for the ${settings.startTempo}→${settings.targetTempo} range`
    : 'Notches to the target · tap Auto to size them for the range again';

  const ladder = tempoLadder(settings.startTempo, settings.targetTempo, settings.rungs);
  const firstJump = ladder.length > 1 ? (ladder[1]! - ladder[0]!) / ladder[0]! : 0;
  view.setupPreview.textContent =
    `${settings.totalSegments} stages · ${ladder.length} rungs from ` +
    `${settings.startTempo} to ${settings.targetTempo} BPM in each, ` +
    `opening at +${Math.round(firstJump * 100)}% and easing to the target.`;
}

function readSetupForm(): void {
  settings = normalize({
    ...settings,
    totalSegments: number(fields.totalSegments, DEFAULT_SETTINGS.totalSegments),
    startTempo: number(fields.startTempo, DEFAULT_SETTINGS.startTempo),
    targetTempo: number(fields.targetTempo, DEFAULT_SETTINGS.targetTempo),
    rungs: number(fields.rungs, DEFAULT_SETTINGS.rungs),
    backwards: selected(directionRadios) === 'bottom',
    meterId: fields.meter.value,
    countInBars: fields.countIn.checked ? 1 : 0,
  });
  save(settings);
}

for (const input of [fields.totalSegments, fields.startTempo, fields.targetTempo]) {
  input.addEventListener('input', () => {
    readSetupForm();
    if (settings.rungsIsAutomatic) fields.rungs.value = String(settings.rungs);
    writeRungsHint();
    view.directionHint.textContent = directionHint();
  });
  input.addEventListener('blur', writeSetupForm);
}

// Typing a rung count takes it off the automatic suggestion; Auto is the way back —
// and it stays on screen, unlike the old "clear the box" trick, which nobody would find
// once a stale preference had been persisted. The field is left alone while it has focus,
// so a half-typed number is not clamped out from under the cursor.
fields.rungs.addEventListener('input', () => {
  settings.rungsIsAutomatic = false;
  readSetupForm();
  writeRungsHint();
});

fields.rungs.addEventListener('blur', writeSetupForm);

fields.rungsAuto.addEventListener('click', () => {
  settings.rungsIsAutomatic = true;
  readSetupForm();
  fields.rungs.value = String(settings.rungs);
  writeRungsHint();
});

for (const input of [
  ...directionRadios,
  fields.meter,
  fields.countIn,
]) {
  input.addEventListener('change', () => {
    readSetupForm();
    writeSetupForm();
  });
}

buttons.begin.addEventListener('click', () => {
  readSetupForm();
  startSession();
});

// --- Session view ---------------------------------------------------------

function startSession(): void {
  session = new Session({
    totalSegments: settings.totalSegments,
    backwards: settings.backwards,
    startTempo: settings.startTempo,
    targetTempo: settings.targetTempo,
    rungs: settings.rungs,
  });

  metronome = new Metronome(clickConfig(session.state().rung.tempo), showBeat);

  setupView.hidden = true;
  sessionView.hidden = false;
  buildBeatRow();
  render();
  buttons.playPause.focus();
}

function endSession(): void {
  metronome?.stop();
  metronome = null;
  session = null;
  sessionView.hidden = true;
  setupView.hidden = false;
  writeSetupForm();
  buttons.begin.focus();
}

/** The click grid for a tempo — the meter decides for itself whether to subdivide. */
function clickConfig(tempo: number) {
  const meter = findMeter(settings.meterId);
  return {
    tempo,
    beatsPerBar: meter.beatsPerBar,
    secondaryAccents: meter.secondaryAccents,
    subdivision: subdivisionAt(meter, tempo),
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
  view.beatName.textContent = meter.beatName;
  view.subdivisionBadge.hidden = subdivision === 1;
  view.subdivisionBadge.textContent = `+ ${meter.subdivisionWord ?? ''}`.trim();
  view.stage.textContent = `Stage ${state.stage} of ${settings.totalSegments}`;
  view.rung.textContent = `rung ${state.rungIndex + 1} of ${ladder.length}`;
  view.badge.hidden = !rung.isTail;
  buttons.playPause.textContent = metronome!.isRunning ? 'Stop' : 'Start';
  buttons.playPause.classList.toggle('is-running', metronome!.isRunning);

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
  buttons.nextStage.classList.toggle('is-suggested', state.stageComplete && state.canGoToNextStage);

  renderPips(state.stage, rung.chunk);
  renderLadder();
  buildBeatRow();

  view.live.textContent =
    `${describeChunk(rung.chunk)} at ${rung.tempo} BPM. ` +
    `Stage ${state.stage} of ${settings.totalSegments}, rung ${state.rungIndex + 1} of ${ladder.length}.` +
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
      pip.className = 'pip';
      pip.classList.toggle('pip--in-stage', inStage.has(index));
      pip.classList.toggle('pip--playing', playing.has(index));
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
      row.className = index === state.rungIndex ? 'is-current' : '';
      row.classList.toggle('is-tail', rung.isTail);
      for (const text of [String(index + 1), String(rung.tempo), describeChunk(rung.chunk)]) {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.append(cell);
      }
      return row;
    }),
  );
  if (view.ladderPanel.open) {
    view.ladderBody.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' });
  }
}

function buildBeatRow(): void {
  const { beatsPerBar } = findMeter(settings.meterId);
  if (view.beats.childElementCount === beatsPerBar) return;
  view.beats.replaceChildren(
    ...Array.from({ length: beatsPerBar }, () => {
      const dot = document.createElement('span');
      dot.className = 'beat';
      return dot;
    }),
  );
}

function showBeat(beat: Beat): void {
  // The dots show the pulse, so the display stays put when subdivisions come and go.
  if (!beat.isPulse) return;
  const dots = view.beats.children;
  for (let i = 0; i < dots.length; i++) dots[i]!.classList.remove('is-on');
  dots[beat.beat]?.classList.add('is-on');
  view.beats.classList.toggle('is-count-in', beat.isCountIn);

  // Which bar of the chunk we are on, so a multi-bar chunk stays legible. Nothing is
  // marked during the count-in — you are not playing yet.
  const length = session!.state().rung.chunk.length;
  const barInChunk = beat.isCountIn ? -1 : beat.bar % length;
  view.pips
    .querySelectorAll('.pip--playing')
    .forEach((pip, index) => pip.classList.toggle('is-now', index === barInChunk));
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
buttons.backToSetup.addEventListener('click', endSession);

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

function meterHint(): string {
  const meter = findMeter(settings.meterId);
  const crossover = subdivisionCrossover(meter);
  const counted = `Counted in ${meter.beatsPerBar} · tempo is ${meter.beatName} = BPM.`;
  if (crossover === null) return counted;
  return (
    `${counted} The ${meter.subdivisionWord} click too up to ` +
    `${meter.beatName}=${crossover}, then drop away so you can feel the pulse.`
  );
}

function directionHint(): string {
  return settings.backwards
    ? `Start on bar ${settings.totalSegments} and add the bar before it each stage — ` +
        'backward chaining, so you always end up in music you already know.'
    : 'Start on bar 1 and add the next bar each stage.';
}

fields.totalSegments.max = String(LIMITS.totalSegments.max);
fields.rungs.max = String(LIMITS.rungs.max);
writeSetupForm();

// --- Small DOM helpers ----------------------------------------------------

function radios(name: string): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
}

function selected(inputs: HTMLInputElement[]): string | undefined {
  return inputs.find((input) => input.checked)?.value;
}

function check(inputs: HTMLInputElement[], value: string): void {
  for (const input of inputs) input.checked = input.value === value;
}

function number(input: HTMLInputElement, fallback: number): number {
  const parsed = Number.parseInt(input.value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
