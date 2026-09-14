/* ============================================================
   HOME
   Not a widget wall. One hero that owns the current context, and
   a three-row support column whose contents change with state.

     idle / parked   hero = now playing
     guidance        hero = route, media collapses to the mini player
     parked          support column trades telemetry for app access
   ============================================================ */

import { AlbumArt } from '../components/AlbumArt';
import { MapCanvas } from '../components/MapCanvas';
import { MANEUVER_GLYPH, ManeuverPanel } from '../components/ManeuverPanel';
import { MiniPlayer } from '../components/MiniPlayer';
import { IconButton, Meter, Surface, TouchButton } from '../components/primitives';
import { APPS, DESTINATIONS, TRACKS, WEATHER } from '../state/demoData';
import { useDerived, useDispatch, useSystem, useTrack } from '../state/systemStore';
import {
  arrivalTime, distanceKm, duration, longDate, clockTime, temperature, timecode,
} from '../system/format';
import { Icon } from '../system/icons';
import { useEffect, useState } from 'react';
import './HomeScreen.css';

export function HomeScreen() {
  const { homeContext, colorMode } = useDerived();
  const guidance = homeContext === 'nav';

  return (
    <div className="screen home" data-context={homeContext}>
      <section className="home__hero">
        {guidance ? <GuidanceHero /> : <MediaHero />}
      </section>

      <aside className="home__side">
        {guidance ? (
          <>
            <ClockBand colorMode={colorMode} compact />
            <UpcomingSteps />
            <VehicleGlance />
            <MiniPlayer />
          </>
        ) : (
          <>
            <ClockBand colorMode={colorMode} />
            <DestinationsCard />
            {homeContext === 'parked' ? <AppShortcuts /> : <VehicleGlance />}
          </>
        )}
      </aside>
    </div>
  );
}

/* ---------- Hero: media ------------------------------------------- */
function MediaHero() {
  const { media } = useSystem();
  const dispatch = useDispatch();
  const track = useTrack();
  const remaining = track.durationSec - media.positionSec;

  return (
    <Surface tone="base" radius="lg" pad="none" chamfer className="hero hero--media">
      <span className="hero__ambient" style={{ background: track.ambient }} aria-hidden="true" />
      <div className="hero__media-body">
        <AlbumArt track={track} size="lg" className="hero__art" />

        <div className="hero__info">
          <span className="t-label hero__source">
            {media.source === 'bluetooth' ? 'بلوتوث' : media.source === 'usb' ? 'USB' : 'راديو'}
            <span className="hero__eq" data-on={media.playing} aria-hidden="true"><i /><i /><i /></span>
          </span>

          <button
            type="button"
            className="hero__titlebtn"
            onClick={() => dispatch({ type: 'navigate', screen: 'music' })}
          >
            <h1 className="hero__title truncate"><bdi>{track.title}</bdi></h1>
            <p className="hero__artist truncate"><bdi>{track.artist}</bdi></p>
          </button>

          <div className="hero__progress">
            <Meter ratio={media.positionSec / track.durationSec} height="sm" />
            <div className="hero__times">
              <span className="n-value hero__time">{timecode(media.positionSec)}</span>
              <span className="n-value hero__time">-{timecode(remaining)}</span>
            </div>
          </div>

          <div className="hero__transport">
            <IconButton icon="prev" label="السابق" size="lg"
              onClick={() => dispatch({ type: 'media-step', delta: -1 })} />
            <IconButton
              icon={media.playing ? 'pause' : 'play'}
              label={media.playing ? 'إيقاف مؤقت' : 'تشغيل'}
              size="xl" variant="filled"
              onClick={() => dispatch({ type: 'media-toggle' })}
            />
            <IconButton icon="next" label="التالي" size="lg"
              onClick={() => dispatch({ type: 'media-step', delta: 1 })} />
          </div>
        </div>

        {/* The queue appears where there is room to read it: parked, or
            on a taller panel. Visibility is CSS so the markup is stable. */}
        <QueuePreview />
      </div>
    </Surface>
  );
}

