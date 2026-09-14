/* ============================================================
   MAP STAGE
   The map is mounted once, in the shell, and never unmounts. Screens
   declare where it should sit; the stage animates between those
   positions. That is what makes Home -> Navigation read as one
   continuous system instead of two pages: the canvas a driver is
   already looking at grows, it does not get replaced.
   ============================================================ */

import { MapCanvas } from './MapCanvas';
import { useDerived, useSystem } from '../state/systemStore';
import './MapStage.css';

export type StagePlacement = 'home' | 'home-guiding' | 'full' | 'off';

function placementFor(screen: string, guiding: boolean): StagePlacement {
  if (screen === 'nav') return 'full';
  if (screen === 'home') return guiding ? 'home-guiding' : 'home';
  return 'off';
}

export function MapStage() {
  const { screen, nav } = useSystem();
  const { homeContext } = useDerived();
  const placement = placementFor(screen, homeContext === 'nav');

  return (
    <div className="mapstage" data-placement={placement} aria-hidden={placement === 'off'}>
      <MapCanvas
        progress={nav.progress}
        routeActive={nav.active}
        variant={placement === 'full' ? 'full' : 'mini'}
      />
      <span className="mapstage__edge" aria-hidden="true" />
    </div>
  );
}
