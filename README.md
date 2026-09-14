# MUSTANG — Infotainment HMI

An interactive prototype of an ultra-wide Android head-unit interface for a Ford
Mustang. Arabic RTL. Designed for **2400×900** (2.67:1) as the primary panel;
1920×720, 1920×1080, 1600×720 and 1280×720 are compatibility targets.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Structure

```
src/
  styles/tokens.css    primitives — spacing, radius, type, motion, touch sizes
  styles/themes.css    semantic tokens per theme × day/night. Themes change
                       tokens only; they never change layout.
  styles/base.css      reset, typography classes, material primitives
  system/icons.tsx     one icon family: 24 grid, 1.6 stroke
  system/format.ts     Arabic-aware time, distance, duration, monogram
  state/types.ts       domain types
  state/demoData.ts    all fabricated data, isolated from the UI
  state/systemStore.tsx  one reducer + one 1 Hz simulation tick
  components/          shell chrome and shared primitives
  screens/             the seven navigation destinations
```

## Two structural decisions

**The map is mounted once.** `components/MapStage.tsx` lives in the shell and
never unmounts; screens declare a placement and the stage animates between
them. Home → Navigation therefore grows the canvas the driver is already
looking at instead of swapping pages.

**The screen does not duplicate the console.** The physical centre stack
carries volume, tuning, transport and climate switchgear, so none of it has a
permanent software copy. The bottom zone holds only what software owns: the
drivetrain readout and the media handle.

There is no router: a head-unit launcher has a fixed set of destinations, so
the current screen is one field in the store and the shell mounts it directly.

## Touch geometry

1rem is the system's dp. Anything a driver may reach for while moving is
`--touch-lg` (76dp) or larger; the visible glyph stays small, the hit region
does not. `--touch-sm` (52dp) is reserved for parked-only surfaces.

## Startup

A ~2.4s sequence from black to Home: the panel wakes, the pony crosses frame,
the tri-bar lights outward, the wordmark and greeting settle. Skippable by
touch and switchable off in Settings, along with the greeting and its text.
Audio is out of scope for the web prototype — no autoplay is attempted.

## Bench controls

Deterministic demo states for design review and QA. Press `` ` `` or `Ctrl+D`,
or long-press the MUSTANG wordmark. Stripped from production builds.

Scenarios: parked · idle · driving · navigating · incoming call.

## What is simulated

Everything. Navigation, media, contacts, call log and all vehicle telemetry are
demo data driven by the tick in `systemStore.tsx`. Drivetrain state (P R N D) is
rendered as a read-only readout with `pointer-events: none` and no handler — the
screen never presents a safety-critical control.

## Notes for an Android Automotive port

- No `color-mix()`, no `backdrop-filter`, no WebGL, no canvas — the build targets
  Chrome 87 for older Automotive WebViews.
- Fonts are self-hosted (`public/fonts/`), so the unit needs no network.
- The map is one SVG with a car-following transform; only the vehicle transform
  and the route dash offset change per tick.
- Replace `state/demoData.ts` and the tick with the vehicle HAL, MediaSession
  and a navigation provider; the UI reads only from the store.
