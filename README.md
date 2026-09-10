# SongScaffold

A tool for taking a hard passage apart and building it back up to tempo. Today it does that
one way: as a practice metronome for Dr. Molly Gebrian's **Interleaved Clicking Up #1**, the
method from _Learn Faster, Perform Better: A Musician's Guide to the Neuroscience of
Practicing_ (Oxford University Press, 2024), ch. 16.

## The method

Split the passage into segments — bars, or short phrases. Then build it up one segment at a
time. The app numbers them and tells you which to play; it counts one bar of the time
signature per segment, so multi-bar segments will still advance the current-segment marker
once a bar.

A **stage** is however many segments are in play. Within a stage you rotate through a fixed
pattern of overlapping chunks, and the metronome goes up one notch on every repetition:

| stage | rotation                                                      |
| ----- | ------------------------------------------------------------- |
| 1     | `[1]`                                                         |
| 2     | `[1 2]` `[2]`                                                 |
| 3     | `[1 2 3]` `[3]` `[2 3]` `[3]`                                 |
| 4     | `[1 2 3 4]` `[4]` `[3 4]` `[4]` `[2 3 4]` `[4]`               |
| 5     | `[1…5]` `[5]` `[4 5]` `[5]` `[3 4 5]` `[5]` `[2 3 4 5]` `[5]` |

The newest segment alternates with a run that reaches it from one segment further back each
time. Because no two consecutive repetitions are the same chunk _and_ no two are at the same
tempo, the practice is interleaved rather than blocked — harder in the room, and much better
retained the next day, which is the only test that counts.

Two more rules:

- Once the ladder tops out, the rotation carries on at the target tempo until it lands back on
  the whole passage-so-far, so a stage always ends by playing everything you have built.
- Climb until you reach the target tempo **or until you can no longer keep up**. Either way,
  press _Next stage_ — the new segment brings the tempo back down to the start, which is what
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

Both constants live at the top of `src/practice/sequence.ts` — `TAPER` (how much bigger the
first increment is than the last, 2.5) and `MAX_FIRST_JUMP` (0.12).

## Time signatures

The tempo you type is always the BPM of the pulse — ♩ in 4/4, the half note in 2/2, ♩. in 6/8, 9/8 and
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
npm run lint       # ESLint, including the React hook rules
npm run format     # Prettier over everything git tracks (`format:check` to only report)
npm run build      # static bundle in dist/
```

While practising: `Space` starts and stops the click, `↑`/`↓` move a tempo step, `Shift`+`←`/`→`
move a stage. On a window wider than 62rem the ladder sits beside the controls instead of
folding away underneath it.

## Working on a recording

`#/recording` opens a file from the machine — nothing is uploaded — draws it as a waveform,
and loops any stretch of it. **Drag across the waveform to select the stretch**; landing on
an edge takes hold of it, so a loop is resized with the same gesture. **Two fingers pan and
zoom** (as do the wheel, and `←`/`→`, `+`/`-`, `Home` while the canvas has focus), which is
what leaves one finger free to select on a phone. A click puts the cursor down. `Space`
plays and stops — the selected stretch round and round, or the rest of the recording from
the cursor — and `Esc` stops, then clears the loop.

The seam of a loop is a **crossfade**, not a cut. A looping `AudioBufferSourceNode` leaves
no gap in time but leaves one in amplitude, and a step in a waveform is a click; heard every
four seconds for twenty minutes it is the reason the practice stops. So each pass is
scheduled on its own, and the outgoing one carries on six milliseconds past the end of the
stretch, fading out, while the incoming one rises from the start of it. The fade is spent on
material _after_ the stretch and never on shortening it, so a pass still begins exactly
every `to − from` seconds — an exact period, which is what a click played beside the
recording will need.

## Layout

`src/` is laid out by layer, and the layering is enforced rather than remembered:
`src/code-rules/layers.test.ts` reads the imports back and fails on one pointing the wrong way.

