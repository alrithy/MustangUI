/* ============================================================
   SHELL
   Fixed automotive chrome: status zone, rail, content, control
   strip. Screens mount inside the content region only — chrome
   never moves, so the panel keeps its physical identity.
   ============================================================ */

import { useEffect, useState } from 'react';
import { BottomVehicleBar } from './components/BottomVehicleBar';
import { MapStage } from './components/MapStage';
import { DevPanel } from './components/DevPanel';
import { NavigationRail } from './components/NavigationRail';
import { SafetyOverlay } from './components/SafetyOverlay';
import { StartupSequence } from './components/StartupSequence';
import { TopStatusBar } from './components/TopStatusBar';
import { AppsScreen } from './screens/AppsScreen';
import { CarScreen } from './screens/CarScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MusicScreen } from './screens/MusicScreen';
import { NavigationScreen } from './screens/NavigationScreen';
import { PhoneScreen } from './screens/PhoneScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PanelDiagnostics } from './platform/PanelDiagnostics';
import { isAndroid } from './platform/host';
import { useDerived, useDispatch, useSystem } from './state/systemStore';
import type { ScreenId } from './state/types';
import './App.css';

const SCREENS: Record<ScreenId, () => JSX.Element> = {
  home: HomeScreen,
  nav: NavigationScreen,
  music: MusicScreen,
  phone: PhoneScreen,
  apps: AppsScreen,
  car: CarScreen,
  settings: SettingsScreen,
};

export default function App() {
  const { screen, settings, vehicle, devPanelOpen } = useSystem();
  const { colorMode } = useDerived();
  const dispatch = useDispatch();
  const [booting, setBooting] = useState(() => settings.startupOn);

  /* Theme axes live on <html> so tokens resolve for portals too. */
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = settings.theme;
    el.dataset.mode = colorMode;
    el.dataset.drive = vehicle.driveMode;
    el.dataset.motion = settings.reduceMotion ? 'reduced' : 'full';
  }, [settings.theme, settings.reduceMotion, colorMode, vehicle.driveMode]);

  const Screen = SCREENS[screen];

  return (
    <div className="shell" data-rail={settings.railSide}>
      <TopStatusBar />
      <div className="shell__body">
        <NavigationRail />
        <main className="shell__content" id="content">
          {/* The map is mounted once and repositioned by the active
              screen, so Home -> Navigation grows the same canvas. */}
          <MapStage />
          <div className="shell__screen">
            <Screen key={screen} />
          </div>
          <SafetyOverlay />
        </main>
      </div>
      <BottomVehicleBar />
      {/* The bench panel drives the simulation, so it only exists where
          there is a simulation. On the head unit the same long-press
          gesture opens the panel-geometry diagnostics instead — the
          question worth asking on real hardware. */}
      {isAndroid
        ? devPanelOpen && <PanelDiagnostics onClose={() => dispatch({ type: 'dev-toggle' })} />
        : <DevPanel />}
      {booting && <StartupSequence onDone={() => setBooting(false)} />}
    </div>
  );
}