function QueuePreview() {
  const { media } = useSystem();
  const dispatch = useDispatch();
  const upcoming = [1, 2, 3].map((o) => (media.trackIndex + o) % TRACKS.length);

  return (
    <div className="hero__queue">
      <span className="t-label">التالي في القائمة</span>
      <ul>
        {upcoming.map((i) => {
          const t = TRACKS[i];
          return (
            <li key={t.id}>
              <button type="button" className="row row--compact hero__queueitem pressable"
                onClick={() => dispatch({ type: 'media-select', index: i })}>
                <AlbumArt track={t} size="xs" />
                <span className="hero__queuetext">
                  <span className="truncate"><bdi>{t.title}</bdi></span>
                  <span className="truncate muted"><bdi>{t.artist}</bdi></span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Hero: guidance ----------------------------------------- */
function GuidanceHero() {
  const { nav } = useSystem();
  const dispatch = useDispatch();
  const step = nav.steps[nav.stepIndex];
  const next = nav.steps[nav.stepIndex + 1];
  const rem = distanceKm(nav.remainingKm);
  const eta = duration(nav.etaMin);

  return (
    <Surface tone="base" radius="lg" pad="none" chamfer className="hero hero--nav">
      <div className="hero__map">
        <MapCanvas progress={nav.progress} routeActive variant="mini" />
      </div>
      <div className="hero__guidance">
        <ManeuverPanel step={step} distanceM={nav.toManeuverM} next={next} />
      </div>
      <div className="hero__etabar">
        <div className="hero__etagroup">
          <span className="t-label">الوصول</span>
          <span className="n-value hero__etaval">{arrivalTime(nav.etaMin)}</span>
        </div>
        <span className="hairline-v hero__etasep" />
        <div className="hero__etagroup">
          <span className="t-label">المتبقي</span>
          <span className="hero__etapair">
            <span className="n-value hero__etaval">{rem.value}</span>
            <span className="hero__etaunit">{rem.unit}</span>
          </span>
        </div>
        <span className="hairline-v hero__etasep" />
        <div className="hero__etagroup">
          <span className="t-label">المدة</span>
          <span className="hero__etapair">
            <span className="n-value hero__etaval">{eta.value}</span>
            <span className="hero__etaunit">{eta.unit}</span>
          </span>
        </div>
        <span className="hero__spacer" />
        <TouchButton size="md" variant="ghost" icon="close"
          onClick={() => dispatch({ type: 'nav-end' })}>
          إنهاء
        </TouchButton>
      </div>
    </Surface>
  );
}

/* ---------- Support column ------------------------------------------ */
function ClockBand({ colorMode, compact = false }: { colorMode: 'day' | 'night'; compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`clockband${compact ? ' clockband--compact' : ''}`}>
      <div className="clockband__time">
        <span className={compact ? 'n-value clockband__value' : 'n-hero clockband__value'}>
          {clockTime(now)}
        </span>
        <span className="clockband__date">{longDate(now)}</span>
      </div>
      <span className="hairline-v clockband__sep" />
      <div className="clockband__weather">
        <Icon name={colorMode === 'day' ? 'sun' : 'moon'} className="clockband__wicon" />
        <span className="n-value clockband__temp">{temperature(WEATHER.tempC)}</span>
        <span className="clockband__cond">
          {WEATHER.condition}
          <span className="clockband__range n-value">
            {WEATHER.highC}° / {WEATHER.lowC}°
          </span>
        </span>
      </div>
    </div>
  );
}

/* The hero shows the current maneuver and the one after it. This is
   the rest of the route — enough to know what shape the drive has,
   at a size that does not invite reading while moving. */
function UpcomingSteps() {
  const { nav } = useSystem();
  const rest = nav.steps.slice(nav.stepIndex + 2, nav.stepIndex + 6);

  return (
    <Surface tone="base" radius="md" pad="sm" className="upnext">
      <span className="t-label upnext__head">بقية المسار</span>
      <ul className="upnext__list">
        {rest.length === 0 && <li className="upnext__empty t-meta">اقتربت من الوجهة</li>}
        {rest.map((st) => {
          const d = distanceKm(st.distanceM / 1000);
          return (
            <li key={st.id} className="upnext__item">
              <Icon name={MANEUVER_GLYPH[st.kind]} className="upnext__icon" />
              <span className="truncate upnext__road">{st.road}</span>
              <span className="upnext__dist">
                <span className="n-value">{d.value}</span>
                <span className="upnext__unit">{d.unit}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}

function DestinationsCard() {
  const dispatch = useDispatch();
  const shortcuts = DESTINATIONS.filter((d) => d.kind === 'home' || d.kind === 'work');
  const recent = DESTINATIONS.filter((d) => d.kind === 'recent').slice(0, 2);

  return (
    <Surface tone="base" radius="md" pad="none" className="destcard">
      <header className="destcard__head">
        <span className="t-label">الوجهات</span>
        <span className="destcard__place t-meta">الرياض — العليا</span>
      </header>
      <div className="destcard__list">
        {shortcuts.map((d) => (
          <button key={d.id} type="button" className="row row--compact destcard__row pressable"
            onClick={() => dispatch({ type: 'nav-start', destination: d })}>
            <Icon name={d.kind === 'home' ? 'home' : 'briefcase'} className="destcard__icon" />
            <span className="destcard__text">
              <span className="destcard__name truncate">{d.name}</span>
              <span className="destcard__sub truncate">{d.district}</span>
            </span>
            <span className="destcard__eta">
              <span className="n-value">{d.etaMin}</span>
              <span className="destcard__unit">د</span>
            </span>
          </button>
        ))}
        <span className="hairline destcard__rule" />
        {recent.map((d) => (
          <button key={d.id} type="button" className="row row--compact destcard__row destcard__row--quiet pressable"
            onClick={() => dispatch({ type: 'nav-start', destination: d })}>
            <Icon name="clock" className="destcard__icon" />
            <span className="destcard__text">
              <span className="destcard__name truncate">{d.name}</span>
              <span className="destcard__sub truncate">{d.district}</span>
            </span>
            <span className="destcard__eta">
              <span className="n-value">{d.etaMin}</span>
              <span className="destcard__unit">د</span>
            </span>
          </button>
        ))}
      </div>
    </Surface>
  );
}

function VehicleGlance() {
  const { vehicle } = useSystem();
  const lowTire = vehicle.tires.some((t) => t.psi < 33);

  return (
    <div className="glance">
      <div className="glance__item">
        <span className="t-label">المدى</span>
        <span className="glance__value">
          <span className="n-value">{vehicle.rangeKm}</span>
          <span className="glance__unit">كم</span>
        </span>
        <Meter ratio={vehicle.fuelPct / 100} height="sm"
          tone={vehicle.fuelPct < 15 ? 'warning' : 'neutral'} />
      </div>
      <span className="hairline-v glance__sep" />
      <div className="glance__item">
        <span className="t-label">الوقود</span>
        <span className="glance__value">
          <span className="n-value">{Math.round(vehicle.fuelPct)}</span>
          <span className="glance__unit">٪</span>
        </span>
      </div>
      <span className="hairline-v glance__sep" />
      <div className="glance__item">
        <span className="t-label">الإطارات</span>
        <span className={`glance__value${lowTire ? ' is-warn' : ''}`}>
          <Icon name={lowTire ? 'info' : 'shield'} className="glance__icon" />
          <span className="glance__status">{lowTire ? 'انتبه' : 'سليمة'}</span>
        </span>
      </div>
    </div>
  );
}

function AppShortcuts() {
  const dispatch = useDispatch();
  const picks = APPS.filter((a) => ['a-maps', 'a-radio', 'a-podcast', 'a-video'].includes(a.id));

  return (
    <div className="shortcuts">
      {picks.map((a) => (
        <button key={a.id} type="button" className="shortcuts__item pressable" data-scale="true"
          onClick={() => (a.target
            ? dispatch({ type: 'navigate', screen: a.target })
            : dispatch({ type: 'navigate', screen: 'apps' }))}>
          <Icon name={a.icon} className="shortcuts__icon" />
          <span className="shortcuts__label truncate">{a.name}</span>
        </button>
      ))}
    </div>
  );
}
