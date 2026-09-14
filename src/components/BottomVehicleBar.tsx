/* ============================================================
   BOTTOM STATUS ZONE
   The console around this screen already carries volume, tuning,
   transport and climate switchgear, so none of that is duplicated
   here. This bar holds only what software owns: the drivetrain
   readout, and the media handle that follows the driver between
   screens.
   ============================================================ */

import { useDispatch, useSystem, useTrack } from '../state/systemStore';
import type { Gear } from '../state/types';
import { Icon } from '../system/icons';
import { AlbumArt } from './AlbumArt';
import { IconButton } from './primitives';
import './BottomVehicleBar.css';

const GEARS: Gear[] = ['P', 'R', 'N', 'D'];

export function BottomVehicleBar() {
  const { vehicle, media, nav } = useSystem();
  const dispatch = useDispatch();
  const track = useTrack();

  return (
    <footer className="bvb">
      {/* Drivetrain: a readout. No handler, no press state, inert to
          pointers — it must never be mistaken for a selector. */}
      <div className="bvb__zone bvb__drive">
        <div
          className="bvb__gears physical"
          role="img"
          aria-label={`ناقل الحركة في الوضع ${vehicle.gear}`}
        >
          {GEARS.map((g) => (
            <span key={g} className={`bvb__gear latin${g === vehicle.gear ? ' is-active' : ''}`}>
              {g}
            </span>
          ))}
        </div>
        <span className="hairline-v bvb__sep" />
        <div className="bvb__speed">
          <span className="n-value bvb__speedval">{Math.round(vehicle.speedKph)}</span>
          <span className="bvb__unit">كم/س</span>
        </div>
        <span className="hairline-v bvb__sep" />
        <div className="bvb__range">
          <span className="t-label">المدى</span>
          <span className="bvb__rangepair">
            <span className="n-value bvb__rangeval">{vehicle.rangeKm}</span>
            <span className="bvb__unit">كم</span>
          </span>
        </div>
      </div>

      {nav.active && (
        <button
          type="button"
          className="bvb__guide pressable"
          onClick={() => dispatch({ type: 'navigate', screen: 'nav' })}
        >
          <Icon name="nav" className="bvb__guideicon" />
          <span className="truncate">{nav.destination?.name}</span>
          <span className="n-value bvb__guidekm">{nav.remainingKm.toFixed(1)}</span>
          <span className="bvb__unit">كم</span>
        </button>
      )}

      {/* Media handle — the one persistent transport in the system. */}
      <div className="bvb__zone bvb__media">
        <button
          type="button"
          className="bvb__track pressable"
          aria-label={`فتح الوسائط — ${track.title}`}
          onClick={() => dispatch({ type: 'navigate', screen: 'music' })}
        >
          <AlbumArt track={track} size="sm" />
          <span className="bvb__tracktext">
            <span className="bvb__title truncate"><bdi>{track.title}</bdi></span>
            <span className="bvb__artist truncate"><bdi>{track.artist}</bdi></span>
          </span>
        </button>
        <IconButton icon="prev" label="المقطع السابق" size="lg"
          onClick={() => dispatch({ type: 'media-step', delta: -1 })} />
        <IconButton
          icon={media.playing ? 'pause' : 'play'}
          label={media.playing ? 'إيقاف مؤقت' : 'تشغيل'}
          size="lg" variant="filled"
          onClick={() => dispatch({ type: 'media-toggle' })}
        />
        <IconButton icon="next" label="المقطع التالي" size="lg"
          onClick={() => dispatch({ type: 'media-step', delta: 1 })} />
      </div>
    </footer>
  );
}