| folder                | what lives there                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/`              | music itself: note values (`notes.ts`), time signatures and their accent patterns (`meter.ts`), plus what identifies a recording (`recording.ts`) and a stretch of one (`selection.ts`). Pure.                                                                                                                                                                                              |
| `practice/`           | the method: the rotation and the tempo ladder (`sequence.ts`), the stage/rung cursor behind the four move buttons (`session.ts`), setup defaults, clamping and `localStorage` (`settings.ts`). Pure — no DOM, no Web Audio.                                                                                                                                                                 |
| `audio/`              | the one `AudioContext` and the gesture that unlocks it (`engine.ts`), the lookahead scheduler that clicks on its clock (`metronome.ts`), the recording read into memory (`recording.ts`) and the looping player with the crossfaded seam (`player.ts`). Knows nothing of the method.                                                                                                        |
| `ui/`                 | the shared React pieces — buttons, fields, cards, a collapsible aside, the drawn note-value glyphs — each with its own stylesheet.                                                                                                                                                                                                                                                          |
| `waveform/`           | the recording drawn on a canvas: the peak envelope (`peaks.ts`), the visible stretch and its arithmetic (`view.ts`), the painting (`draw.ts`), the gestures (`gestures.ts`) and the one component that owns them. Two marks on it mean different things — the cursor is where a play would begin, the playhead is where the sound is — and both are read once a frame rather than rendered. |
| `screens/`            | whole screens, a folder each: `setup/` is the form, `session/` the practice session — the screen itself plus the segment map, the beat dots, the controls and the ladder it is drawn from — and `recording/`, where a file is opened, looped and played, reachable by address alone until it is worth linking to.                                                                           |
| `App.tsx`, `main.tsx` | the entry: mounts the React root and holds the hash routes — the setup form with the session inside it on one, the recording workspace on the other.                                                                                                                                                                                                                                        |
| `app-harness.tsx`     | test-only, shipped to nobody: boots the whole app on a fake audio clock and reads it back the way a player does.                                                                                                                                                                                                                                                                            |
| `code-rules/`         | the two tests that measure the tree itself rather than any one file — the layering and the sizes. They read the source through the file system and import none of it.                                                                                                                                                                                                                       |

Everything that sounds is handed the same engine, so the click and the recording stand on
one clock — which is the whole reason the loop keeps an exact period.

Tests sit beside what they test. `sequence.test.ts` and `session.test.ts` pin the method
itself; `engine.test.ts`, `metronome.test.ts` and `player.test.ts` drive the audio against a fake
clock — the loop's seam is judged there as two numbers rather than by ear: the period the
passes start on, and whether the outgoing level was still falling while the incoming one was
rising;
`SetupScreen.test.tsx` and `SessionScreen.test.tsx` drive the real screens under jsdom with a
stub `AudioContext`, so the form, the four move buttons, the ladder, the beat display and the
click scheduling are all exercised as they run. The session is driven through what a player can
perceive — a control by the name it shows, a value by the words on screen — so the markup can be
rearranged underneath without rewriting the tests. Only whether it _sounds_ right needs your ears.

Two tests are about the tree rather than any one file, and live together in `code-rules/`:
`layers.test.ts` for the layering above, and `structure.test.ts` for size — a file over 300
lines (a test over 400) or a folder over 12
entries fails until the exception is written down with a reason and a ceiling, and then says so
on every run.

## Credit

The method is Dr. Molly Gebrian's — <https://www.mollygebrian.com>.

She writes it out on page 4 of [The Amazing List of Practice
Techniques](https://mollygebrian.wordpress.com/wp-content/uploads/2020/06/the-amazing-list-of-practice-techniques-with-gingold-rhythms-1.pdf#page=4),
explains it in [How To Practice to Increase Speed: Part
II](https://www.youtube.com/watch?v=75OWZAq-O4U) and demonstrates it in [Part
III](https://www.youtube.com/watch?v=e08zFDnLOYY). It is Chapter 16 of _Learn Faster, Perform
Better_.

The rotation here matches her written description exactly — "play the first three
beats/bars. Then do the NEW bar/beat ONLY at 65. Then the 2nd and 3rd beats at 70. Then the
new beat at 75. Then all three at 80" — as does working forwards or backwards. The tail rule,
which she does not spell out, follows the reference implementation at
<https://nellsonic.github.io/icu-metronome/>.

**One deliberate divergence.** She says to click up "by 5s", a constant increment. This app
tapers instead, for the reason in [The tempo ladder](#the-tempo-ladder) above. The taper is
not currently optional: the rung count changes how many steps there are, not how evenly they
are spaced.
