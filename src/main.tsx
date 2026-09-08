import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
// The imperative app still drives every screen, so the entry keeps running it while the
// React root grows underneath. It goes away once the last screen has moved over.
import './main';

import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('missing element #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
