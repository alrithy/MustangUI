/* ============================================================
   STARTUP
   Roughly 2.4s from black to Home. The pony passes through frame
   once, the tri-bar lights outward in sequence, the wordmark settles,
   and the shell fades up underneath. No logo bloom, no rev graphics,
   no dwell — a driver who has seen it a thousand times should never
   be waiting on it.

   Skippable by touch, and switchable off in Settings.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { useSystem } from '../state/systemStore';
import './StartupSequence.css';

const TOTAL_MS = 2400;

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
      onPointerDown={() => { setLeaving(true); window.setTimeout(() => done.current(), 220); }}
    >
      {/* A low, wide sweep — the display waking, not a light show. */}
      <span className="startup__wake" aria-hidden="true" />

      <div className="startup__frame">
        <PonyMark />

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

/* Built from separate masses rather than one outline: a single-path
   horse is almost impossible to keep in proportion, and a pony that is
   slightly wrong is worse than no pony at all. Drawn flat, small, and
   gone inside a second. */
function PonyMark() {
  return (
    <svg className="startup__pony" viewBox="0 0 250 145" aria-hidden="true">
      <g className="startup__ponyleg">
        <path d="M156 70 L190 100 L204 128" />
        <path d="M106 68 L80 96 L52 112" />
      </g>
      <path className="startup__ponybody" d="M92 48 C118 41 150 42 170 53 C180 60 178 72 166 78 C142 88 112 87 96 78 C84 71 82 54 92 48 Z" />
      <path className="startup__ponyneck" d="M100 58 C82 46 70 36 56 28" />
      <path className="startup__ponybody" d="M64 20 L50 40 L20 51 L14 42 L33 24 L48 12 Z" />
      <path className="startup__ponybody" d="M52 14 L54 2 L62 14 Z" />
      <path className="startup__ponytail" d="M164 51 C190 33 214 19 242 11 C226 33 204 51 176 65 Z" />
      <g className="startup__ponyleg">
        <path d="M114 74 L98 106 L76 126" />
        <path d="M158 72 L172 102 L166 130" />
      </g>
    </svg>
  );
}
