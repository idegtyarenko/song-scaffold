import { useEffect, useState } from 'react';

// The session screen has not moved yet: session-view.ts still draws it imperatively against
// the markup in index.html. React owns the setup screen and hands the session its settings.
import { endSession, startSession } from './screens/session-view';
import { SetupScreen } from './screens/SetupScreen';
import type { Settings } from './practice/settings';

export function App() {
  const [running, setRunning] = useState<Settings | null>(null);
  const [returned, setReturned] = useState(false);

  if (running) {
    return (
      <PracticeSession
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
 * Draws nothing itself — it just holds the imperative session open for as long as React
 * says it is on screen, and tears it down when it is not.
 */
function PracticeSession({ settings, onExit }: { settings: Settings; onExit: () => void }) {
  useEffect(() => {
    startSession(settings, onExit);
    return endSession;
    // A session is set up once, from the settings it opened with; changing those means
    // going back to the setup screen, which unmounts this.
  }, []);

  return null;
}
