/* ============================================================
   STARTUP
   ~2.6s from black to Home, in eight beats:

     black → pony emerges under a moving light → pony travels and
     clears → tri-bar strikes → MUSTANG settles → greeting → Home.

   The pony is the approved Mustang emblem asset, used as artwork.
   It is never redrawn in code: the light sweep is a masked overlay
   driven by the same asset's alpha, so the silhouette on screen is
   the silhouette in the file.

   The exit is two-stage. The black ground goes first, and a dark
   desaturated veil holds behind it a moment longer, so the interface
   underneath arrives through darkness and brightens into its own
   theme instead of appearing at full value. In Day Mode that is the
   difference between a continuous reveal and a flash; in the dark
   themes the veil is their own background and costs nothing.

   Skippable by touch, and switchable off in Settings.
   Audio is deliberately absent — the eventual native build owns the
   chime and the spoken greeting (see settings.startupChime).
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { useSystem } from '../state/systemStore';
import './StartupSequence.css';

const PONY_SRC = '/brand/mustang-pony.webp';
const TOTAL_MS = 2600;
/* Long enough to outlast the veil, which is the slowest of the two. */
const EXIT_MS = 450;

export function StartupSequence({ onDone }: { onDone: () => void }) {
  const { settings } = useSystem();
  const [leaving, setLeaving] = useState(false);

  /* The shell re-renders every second with the simulation tick, so the
     sequence must not hang its timers off a prop identity — it would
     re-arm on each tick and never finish. */
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const hold = window.setTimeout(() => setLeaving(true), TOTAL_MS);
    const end = window.setTimeout(() => done.current(), TOTAL_MS + EXIT_MS);
    return () => { window.clearTimeout(hold); window.clearTimeout(end); };
  }, []);

  return (
    <>
      {/* Sibling, not child: the veil has to outlive the black ground's
          own fade, and a child can never be more opaque than its parent. */}
      <span className="startup__veil" data-leaving={leaving} aria-hidden="true" />

      <div
        className="startup"
        data-leaving={leaving}
        role="presentation"
        onPointerDown={() => { setLeaving(true); window.setTimeout(() => done.current(), EXIT_MS); }}
      >
        {/* A low, wide sweep — the display waking, not a light show. */}
        <span className="startup__wake" aria-hidden="true" />

        <div className="startup__frame">
          <div className="startup__ponystage" aria-hidden="true">
            <img className="startup__pony" src={PONY_SRC} alt="" decoding="async" />
            {/* Specular pass: a broad, soft band of light travelling
                across the badge, clipped to the badge's own alpha. */}
            <span className="startup__ponysweep" />
          </div>

          <div className="startup__mark physical">
            <span className="startup__tribar" aria-hidden="true"><i /><i /><i /></span>
            <span className="latin startup__word">MUSTANG</span>
          </div>

          {settings.greetingOn && settings.greetingText.trim() !== '' && (
            <p className="startup__greeting">{settings.greetingText}</p>
          )}
        </div>
      </div>
    </>
  );
}
