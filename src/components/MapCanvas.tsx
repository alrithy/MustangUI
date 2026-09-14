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
   Riyadh's north grid: long arterials, a finer street mesh between
   them, and superblocks that vary just enough to not read as graph
   paper. */
const WORLD = { x0: -700, x1: 1700, y0: -400, y1: 1100 };

const ARTERIALS_H = [-240, 160, 262, 348, 448, 548, 760, 980];
const ARTERIALS_V = [-460, -180, 118, 214, 486, 742, 862, 1160, 1460];

function buildStreets() {
  const h: number[] = [];
  const v: number[] = [];
  for (let y = WORLD.y0; y <= WORLD.y1; y += 44) {
    if (!ARTERIALS_H.some((a) => Math.abs(a - y) < 26)) h.push(y);
  }
  for (let x = WORLD.x0; x <= WORLD.x1; x += 62) {
    if (!ARTERIALS_V.some((a) => Math.abs(a - x) < 30)) v.push(x);
  }
  return { h, v };
}
const STREETS = buildStreets();

/* Deterministic block field — a seeded hash, so the city is identical
   on every load and nothing animates. */
function buildBlocks() {
  const cells: Array<[number, number, number, number]> = [];
  let seed = 20250913;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const xs = [...ARTERIALS_V, ...STREETS.v].sort((a, b) => a - b);
  const ys = [...ARTERIALS_H, ...STREETS.h].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const w = xs[i + 1] - xs[i];
      const h = ys[j + 1] - ys[j];
      if (w < 20 || h < 18) continue;
      const r = rand();
      if (r < 0.2) continue; // open lots keep the grid from reading as tile
      const inset = 4 + r * 9;
      const trimX = r > 0.72 ? w * 0.34 : 0;   // half-built blocks
      const trimY = r > 0.86 ? h * 0.3 : 0;
      cells.push([
        xs[i] + inset,
        ys[j] + inset,
        Math.max(6, w - inset * 2 - trimX),
        Math.max(6, h - inset * 2 - trimY),
      ]);
    }
  }
  return cells;
}
const BLOCKS = buildBlocks();

/* Wadi Hanifa: the one organic edge in an orthogonal city. */
const WADI =
  'M-700 620 C -420 596, -180 520, 60 470 C 300 420, 430 372, 600 300 ' +
  'C 790 220, 980 190, 1240 150 C 1420 122, 1560 118, 1700 108 ' +
  'L 1700 -400 L -700 -400 Z';

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

          {BLOCKS.map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} className="map-block" />
          ))}

          <g className="map-streets">
            {STREETS.h.map((y) => <line key={`sh${y}`} x1={WORLD.x0} y1={y} x2={WORLD.x1} y2={y} />)}
            {STREETS.v.map((x) => <line key={`sv${x}`} x1={x} y1={WORLD.y0} x2={x} y2={WORLD.y1} />)}
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
