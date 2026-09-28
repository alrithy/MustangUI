/* ============================================================
   HOME
   Two things, both large: the player on the driver's side, and the
   driver's own app tiles beside it. No map — navigation happens in
   Waze — and nothing secondary competing for a glance.

   Tiles are chosen by the driver. A long press enters editing:
   remove a tile, swap one, add one, choose four or six. A tap never
   edits, so the tiles cannot be rearranged by a hurried touch.
   ============================================================ */

import { useState } from 'react';
import { AlbumArt } from '../components/AlbumArt';
import { AppIcon, AppTile } from '../components/AppTile';
import { Meter } from '../components/primitives';
import { SPOTIFY } from '../state/demoData';
import { pinnedApps, useDispatch, useSystem, useTrack } from '../state/systemStore';
import type { CatalogApp } from '../state/types';
import { Icon } from '../system/icons';
import './HomeScreen.css';

export function HomeScreen() {
  const [editing, setEditing] = useState(false);
  /* Slot being filled by the picker; -1 appends. null = picker closed. */
  const [picking, setPicking] = useState<number | null>(null);

  return (
    <div className="screen home">
      <PlayerCard />
      <Tiles
        editing={editing}
        onEdit={setEditing}
        onPick={setPicking}
      />
      {picking !== null && (
        <Picker slot={picking} onClose={() => setPicking(null)} />
      )}
    </div>
  );
}

/* ---------- Player ---------------------------------------------------- */
function PlayerCard() {
  const { media, sources, native } = useSystem();
  const dispatch = useDispatch();
  const track = useTrack();

  const demo = sources.media === 'demo';
  const live = sources.media === 'live';
  /* The player that owns the session, or Spotify when nothing is
     playing yet — it is the one this unit uses. */
  const playerPkg = native.media?.app || SPOTIFY;
  const source = demo ? 'Spotify' : native.media?.appLabel || 'Spotify';
  const idle = !demo && !live;
  const ratio = track.durationSec > 0 ? media.positionSec / track.durationSec : 0;

  const openPlayer = () => {
    if (demo) dispatch({ type: 'navigate', screen: 'music' });
    else dispatch({ type: 'open-app', pkg: playerPkg });
  };

  return (
    <section className="player" data-playing={media.playing}>
      <span className="player__ambient" style={{ background: track.ambient }} aria-hidden="true" />

      <header className="player__head">
        <button type="button" className="player__source pressable" onClick={openPlayer}>
          <span className="player__live" data-on={media.playing} />
          <span className="truncate">{source}</span>
          <Icon name="chevron-left" className="player__go" />
        </button>
      </header>

      <button type="button" className="player__track pressable" onClick={openPlayer}
        aria-label={`فتح ${source}`}>
        <AlbumArt track={track} size="xl" className="player__art" />
        <span className="player__meta">
          <span className="player__title truncate">
            <bdi>{idle ? source : track.title}</bdi>
          </span>
          <span className="player__artist truncate">
            <bdi>{idle ? 'اضغط تشغيل للمتابعة' : track.artist}</bdi>
          </span>
        </span>
      </button>

      <div className="player__progress">
        <Meter ratio={idle ? 0 : ratio} height="sm" />
      </div>

      {/* Three targets that split the card's width. Previous and next
          keep their physical order in both reading directions. */}
      <div className="player__transport">
        <button type="button" className="player__btn pressable" aria-label="المقطع السابق"
          onClick={() => dispatch({ type: 'media-step', delta: -1 })}>
          <Icon name="prev" />
        </button>
        <button type="button" className="player__btn player__btn--play pressable"
          aria-label={media.playing ? 'إيقاف مؤقت' : 'تشغيل'}
          onClick={() => dispatch({ type: 'media-toggle' })}>
          <Icon name={media.playing ? 'pause' : 'play'} />
        </button>
        <button type="button" className="player__btn pressable" aria-label="المقطع التالي"
          onClick={() => dispatch({ type: 'media-step', delta: 1 })}>
          <Icon name="next" />
        </button>
      </div>
    </section>
  );
}

/* ---------- Tiles ----------------------------------------------------- */
function Tiles({
  editing, onEdit, onPick,
}: {
  editing: boolean;
  onEdit: (on: boolean) => void;
  onPick: (slot: number) => void;
}) {
  const state = useSystem();
  const dispatch = useDispatch();
  const apps = pinnedApps(state);
  const { slots } = state.launcher;
  const empty = Math.max(0, slots - apps.length);

  return (
    <section className="tiles" data-slots={slots} data-editing={editing}>
      <div className="tiles__grid">
        {apps.map((app, i) => (
          <AppTile
            key={app.packageName}
            app={app}
            variant="home"
            editing={editing}
            onOpen={() => (editing ? onPick(i) : dispatch({ type: 'open-app', pkg: app.packageName }))}
            onLongPress={() => onEdit(true)}
            badge={editing && (
              <span
                className="apptile__corner"
                role="button"
                aria-label={`إزالة ${app.label}`}
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'unpin-app', pkg: app.packageName }); }}
              >
                <Icon name="close" />
              </span>
            )}
          />
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <button
            key={`empty-${i}`}
            type="button"
            className="tiles__add pressable"
            onClick={() => onPick(-1)}
          >
            <Icon name="plus" className="tiles__addicon" />
            <span>إضافة تطبيق</span>
          </button>
        ))}
      </div>

      {editing && (
        <div className="tiles__bar">
          <span className="tiles__hint">اضغط خانة لاستبدالها · ✕ للإزالة</span>
          <div className="tiles__slots" role="group" aria-label="عدد الخانات">
            {([4, 6] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`tiles__slot pressable${slots === n ? ' is-on' : ''}`}
                onClick={() => dispatch({ type: 'set-slots', slots: n })}
              >
                <span className="n-value">{n}</span> خانات
              </button>
            ))}
          </div>
          <button type="button" className="tiles__done pressable" onClick={() => onEdit(false)}>
            تم
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- Picker ---------------------------------------------------- */
function Picker({ slot, onClose }: { slot: number; onClose: () => void }) {
  const state = useSystem();
  const dispatch = useDispatch();
  const pinned = new Set(pinnedApps(state).map((a) => a.packageName));
  const list = sortByUse(state.catalog, state.launcher.usage);

  const choose = (app: CatalogApp) => {
    dispatch({ type: 'pin-app', pkg: app.packageName, slot: slot < 0 ? undefined : slot });
    onClose();
  };

  return (
    <div className="picker" role="dialog" aria-label="اختر تطبيقاً">
      <div className="picker__panel">
        <header className="picker__head">
          <h2 className="picker__title">اختر تطبيقاً للخانة</h2>
          <button type="button" className="picker__close pressable" onClick={onClose}>إغلاق</button>
        </header>
        <div className="picker__grid">
          {list.map((app) => (
            <button
              key={app.packageName}
              type="button"
              className={`picker__item pressable${pinned.has(app.packageName) ? ' is-on' : ''}`}
              onClick={() => choose(app)}
            >
              {pinned.has(app.packageName) && (
                <span className="apptile__check"><Icon name="check" /></span>
              )}
              <AppIcon app={app} className="picker__icon" />
              <span className="truncate"><bdi>{app.label}</bdi></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Most-used first, then by name. Shared with the Apps grid. */
export function sortByUse(apps: CatalogApp[], usage: Record<string, number>): CatalogApp[] {
  return [...apps].sort((a, b) =>
    (usage[b.packageName] ?? 0) - (usage[a.packageName] ?? 0)
    || a.label.localeCompare(b.label, 'ar'));
}
