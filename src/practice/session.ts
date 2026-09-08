/**
 * The cursor over a practice session: which stage we are on, and how far up its ladder.
 * Pure — the UI reads a snapshot, and the four move buttons call the four actions.
 */

import { buildStage, tempoLadder, type Rung } from './sequence';

export interface SessionSettings {
  /** How many bars/phrases the passage is divided into. */
  totalSegments: number;
  /** False: stage 1 is the first segment. True: stage 1 is the last, working backwards. */
  backwards: boolean;
  startTempo: number;
  targetTempo: number;
  rungs: number;
}

export interface SessionState {
  stage: number;
  rungIndex: number;
  rung: Rung;
  /** Every rung of the current stage, for the ladder view. */
  ladder: Rung[];
  /** We have played the last rung of this stage: time to add a segment. */
  stageComplete: boolean;
  canGoFaster: boolean;
  canGoSlower: boolean;
  canGoToNextStage: boolean;
  canGoToPreviousStage: boolean;
}

export class Session {
  readonly settings: SessionSettings;
  private readonly tempos: number[];
  private stage: number;
  private rungIndex = 0;
  private ladder: Rung[];

  constructor(settings: SessionSettings) {
    this.settings = settings;
    this.tempos = tempoLadder(settings.startTempo, settings.targetTempo, settings.rungs);
    this.stage = 1;
    this.ladder = this.buildLadder(1);
  }

  /** One notch up: the next chunk in the rotation, at the next tempo. */
  goFaster(): void {
    if (this.rungIndex < this.ladder.length - 1) this.rungIndex++;
  }

  /** Back a notch — both the chunk and the tempo. */
  goSlower(): void {
    if (this.rungIndex > 0) this.rungIndex--;
  }

  /**
   * Add the next segment. Pressed either because the stage is done or because you have
   * stopped being able to keep up; either way the new segment deserves slow repetitions,
   * so the tempo drops back to the start.
   */
  nextStage(): void {
    if (this.stage >= this.settings.totalSegments) return;
    this.goToStage(this.stage + 1);
  }

  previousStage(): void {
    if (this.stage <= 1) return;
    this.goToStage(this.stage - 1);
  }

  state(): SessionState {
    return {
      stage: this.stage,
      rungIndex: this.rungIndex,
      rung: this.ladder[this.rungIndex]!,
      ladder: this.ladder,
      stageComplete: this.rungIndex === this.ladder.length - 1,
      canGoFaster: this.rungIndex < this.ladder.length - 1,
      canGoSlower: this.rungIndex > 0,
      canGoToNextStage: this.stage < this.settings.totalSegments,
      canGoToPreviousStage: this.stage > 1,
    };
  }

  private goToStage(stage: number): void {
    this.stage = stage;
    this.rungIndex = 0;
    this.ladder = this.buildLadder(stage);
  }

  private buildLadder(stage: number): Rung[] {
    return buildStage(stage, this.settings.totalSegments, this.tempos, this.settings.backwards);
  }
}
