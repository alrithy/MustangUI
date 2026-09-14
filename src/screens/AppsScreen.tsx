/* ============================================================
   APPS
   Secondary by construction: three labelled bands on the background,
   no card chrome, no colour. Entries that demand sustained attention
   are held back while the vehicle moves and release themselves when
   it stops — the driver is never asked to dismiss anything.
   ============================================================ */

import { APPS } from '../state/demoData';
import { useDerived, useDispatch, useSystem } from '../state/systemStore';
import { Icon } from '../system/icons';
import './AppsScreen.css';

const BANDS = [
  {
    key: 'drive',
    title: 'أثناء القيادة',
    tag: 'ALWAYS ON',
    ids: ['a-maps', 'a-music', 'a-phone', 'a-radio', 'a-podcast', 'a-fuel'],
  },
  {
    key: 'system',
    title: 'النظام والمركبة',
    tag: 'SYSTEM',
    ids: ['a-cast', 'a-bt', 'a-car', 'a-settings'],
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
      {BANDS.map((band) => (
        <section key={band.key} className="apps__band">
          <header className="apps__head">
            <h2 className="apps__title">{band.title}</h2>
            <span className="latin apps__tag">{band.tag}</span>
            {band.key === 'parked' && moving && (
              <span className="apps__held t-meta">
                <Icon name="lock" /> تتوفر عند التوقف
              </span>
            )}
            <span className="hairline apps__rule" />
          </header>

          <ul className="apps__row">
            {band.ids.map((id) => {
              const app = APPS.find((a) => a.id === id)!;
              const held = app.restricted && moving;
              return (
                <li key={app.id}>
                  <button
                    type="button"
                    data-scale="true"
                    className={`apps__tile pressable${held ? ' is-held' : ''}`}
                    onClick={() => open(app.id)}
                  >
                    <span className="apps__icon"><Icon name={app.icon} /></span>
                    <span className="apps__name truncate">{app.name}</span>
                    {held && <Icon name="lock" className="apps__lock" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
