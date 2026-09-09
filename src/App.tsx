/**
 * The routes, and what sits on each of them.
 *
 * Hash routes rather than paths: the app is served from a static host under a project
 * path, and a reload on `/recording` would 404 before any of our code ran.
 *
 * `/recording` has no link pointing at it. The workspace is reachable by address and by
 * nothing else until it is worth showing, which is what keeps unfinished work out of the
 * way without keeping it off the branch.
 *
 * `<Routes>` rather than `createHashRouter`: the data router's loaders and actions have
 * nothing to load here — the settings are local and the recording is a file in memory —
 * and it costs 16 kB gzipped more than the component API for the privilege.
 *
 * A session is deliberately not a route. It is not addressable — it exists only as the
 * settings it was started with, and a link to it would promise a session it cannot
 * restore — so it lives inside the route the setup form is on.
 */

import { useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router';

import type { Settings } from './practice/settings';
import { RecordingScreen } from './screens/recording/RecordingScreen';
import { SessionScreen } from './screens/session/SessionScreen';
import { SetupScreen } from './screens/setup/SetupScreen';

/** Setting a session up and running it: two screens, one address. */
function Practice() {
  const [running, setRunning] = useState<Settings | null>(null);
  const [returned, setReturned] = useState(false);

  if (running) {
    return (
      <SessionScreen
        settings={running}
        onExit={() => {
          setRunning(null);
          setReturned(true);
        }}
      />
    );
  }

  return <SetupScreen onStart={setRunning} focusStart={returned} />;
}

/**
 * The recording workspace. The screen itself knows nothing of routing — it is told where
 * "back" goes, which is also how its own tests reach it.
 */
function Recording() {
  const navigate = useNavigate();
  return <RecordingScreen onBack={() => void navigate('/')} />;
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Practice />} />
        <Route path="/recording" element={<Recording />} />
        {/* An address nobody recognizes is not an error page's worth of ceremony: there is
            one way in, and it is the setup form. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
