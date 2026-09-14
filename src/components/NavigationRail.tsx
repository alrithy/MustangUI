/* ============================================================
   NAVIGATION RAIL
   Persistent, seven fixed destinations, no overflow menu. The
   selected item is marked by the tri-bar against the outer edge
   plus a tonal lift — no coloured pill, no fill.
   ============================================================ */

import { useDispatch, useSystem } from '../state/systemStore';
import type { ScreenId } from '../state/types';
import { Icon } from '../system/icons';
import { TriBar } from './TriBar';
import './NavigationRail.css';

interface RailItem {
  id: ScreenId;
  label: string;
  icon: string;
}

const ITEMS: RailItem[] = [
  { id: 'home', label: 'الرئيسية', icon: 'home' },
  { id: 'nav', label: 'التوجيه', icon: 'nav' },
  { id: 'music', label: 'الوسائط', icon: 'music' },
  { id: 'phone', label: 'الهاتف', icon: 'phone' },
  { id: 'apps', label: 'التطبيقات', icon: 'apps' },
  { id: 'car', label: 'المركبة', icon: 'car' },
  { id: 'settings', label: 'الإعدادات', icon: 'settings' },
];

export function NavigationRail() {
  const { screen, nav, phone } = useSystem();
  const dispatch = useDispatch();

  /* One quiet activity dot, only where the state is not already
     visible elsewhere. Media is omitted: the control strip shows
     what is playing at all times. */
  const activity: Partial<Record<ScreenId, boolean>> = {
    nav: nav.active,
    phone: phone.status === 'active' || phone.status === 'incoming',
  };

  return (
    <nav className="rail" aria-label="التنقل الرئيسي">
      {ITEMS.map((item) => {
        const selected = screen === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            onClick={() => dispatch({ type: 'navigate', screen: item.id })}
            className={`rail__item pressable${selected ? ' is-selected' : ''}`}
          >
            <TriBar variant="marker" orientation="horizontal" size="md" active={selected} className="rail__marker" />
            <span className="rail__icon-wrap">
              <Icon name={item.icon} className="rail__icon" />
              {activity[item.id] && !selected && <span className="rail__dot" />}
            </span>
            <span className="rail__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
