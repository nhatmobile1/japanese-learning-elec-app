import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/600.css';
import '@fontsource/noto-sans-jp/700.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

if (window.desktop) {
  document.body.classList.add('desktop');
  // Full-width drag band across the window top (hiddenInset titlebar area).
  // The in-column .app-header alone can't cover the traffic-light corner.
  const bar = document.createElement('div');
  bar.className = 'titlebar-drag';
  document.body.appendChild(bar);
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
