/* ============================================================
   MAP CANVAS
   A lightweight vector map: no tiles, no canvas, no WebGL, and no
   per-frame work — the whole surface is one SVG whose only moving
   parts are the vehicle transform and the route dash offset.

   The world is drawn once in a fixed coordinate space and then
   translated so the vehicle always sits at the same focal point.
   That keeps the map correct at every panel aspect ratio without
   measuring the container.

   This is a prototype visualisation, not a navigation engine. The
   native build will render through a real maps SDK; what this has
   to do is stop reading as graph paper, which means three things:
   roads that start and stop instead of running edge to edge, a
   block fabric with genuine variation in grain, and a small number
   of non-orthogonal features to break the lattice.
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

const WORLD = { x0: -900, x1: 1900, y0: -600, y1: 1300 };

/* Seeded so the city is identical on every load and nothing animates. */
let seed = 20250914;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

/** Irregular line positions: a base pitch with up to `jitter` drift. */
function lattice(from: number, to: number, pitch: number, jitter: number) {
  const out: number[] = [];
  let v = from;
  while (v < to) {
    out.push(Math.round(v));
    v += pitch * (1 - jitter + rand() * jitter * 2);
  }
  return out;
}

/* --- Road network ------------------------------------------------
   Four classes. Arterials are the frame and carry the names; the
   ring road and one diagonal expressway cut across it; collectors
   run between arterials in runs of a few blocks, so the network is
   full of T-junctions instead of a continuous mesh; local streets
   exist only inside a block and never line up across one. */
const ARTERIALS_H = [-240, 160, 348, 548, 860];
const ARTERIALS_V = [-380, 118, 486, 862, 1320];

interface Seg { x1: number; y1: number; x2: number; y2: number }

