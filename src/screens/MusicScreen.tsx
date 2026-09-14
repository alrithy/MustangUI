/* ============================================================
   MEDIA
   Three bands: artwork, transport, queue. Transport controls are
   the largest touch targets in the system after the call buttons,
   because skip and pause are what a driver actually reaches for.
   ============================================================ */

import type { PointerEvent } from 'react';
import { AlbumArt } from '../components/AlbumArt';
import { TriBar } from '../components/TriBar';
import { IconButton, Surface } from '../components/primitives';
import { TRACKS } from '../state/demoData';
import { useDispatch, useSystem, useTrack } from '../state/systemStore';
import { timecode } from '../system/format';
import { Icon } from '../system/icons';
import './MusicScreen.css';

const SOURCE_LABEL: Record<string, string> = {
  bluetooth: 'بلوتوث · هاتف عبدالله',
  usb: 'USB',
  radio: 'راديو FM',
};

export function MusicScreen() {
  const { media } = useSystem();
  const dispatch = useDispatch();
  const track = useTrack();
  const ratio = media.positionSec / track.durationSec;
  const favorite = media.favorites.includes(track.id);

  /* RTL scrub: progress grows from the inline start, i.e. the right. */
  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dispatch({ type: 'media-seek', ratio: (rect.right - e.clientX) / rect.width });
  };

  return (
    <div className="screen music">
      <span className="music__ambient" style={{ background: track.ambient }} aria-hidden="true" />

      <section className="music__stage">
        <AlbumArt track={track} size="xl" className="music__art" />
        <span className="t-label music__source">{SOURCE_LABEL[media.source]}</span>
      </section>

      <section className="music__deck">
        <div className="music__meta">
          <h1 className="music__title clamp-2"><bdi>{track.title}</bdi></h1>
          <p className="music__artist truncate"><bdi>{track.artist}</bdi></p>
          <p className="music__album truncate"><bdi>{track.album}</bdi></p>
        </div>

        <div className="music__scrubwrap">
          <div
            className="music__scrub"
            onPointerDown={seek}
            role="slider"
            tabIndex={0}
            aria-label="موضع التشغيل"
            aria-valuemin={0}
            aria-valuemax={track.durationSec}
            aria-valuenow={media.positionSec}
          >
            <span className="music__scrubtrack">
              <span className="music__scrubfill" style={{ width: `${ratio * 100}%` }} />
            </span>
            <span className="music__scrubknob" style={{ insetInlineStart: `${ratio * 100}%` }} />
          </div>
          <div className="music__times">
            <span className="n-value music__time">{timecode(media.positionSec)}</span>
            <span className="n-value music__time">{timecode(track.durationSec)}</span>
          </div>
        </div>

        {/* Three tiers, not five equal buttons: play dominates, skip is
            secondary, shuffle and repeat are tertiary and set apart. */}
        <div className="music__transport">
          <div className="music__tertiary">
            <IconButton icon="shuffle" label="تشغيل عشوائي" size="lg" active={media.shuffle}
              onClick={() => dispatch({ type: 'media-shuffle' })} />
          </div>
          <IconButton icon="prev" label="المقطع السابق" size="xl" variant="filled"
            onClick={() => dispatch({ type: 'media-step', delta: -1 })} />
          <button
            type="button"
            className="music__play pressable"
            data-scale="true"
            data-playing={media.playing}
            aria-label={media.playing ? 'إيقاف مؤقت' : 'تشغيل'}
            onClick={() => dispatch({ type: 'media-toggle' })}
          >
            <Icon name={media.playing ? 'pause' : 'play'} />
          </button>
          <IconButton icon="next" label="المقطع التالي" size="xl" variant="filled"
            onClick={() => dispatch({ type: 'media-step', delta: 1 })} />
          <div className="music__tertiary">
            <IconButton
              icon={media.repeat === 'one' ? 'repeat-one' : 'repeat'}
              label="إعادة التشغيل" size="lg" active={media.repeat !== 'off'}
              onClick={() => dispatch({ type: 'media-repeat' })}
            />
          </div>
        </div>

        <div className="music__secondary">
          <IconButton
            icon={favorite ? 'heart-filled' : 'heart'}
            label="المفضلة" size="lg" tone="accent" active={favorite}
            onClick={() => dispatch({ type: 'media-favorite', id: track.id })}
          />
          <span className="t-meta music__count">
            {media.trackIndex + 1} من {TRACKS.length}
          </span>
        </div>
      </section>

      <Surface tone="base" radius="md" pad="none" className="music__queue">
        <header className="music__queuehead">
          <Icon name="queue" className="music__queueicon" />
          <span className="t-label">قائمة التشغيل</span>
        </header>
        <ul className="music__list scroll-y">
          {TRACKS.map((t, i) => {
            const current = i === media.trackIndex;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`row row--compact music__row pressable${current ? ' is-current' : ''}`}
                  onClick={() => dispatch({ type: 'media-select', index: i })}
                >
                  <span className="music__rowmark">
                    {current
                      ? <TriBar variant="marker" orientation="horizontal" size="sm" active />
                      : <span className="n-value music__rownum">{i + 1}</span>}
                  </span>
                  <span className="music__rowtext">
                    <span className="truncate music__rowtitle"><bdi>{t.title}</bdi></span>
                    <span className="truncate music__rowartist"><bdi>{t.artist}</bdi></span>
                  </span>
                  <span className="n-value music__rowdur">{timecode(t.durationSec)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Surface>
    </div>
  );
}
