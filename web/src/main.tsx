import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './public-page-fonts.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
