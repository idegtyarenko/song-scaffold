# Interleaved Clicking Up

A practice metronome for Dr. Molly Gebrian's **Interleaved Clicking Up #1** — the method for
taking a hard passage up to tempo from *Learn Faster, Perform Better: A Musician's Guide to the
Neuroscience of Practicing* (Oxford University Press, 2024), ch. 16.

## The method

Split the passage into segments — bars, or short phrases. Then build it up one segment at a
time. The app numbers them and tells you which to play; it counts one bar of the time
signature per segment, so multi-bar segments will still advance the current-segment marker
once a bar.

A **stage** is however many segments are in play. Within a stage you rotate through a fixed
pattern of overlapping chunks, and the metronome goes up one notch on every repetition:

| stage | rotation |
| ----- | -------- |
| 1 | `[1]` |
| 2 | `[1 2]` `[2]` |
| 3 | `[1 2 3]` `[3]` `[2 3]` `[3]` |
| 4 | `[1 2 3 4]` `[4]` `[3 4]` `[4]` `[2 3 4]` `[4]` |
| 5 | `[1…5]` `[5]` `[4 5]` `[5]` `[3 4 5]` `[5]` `[2 3 4 5]` `[5]` |

The newest segment alternates with a run that reaches it from one segment further back each
time. Because no two consecutive repetitions are the same chunk *and* no two are at the same
tempo, the practice is interleaved rather than blocked — harder in the room, and much better
retained the next day, which is the only test that counts.

Two more rules:

- Once the ladder tops out, the rotation carries on at the target tempo until it lands back on
  the whole passage-so-far, so a stage always ends by playing everything you have built.
- Climb until you reach the target tempo **or until you can no longer keep up**. Either way,
  press *Next stage* — the new segment brings the tempo back down to the start, which is what
  it needs.

Building **from the bottom** mirrors the whole thing: stage 1 is the last segment, and each
stage prepends the one before it, so every run heads forward into music you already know.

## The tempo ladder

Increments **shrink as the tempo rises**. Difficulty near a motor ceiling is asymptotic
rather than proportional — 140→150 costs far more than 75→80 despite being the smaller
percentage — so equal jumps in either BPM or percent put the coarse resolution exactly where
the passage fights hardest. Low down you are nowhere near the limit and can take long
strides.

```
75 → 150 in 13 rungs:   75  84  92 100 108 115 121 127 133 138 142 146 150
                       +12% +10% +9% +8% +6% +5% +5% +5% +4% +3% +3% +3%
```

You set how many **tempo steps** to take, not a BPM increment. **Auto** picks the fewest that
keep the opening jump within about a tenth of the start tempo — at the bottom of the ladder the difficulty is
still learning the notes rather than playing them fast, so the first stride has to stay
within reach. Being relative to the range, it adapts on its own: a doubling needs 13 steps,
60→90 needs 7.

Both constants live at the top of `src/sequence.ts` — `TAPER` (how much bigger the first
increment is than the last, 2.5) and `MAX_FIRST_JUMP` (0.12).

## Time signatures

The tempo you type is always the BPM of the pulse — ♩ in 4/4, 𝅗𝅥 in 2/2, ♩. in 6/8, 9/8 and
12/8. In the compound meters the eighths click as well while the passage is slow, and drop
away above ♩.=80, where a third click every 250 ms stops being support and starts being a
buzz. Because the tempo climbs all session, the metronome makes that switch itself rather
than asking you to predict it. The beat dots always show the pulse, so the display does not
reshuffle underneath you when the switch happens.

## Running it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # the method, the cursor, and the page driven end to end
npm run build      # static bundle in dist/
```

While practising: `Space` starts and stops the click, `↑`/`↓` move a tempo step, `Shift`+`←`/`→`
move a stage. On a window wider than 62rem the ladder sits beside the transport instead of
folding away underneath it.

## Layout

| file | what it holds |
| ---- | ------------- |
| `src/sequence.ts` | the rotation, the tempo ladder, the backwards mirror. Pure. |
| `src/session.ts` | the stage/rung cursor behind the four transport buttons. Pure. |
| `src/metronome.ts` | Web Audio lookahead scheduler. The only part that touches the clock. |
| `src/meter.ts` | time signatures and their accent patterns. |
| `src/settings.ts` | setup defaults, clamping, `localStorage`. |
| `src/main.ts` | DOM wiring. |

Tests: `sequence.test.ts` and `session.test.ts` pin the method itself; `app.test.ts` drives the
real page through the real `main.ts` under jsdom, with a stub `AudioContext`, so the form, the
four transport buttons, the ladder, the beat display and the click scheduling are all exercised
as they run. Only whether it *sounds* right needs your ears.

## Not implemented

Interleaved clicking up **#2** (simulating performance at tempo), at-tempo chunking,
subdivision clicks, and the build-towards/from-the-centre variants.

## Credit

The method is Dr. Molly Gebrian's — <https://www.mollygebrian.com>.

She explains interleaved clicking up in [How To Practice to Increase Speed: Part
II](https://www.youtube.com/watch?v=75OWZAq-O4U) and demonstrates it in [Part
III](https://www.youtube.com/watch?v=e08zFDnLOYY); it is Chapter 16 of *Learn Faster, Perform
Better*. Her [handout on interleaved
practice](https://www.mollygebrian.com/s/interleaved-practice-handout.pdf) covers the
principle underneath it, though not clicking up specifically — as far as I can find, no
public PDF of hers describes this method.

The rotation and tail rules here were checked against the reference implementation at
<https://nellsonic.github.io/icu-metronome/>.
