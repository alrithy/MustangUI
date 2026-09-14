/* ============================================================
   APPS
   Deliberately secondary: a curated library in three columns, not
   a launcher grid. Entries that demand sustained attention are
   locked while the vehicle moves and unlock on their own when it
   stops — the driver is never asked to dismiss anything.
   ============================================================ */

import { Surface } from '../components/primitives';
import { APPS } from '../state/demoData';
import { useDerived, useDispatch, useSystem } from '../state/systemStore';
import { Icon } from '../system/icons';
import './AppsScreen.css';

const GROUPS = [
  {
    key: 'drive',
    title: 'أثناء القيادة',
    tag: 'ALWAYS ON',
    ids: ['a-maps', 'a-music', 'a-phone', 'a-radio', 'a-podcast'],
  },
  {
    key: 'system',
    title: 'النظام والمركبة',
    tag: 'SYSTEM',
    ids: ['a-bt', 'a-car', 'a-settings'],
  },
  {
    key: 'parked',
    title: 'عند التوقف',
    tag: 'PARKED ONLY',
    ids: ['a-video', 'a-browser', 'a-gallery', 'a-store'],
  },
];

export function AppsScreen() {
  const { moving } = useDerived();
  const { screen } = useSystem();
  const dispatch = useDispatch();

  const open = (id: string) => {
    const app = APPS.find((a) => a.id === id);
    if (!app) return;
    if (app.restricted && moving) { dispatch({ type: 'block-app', id }); return; }
    if (app.target && app.target !== screen) dispatch({ type: 'navigate', screen: app.target });
  };

  return (
    <div className="screen apps">
      {GROUPS.map((g) => (
        <Surface key={g.key} tone="base" radius="md" pad="none" className="apps__col">
          <header className="apps__head">
            <h2 className="apps__title">{g.title}</h2>
            <span className="latin apps__tag">{g.tag}</span>
          </header>
          <ul className="apps__list">
            {g.ids.map((id) => {
              const app = APPS.find((a) => a.id === id)!;
              const locked = app.restricted && moving;
              return (
                <li key={app.id}>
                  <button
                    type="button"
                    className={`row apps__item pressable${locked ? ' is-locked' : ''}`}
                    onClick={() => open(app.id)}
                  >
                    <span className="apps__icon"><Icon name={app.icon} /></span>
                    <span className="apps__name truncate">{app.name}</span>
                    {locked && <Icon name="lock" className="apps__lock" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Surface>
      ))}
    </div>
  );
}
