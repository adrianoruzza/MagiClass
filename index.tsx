/// <reference types="vite/client" />
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; 
import App from './App';

if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {});
  if (typeof caches !== 'undefined') {
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.includes('workbox')).map((k) => caches.delete(k))))
      .catch(() => {});
  }
}

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}