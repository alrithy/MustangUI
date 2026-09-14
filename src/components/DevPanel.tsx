/* ============================================================
   BENCH PANEL  (not production UI)
   Deterministic scenario switching for design review and QA.
   Reached only by long-pressing the wordmark or pressing `.
   Nothing in the shipping surface links to it.
   ============================================================ */

import { useEffect } from 'react';
import { useDispatch, useSystem, type ScenarioId } from '../state/systemStore';
import { DESTINATIONS } from '../state/demoData';
import type { Appearance, DriveMode, Gear, ThemeName } from '../state/types';
import { Icon } from '../system/icons';
import './DevPanel.css';

const SCENARIOS: Array<{ id: ScenarioId; label: string }> = [
  { id: 'parked', label: 'متوقفة' },
  { id: 'idle', label: 'قيادة هادئة' },
  { id: 'driving', label: 'قيادة' },
  { id: 'navigating', label: 'توجيه نشط' },
  { id: 'incoming-call', label: 'مكالمة واردة' },
];

const THEMES: Array<{ id: ThemeName; label: string }> = [
  { id: 'stealth', label: 'Stealth' },
  { id: 'gt', label: 'Grand Touring' },
  { id: 'night', label: 'Night Drive' },
];

const MODES: Array<{ id: Appearance; label: string }> = [
  { id: 'auto', label: 'تلقائي' },
  { id: 'day', label: 'نهار' },
  { id: 'night', label: 'ليل' },
];

const DRIVE: Array<{ id: DriveMode; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'sport', label: 'Sport' },
  { id: 'track', label: 'Track' },
  { id: 'wet', label: 'Wet' },
];

const GEARS: Gear[] = ['P', 'R', 'N', 'D'];

export function DevPanel() {
  const { devPanelOpen, settings, vehicle, nav } = useSystem();
  const dispatch = useDispatch();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`' || (e.ctrlKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        dispatch({ type: 'dev-toggle' });
      }
      if (e.key === 'Escape' && devPanelOpen) dispatch({ type: 'dev-toggle' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, devPanelOpen]);

  if (!devPanelOpen) return null;

  return (
    <aside className="devpanel" aria-label="Bench controls">
      <header className="devpanel__head">
        <span className="latin devpanel__title">BENCH / DEMO STATE</span>
        <button type="button" className="devpanel__close" onClick={() => dispatch({ type: 'dev-toggle' })} aria-label="إغلاق">
          <Icon name="close" />
        </button>
      </header>

      <Group label="Scenario">
        {SCENARIOS.map((s) => (
          <Chip key={s.id} onClick={() => dispatch({ type: 'scenario', id: s.id })}>{s.label}</Chip>
        ))}
      </Group>

      <Group label="Theme">
        {THEMES.map((t) => (
          <Chip key={t.id} on={settings.theme === t.id} onClick={() => dispatch({ type: 'set-theme', theme: t.id })}>
            {t.label}
          </Chip>
        ))}
      </Group>

      <Group label="Appearance">
        {MODES.map((m) => (
          <Chip key={m.id} on={settings.appearance === m.id} onClick={() => dispatch({ type: 'set-appearance', appearance: m.id })}>
            {m.label}
          </Chip>
        ))}
        <Chip on={settings.ambientDaylight} onClick={() => dispatch({ type: 'set-ambient', daylight: !settings.ambientDaylight })}>
          ambient: {settings.ambientDaylight ? 'day' : 'night'}
        </Chip>
      </Group>

      <Group label="Drive mode">
        {DRIVE.map((d) => (
          <Chip key={d.id} on={vehicle.driveMode === d.id} onClick={() => dispatch({ type: 'set-drive-mode', mode: d.id })}>
            {d.label}
          </Chip>
        ))}
      </Group>

      <Group label="Gear (simulated ECU input)">
        {GEARS.map((g) => (
          <Chip key={g} on={vehicle.gear === g} onClick={() => dispatch({ type: 'set-gear', gear: g })}>{g}</Chip>
        ))}
      </Group>

      <Group label="Guidance">
        <Chip on={nav.active} onClick={() => dispatch({ type: 'nav-start', destination: DESTINATIONS[0] })}>start</Chip>
        <Chip onClick={() => dispatch({ type: 'nav-advance' })}>next step</Chip>
        <Chip onClick={() => dispatch({ type: 'nav-end' })}>end</Chip>
      </Group>

      <Group label="Phone">
        <Chip onClick={() => dispatch({ type: 'call-incoming' })}>incoming</Chip>
        <Chip onClick={() => dispatch({ type: 'call-end' })}>clear</Chip>
      </Group>

      <p className="devpanel__hint latin">
        ` or Ctrl+D toggles · long-press MUSTANG wordmark
      </p>
    </aside>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="devpanel__group">
      <span className="latin devpanel__label">{label}</span>
      <div className="devpanel__chips">{children}</div>
    </div>
  );
}

function Chip({ children, onClick, on = false }: { children: React.ReactNode; onClick: () => void; on?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`devpanel__chip${on ? ' is-on' : ''}`}>
      {children}
    </button>
  );
}
