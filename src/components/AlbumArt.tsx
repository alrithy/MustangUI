/* ============================================================
   ALBUM ART
   Artwork is synthesised, not shipped as images: the head unit
   should look right before any media source is attached, and a
   real build swaps this for MediaMetadata bitmaps. Four restrained
   motifs, chosen deterministically per track id.
   ============================================================ */

import type { Track } from '../state/types';
import { hashIndex } from '../system/format';
import './AlbumArt.css';

const MOTIFS = 4;

export function AlbumArt({
  track, size = 'md', className = '',
}: {
  track: Track;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const motif = hashIndex(track.id, MOTIFS);
  const [c1, c2] = track.art;

  return (
    <div
      className={`albumart albumart--${size} ${className}`}
      style={{ ['--art-a' as string]: c1, ['--art-b' as string]: c2 }}
      role="img"
      aria-label={`غلاف ألبوم ${track.album}`}
    >
      <svg viewBox="0 0 100 100" className="albumart__motif" aria-hidden="true" preserveAspectRatio="none">
        {motif === 0 && (
          <>
            <circle cx="68" cy="34" r="30" className="albumart__stroke" />
            <circle cx="68" cy="34" r="17" className="albumart__fill" />
          </>
        )}
        {motif === 1 && (
          <>
            <rect x="0" y="58" width="100" height="7" className="albumart__fill" />
            <rect x="0" y="71" width="100" height="4" className="albumart__fill" opacity="0.6" />
            <rect x="0" y="80" width="100" height="2.5" className="albumart__fill" opacity="0.35" />
          </>
        )}
        {motif === 2 && (
          <>
            <path d="M0 100 L100 18 L100 100 Z" className="albumart__fill" opacity="0.5" />
            <path d="M0 100 L100 46 L100 100 Z" className="albumart__fill" opacity="0.35" />
          </>
        )}
        {motif === 3 && (
          <>
            <path d="M-10 86 A56 56 0 0 1 86 -10" className="albumart__stroke" />
            <path d="M-10 62 A38 38 0 0 1 62 -10" className="albumart__stroke" opacity="0.55" />
            <path d="M-10 38 A20 20 0 0 1 38 -10" className="albumart__stroke" opacity="0.3" />
          </>
        )}
      </svg>
      <span className="albumart__sheen" aria-hidden="true" />
    </div>
  );
}
