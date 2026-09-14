/* ============================================================
   MANEUVER PANEL
   The single highest-priority element while guidance is running.
   Distance leads, because it is the only value that changes and
   the only one a driver re-reads.
   ============================================================ */

import type { ManeuverKind, RouteStep } from '../state/types';
import { maneuverDistance } from '../system/format';
import { Icon } from '../system/icons';
import './ManeuverPanel.css';

export const MANEUVER_GLYPH: Record<ManeuverKind, string> = {
  straight: 'mv-straight',
  'turn-right': 'mv-right',
  'turn-left': 'mv-left',
  'slight-right': 'mv-slight-right',
  'slight-left': 'mv-slight-left',
  'exit-right': 'mv-exit-right',
  roundabout: 'mv-roundabout',
  merge: 'mv-merge',
  destination: 'mv-destination',
};

export function ManeuverPanel({
  step, distanceM, next, size = 'hero',
}: {
  step: RouteStep;
  distanceM: number;
  next?: RouteStep;
  size?: 'hero' | 'compact';
}) {
  const d = maneuverDistance(distanceM);
  /* Imminent maneuvers get the accent; everything else stays neutral
     so the colour still means something when it appears. */
  const imminent = distanceM < 300;

  return (
    <div className={`maneuver maneuver--${size}`} data-imminent={imminent}>
      <div className="maneuver__primary">
        <span className="maneuver__glyph">
          <Icon name={MANEUVER_GLYPH[step.kind]} strokeWidth={1.5} />
        </span>
        <div className="maneuver__text">
          <div className="maneuver__dist">
            <span className="n-display maneuver__distval">{d.value}</span>
            <span className="maneuver__distunit">{d.unit}</span>
          </div>
          <div className="maneuver__road truncate">{step.road}</div>
          {step.detail && size === 'hero' && (
            <div className="maneuver__detail truncate">{step.detail}</div>
          )}
        </div>
      </div>

      {next && size === 'hero' && (
        <>
          <span className="hairline maneuver__rule" />
          <div className="maneuver__next">
            <span className="t-label">ثم</span>
            <Icon name={MANEUVER_GLYPH[next.kind]} className="maneuver__nexticon" />
            <span className="maneuver__nextroad truncate">{next.road}</span>
          </div>
        </>
      )}
    </div>
  );
}
