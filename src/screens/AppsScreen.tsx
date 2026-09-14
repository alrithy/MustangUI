/* ============================================================
   APPS
   Secondary by construction: three labelled bands on the background,
   no card chrome, no colour. Entries that demand sustained attention
   are held back while the vehicle moves and release themselves when
   it stops — the driver is never asked to dismiss anything.
   ============================================================ */

import { act } from '../platform/host';
import { DEMO_ONLY, NATIVE_APP, NATIVE_LABEL } from '../platform/appMap';
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
  const { moving, motion } = useDerived();
  const { screen, sources, native } = useSystem();
  const dispatch = useDispatch();
  const demo = sources.apps === 'demo';

  /* A tile is present if the prototype owns it, or if the host actually
     resolved a launchable package for it. Nothing is offered that would
     fail when pressed. */
  const present = (id: string): boolean => {
    if (demo) return true;
    const native_id = NATIVE_APP[id];
    if (native_id === null) return !DEMO_ONLY.has(id);
    return native.apps.some((a) => a.id === native_id && a.available);
  };

  const label = (id: string, fallback: string) =>
    (demo ? fallback : NATIVE_LABEL[id] ?? fallback);

  const open = (id: string) => {
    const app = APPS.find((a) => a.id === id);
    if (!app) return;
    if (app.restricted && moving) { dispatch({ type: 'block-app', id }); return; }
    const native_id = demo ? null : NATIVE_APP[id];
    if (native_id) { act('launch', { app: native_id }); return; }
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
                <Icon name="lock" />
                {motion === 'unknown' ? ' حالة الوقوف غير متاحة' : ' تتوفر عند التوقف'}
              </span>
            )}
            <span className="hairline apps__rule" />
          </header>

          <ul className="apps__row">
            {band.ids.map((id) => {
              const app = APPS.find((a) => a.id === id)!;
              const held = app.restricted && moving;
              const missing = !present(app.id);
              return (
                <li key={app.id}>
                  <button
                    type="button"
                    data-scale="true"
                    disabled={missing}
                    className={`apps__tile pressable${held ? ' is-held' : ''}${missing ? ' is-missing' : ''}`}
                    onClick={() => open(app.id)}
                  >
                    <span className="apps__icon"><Icon name={app.icon} /></span>
                    <span className="apps__name truncate">{label(app.id, app.name)}</span>
                    {missing
                      ? <span className="apps__state t-meta">غير مثبت</span>
                      : held && <Icon name="lock" className="apps__lock" />}
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
