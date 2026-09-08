# SongScaffold

A tool for taking a hard passage apart and building it back up to tempo. Today it does that
one way: as a practice metronome for Dr. Molly Gebrian's **Interleaved Clicking Up #1**, the
method from *Learn Faster, Perform Better: A Musician's Guide to the Neuroscience of
Practicing* (Oxford University Press, 2024), ch. 16.

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
12/8. While the passage is slow the pulse is not left on its own: the compound meters click
their eighths, and a simple meter gets an extra click on the upbeat below 60, where the gap
between pulses runs over a second and the player ends up guessing across it. Both drop away
once they are no longer support — the upbeat at 60, and the compound eighths above ♩.=80,
where a third click every 250 ms turns into a buzz. Because the tempo climbs all session,
the metronome makes both switches itself rather than asking you to predict them. The beat
dots always show the pulse, so the display does not reshuffle underneath you when a switch
happens.

## Running it

```sh
npm install
npm run dev        # http://localhost:5173/song-scaffold/
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

Tests: `sequence.test.ts` and `session.test.ts` pin the method itself; `metronome.test.ts`
drives the scheduler against a fake audio clock; `app.test.ts` drives the
real page through the real `main.ts` under jsdom, with a stub `AudioContext`, so the form, the
four transport buttons, the ladder, the beat display and the click scheduling are all exercised
as they run. Only whether it *sounds* right needs your ears.

## Not implemented

Interleaved clicking up **#2** (simulating performance at tempo), at-tempo chunking,
subdivision clicks, and the build-towards/from-the-centre variants.

## Credit

The method is Dr. Molly Gebrian's — <https://www.mollygebrian.com>.

She writes it out on page 4 of [The Amazing List of Practice
Techniques](https://mollygebrian.wordpress.com/wp-content/uploads/2020/06/the-amazing-list-of-practice-techniques-with-gingold-rhythms-1.pdf#page=4),
explains it in [How To Practice to Increase Speed: Part
II](https://www.youtube.com/watch?v=75OWZAq-O4U) and demonstrates it in [Part
III](https://www.youtube.com/watch?v=e08zFDnLOYY). It is Chapter 16 of *Learn Faster, Perform
Better*.

The rotation here matches her written description exactly — "play the first three
beats/bars. Then do the NEW bar/beat ONLY at 65. Then the 2nd and 3rd beats at 70. Then the
new beat at 75. Then all three at 80" — as does working forwards or backwards. The tail rule,
which she does not spell out, follows the reference implementation at
<https://nellsonic.github.io/icu-metronome/>.

**One deliberate divergence.** She says to click up "by 5s", a constant increment. This app
tapers instead, for the reason in [The tempo ladder](#the-tempo-ladder) above. The taper is
not currently optional: the rung count changes how many steps there are, not how evenly they
are spaced.
