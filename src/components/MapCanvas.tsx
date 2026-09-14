/* ============================================================
   MAP CANVAS
   A lightweight vector map: no tiles, no canvas, no WebGL, and no
   per-frame work — the whole surface is one SVG whose only moving
   parts are the vehicle transform and the route dash offset.

   The world is drawn once in a fixed coordinate space and then
   translated so the vehicle always sits at the same focal point.
   That keeps the map correct at every panel aspect ratio without
   measuring the container.
   ============================================================ */

import { useLayoutEffect, useRef, useState } from 'react';
import { ROUTE_PATH } from '../state/demoData';
import './MapCanvas.css';

/* --- Viewport ----------------------------------------------------
   preserveAspectRatio="slice" on a wide container always shows the
   full 1000 width and a band centred on y = 300, so a focal point
   near the middle is visible at every aspect we ship. */
const VIEW_W = 1000;
const FOCUS_X = 500;
const FOCUS_Y = 340;

/* --- World geometry ---------------------------------------------
   Generated once at module scope so panning never reveals an edge.

   The grid is deliberately irregular. A city drawn on even spacing
   reads as graph paper; Riyadh's north is a coarse arterial frame
   with blocks of very different depth inside it, and that variation
   is what makes the canvas read as a place rather than a mesh. */
const WORLD = { x0: -900, x1: 1900, y0: -600, y1: 1300 };

/* Seeded so the city is identical on every load and nothing animates. */
let seed = 20250914;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

/** Irregular line positions: a base pitch with up to 40% jitter. */
function lattice(from: number, to: number, pitch: number, jitter: number) {
  const out: number[] = [];
  let v = from;
  while (v < to) {
    out.push(Math.round(v));
    v += pitch * (1 - jitter + rand() * jitter * 2);
  }
  return out;
}

/* Three road classes. The arterials carry the route and the names;
   collectors thread between them; the rest is local grain. */
const ARTERIALS_H = [-240, 160, 348, 548, 860];
const ARTERIALS_V = [-380, 118, 486, 862, 1320];
const COLLECTORS_H = lattice(WORLD.y0, WORLD.y1, 104, 0.34)
  .filter((y) => !ARTERIALS_H.some((a) => Math.abs(a - y) < 46));
const COLLECTORS_V = lattice(WORLD.x0, WORLD.x1, 128, 0.34)
  .filter((x) => !ARTERIALS_V.some((a) => Math.abs(a - x) < 54));
const LOCAL_H = lattice(WORLD.y0, WORLD.y1, 46, 0.3)
  .filter((y) => ![...ARTERIALS_H, ...COLLECTORS_H].some((a) => Math.abs(a - y) < 22));
const LOCAL_V = lattice(WORLD.x0, WORLD.x1, 58, 0.3)
  .filter((x) => ![...ARTERIALS_V, ...COLLECTORS_V].some((a) => Math.abs(a - x) < 26));

/* Two block weights: the bulk of the fabric, plus a lighter set that
   catches the eye and keeps large areas from going flat. */
interface Block { x: number; y: number; w: number; h: number; light: boolean }

function buildBlocks(): Block[] {
  const cells: Block[] = [];
  const xs = [...ARTERIALS_V, ...COLLECTORS_V, ...LOCAL_V].sort((a, b) => a - b);
  const ys = [...ARTERIALS_H, ...COLLECTORS_H, ...LOCAL_H].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const w = xs[i + 1] - xs[i];
      const h = ys[j + 1] - ys[j];
      if (w < 16 || h < 14) continue;
      const r = rand();
      if (r < 0.26) continue;                  // open lots and yards
      const inset = 3 + r * 7;
      // Partly-built parcels: trim one axis so edges are not all flush.
      const tw = r > 0.78 ? w * (0.26 + rand() * 0.3) : 0;
      const th = r > 0.88 ? h * (0.22 + rand() * 0.26) : 0;
      cells.push({
        x: xs[i] + inset,
        y: ys[j] + inset,
        w: Math.max(5, w - inset * 2 - tw),
        h: Math.max(5, h - inset * 2 - th),
        light: r > 0.93,
      });
    }
  }
  return cells;
}
const BLOCKS = buildBlocks();

/* Wadi Hanifa and one green corridor: the two non-orthogonal edges. */
const WADI =
  'M-900 700 C -560 672, -240 590, 60 520 C 360 450, 520 392, 700 300 ' +
  'C 900 196, 1150 150, 1460 104 C 1660 74, 1800 66, 1900 58 ' +
  'L 1900 -18 C 1760 -8, 1620 0, 1440 26 C 1130 72, 880 118, 680 222 ' +
  'C 500 314, 340 372, 40 442 C -250 512, -570 594, -900 622 Z';
const PARK = 'M236 596 L470 596 L470 742 L236 742 Z';