/** Arterials drift a little off true, so long runs are never dead straight. */
function arterialPath(at: number, horizontal: boolean) {
  const from = horizontal ? WORLD.x0 : WORLD.y0;
  const to = horizontal ? WORLD.x1 : WORLD.y1;
  const stops = lattice(from, to, 520, 0.2);
  stops.push(to);
  let d = '';
  stops.forEach((s, i) => {
    const drift = at + (i === 0 || i === stops.length - 1 ? 0 : (rand() - 0.5) * 26);
    const [x, y] = horizontal ? [s, drift] : [drift, s];
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  return d;
}
const ARTERIAL_PATHS = [
  ...ARTERIALS_H.map((y) => arterialPath(y, true)),
  ...ARTERIALS_V.map((x) => arterialPath(x, false)),
];

/* One expressway on the diagonal and one arc of ring road: the two
   features that stop the fabric reading as a mesh. */
const EXPRESSWAY =
  'M -900 1020 C -520 900, -230 760, 40 620 C 330 470, 560 330, 820 160 ' +
  'C 1040 16, 1240 -120, 1420 -260';
const RING =
  'M 1900 760 C 1640 700, 1430 560, 1330 360 C 1240 178, 1210 -20, 1236 -240';

const COLLECTORS_H = lattice(WORLD.y0, WORLD.y1, 112, 0.38)
  .filter((y) => !ARTERIALS_H.some((a) => Math.abs(a - y) < 48));
const COLLECTORS_V = lattice(WORLD.x0, WORLD.x1, 136, 0.38)
  .filter((x) => !ARTERIALS_V.some((a) => Math.abs(a - x) < 56));

/** Break a full-length line into two or three runs that stop on an
    arterial, leaving gaps where a real street would not continue. */
function runs(at: number, crossings: number[], horizontal: boolean): Seg[] {
  const bounds = [horizontal ? WORLD.x0 : WORLD.y0, ...crossings, horizontal ? WORLD.x1 : WORLD.y1];
  const out: Seg[] = [];
  let i = 0;
  while (i < bounds.length - 1) {
    const span = 1 + Math.floor(rand() * 2);          // 1–2 arterial bays
    const j = Math.min(bounds.length - 1, i + span);
    if (rand() > 0.24) {                              // occasionally the street simply is not there
      const a = bounds[i] + (i === 0 ? 0 : (rand() - 0.5) * 40);
      const b = bounds[j] - (j === bounds.length - 1 ? 0 : (rand() - 0.5) * 40);
      out.push(horizontal ? { x1: a, y1: at, x2: b, y2: at } : { x1: at, y1: a, x2: at, y2: b });
    }
    i = j;
  }
  return out;
}
const COLLECTOR_SEGS: Seg[] = [
  ...COLLECTORS_H.flatMap((y) => runs(y, ARTERIALS_V, true)),
  ...COLLECTORS_V.flatMap((x) => runs(x, ARTERIALS_H, false)),
];

/* --- Block fabric ------------------------------------------------
   Cells come from the arterial/collector lattice, then each cell is
   subdivided on its own terms: some carry a fine grain of narrow
   plots, some a couple of large footprints, some a single compound,
   and a fair number stay open. Nothing repeats at a fixed pitch,
   which is what kills the rectangular rhythm. */
interface Block { x: number; y: number; w: number; h: number; tone: 0 | 1 | 2 }
interface LocalSeg extends Seg { }

const BLOCKS: Block[] = [];
const LOCALS: LocalSeg[] = [];

function fillCell(x: number, y: number, w: number, h: number) {
  const r = rand();
  if (w < 20 || h < 18) return;
  if (r < 0.14) return;                                   // open lot, yard, sand

  if (r < 0.34 && w > 120 && h > 90) {                    // compound / mall / school
    const inset = 8 + rand() * 14;
    BLOCKS.push({ x: x + inset, y: y + inset, w: w - inset * 2, h: h - inset * 2, tone: rand() > 0.62 ? 2 : 1 });
    return;
  }

  if (r < 0.72 && (w > 80 || h > 70)) {                   // fine grain of plots
    const along = w >= h;
    const n = 2 + Math.floor(rand() * 3);
    const pad = 5 + rand() * 6;
    for (let k = 0; k < n; k += 1) {
      const t0 = k / n, t1 = (k + 1) / n;
      if (rand() < 0.2) continue;                         // a gap in the terrace
      const bx = along ? x + w * t0 + pad : x + pad;
      const by = along ? y + pad : y + h * t0 + pad;
      const bw = along ? w * (t1 - t0) - pad * 1.7 : w - pad * 2;
      const bh = along ? h - pad * 2 : h * (t1 - t0) - pad * 1.7;
      const short = rand() < 0.3 ? 0.55 + rand() * 0.3 : 1;
      BLOCKS.push({
        x: bx, y: by,
        w: Math.max(6, along ? bw : bw * short),
        h: Math.max(6, along ? bh * short : bh),
        tone: rand() > 0.9 ? 2 : 0,
      });
    }
    // A service street through the middle of a terraced block.
    if (rand() < 0.42) {
      LOCALS.push(along
        ? { x1: x + 4, y1: y + h / 2, x2: x + w - 4, y2: y + h / 2 }
        : { x1: x + w / 2, y1: y + 4, x2: x + w / 2, y2: y + h - 4 });
    }
    return;
  }

  // Two or three footprints of clearly different size.
  const n = 2 + Math.floor(rand() * 2);
  for (let k = 0; k < n; k += 1) {
    const bw = w * (0.24 + rand() * 0.4);
    const bh = h * (0.24 + rand() * 0.44);
    BLOCKS.push({
      x: x + 6 + rand() * Math.max(1, w - bw - 12),
      y: y + 6 + rand() * Math.max(1, h - bh - 12),
      w: Math.max(6, bw), h: Math.max(6, bh),
      tone: rand() > 0.88 ? 2 : 0,
    });
  }
}

(function buildFabric() {
  const xs = [...ARTERIALS_V, ...COLLECTORS_V].sort((a, b) => a - b);
  const ys = [...ARTERIALS_H, ...COLLECTORS_H].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      fillCell(xs[i] + 7, ys[j] + 7, xs[i + 1] - xs[i] - 14, ys[j + 1] - ys[j] - 14);
    }
  }
})();

