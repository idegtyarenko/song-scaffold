/**
 * What the app is and whose method it follows, at the top of the setup form.
 *
 * Its own component because it is its own block: nothing here reacts to the settings below
 * it, and the form was long enough without forty lines of prose in the middle of it.
 */

import './Masthead.css';

export function Masthead() {
  return (
    <header className="masthead">
      <h1 className="masthead__title">SongScaffold</h1>
      <p className="masthead__lede">
        <a
          className="masthead__link"
          id="methodLink"
          href="https://mollygebrian.wordpress.com/wp-content/uploads/2020/06/the-amazing-list-of-practice-techniques-with-gingold-rhythms-1.pdf#page=4"
          target="_blank"
          rel="noreferrer"
        >
          Dr. Molly Gebrian’s Interleaved Clicking Up
          <span className="visually-hidden">
            , described on page 4 of her practice techniques PDF, opens in a new tab
          </span>
        </a>{' '}
        for taking a hard passage up to tempo: add one segment at a time, and rotate through
        overlapping chunks as the metronome climbs.
      </p>
      <p className="masthead__sources">
        <a
          className="masthead__link"
          id="explainLink"
          href="https://www.youtube.com/watch?v=75OWZAq-O4U"
          target="_blank"
          rel="noreferrer"
        >
          She explains it on video
        </a>{' '}
        <span className="masthead__separator" aria-hidden="true">
          ·
        </span>{' '}
        <a
          className="masthead__link"
          id="demoLink"
          href="https://www.youtube.com/watch?v=e08zFDnLOYY"
          target="_blank"
          rel="noreferrer"
        >
          and demonstrates it
        </a>
      </p>
    </header>
  );
}
