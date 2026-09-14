/* ============================================================
   TOP STATUS ZONE
   Not an Android status bar. Vehicle identity on one end,
   connectivity + time on the other, and a single centre slot the
   system uses to confirm a state change and then vacate.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { onNotice } from '../platform/host';
import { useDispatch, useDerived, useReadout, useSystem } from '../state/systemStore';
import { clockTime, temperature } from '../system/format';
import { Icon } from '../system/icons';
import { TriBar } from './TriBar';
import './TopStatusBar.css';

const DRIVE_LABEL: Record<string, { ar: string; tag: string }> = {
  normal: { ar: 'الوضع العادي', tag: 'NORMAL' },
  sport: { ar: 'الوضع الرياضي', tag: 'SPORT' },
  track: { ar: 'وضع الحلبة', tag: 'TRACK' },
  wet: { ar: 'وضع الطرق المبتلة', tag: 'WET' },
};

export function TopStatusBar() {
  const { vehicle, nav, settings, sources, native } = useSystem();
  const { moving } = useDerived();
  const dispatch = useDispatch();
  const readout = useReadout();
  const [now, setNow] = useState(() => clockTime());
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastMode = useRef(vehicle.driveMode);
  const holdTimer = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(clockTime()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  /* The centre slot already exists to confirm a state change and then
     vacate. A host action that could not be carried out is exactly that
     kind of message, so it lands here rather than in new chrome. */
  useEffect(() => onNotice(setNotice), []);
  useEffect(() => {
    if (!notice) return undefined;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  /* Drive-mode change is confirmed here and nowhere else, so the
     screens themselves never have to host a toast layer. */
  useEffect(() => {
    if (lastMode.current === vehicle.driveMode) return;
    lastMode.current = vehicle.driveMode;
    setConfirm(vehicle.driveMode);
    const id = window.setTimeout(() => setConfirm(null), 2400);
    return () => window.clearTimeout(id);
  }, [vehicle.driveMode]);

  /* Long-press the wordmark to reach the bench/developer panel. */
  const startHold = () => {
    holdTimer.current = window.setTimeout(() => dispatch({ type: 'dev-toggle' }), 900);
  };
  const cancelHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const mode = DRIVE_LABEL[vehicle.driveMode];

  /* The prototype shows the connected state it was designed around.
     A real host reports each link, and an unreported link reads as off
     rather than inheriting the prototype's optimism. */
  const link = sources.system === 'demo'
    ? { gps: true, signal: true, bluetooth: true }
    : {
      gps: native.system?.gpsEnabled === true,
      signal: native.system?.network === true,
      bluetooth: native.system?.bluetooth === 'on',
    };

  return (
    <header className="statusbar">
      <div className="statusbar__brand">
        <button
          type="button"
          className="statusbar__mark physical"
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          aria-label="لوحة أدوات التطوير"
        >
          <TriBar variant="marker" orientation="horizontal" size="sm" active />
          <span className="latin statusbar__wordmark">MUSTANG</span>
          <span className="latin statusbar__trim">GT</span>
        </button>
        {vehicle.driveMode !== 'normal' && (
          <span className="statusbar__mode latin" data-mode={vehicle.driveMode}>
            {mode.tag}
          </span>
        )}
      </div>

      <div className="statusbar__center" aria-live="polite">
        {notice ? (
          <span className="statusbar__route t-meta truncate">{notice}</span>
        ) : confirm ? (
          <span className="statusbar__confirm">
            <TriBar variant="sequential" orientation="horizontal" size="sm" />
            <span className="t-meta">{DRIVE_LABEL[confirm].ar}</span>
          </span>
        ) : nav.active && moving ? (
          <span className="statusbar__route t-meta truncate">
            التوجيه إلى {nav.destination?.name}
          </span>
        ) : null}
      </div>

      <div className="statusbar__status">
        <span className="statusbar__temp">
          <span className="n-value statusbar__tempval">
            {readout.num(vehicle.outsideC, temperature)}
          </span>
          <span className="t-label statusbar__templabel">خارجي</span>
        </span>
        <span className="statusbar__icons">
          <Icon name="gps" className={`statusbar__icon${link.gps ? ' is-on' : ''}`} />
          <Icon name="signal" className={`statusbar__icon${link.signal ? ' is-on' : ''}`} />
          <Icon name="bluetooth" className={`statusbar__icon${link.bluetooth ? ' is-on' : ''}`} />
          {settings.appearance === 'auto' && (
            <Icon
              name={settings.ambientDaylight ? 'sun' : 'moon'}
              className="statusbar__icon"
            />
          )}
        </span>
        <span className="statusbar__clock n-value">{now}</span>
      </div>
    </header>
  );
}