/* Wadi Hanifa, two parks and an interchange: the non-orthogonal set. */
const WADI =
  'M-900 700 C -560 672, -240 590, 60 520 C 360 450, 520 392, 700 300 ' +
  'C 900 196, 1150 150, 1460 104 C 1660 74, 1800 66, 1900 58 ' +
  'L 1900 -18 C 1760 -8, 1620 0, 1440 26 C 1130 72, 880 118, 680 222 ' +
  'C 500 314, 340 372, 40 442 C -250 512, -570 594, -900 622 Z';
const PARKS = [
  'M236 600 C 300 586, 392 584, 470 598 C 486 654, 478 714, 452 748 ' +
  'C 372 760, 292 754, 232 736 C 222 692, 224 640, 236 600 Z',
  'M902 470 C 962 458, 1028 462, 1066 478 C 1074 520, 1066 558, 1044 580 ' +
  'C 986 590, 928 584, 896 570 C 888 532, 892 496, 902 470 Z',
];

/* Labels are placed on the roads they name and sit at two levels:
   districts read first, street names second. Fewer, larger, and
   never stacked on top of a route. */
const LABELS: Array<{ x: number; y: number; text: string; rank: 1 | 2; rotate?: number }> = [
  { x: 250, y: 292, text: 'العليا', rank: 1 },
  { x: 672, y: 430, text: 'الصحافة', rank: 1 },
  { x: 1004, y: 268, text: 'الملقا', rank: 1 },
  { x: 330, y: 646, text: 'السليمانية', rank: 1 },
  { x: 836, y: 690, text: 'حطين', rank: 1 },
  { x: 690, y: 148, text: 'طريق الملك سلمان', rank: 2 },
  { x: 286, y: 338, text: 'طريق الملك عبدالله', rank: 2 },
  { x: 566, y: 536, text: 'طريق الملك فهد', rank: 2 },
  { x: 1150, y: 470, text: 'الدائري الشمالي', rank: 2, rotate: -74 },
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
          {PARKS.map((d, i) => <path key={i} d={d} className="map-park" />)}

          {BLOCKS.map((b, i) => (
            <rect
              key={i}
              x={b.x} y={b.y} width={b.w} height={b.h}
              className={b.tone === 0 ? 'map-block' : b.tone === 1 ? 'map-block--mid' : 'map-block--light'}
            />
          ))}

          <g className="map-local">
            {LOCALS.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />)}
          </g>

          <g className="map-collectors">
            {COLLECTOR_SEGS.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />)}
          </g>

          <g className="map-arterials">
            {ARTERIAL_PATHS.map((d, i) => <path key={i} d={d} />)}
          </g>

          {/* Grade-separated roads sit above the surface network. */}
          <g className="map-express">
            <path d={EXPRESSWAY} className="map-express__case" />
            <path d={RING} className="map-express__case" />
            <path d={EXPRESSWAY} />
            <path d={RING} />
          </g>

          {showLabels && (
            <g className="map-labels">
              {LABELS.map((l) => (
                <text
                  key={l.text}
                  x={l.x} y={l.y}
                  className={l.rank === 1 ? 'map-label--district' : 'map-label--street'}
                  textAnchor="middle"
                  transform={l.rotate ? `rotate(${l.rotate} ${l.x} ${l.y})` : undefined}
                >
                  {l.text}
                </text>
              ))}
            </g>
          )}

          {/* Route: a bright neutral core inside an accent halo. Red is
              the trim around the line, never the line itself — a solid
              red route on a dark map reads as a warning. */}
          <path ref={pathRef} d={ROUTE_PATH} className="map-route-probe" />
          {routeActive && geo.len > 0 && (
            <>
              <path d={ROUTE_PATH} className="map-route-case" />
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
            <circle r="15" className="map-vehicle__halo" />
            <path d="M0 -13 L9 10.5 L0 5.2 L-9 10.5 Z" className="map-vehicle__arrow" />
          </g>
        </g>
      </svg>
    </div>
  );
}
