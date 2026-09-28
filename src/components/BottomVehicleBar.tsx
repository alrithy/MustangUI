/* ============================================================
   BOTTOM STATUS ZONE
   Shown on every screen except Home, which has the full player.
   It holds the media handle that follows the driver between
   screens; the drivetrain readout moved to the status bar.
   ============================================================ */

import { useDispatch, useSystem, useTrack } from '../state/systemStore';
import { Icon } from '../system/icons';
import { AlbumArt } from './AlbumArt';
import { IconButton } from './primitives';
import './BottomVehicleBar.css';

export function BottomVehicleBar() {
  const { media, nav } = useSystem();
  const dispatch = useDispatch();
  const track = useTrack();

  return (
    <footer className="bvb">
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
