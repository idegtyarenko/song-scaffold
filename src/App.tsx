import { useState } from 'react';

import type { Settings } from './practice/settings';
import { SessionScreen } from './screens/session/SessionScreen';
import { SetupScreen } from './screens/setup/SetupScreen';

export function App() {
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
