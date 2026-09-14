/* ============================================================
   NAVIGATION
   Map first, one maneuver, one ETA row. Everything else is either
   removed or reduced: while guidance runs this screen has a single
   job and one glance to do it in.
   ============================================================ */

import { useState } from 'react';
import { MapCanvas } from '../components/MapCanvas';
import { ManeuverPanel } from '../components/ManeuverPanel';
import { MiniPlayer } from '../components/MiniPlayer';
import { IconButton, Surface, TouchButton } from '../components/primitives';
import { DESTINATIONS } from '../state/demoData';
import { useDispatch, useSystem } from '../state/systemStore';
import { arrivalTime, distanceKm, duration } from '../system/format';
import { Icon } from '../system/icons';
import './NavigationScreen.css';

export function NavigationScreen() {
  const { nav } = useSystem();
  const dispatch = useDispatch();
  const [voice, setVoice] = useState(true);

  const step = nav.steps[nav.stepIndex];
  const next = nav.steps[nav.stepIndex + 1];
  const rem = distanceKm(nav.remainingKm);
  const dur = duration(nav.etaMin);

  return (
    <div className="screen navscreen">
      <div className="navscreen__map">
        <MapCanvas progress={nav.progress} routeActive={nav.active} variant="full" />
      </div>

      {nav.active ? (
        <>
          <Surface tone="elevated" radius="lg" pad="lg" chamfer className="navscreen__guidance">
            <ManeuverPanel step={step} distanceM={nav.toManeuverM} next={next} />
          </Surface>

          <div className="navscreen__tools">
            <IconButton
              icon={voice ? 'volume' : 'mute'}
              label={voice ? 'كتم إرشادات الصوت' : 'تشغيل إرشادات الصوت'}
              size="md" variant="filled" active={!voice}
              onClick={() => setVoice((v) => !v)}
            />
            <IconButton icon="gps" label="إعادة التمركز" size="md" variant="filled" />
          </div>

          <Surface tone="elevated" radius="lg" pad="none" className="navscreen__dock">
            <div className="navscreen__dest">
              <Icon name="pin" className="navscreen__desticon" />
              <span className="navscreen__destname truncate">{nav.destination?.name}</span>
              <span className="navscreen__destsub truncate">{nav.destination?.district}</span>
            </div>
            <span className="hairline-v navscreen__docksep" />
            <div className="navscreen__eta">
              <EtaGroup label="الوصول" value={arrivalTime(nav.etaMin)} />
              <span className="hairline-v navscreen__docksep" />
              <EtaGroup label="المتبقي" value={rem.value} unit={rem.unit} />
              <span className="hairline-v navscreen__docksep" />
              <EtaGroup label="المدة" value={dur.value} unit={dur.unit} />
            </div>
            <span className="hairline-v navscreen__docksep" />
            <div className="navscreen__player"><MiniPlayer tone="bare" /></div>
            <TouchButton size="lg" variant="ghost" icon="close"
              onClick={() => dispatch({ type: 'nav-end' })}>
              إنهاء التوجيه
            </TouchButton>
          </Surface>
        </>
      ) : (
        <Surface tone="elevated" radius="lg" pad="none" chamfer className="navscreen__picker">
          <header className="navscreen__pickerhead">
            <h1 className="t-title-sm">إلى أين؟</h1>
            <span className="t-meta">الرياض — العليا</span>
          </header>
          <ul className="navscreen__list scroll-y">
            {DESTINATIONS.map((d) => {
              const dk = distanceKm(d.distanceKm);
              return (
                <li key={d.id}>
                  <button type="button" className="row navscreen__row pressable"
                    onClick={() => dispatch({ type: 'nav-start', destination: d })}>
                    <span className="navscreen__rowicon">
                      <Icon name={d.kind === 'home' ? 'home' : d.kind === 'work' ? 'briefcase' : 'clock'} />
                    </span>
                    <span className="navscreen__rowtext">
                      <span className="navscreen__rowname truncate">{d.name}</span>
                      <span className="navscreen__rowsub truncate">{d.district}</span>
                    </span>
                    <span className="navscreen__rowmeta">
                      <span className="n-value">{dk.value}</span>
                      <span className="navscreen__rowunit">{dk.unit}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Surface>
      )}
    </div>
  );
}

function EtaGroup({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="navscreen__etagroup">
      <span className="t-label">{label}</span>
      <span className="navscreen__etaval">
        <span className="n-value">{value}</span>
        {unit && <span className="navscreen__etaunit">{unit}</span>}
      </span>
    </div>
  );
}
