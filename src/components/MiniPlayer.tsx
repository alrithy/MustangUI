/* ============================================================
   MINI PLAYER
   Appears only where media is secondary to something else. Four
   elements maximum: artwork, title, play/pause, next.
   ============================================================ */

import { useDispatch, useSystem, useTrack } from '../state/systemStore';
import { AlbumArt } from './AlbumArt';
import { IconButton } from './primitives';
import './MiniPlayer.css';

export function MiniPlayer({ tone = 'surface' }: { tone?: 'surface' | 'bare' }) {
  const { media } = useSystem();
  const dispatch = useDispatch();
  const track = useTrack();
  const progress = media.positionSec / track.durationSec;

  return (
    <div className={`miniplayer miniplayer--${tone}`}>
      <AlbumArt track={track} size="sm" />
      <div className="miniplayer__text">
        <span className="miniplayer__title truncate"><bdi>{track.title}</bdi></span>
        <span className="miniplayer__artist truncate"><bdi>{track.artist}</bdi></span>
      </div>
      <div className="miniplayer__controls">
        <IconButton
          icon={media.playing ? 'pause' : 'play'}
          label={media.playing ? 'إيقاف مؤقت' : 'تشغيل'}
          size="md" variant="filled"
          onClick={() => dispatch({ type: 'media-toggle' })}
        />
        <IconButton icon="next" label="المقطع التالي" size="md"
          onClick={() => dispatch({ type: 'media-step', delta: 1 })} />
      </div>
      <span className="miniplayer__progress" aria-hidden="true">
        <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
      </span>
    </div>
  );
}
