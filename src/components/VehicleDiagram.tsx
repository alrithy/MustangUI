/* ============================================================
   VEHICLE DIAGRAM
   Top view, drawn as flat geometry rather than a render: it has to
   read at a glance and stay honest about being a schematic.
   The diagram is never mirrored in RTL — left and right here are
   physical positions on the car, not reading order.
   ============================================================ */

import './VehicleDiagram.css';

export function VehicleDiagram({ warn = [] }: { warn?: string[] }) {
  const wheelClass = (pos: string) =>
    `vd__wheel${warn.includes(pos) ? ' is-warn' : ''}`;

  return (
    <svg viewBox="0 0 180 320" className="vd" aria-hidden="true">
      <path
        className="vd__body"
        d="M90 10 C62 10 43 27 39 62 L35 120 C33 152 33 190 35 224 L39 280 C43 304 62 312 90 312 C118 312 137 304 141 280 L145 224 C147 190 147 152 145 120 L141 62 C137 27 118 10 90 10 Z"
      />
      {/* Greenhouse: windscreen, roof, backlight */}
      <path className="vd__glass" d="M56 92 C64 78 116 78 124 92 L128 108 L52 108 Z" />
      <rect className="vd__roof" x="52" y="112" width="76" height="72" rx="6" />
      <path className="vd__glass" d="M52 188 L128 188 L124 210 C116 222 64 222 56 210 Z" />
      {/* Shoulder line — the one styling cue carried from the exterior */}
      <path className="vd__shoulder" d="M37 118 L37 232" />
      <path className="vd__shoulder" d="M143 118 L143 232" />

      <rect className={wheelClass('fl')} x="20" y="66" width="17" height="46" rx="5" />
      <rect className={wheelClass('fr')} x="143" y="66" width="17" height="46" rx="5" />
      <rect className={wheelClass('rl')} x="20" y="212" width="17" height="46" rx="5" />
      <rect className={wheelClass('rr')} x="143" y="212" width="17" height="46" rx="5" />
    </svg>
  );
}
