import { beforeEach, describe, expect, it } from 'vitest';
import { Session, type SessionSettings } from './session';

const SETTINGS: SessionSettings = {
  totalSegments: 4,
  backwards: false,
  startTempo: 60,
  targetTempo: 90,
  rungs: 7, // 60, 67, 73, 79, 83, 87, 90
};

describe('Session', () => {
  let session: Session;
  beforeEach(() => {
    session = new Session(SETTINGS);
  });

  it('starts on the first segment at the start tempo', () => {
    const state = session.state();
    expect(state.stage).toBe(1);
    expect(state.rung).toEqual({ tempo: 60, chunk: [1], isTail: false });
    expect(state.canGoSlower).toBe(false);
    expect(state.canGoToPreviousStage).toBe(false);
  });

  it('moves chunk and tempo together on goFaster', () => {
    session.nextStage();
    session.nextStage(); // stage 3
    session.goFaster();
    expect(session.state().rung).toEqual({ tempo: 67, chunk: [3], isTail: false });
    session.goFaster();
    expect(session.state().rung).toEqual({ tempo: 73, chunk: [2, 3], isTail: false });
  });

  it('undoes a rung exactly on goSlower', () => {
    session.goFaster();
    session.goFaster();
    const twoUp = session.state().rung;
    session.goSlower();
    session.goFaster();
    expect(session.state().rung).toEqual(twoUp);
  });

  it('stops at the ends of the ladder rather than wrapping', () => {
    for (let i = 0; i < 200; i++) session.goFaster();
    const top = session.state();
    expect(top.canGoFaster).toBe(false);
    expect(top.stageComplete).toBe(true);
    expect(top.rung.tempo).toBe(90);
    expect(top.rung.chunk).toEqual([1]);

    for (let i = 0; i < 200; i++) session.goSlower();
    expect(session.state().rungIndex).toBe(0);
    expect(session.state().canGoSlower).toBe(false);
  });

  it('adds a segment and drops back to the start tempo on nextStage', () => {
    session.goFaster();
    session.goFaster();
    session.nextStage();
    const state = session.state();
    expect(state.stage).toBe(2);
    expect(state.rung).toEqual({ tempo: 60, chunk: [1, 2], isTail: false });
  });

  it('gives up the stage early when you cannot keep up', () => {
    session.nextStage();
    session.nextStage();
    session.goFaster(); // stalled partway up stage 3
    expect(session.state().stageComplete).toBe(false);
    session.nextStage();
    expect(session.state().stage).toBe(4);
    expect(session.state().rung.tempo).toBe(60);
  });

  it('will not go past the whole passage or before the first stage', () => {
    for (let i = 0; i < 20; i++) session.nextStage();
    expect(session.state().stage).toBe(4);
    expect(session.state().canGoToNextStage).toBe(false);

    for (let i = 0; i < 20; i++) session.previousStage();
    expect(session.state().stage).toBe(1);
    expect(session.state().canGoToPreviousStage).toBe(false);
  });

  it('runs backwards from the end of the piece', () => {
    const backwards = new Session({ ...SETTINGS, backwards: true });
    expect(backwards.state().rung.chunk).toEqual([4]);
    backwards.nextStage();
    expect(backwards.state().rung.chunk).toEqual([3, 4]);
    backwards.goFaster();
    expect(backwards.state().rung.chunk).toEqual([3]);
  });

  it('flags the tail rungs that run on at the target tempo', () => {
    session.nextStage();
    session.nextStage(); // stage 3, 7-rung ladder over a 4-chunk rotation
    const { ladder } = session.state();
    expect(ladder.filter((r) => r.isTail).every((r) => r.tempo === 90)).toBe(true);
    expect(ladder[ladder.length - 1]!.chunk).toEqual([1, 2, 3]);
  });
});
