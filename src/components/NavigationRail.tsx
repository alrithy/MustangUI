/* ============================================================
   NAVIGATION RAIL
   Three destinations, each a quarter-height target with its label
   always shown: Home, Waze, Apps. Waze is not a screen of ours — it
   opens the app itself, because that is where the driver navigates.
   Vehicle and settings live in the Apps header; they are for when
   the car is stopped.
   ============================================================ */

import { WAZE } from '../state/demoData';
import { useDispatch, useSystem } from '../state/systemStore';
import type { ScreenId } from '../state/types';
import { Icon } from '../system/icons';
import { TriBar } from './TriBar';
import './NavigationRail.css';

interface RailItem {
  key: string;
  label: string;
  icon: string;
  /** Screen it selects; absent for an item that opens an app. */
  screen?: ScreenId;
  pkg?: string;
}

const ITEMS: RailItem[] = [
  { key: 'home', label: 'الرئيسية', icon: 'home', screen: 'home' },
  { key: 'waze', label: 'Waze', icon: 'nav', pkg: WAZE },
  { key: 'apps', label: 'التطبيقات', icon: 'apps', screen: 'apps' },
];

export function NavigationRail() {
  const { screen } = useSystem();
  const dispatch = useDispatch();

  /* The Apps item stays lit on the screens it leads to. */
  const lit = (item: RailItem) =>
    item.screen === screen || (item.screen === 'apps' && (screen === 'car' || screen === 'settings'));

  return (
    <nav className="rail" aria-label="التنقل الرئيسي">
      {ITEMS.map((item) => {
        const selected = lit(item);
        return (
          <button
            key={item.key}
            type="button"
            aria-current={selected ? 'page' : undefined}
            onClick={() => (item.pkg
              ? dispatch({ type: 'open-app', pkg: item.pkg })
              : dispatch({ type: 'navigate', screen: item.screen! }))}
            className={`rail__item pressable${selected ? ' is-selected' : ''}`}
          >
            <TriBar variant="marker" orientation="horizontal" size="sm" active={selected} className="rail__marker" />
            <Icon name={item.icon} className="rail__icon" />
            <span className="rail__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
