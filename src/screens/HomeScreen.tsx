/* ============================================================
   HOME
   One hero, one context. The map is the hero and lives in the
   shell's map stage, so it is already on screen before guidance
   starts and simply grows when it does. This screen owns the
   context panel on the driver's side of the panel, plus the light
   ambient overlay that sits on the canvas.

   idle      context = now playing
   guiding   context = maneuver, arrival, collapsed media
   call      context = caller, answer / decline; the map stays
   parked    context = now playing with queue, plus app access
   ============================================================ */

import { useEffect, useState } from 'react';
import { AlbumArt } from '../components/AlbumArt';
import { ManeuverPanel } from '../components/ManeuverPanel';
import { MiniPlayer } from '../components/MiniPlayer';
import { IconButton, Meter, TouchButton } from '../components/primitives';
import { DESTINATIONS, TRACKS, WEATHER } from '../state/demoData';
import { contactById, useDerived, useDispatch, useSystem, useTrack } from '../state/systemStore';
import {
  arrivalTime, clockTime, distanceKm, duration, longDate, temperature, timecode,
} from '../system/format';
import { Icon } from '../system/icons';
import './HomeScreen.css';

export function HomeScreen() {
  const { homeContext } = useDerived();
  const { phone } = useSystem();
  const showCall = phone.status !== 'idle';

  return (
    <div className="screen home" data-context={homeContext}>
      {/* Ambient layer: sits on the map canvas, never boxes it in. */}
      <MapOverlay />

      <section className="home__context">
        {showCall ? <CallContext /> : homeContext === 'nav' ? <GuidanceContext /> : <MediaContext />}
      </section>
    </div>
  );
}

/* ---------- Ambient overlay on the canvas --------------------------
   Time, date, weather and the two saved destinations. Nothing here is
   a card: the information floats on the map at low weight so the map
   stays a calm surface. */
