/* ============================================================
   HOST BOUNDARY
   If React fails to mount or throws at the root, the launcher must
   find out — otherwise the driver is left looking at the black
   document with no way back to Android. Telling the host lets it
   raise the native recovery panel immediately rather than waiting
   for its start-up watchdog to expire.
   ============================================================ */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { act, isAndroid } from './host';

interface State { failed: boolean }

export class HostBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isAndroid) act('uiFailure', { message: String(error?.message ?? error) });
    else console.error('HMI root failure', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    /* Native recovery takes over on the head unit; this is the browser
       prototype's equivalent, and it stays black either way. */
    return (
      <div className="hostfail">
        <p className="hostfail__text">تعذر تحميل الواجهة</p>
        <button type="button" className="hostfail__retry" onClick={() => location.reload()}>
          إعادة المحاولة
        </button>
      </div>
    );
  }
}
