import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Toaster } from 'sonner';
import { App } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('Thiếu #root');
createRoot(root).render(
  <StrictMode>
    <App />
    <Toaster position="top-right" richColors={false} closeButton toastOptions={{ duration: 4500 }} />
  </StrictMode>,
);
