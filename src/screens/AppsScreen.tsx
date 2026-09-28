/* ============================================================
   APPS
   Every launchable app on the unit, most-used first, as large tiles.
   Above them, the places that belong to the launcher and the unit
   rather than to an app: vehicle, launcher settings, Android settings,
   and the system report.

   Long press an app for its options: keep it on Home, or hide it
   from this grid. Hidden apps are one tap from coming back.
   ============================================================ */

import { useState } from 'react';
import { AppIcon, AppTile } from '../components/AppTile';
import { ReportPanel } from '../components/ReportPanel';
import { act, isAndroid } from '../platform/host';
import { pinnedApps, useDispatch, useSystem } from '../state/systemStore';
import type { CatalogApp } from '../state/types';
import { Icon } from '../system/icons';
import { sortByUse } from './HomeScreen';
import './AppsScreen.css';

export function AppsScreen() {
  const state = useSystem();
  const dispatch = useDispatch();
  const [menu, setMenu] = useState<CatalogApp | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [report, setReport] = useState(false);

  const { hidden, usage } = state.launcher;
  const pinned = new Set(pinnedApps(state).map((a) => a.packageName));
  const visible = sortByUse(state.catalog.filter((a) => !hidden.includes(a.packageName)), usage);
  const hiddenApps = state.catalog.filter((a) => hidden.includes(a.packageName));

  const systemSettings = () => {
    if (isAndroid) act('launch', { app: 'settings' });
    else dispatch({ type: 'navigate', screen: 'settings' });
  };

  return (
    <div className="screen apps">
      <header className="apps__head">
        <h1 className="apps__title">التطبيقات</h1>
        <div className="apps__system">
          <button type="button" className="apps__sys pressable"
            onClick={() => dispatch({ type: 'navigate', screen: 'car' })}>
            <Icon name="car" /><span>المركبة</span>
          </button>
          <button type="button" className="apps__sys pressable"
            onClick={() => dispatch({ type: 'navigate', screen: 'settings' })}>
            <Icon name="sliders" /><span>الإعدادات</span>
          </button>
          <button type="button" className="apps__sys pressable" onClick={systemSettings}>
            <Icon name="settings" /><span>إعدادات النظام</span>
          </button>
          <button type="button" className="apps__sys pressable" onClick={() => setReport(true)}>
            <Icon name="info" /><span>تقرير النظام</span>
          </button>
          {hiddenApps.length > 0 && (
            <button type="button" className={`apps__sys pressable${showHidden ? ' is-on' : ''}`}
              onClick={() => setShowHidden((v) => !v)}>
              <span>المخفية</span><span className="n-value">{hiddenApps.length}</span>
            </button>
          )}
        </div>
      </header>

      {showHidden ? (
        <div className="apps__grid">
          {hiddenApps.map((app) => (
            <AppTile key={app.packageName} app={app} variant="grid"
              badge={<span className="apptile__corner"><Icon name="plus" /></span>}
              onOpen={() => dispatch({ type: 'unhide-app', pkg: app.packageName })} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="apps__empty">لم تصل قائمة التطبيقات من النظام بعد</p>
      ) : (
        <div className="apps__grid">
          {visible.map((app) => (
            <AppTile
              key={app.packageName}
              app={app}
              variant="grid"
              badge={pinned.has(app.packageName) && <span className="apptile__dot" />}
              onOpen={() => dispatch({ type: 'open-app', pkg: app.packageName })}
              onLongPress={() => setMenu(app)}
            />
          ))}
        </div>
      )}

      {report && <ReportPanel onClose={() => setReport(false)} />}

      {menu && (
        <div className="apps__menu" role="dialog" aria-label={menu.label} onClick={() => setMenu(null)}>
          <div className="apps__menupanel" onClick={(e) => e.stopPropagation()}>
            <div className="apps__menuhead">
              <AppIcon app={menu} className="apps__menuicon" />
              <span className="apps__menuname truncate"><bdi>{menu.label}</bdi></span>
            </div>
            {pinned.has(menu.packageName) ? (
              <button type="button" className="apps__action pressable"
                onClick={() => { dispatch({ type: 'unpin-app', pkg: menu.packageName }); setMenu(null); }}>
                <Icon name="minus" /> إزالة من الرئيسية
              </button>
            ) : (
              <button type="button" className="apps__action pressable"
                disabled={pinned.size >= state.launcher.slots}
                onClick={() => { dispatch({ type: 'pin-app', pkg: menu.packageName }); setMenu(null); }}>
                <Icon name="pin" />
                {pinned.size >= state.launcher.slots ? ' الرئيسية ممتلئة — أزل خانة أولاً' : ' تثبيت في الرئيسية'}
              </button>
            )}
            <button type="button" className="apps__action pressable"
              onClick={() => { dispatch({ type: 'hide-app', pkg: menu.packageName }); setMenu(null); }}>
              <Icon name="close" /> إخفاء من القائمة
            </button>
            <button type="button" className="apps__action apps__action--quiet pressable" onClick={() => setMenu(null)}>
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