const LABELS: Array<{ x: number; y: number; text: string; size: number }> = [
  { x: 700, y: 138, text: 'طريق الملك سلمان', size: 10 },
  { x: 300, y: 326, text: 'طريق الملك عبدالله', size: 10 },
  { x: 560, y: 500, text: 'طريق الملك فهد', size: 10 },
  { x: 150, y: 300, text: 'العليا', size: 13 },
  { x: 646, y: 420, text: 'الصحافة', size: 13 },
  { x: 950, y: 300, text: 'الملقا', size: 13 },
  { x: 330, y: 620, text: 'السليمانية', size: 11 },
  { x: 820, y: 660, text: 'حطين', size: 11 },
];

const ZOOM = { full: 1, mini: 1.35, card: 1.75 } as const;

interface MapCanvasProps {
  /** 0..1 position of the vehicle along the demo route. */
  progress: number;
  /** Draw the route + destination. When false the map is context only. */
  routeActive: boolean;
  variant?: keyof typeof ZOOM;
  className?: string;
}

export function MapCanvas({ progress, routeActive, variant = 'full', className = '' }: MapCanvasProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [geo, setGeo] = useState({ len: 0, x: 118, y: 548, angle: 0 });

  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    const at = Math.max(0, Math.min(1, progress)) * len;
    const p = el.getPointAtLength(at);
    const q = el.getPointAtLength(Math.min(len, at + 6));
    const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + 90;
    setGeo({ len, x: p.x, y: p.y, angle });
  }, [progress]);

  const zoom = ZOOM[variant];
  const frame = `translate(${FOCUS_X - geo.x * zoom} ${FOCUS_Y - geo.y * zoom}) scale(${zoom})`;
  const showLabels = variant !== 'card';

  return (
    <div className={`mapcanvas mapcanvas--${variant} ${className}`}>
      <svg viewBox={`0 0 ${VIEW_W} 600`} className="mapcanvas__svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect x="0" y="0" width={VIEW_W} height="600" className="map-land" />
        <g transform={frame} className="map-world">
          <path d={WADI} className="map-water" />
          <path d={PARK} className="map-park" />

          {BLOCKS.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              className={b.light ? 'map-block map-block--light' : 'map-block'}
            />
          ))}

          <g className="map-local">
            {LOCAL_H.map((y) => <line key={`lh${y}`} x1={WORLD.x0} y1={y} x2={WORLD.x1} y2={y} />)}
            {LOCAL_V.map((x) => <line key={`lv${x}`} x1={x} y1={WORLD.y0} x2={x} y2={WORLD.y1} />)}
          </g>

          <g className="map-collectors">
            {COLLECTORS_H.map((y) => <line key={`ch${y}`} x1={WORLD.x0} y1={y} x2={WORLD.x1} y2={y} />)}
            {COLLECTORS_V.map((x) => <line key={`cv${x}`} x1={x} y1={WORLD.y0} x2={x} y2={WORLD.y1} />)}
          </g>

          <g className="map-arterials">
            {ARTERIALS_H.map((y) => <line key={`ah${y}`} x1={WORLD.x0} y1={y} x2={WORLD.x1} y2={y} />)}
            {ARTERIALS_V.map((x) => <line key={`av${x}`} x1={x} y1={WORLD.y0} x2={x} y2={WORLD.y1} />)}
          </g>

          {showLabels && (
            <g className="map-labels">
              {LABELS.map((l) => (
                <text key={l.text} x={l.x} y={l.y} fontSize={l.size} textAnchor="middle">{l.text}</text>
              ))}
            </g>
          )}

          {/* Route: a bright neutral core inside an accent halo. Red is
              the trim around the line, never the line itself — a solid
              red route on a dark map reads as a warning. */}
          <path ref={pathRef} d={ROUTE_PATH} className="map-route-probe" />
          {routeActive && geo.len > 0 && (
            <>
              <path d={ROUTE_PATH} className="map-route-halo" />
              <path d={ROUTE_PATH} className="map-route-done" />
              <path
                d={ROUTE_PATH}
                className="map-route"
                strokeDasharray={geo.len}
                strokeDashoffset={-geo.len * Math.max(0, Math.min(1, progress))}
              />
              <g className="map-dest">
                <circle cx="862" cy="206" r="13" className="map-dest__ring" />
                <circle cx="862" cy="206" r="5.5" className="map-dest__core" />
              </g>
            </>
          )}

          <g transform={`translate(${geo.x} ${geo.y}) rotate(${geo.angle})`} className="map-vehicle">
            <circle r="14" className="map-vehicle__halo" />
            <path d="M0 -12 L8.5 9.5 L0 4.8 L-8.5 9.5 Z" className="map-vehicle__arrow" />
          </g>
        </g>
      </svg>

    </div>
  );
}
