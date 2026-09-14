/* ============================================================
   PHONE STAGE — عرض الهاتف

   Phone projection that does not behave like a mirror.

   A mirrored handset arrives as a fixed-aspect rectangle, which on a
   2400x900 panel means letterboxing away a third of the glass and
   evicting everything the car itself was saying. So nothing here is
   mirrored. Each app declares what it wants shown and the car
   re-renders it in its own language: the same type ramp, the same
   touch geometry, the same restraint.

   Two planes, deliberately unequal. The stage sits on the driver's
   side and carries whatever holds focus. The spine stays on the
   passenger side and never leaves — device, link, and the one live
   activity worth glancing at.

   The signature is light. The stage is treated as a physical source
   in the cabin: a wash bleeds from it onto the panel behind, and the
   shelf tiles nearest it catch a rim. One light source, one origin,
   consistent with every other shadow in the system.
   ============================================================ */

import { useState } from 'react';
import { AlbumArt } from '../components/AlbumArt';
import { ManeuverPanel } from '../components/ManeuverPanel';
import { TriBar } from '../components/TriBar';
import { IconButton, Meter } from '../components/primitives';
import {
  PROJECTED_APPS, PROJECTED_MESSAGES, PROJECTED_ROUTE, PROJECTED_TRACK,
  PROJECTION_DEVICE, type ProjectedApp,
} from '../state/demoData';
import { useDerived, useDispatch } from '../state/systemStore';
import { relativeTime, timecode } from '../system/format';
import { Icon } from '../system/icons';
import './CastScreen.css';

export function CastScreen() {
  const { moving } = useDerived();
  const [activeId, setActiveId] = useState('anghami');
  const [playing, setPlaying] = useState(true);
  const [onPanel, setOnPanel] = useState(true);

  const active = PROJECTED_APPS.find((a) => a.id === activeId) ?? PROJECTED_APPS[0];

  /* Everything that is not the stage takes its colour from the stage.
     Declared once here so the wash, the rim on the shelf and the
     spine's edge all resolve from a single origin. */
  const lit = active.surface === 'media' ? PROJECTED_TRACK.ambient : 'var(--accent-primary)';

  const open = (app: ProjectedApp) => {
    if (app.restricted && moving) return;
    setActiveId(app.id);
  };

  return (
    <div
      className="screen stage"
      data-projecting={onPanel}
      style={{ ['--lit' as string]: lit }}
    >
      {/* The cabin wash. Sits under everything, never boxed. */}
      <span className="stage__wash" aria-hidden="true" />

      <section className="stage__main">
        <StageSurface
          app={active}
          playing={playing}
          onPlayToggle={() => setPlaying((p) => !p)}
          projecting={onPanel}
          moving={moving}
        />
        <Shelf active={active.id} moving={moving} onOpen={open} />
      </section>

      <Spine
        app={active}
        onPanel={onPanel}
        onHandoff={() => setOnPanel((v) => !v)}
      />
    </div>
  );
}

/* ---------- Stage --------------------------------------------------
   One slab, chamfered like every other hero surface in the system.
   The content inside changes wholesale with the app; the frame never
   moves, so switching apps reads as the same object showing something
   else rather than a page transition. */
function StageSurface({
  app, playing, onPlayToggle, projecting, moving,
}: {
  app: ProjectedApp;
  playing: boolean;
  onPlayToggle: () => void;
  projecting: boolean;
  moving: boolean;
}) {
  const held = app.restricted && moving;

  return (
    <div className="stage__slab surface--chamfer" data-surface={app.surface}>
      <header className="stage__slabhead">
        <span className="stage__source">
          <Icon name="cast" className="stage__sourceicon" />
          <span className="t-label">{app.name}</span>
          <span className="latin stage__mark">{app.mark}</span>
        </span>
        {!projecting && <span className="t-meta stage__paused">متوقف على الشاشة</span>}
      </header>

      <div className="stage__body" data-dimmed={!projecting || held}>
        {held ? <HeldSurface /> : null}
        {!held && app.surface === 'media' && (
          <MediaSurface playing={playing} onPlayToggle={onPlayToggle} />
        )}
        {!held && app.surface === 'route' && <RouteSurface />}
        {!held && app.surface === 'messages' && <MessagesSurface moving={moving} />}
        {!held && app.surface === 'call' && <CallSurface />}
      </div>
    </div>
  );
}

