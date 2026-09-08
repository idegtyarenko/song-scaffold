import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
import { App } from './App';
import { audio } from './audio/engine';

const container = document.getElementById('root');
if (!container) throw new Error('missing element #root');

// The sound is unlocked by whichever gesture comes first, so pressing Start — or Space, or a
// tempo arrow — plays immediately instead of losing its first bar to autoplay policy.
audio.listenForGesture();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
