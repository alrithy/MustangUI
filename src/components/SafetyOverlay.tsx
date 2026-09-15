/* ============================================================
   SAFETY STATE
   Shown when a visually demanding app is opened while moving.
   Written as a designed system state, not an error: it says what
   is happening, when it clears, and offers the safe alternative.
   ============================================================ */

import { useDispatch, useSystem } from '../state/systemStore';
import { APPS, PROJECTED_APPS } from '../state/demoData';
import { TriBar } from './TriBar';
import { TouchButton } from './primitives';
import './SafetyOverlay.css';

export function SafetyOverlay() {
  const { blockedApp } = useSystem();
  const dispatch = useDispatch();
  if (!blockedApp) return null;
  /* Either catalogue can raise this — the car's own tiles and the
     phone's projected apps are both openable from the index. */
  const app = APPS.find((a) => a.id === blockedApp)
    ?? PROJECTED_APPS.find((a) => a.id === blockedApp);

  return (
    <div className="safety" role="alertdialog" aria-label="غير متاح أثناء القيادة">
      <div className="safety__panel">
        <TriBar variant="sequential" orientation="horizontal" size="lg" className="safety__mark" />
        <h2 className="safety__headline">خلّ انتباهك للطريق</h2>
        <p className="safety__body">
          {app ? `«${app.name}»` : 'هذا التطبيق'} يتطلب توقّف المركبة. سيتم فتحه تلقائياً عند التوقف.
        </p>
        <div className="safety__actions">
          <TouchButton size="lg" variant="secondary" onClick={() => dispatch({ type: 'clear-block' })}>
            حسناً
          </TouchButton>
          <TouchButton
            size="lg" variant="ghost" icon="music"
            onClick={() => { dispatch({ type: 'clear-block' }); dispatch({ type: 'navigate', screen: 'music' }); }}
          >
            تشغيل الوسائط بدلاً منه
          </TouchButton>
        </div>
      </div>
    </div>
  );
}
