/* ============================================================
   NAVIGATION
   The map is already on screen — it arrives here by expanding out of
   Home, not by being drawn again. This screen only adds what full
   guidance needs on top of the canvas: one maneuver, one arrival row,
   and nothing else. No zoom buttons, no layers, no search field: a
   driver needs the route, not a GIS application.
   ============================================================ */

import { useState } from 'react';
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

  if (!nav.active) {
    return (
      <div className="screen navscreen">
        <Surface tone="elevated" radius="lg" pad="none" className="navscreen__picker">
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
      </div>
    );
  }

  return (
    <div className="screen navscreen">
      {/* Guidance card. Sits on the driver's side, clear of the route. */}
      <Surface tone="elevated" radius="lg" pad="lg" className="navscreen__guidance">
        <ManeuverPanel step={step} distanceM={nav.toManeuverM} next={next} />
      </Surface>

      {/* Voice is the only control the map itself needs while running. */}
      <IconButton
        icon={voice ? 'volume' : 'mute'}
        label={voice ? 'كتم إرشادات الصوت' : 'تشغيل إرشادات الصوت'}
        size="lg" variant="filled" active={!voice}
        className="navscreen__voice"
        onClick={() => setVoice((v) => !v)}
      />

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
        <div className="navscreen__player"><MiniPlayer tone="bare" /></div>
        <TouchButton size="lg" variant="ghost" icon="close"
          onClick={() => dispatch({ type: 'nav-end' })}>
          إنهاء
        </TouchButton>
      </Surface>
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