function MediaSurface({ playing, onPlayToggle }: { playing: boolean; onPlayToggle: () => void }) {
  const t = PROJECTED_TRACK;
  const ratio = t.positionSec / t.durationSec;
  const track = {
    id: 'proj-anghami',
    title: t.title,
    artist: t.artist,
    album: t.album,
    durationSec: t.durationSec,
    art: ['#9c3446', '#2a1016'] as [string, string],
    ambient: t.ambient,
  };

  return (
    <div className="proj proj--media">
      <AlbumArt track={track} size="xl" className="proj__art" />

      {/* Each of these is a grid child in its own cell. Nesting the
          scrub inside the metadata would collapse the composition back
          into a column and hand the width back to nothing. */}
      <div className="proj__meta">
        <h1 className="proj__title clamp-2"><bdi>{t.title}</bdi></h1>
        <p className="proj__artist truncate"><bdi>{t.artist}</bdi></p>
        <p className="proj__album truncate"><bdi>{t.album}</bdi></p>
      </div>

      <div className="proj__transport">
        <IconButton icon="prev" label="السابق" size="xl" />
        <button
          type="button"
          className="proj__play pressable"
          data-scale="true"
          aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
          onClick={onPlayToggle}
        >
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <IconButton icon="next" label="التالي" size="xl" />
      </div>

      <div className="proj__scrub">
        <Meter ratio={ratio} height="sm" />
        <div className="proj__times">
          <span className="n-value proj__time">{timecode(t.positionSec)}</span>
          <span className="n-value proj__time">-{timecode(t.durationSec - t.positionSec)}</span>
        </div>
      </div>
    </div>
  );
}

/* Guidance from the phone, rendered with the car's own maneuver panel.
   The point of the screen in one component: the driver reads the same
   shape whether the route came from the head unit or the handset. */
function RouteSurface() {
  const r = PROJECTED_ROUTE;
  const step = {
    id: 'proj-step',
    kind: 'slight-right' as const,
    road: r.road,
    detail: r.detail,
    distanceM: r.distanceM,
  };

  return (
    <div className="proj proj--route">
      <ManeuverPanel step={step} distanceM={r.distanceM} />

      {/* Arrival sits at the far reach, where the eye lands last and
          where nothing competes with the maneuver for the same glance. */}
      <div className="proj__routestats">
        <div className="proj__routestat">
          <span className="n-value proj__routeval">{r.etaMin}</span>
          <span className="proj__routeunit">د</span>
          <span className="t-label proj__routelabel">الوصول</span>
        </div>
        <span className="hairline proj__routesep" />
        <div className="proj__routestat">
          <span className="n-value proj__routeval">{r.remainingKm.toFixed(1)}</span>
          <span className="proj__routeunit">كم</span>
          <span className="t-label proj__routelabel">المتبقي</span>
        </div>
      </div>

      <p className="proj__alert">
        <Icon name="info" className="proj__alerticon" />
        {r.alert}
      </p>
    </div>
  );
}

function MessagesSurface({ moving }: { moving: boolean }) {
  return (
    <div className="proj proj--messages">
      <ul className="proj__threads">
        {PROJECTED_MESSAGES.map((m) => (
          <li key={m.id} className="proj__thread" data-unread={m.unread}>
            <span className="proj__threadmark" aria-hidden="true">
              {m.unread ? <TriBar variant="marker" orientation="horizontal" size="sm" active /> : null}
            </span>
            <span className="proj__threadtext">
              <span className="proj__threadfrom">{m.from}</span>
              <span className="proj__threadpreview truncate"><bdi>{m.preview}</bdi></span>
            </span>
            <span className="t-meta proj__threadago">{relativeTime(m.agoMin)}</span>
          </li>
        ))}
      </ul>
      <p className="proj__reply">
        <Icon name="mic" className="proj__replyicon" />
        {moving ? 'الرد بالصوت — النص محجوب أثناء الحركة' : 'الرد بالصوت أو من الهاتف'}
      </p>
    </div>
  );
}

function CallSurface() {
  return (
    <div className="proj proj--call">
      <p className="t-meta proj__callhint">لا توجد مكالمة نشطة</p>
      <p className="proj__callbody">
        المكالمات تمر عبر البلوتوث، وتظهر هنا مع اسم المتصل وأدوات الرد.
      </p>
    </div>
  );
}

function HeldSurface() {
  return (
    <div className="proj proj--held">
      <Icon name="lock" className="proj__heldicon" />
      <p className="proj__heldtext">يتوفر عند التوقف</p>
    </div>
  );
}

/* ---------- Shelf --------------------------------------------------
   Not a grid. The active app is raised and lit, its neighbours sit
   back, and anything held while moving reads as inert rather than
   missing. Depth carries the hierarchy so colour does not have to. */
