import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { HostBoundary } from './platform/HostBoundary';
import { act, isAndroid } from './platform/host';
import { SystemProvider } from './state/systemStore';
import './styles/tokens.css';
import './styles/themes.css';
import './styles/base.css';

const container = document.getElementById('hmi-root');
if (!container) {
  if (isAndroid) act('uiFailure', { message: 'hmi-root missing' });
  throw new Error('hmi-root missing');
}

createRoot(container).render(
  <StrictMode>
    <HostBoundary>
      <SystemProvider>
        <App />
      </SystemProvider>
    </HostBoundary>
  </StrictMode>,
);
