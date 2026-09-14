import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SystemProvider } from './state/systemStore';
import './styles/tokens.css';
import './styles/themes.css';
import './styles/base.css';

const container = document.getElementById('hmi-root');
if (!container) throw new Error('hmi-root missing');

createRoot(container).render(
  <StrictMode>
    <SystemProvider>
      <App />
    </SystemProvider>
  </StrictMode>,
);
