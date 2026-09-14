/* ============================================================
   STARTUP
   ~2.6s from black to Home, in eight beats:

     black → pony emerges under a moving light → pony travels and
     clears → tri-bar strikes → MUSTANG settles → greeting → Home.

   The pony is the approved Mustang emblem asset, used as artwork.
   It is never redrawn in code: the light sweep is a masked overlay
   driven by the same asset's alpha, so the silhouette on screen is
   the silhouette in the file.

   Skippable by touch, and switchable off in Settings.
   Audio is deliberately absent — the eventual native build owns the
   chime and the spoken greeting (see settings.startupChime).
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { useSystem } from '../state/systemStore';
import './StartupSequence.css';

const PONY_SRC = '/brand/mustang-pony.webp';
const TOTAL_MS = 2600;

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
    const end = window.setTimeout(() => done.current(), TOTAL_MS + 420);
    return () => { window.clearTimeout(hold); window.clearTimeout(end); };
  }, []);

  return (
    <div
      className="startup"
      data-leaving={leaving}
      role="presentation"
      onPointerDown={() => { setLeaving(true); window.setTimeout(() => done.current(), 200); }}
    >
      {/* A low, wide sweep — the display waking, not a light show. */}
      <span className="startup__wake" aria-hidden="true" />

      <div className="startup__frame">
        <div className="startup__ponystage" aria-hidden="true">
          <img className="startup__pony" src={PONY_SRC} alt="" decoding="async" />
          {/* Specular pass: a narrow band of light travelling across the
              badge, clipped to the badge's own alpha. */}
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
  );
}