function MapOverlay() {
  const { homeContext, colorMode } = useDerived();
  const { nav } = useSystem();
  const dispatch = useDispatch();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const guiding = homeContext === 'nav';
  const saved = DESTINATIONS.filter((d) => d.kind === 'home' || d.kind === 'work');

  return (
    <div className="home__overlay" data-guiding={guiding}>
      {!guiding && (
      <div className="home__ambient">
        <div className="home__clock">
          <span className="n-hero home__time">{clockTime(now)}</span>
          <span className="home__date">{longDate(now)}</span>
        </div>
        <span className="home__ambientsep" />
        <div className="home__weather">
          <Icon name={colorMode === 'day' ? 'sun' : 'moon'} className="home__wicon" />
          <span className="n-value home__temp">{temperature(WEATHER.tempC)}</span>
          <span className="home__wcond">
            {WEATHER.condition}
            <span className="n-value home__wrange">{WEATHER.highC}° / {WEATHER.lowC}°</span>
          </span>
        </div>
      </div>
      )}

      {!guiding && (
        <div className="home__saved">
          {saved.map((d) => (
            <button
              key={d.id}
              type="button"
              className="home__chip pressable"
              data-scale="true"
              onClick={() => dispatch({ type: 'nav-start', destination: d })}
            >
              <Icon name={d.kind === 'home' ? 'home' : 'briefcase'} className="home__chipicon" />
              <span className="home__chiptext">
                <span className="home__chipname truncate">{d.name}</span>
                <span className="home__chipsub truncate">{d.district}</span>
              </span>
              <span className="home__chipeta">
                <span className="n-value">{d.etaMin}</span>
                <span className="home__chipunit">د</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {guiding && nav.destination && (
        <button
          type="button"
          className="home__routechip pressable"
          onClick={() => dispatch({ type: 'navigate', screen: 'nav' })}
        >
          <Icon name="pin" className="home__routeicon" />
          <span className="truncate">{nav.destination.name}</span>
          <Icon name="chevron-left" className="home__routego" />
        </button>
      )}
    </div>
  );
}

/* ---------- Context: media ------------------------------------------ */
function MediaContext() {
  const { media } = useSystem();
  const { parked } = useDerived();
  const dispatch = useDispatch();
  const track = useTrack();
  const remaining = track.durationSec - media.positionSec;

  return (
    <div className="ctx ctx--media">
      <span className="ctx__ambient" style={{ background: track.ambient }} aria-hidden="true" />

      <header className="ctx__head">
        <span className="t-label">
          {media.source === 'bluetooth' ? 'بلوتوث' : media.source === 'usb' ? 'USB' : 'راديو'}
        </span>
        <span className="ctx__eq" data-on={media.playing} aria-hidden="true"><i /><i /><i /></span>
      </header>

      <button
        type="button"
        className="ctx__artbtn pressable"
        aria-label={`فتح الوسائط — ${track.title}`}
        onClick={() => dispatch({ type: 'navigate', screen: 'music' })}
      >
        <AlbumArt track={track} size="xl" className="ctx__art" />
      </button>

      <div className="ctx__meta">
        <h1 className="ctx__title truncate"><bdi>{track.title}</bdi></h1>
        <p className="ctx__artist truncate"><bdi>{track.artist}</bdi></p>
      </div>

      <div className="ctx__progress">
        <Meter ratio={media.positionSec / track.durationSec} height="sm" />
        <div className="ctx__times">
          <span className="n-value ctx__time">{timecode(media.positionSec)}</span>
          <span className="n-value ctx__time">-{timecode(remaining)}</span>
        </div>
      </div>

      <div className="ctx__transport">
        <IconButton icon="prev" label="المقطع السابق" size="xl"
          onClick={() => dispatch({ type: 'media-step', delta: -1 })} />
        <IconButton
          icon={media.playing ? 'pause' : 'play'}
          label={media.playing ? 'إيقاف مؤقت' : 'تشغيل'}
          size="2xl" variant="filled" active={media.playing}
          onClick={() => dispatch({ type: 'media-toggle' })}
        />
        <IconButton icon="next" label="المقطع التالي" size="xl"
          onClick={() => dispatch({ type: 'media-step', delta: 1 })} />
      </div>

      {parked && <ParkedExtras />}
    </div>
  );
}

/* Parked unlocks what is unsafe to read while moving. The queue is
   what the media panel gains; apps stay one tap away on the rail
   rather than being crammed into this column. */
function ParkedExtras() {
  const { media } = useSystem();
  const dispatch = useDispatch();
  const upcoming = [1, 2].map((o) => (media.trackIndex + o) % TRACKS.length);

  return (
    <div className="ctx__parked">
      <span className="t-label">التالي في القائمة</span>
      <ul className="ctx__queue">
        {upcoming.map((i) => {
          const t = TRACKS[i];
          return (
            <li key={t.id}>
              <button type="button" className="ctx__queueitem pressable"
                onClick={() => dispatch({ type: 'media-select', index: i })}>
                <AlbumArt track={t} size="xs" />
                <span className="ctx__queuetext">
                  <span className="truncate"><bdi>{t.title}</bdi></span>
                  <span className="truncate muted"><bdi>{t.artist}</bdi></span>
                </span>
                <span className="n-value ctx__queuedur">{timecode(t.durationSec)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Context: guidance ---------------------------------------- */
function GuidanceContext() {
  const { nav } = useSystem();
  const dispatch = useDispatch();
  const step = nav.steps[nav.stepIndex];
  const next = nav.steps[nav.stepIndex + 1];
  const rem = distanceKm(nav.remainingKm);
  const dur = duration(nav.etaMin);

  return (
    <div className="ctx ctx--nav">
      <ManeuverPanel step={step} distanceM={nav.toManeuverM} next={next} />

      <div className="ctx__eta">
        <EtaCell label="الوصول" value={arrivalTime(nav.etaMin)} />
        <span className="hairline-v ctx__etasep" />
        <EtaCell label="المتبقي" value={rem.value} unit={rem.unit} />
        <span className="hairline-v ctx__etasep" />
        <EtaCell label="المدة" value={dur.value} unit={dur.unit} />
      </div>

      <span className="ctx__spacer" />

      <MiniPlayer />

      <TouchButton size="lg" variant="secondary" icon="close" block
        onClick={() => dispatch({ type: 'nav-end' })}>
        إنهاء التوجيه
      </TouchButton>
    </div>
  );
}

function EtaCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="ctx__etacell">
      <span className="t-label">{label}</span>
      <span className="ctx__etaval">
        <span className="n-value">{value}</span>
        {unit && <span className="ctx__etaunit">{unit}</span>}
      </span>
    </div>
  );
}

/* ---------- Context: call --------------------------------------------
   The call takes the context panel, never the screen: guidance on the
   canvas beside it stays exactly where the driver last saw it. */
function CallContext() {
  const { phone, nav } = useSystem();
  const dispatch = useDispatch();
  const contact = contactById(phone.contactId);
  if (!contact) return null;
  const incoming = phone.status === 'incoming';

  return (
    <div className="ctx ctx--call" data-state={phone.status}>
      <span className="t-label ctx__callstate">
        {incoming ? 'مكالمة واردة' : 'مكالمة جارية'}
      </span>
      <h1 className="ctx__callname clamp-2">{contact.name}</h1>
      <span className="ctx__callmeta ltr-num">
        {incoming ? contact.phone : timecode(phone.durationSec)}
      </span>

      <span className="ctx__spacer" />

      {incoming ? (
        <div className="ctx__callactions">
          <TouchButton variant="accept" size="2xl" icon="phone" block
            onClick={() => dispatch({ type: 'call-accept' })}>رد</TouchButton>
          <TouchButton variant="danger" size="2xl" icon="phone-end" block
            onClick={() => dispatch({ type: 'call-decline' })}>رفض</TouchButton>
        </div>
      ) : (
        <div className="ctx__callactions">
          <div className="ctx__callrow">
            <IconButton icon={phone.muted ? 'mic-off' : 'mic'} label="كتم الميكروفون"
              size="xl" variant="filled" active={phone.muted}
              onClick={() => dispatch({ type: 'call-mute' })} />
            <IconButton icon="speaker" label="مكبر الصوت" size="xl" variant="filled"
              active={phone.speaker} onClick={() => dispatch({ type: 'call-speaker' })} />
          </div>
          <TouchButton variant="danger" size="2xl" icon="phone-end" block
            onClick={() => dispatch({ type: 'call-end' })}>إنهاء المكالمة</TouchButton>
        </div>
      )}

      {nav.active && (
        <p className="ctx__callnav t-meta">
          <Icon name="nav" /> التوجيه مستمر إلى {nav.destination?.name}
        </p>
      )}
    </div>
  );
}
