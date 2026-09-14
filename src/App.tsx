/* ============================================================
   SHELL
   Fixed automotive chrome: status zone, rail, content, control
   strip. Screens mount inside the content region only — chrome
   never moves, so the panel keeps its physical identity.
   ============================================================ */

import { useEffect } from 'react';
import { BottomVehicleBar } from './components/BottomVehicleBar';
import { CallBanner } from './components/CallBanner';
import { DevPanel } from './components/DevPanel';
import { NavigationRail } from './components/NavigationRail';
import { SafetyOverlay } from './components/SafetyOverlay';
import { TopStatusBar } from './components/TopStatusBar';
import { AppsScreen } from './screens/AppsScreen';
import { CarScreen } from './screens/CarScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MusicScreen } from './screens/MusicScreen';
import { NavigationScreen } from './screens/NavigationScreen';
import { PhoneScreen } from './screens/PhoneScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { useDerived, useSystem } from './state/systemStore';
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
  const { screen, settings, vehicle, phone } = useSystem();
  const { colorMode } = useDerived();

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
          {/* key remounts the screen so its enter transition runs */}
          <div className="shell__screen">
            <Screen key={screen} />
          </div>
          {/* A call outranks the screen but never replaces it: the
              banner docks below, so guidance above stays visible. */}
          {phone.status !== 'idle' && screen !== 'phone' && <CallBanner />}
          <SafetyOverlay />
        </main>
      </div>
      <BottomVehicleBar />
      <DevPanel />
    </div>
  );
}