function Shelf({
  active, moving, onOpen,
}: {
  active: string;
  moving: boolean;
  onOpen: (app: ProjectedApp) => void;
}) {
  return (
    /* Every app is on the panel at once. A shelf that scrolls would
       ask a driver to hunt while moving, and would hide exactly the
       tiles that are held — the behaviour most worth seeing. */
    <ul className="shelf">
      {PROJECTED_APPS.map((app) => {
        const isActive = app.id === active;
        const held = !!app.restricted && moving;
        return (
          <li key={app.id}>
            <button
              type="button"
              data-scale="true"
              data-active={isActive}
              aria-current={isActive ? 'true' : undefined}
              disabled={held}
              className={`shelf__tile pressable${held ? ' is-held' : ''}`}
              onClick={() => onOpen(app)}
            >
              <span className="shelf__icon"><Icon name={app.icon} /></span>
              <span className="shelf__text">
                <span className="shelf__name truncate">{app.name}</span>
                {/* Only the live tile reports what it is doing. Eight
                    status lines at once is noise, not information. */}
                {isActive && app.status && !held && (
                  <span className="shelf__status truncate">{app.status}</span>
                )}
                {held && <span className="shelf__status">عند التوقف</span>}
              </span>
              {isActive && (
                <TriBar variant="marker" orientation="horizontal" size="sm" active
                  className="shelf__mark" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Spine --------------------------------------------------
   The column a mirror cannot have. It belongs to the car, not the
   handset, so it survives every app switch: what is connected, how
   well, and where the content is currently playing. */
function Spine({
  app, onPanel, onHandoff,
}: {
  app: ProjectedApp;
  onPanel: boolean;
  onHandoff: () => void;
}) {
  const d = PROJECTION_DEVICE;
  const dispatch = useDispatch();

  return (
    <aside className="spine">
      <header className="spine__device">
        <span className="spine__avatar" aria-hidden="true">
          <Icon name="phone" />
        </span>
        <span className="spine__id">
          <span className="spine__name truncate">{d.name}</span>
          <span className="latin spine__model truncate">{d.model}</span>
        </span>
      </header>

      <div className="spine__battery">
        <div className="spine__batteryhead">
          <span className="n-value spine__batteryval">{d.batteryPct}</span>
          <span className="spine__batteryunit">٪</span>
          {d.charging && <Icon name="plug" className="spine__charging" />}
        </div>
        <Meter ratio={d.batteryPct / 100} height="sm" tone="neutral" />
      </div>

      <span className="hairline spine__rule" />

      <dl className="spine__link">
        <Row label="الاتصال" value={d.link} latin />
        <Row label="زمن الاستجابة" value={`${d.latencyMs} ms`} latin />
        <Row label="الشبكة" value={d.carrier} latin />
      </dl>

      <span className="hairline spine__rule" />

      {/* Handoff. A mirror has no answer to "keep it on the phone";
          a projection surface has to, because the passenger holds it. */}
      <div className="spine__handoff">
        <span className="t-label spine__handofflabel">مكان التشغيل</span>
        <div className="spine__toggle" role="radiogroup" aria-label="مكان التشغيل">
          <button
            type="button" role="radio" aria-checked={onPanel}
            className={`spine__choice pressable${onPanel ? ' is-on' : ''}`}
            onClick={() => { if (!onPanel) onHandoff(); }}
          >
            <Icon name="cast" />
            <span>الشاشة</span>
          </button>
          <button
            type="button" role="radio" aria-checked={!onPanel}
            className={`spine__choice pressable${!onPanel ? ' is-on' : ''}`}
            onClick={() => { if (onPanel) onHandoff(); }}
          >
            <Icon name="phone" />
            <span>الهاتف</span>
          </button>
        </div>
        <p className="spine__note">
          {onPanel
            ? `${app.name} معروض على اللوحة والصوت عبر مكبرات المركبة.`
            : 'الصوت والعرض على الهاتف. اللوحة تبقى على واجهة المركبة.'}
        </p>
      </div>

      <button
        type="button"
        className="spine__disconnect pressable"
        onClick={() => dispatch({ type: 'navigate', screen: 'settings' })}
      >
        <Icon name="external" className="spine__disconnecticon" />
        إدارة الأجهزة المقترنة
      </button>
    </aside>
  );
}

function Row({ label, value, latin = false }: { label: string; value: string; latin?: boolean }) {
  return (
    <div className="spine__row">
      <dt className="spine__rowlabel">{label}</dt>
      <dd className={`spine__rowvalue${latin ? ' latin' : ''}`}>{value}</dd>
    </div>
  );
}
