/* ============================================================
   SYSTEM STORE
   One reducer, one 1 Hz simulation tick. State and dispatch are
   exposed through separate contexts so control surfaces that only
   dispatch never re-render on the tick.
   ============================================================ */

import {
  createContext, useContext, useEffect, useMemo, useReducer, useRef,
  type Dispatch, type ReactNode,
} from 'react';
import {
  CONTACTS, DESTINATIONS, INCOMING_CONTACT_ID, ROUTE_STEPS, TRACKS,
} from './demoData';
import type {
  Appearance, ColorMode, Destination, DriveMode, Gear, RailSide,
  ScreenId, SystemState, ThemeName,
} from './types';

/* ---------- Demo scenarios ---------------------------------------
   Deterministic, named states used by the developer panel and by
   the keyboard shortcuts during bench testing. */
export type ScenarioId =
  | 'idle' | 'driving' | 'navigating' | 'incoming-call' | 'parked';

const HOME_DEST = DESTINATIONS[0];
const TOTAL_ROUTE_KM = HOME_DEST.distanceKm;

const initialVehicle = (): SystemState['vehicle'] => ({
  gear: 'P',
  speedKph: 0,
  driveMode: 'normal',
  fuelPct: 62,
  rangeKm: 418,
  voltage: 14.2,
  coolantC: 88,
  oilC: 96,
  outsideC: 34,
  odometerKm: 24_318,
  tires: [
    { position: 'fl', psi: 35.2, tempC: 41 },
    { position: 'fr', psi: 35.0, tempC: 42 },
    { position: 'rl', psi: 33.4, tempC: 39 },
    { position: 'rr', psi: 34.9, tempC: 40 },
  ],
  trip: { distanceKm: 142.7, avgKmL: 9.4, durationMin: 118, avgSpeed: 72 },
  rpm: 0,
});

function loadSettings(): SystemState['settings'] {
  const hour = new Date().getHours();
  const base: SystemState['settings'] = {
    theme: 'stealth',
    appearance: 'auto',
    railSide: 'left', // LHD market: nearest the driver
    ambientDaylight: hour >= 6 && hour < 18,
    reduceMotion: false,
    chimeVolume: 4,
    driverAlerts: true,
    startupOn: true,
    greetingOn: true,
    greetingText: 'مرحباً حسن',
  };
  try {
    const raw = localStorage.getItem('mustang.settings');
    return raw ? { ...base, ...JSON.parse(raw) } : base;
  } catch {
    return base;
  }
}

export const initialState: SystemState = {
  screen: 'home',
  clock: 0,
  vehicle: initialVehicle(),
  climate: { driverC: 21.5, passengerC: 22, fan: 3, sync: true, ac: true, seatHeatDriver: 0 },
  media: {
    playing: true, trackIndex: 0, positionSec: 74, shuffle: false, repeat: 'all',
    volume: 14, muted: false, favorites: ['tr-01', 'tr-05'], source: 'bluetooth',
  },
  nav: {
    active: false, destination: null, steps: ROUTE_STEPS, stepIndex: 0,
    toManeuverM: ROUTE_STEPS[0].distanceM, remainingKm: TOTAL_ROUTE_KM,
    etaMin: HOME_DEST.etaMin, progress: 0,
  },
  phone: { status: 'idle', contactId: null, durationSec: 0, muted: false, speaker: false },
  settings: loadSettings(),
  blockedApp: null,
  devPanelOpen: false,
};

export type Action =
  | { type: 'navigate'; screen: ScreenId }
  | { type: 'tick' }
  | { type: 'set-theme'; theme: ThemeName }
  | { type: 'set-appearance'; appearance: Appearance }
  | { type: 'set-rail-side'; side: RailSide }
  | { type: 'set-ambient'; daylight: boolean }
  | { type: 'set-setting'; key: 'reduceMotion' | 'driverAlerts' | 'startupOn' | 'greetingOn'; value: boolean }
  | { type: 'set-greeting-text'; value: string }
  | { type: 'set-chime'; value: number }
  | { type: 'set-drive-mode'; mode: DriveMode }
  | { type: 'set-gear'; gear: Gear }
  | { type: 'media-toggle' }
  | { type: 'media-step'; delta: 1 | -1 }
  | { type: 'media-select'; index: number }
  | { type: 'media-seek'; ratio: number }
  | { type: 'media-volume'; delta: number }
  | { type: 'media-set-volume'; value: number }
  | { type: 'media-mute' }
  | { type: 'media-shuffle' }
  | { type: 'media-repeat' }
  | { type: 'media-favorite'; id: string }
  | { type: 'nav-start'; destination: Destination }
  | { type: 'nav-end' }
  | { type: 'nav-advance' }
  | { type: 'call-incoming' }
  | { type: 'call-accept' }
  | { type: 'call-decline' }
  | { type: 'call-dial'; contactId: string }
  | { type: 'call-end' }
  | { type: 'call-mute' }
  | { type: 'call-speaker' }
  | { type: 'climate-temp'; seat: 'driver' | 'passenger'; delta: number }
  | { type: 'climate-fan'; delta: number }
  | { type: 'climate-toggle'; key: 'sync' | 'ac' }
  | { type: 'climate-seat' }
  | { type: 'block-app'; id: string }
  | { type: 'clear-block' }
  | { type: 'dev-toggle' }
  | { type: 'scenario'; id: ScenarioId };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Cruise target per drive mode — the tick eases toward this. */
const TARGET_SPEED: Record<DriveMode, number> = {
  normal: 88, sport: 104, track: 118, wet: 74,
};

function advanceMedia(s: SystemState, delta: 1 | -1): SystemState {
  const next = (s.media.trackIndex + delta + TRACKS.length) % TRACKS.length;
  return { ...s, media: { ...s.media, trackIndex: next, positionSec: 0, playing: true } };
}

function tick(s: SystemState): SystemState {
  const next: SystemState = { ...s, clock: s.clock + 1 };
  const v = { ...s.vehicle };
  const moving = v.gear === 'D' || v.gear === 'R';

  /* --- Powertrain ------------------------------------------------ */
  if (moving) {
    // Deterministic drift so the demo never looks like a random walk.
    const target = TARGET_SPEED[v.driveMode] + Math.sin(next.clock / 17) * 7;
    v.speedKph = round1(v.speedKph + (target - v.speedKph) * 0.08);
    v.rpm = Math.round(900 + v.speedKph * 21 + Math.sin(next.clock / 9) * 120);
    v.fuelPct = Math.max(0, round1(v.fuelPct - 0.0035));
    v.rangeKm = Math.round(v.fuelPct * 6.9);
    v.odometerKm = round1(v.odometerKm + v.speedKph / 3600);
    v.trip = {
      ...v.trip,
      distanceKm: round1(v.trip.distanceKm + v.speedKph / 3600),
      durationMin: round1(v.trip.durationMin + 1 / 60),
    };
    v.coolantC = clamp(round1(v.coolantC + (94 - v.coolantC) * 0.02), 60, 118);
    v.oilC = clamp(round1(v.oilC + (104 - v.oilC) * 0.015), 60, 132);
  } else {
    v.speedKph = round1(Math.max(0, v.speedKph - 6));
    v.rpm = v.gear === 'P' || v.gear === 'N' ? 720 + Math.round(Math.sin(next.clock / 6) * 25) : v.rpm;
    v.coolantC = clamp(round1(v.coolantC + (86 - v.coolantC) * 0.01), 60, 118);
  }
  v.voltage = round1(13.9 + Math.sin(next.clock / 23) * 0.35);
  next.vehicle = v;

  /* --- Media ----------------------------------------------------- */
  if (s.media.playing) {
    const track = TRACKS[s.media.trackIndex];
    const pos = s.media.positionSec + 1;
    if (pos >= track.durationSec) {
      const idx = s.media.repeat === 'one'
        ? s.media.trackIndex
        : (s.media.trackIndex + 1) % TRACKS.length;
      next.media = { ...s.media, trackIndex: idx, positionSec: 0 };
    } else {
      next.media = { ...s.media, positionSec: pos };
    }
  }

  /* --- Guidance -------------------------------------------------- */
  if (s.nav.active && moving) {
    const metresPerSec = (v.speedKph * 1000) / 3600;
    let toManeuver = s.nav.toManeuverM - metresPerSec;
    let stepIndex = s.nav.stepIndex;
    const remainingKm = Math.max(0, round1(s.nav.remainingKm - metresPerSec / 1000));

    if (toManeuver <= 0) {
      if (stepIndex < s.nav.steps.length - 1) {
        stepIndex += 1;
        toManeuver = s.nav.steps[stepIndex].distanceM;
      } else {
        toManeuver = 0;
      }
    }
    next.nav = {
      ...s.nav,
      stepIndex,
      toManeuverM: Math.max(0, Math.round(toManeuver)),
      remainingKm,
      etaMin: Math.max(1, Math.round((remainingKm / Math.max(28, v.speedKph)) * 60)),
      progress: clamp(1 - remainingKm / TOTAL_ROUTE_KM, 0, 1),
    };
  }

  /* --- Call ------------------------------------------------------ */
  if (s.phone.status === 'active') {
    next.phone = { ...s.phone, durationSec: s.phone.durationSec + 1 };
  }

  return next;
}

function applyScenario(s: SystemState, id: ScenarioId): SystemState {
  const base: SystemState = {
    ...s,
    blockedApp: null,
    phone: { status: 'idle', contactId: null, durationSec: 0, muted: false, speaker: false },
  };
  switch (id) {
    case 'parked':
      return {
        ...base,
        vehicle: { ...base.vehicle, gear: 'P', speedKph: 0, rpm: 0 },
        nav: { ...base.nav, active: false },
      };
    case 'idle':
      return {
        ...base,
        vehicle: { ...base.vehicle, gear: 'D', speedKph: 46 },
        nav: { ...base.nav, active: false },
      };
    case 'driving':
      return { ...base, vehicle: { ...base.vehicle, gear: 'D', speedKph: 92 } };
    case 'navigating':
      return {
        ...base,
        vehicle: { ...base.vehicle, gear: 'D', speedKph: 88 },
        nav: {
          ...base.nav, active: true, destination: HOME_DEST, stepIndex: 1,
          toManeuverM: 780, remainingKm: 11.2, etaMin: 13, progress: 0.39,
        },
      };
    case 'incoming-call':
      return {
        ...base,
        vehicle: { ...base.vehicle, gear: 'D', speedKph: 86 },
        phone: { status: 'incoming', contactId: INCOMING_CONTACT_ID, durationSec: 0, muted: false, speaker: false },
      };
    default:
      return base;
  }
}

export function reducer(s: SystemState, a: Action): SystemState {
  switch (a.type) {
    case 'tick': return tick(s);
    case 'navigate': return s.screen === a.screen ? s : { ...s, screen: a.screen, blockedApp: null };

    /* Settings */
    case 'set-theme': return { ...s, settings: { ...s.settings, theme: a.theme } };
    case 'set-appearance': return { ...s, settings: { ...s.settings, appearance: a.appearance } };
    case 'set-rail-side': return { ...s, settings: { ...s.settings, railSide: a.side } };
    case 'set-ambient': return { ...s, settings: { ...s.settings, ambientDaylight: a.daylight } };
    case 'set-setting': return { ...s, settings: { ...s.settings, [a.key]: a.value } };
    case 'set-chime': return { ...s, settings: { ...s.settings, chimeVolume: clamp(a.value, 0, 7) } };
    case 'set-greeting-text':
      return { ...s, settings: { ...s.settings, greetingText: a.value.slice(0, 40) } };

    /* Vehicle */
    case 'set-drive-mode': return { ...s, vehicle: { ...s.vehicle, driveMode: a.mode } };
    case 'set-gear': return { ...s, vehicle: { ...s.vehicle, gear: a.gear } };

    /* Media */
    case 'media-toggle': return { ...s, media: { ...s.media, playing: !s.media.playing } };
    case 'media-step': return advanceMedia(s, a.delta);
    case 'media-select':
      return { ...s, media: { ...s.media, trackIndex: a.index, positionSec: 0, playing: true } };
    case 'media-seek': {
      const dur = TRACKS[s.media.trackIndex].durationSec;
      return { ...s, media: { ...s.media, positionSec: Math.round(clamp(a.ratio, 0, 1) * dur) } };
    }
    case 'media-volume':
      return { ...s, media: { ...s.media, volume: clamp(s.media.volume + a.delta, 0, 30), muted: false } };
    case 'media-set-volume':
      return { ...s, media: { ...s.media, volume: clamp(Math.round(a.value), 0, 30), muted: false } };
    case 'media-mute': return { ...s, media: { ...s.media, muted: !s.media.muted } };
    case 'media-shuffle': return { ...s, media: { ...s.media, shuffle: !s.media.shuffle } };
    case 'media-repeat': {
      const order = ['off', 'all', 'one'] as const;
      const idx = (order.indexOf(s.media.repeat) + 1) % order.length;
      return { ...s, media: { ...s.media, repeat: order[idx] } };
    }
    case 'media-favorite': {
      const has = s.media.favorites.includes(a.id);
      return {
        ...s,
        media: {
          ...s.media,
          favorites: has
            ? s.media.favorites.filter((f) => f !== a.id)
            : [...s.media.favorites, a.id],
        },
      };
    }

    /* Guidance */
    case 'nav-start':
      return {
        ...s,
        screen: 'nav',
        nav: {
          ...s.nav, active: true, destination: a.destination, stepIndex: 0,
          toManeuverM: s.nav.steps[0].distanceM, remainingKm: a.destination.distanceKm,
          etaMin: a.destination.etaMin, progress: 0,
        },
      };
    case 'nav-end':
      return {
        ...s,
        nav: {
          ...s.nav, active: false, destination: null, stepIndex: 0,
          toManeuverM: s.nav.steps[0].distanceM, remainingKm: TOTAL_ROUTE_KM, progress: 0,
        },
      };
    case 'nav-advance': {
      const stepIndex = Math.min(s.nav.stepIndex + 1, s.nav.steps.length - 1);
      return {
        ...s,
        nav: { ...s.nav, stepIndex, toManeuverM: s.nav.steps[stepIndex].distanceM },
      };
    }

    /* Phone */
    case 'call-incoming':
      return {
        ...s,
        phone: { status: 'incoming', contactId: INCOMING_CONTACT_ID, durationSec: 0, muted: false, speaker: false },
      };
    case 'call-accept':
      return { ...s, phone: { ...s.phone, status: 'active', durationSec: 0 } };
    case 'call-dial':
      return {
        ...s, screen: 'phone',
        phone: { status: 'active', contactId: a.contactId, durationSec: 0, muted: false, speaker: false },
      };
    case 'call-decline':
    case 'call-end':
      return {
        ...s,
        phone: { status: 'idle', contactId: null, durationSec: 0, muted: false, speaker: false },
      };
    case 'call-mute': return { ...s, phone: { ...s.phone, muted: !s.phone.muted } };
    case 'call-speaker': return { ...s, phone: { ...s.phone, speaker: !s.phone.speaker } };

    /* Climate */
    case 'climate-temp': {
      const c = { ...s.climate };
      if (a.seat === 'driver' || c.sync) c.driverC = clamp(round1(c.driverC + a.delta), 16, 30);
      if (a.seat === 'passenger' || c.sync) c.passengerC = clamp(round1(c.passengerC + a.delta), 16, 30);
      return { ...s, climate: c };
    }
    case 'climate-fan':
      return { ...s, climate: { ...s.climate, fan: clamp(s.climate.fan + a.delta, 0, 7) } };
    case 'climate-toggle':
      return { ...s, climate: { ...s.climate, [a.key]: !s.climate[a.key] } };
    case 'climate-seat':
      return { ...s, climate: { ...s.climate, seatHeatDriver: ((s.climate.seatHeatDriver + 1) % 4) as 0 | 1 | 2 | 3 } };

    /* Safety + dev */
    case 'block-app': return { ...s, blockedApp: a.id };
    case 'clear-block': return { ...s, blockedApp: null };
    case 'dev-toggle': return { ...s, devPanelOpen: !s.devPanelOpen };
    case 'scenario': return applyScenario(s, a.id);
    default: return s;
  }
}

const StateContext = createContext<SystemState>(initialState);
const DispatchContext = createContext<Dispatch<Action>>(() => undefined);

export function SystemProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const settingsRef = useRef(state.settings);
  settingsRef.current = state.settings;

  /* Single 1 Hz simulation clock for the whole system. */
  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => window.clearInterval(id);
  }, []);

  /* Bench hook: lets the screenshot/QA harness drive deterministic
     scenarios. Stripped from production builds by the DEV guard. */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __hmi?: unknown }).__hmi = { dispatch };
  }, []);

  /* Persist user preferences the way a head unit would. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem('mustang.settings', JSON.stringify(settingsRef.current));
      } catch { /* storage unavailable — preferences stay session-only */ }
    }, 400);
    return () => window.clearTimeout(id);
  }, [state.settings]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export const useSystem = () => useContext(StateContext);
export const useDispatch = () => useContext(DispatchContext);

/* ---------- Derived selectors ------------------------------------ */

export function useDerived() {
  const s = useSystem();
  return useMemo(() => {
    const parked = s.vehicle.gear === 'P';
    const moving = !parked && s.vehicle.speedKph > 3;
    const colorMode: ColorMode =
      s.settings.appearance === 'auto'
        ? (s.settings.ambientDaylight ? 'day' : 'night')
        : s.settings.appearance;
    /* A call never takes the hero: it docks as a banner below, so route
       guidance stays on screen exactly as it was. */
    const homeContext: 'nav' | 'parked' | 'idle' =
      s.nav.active ? 'nav' : parked ? 'parked' : 'idle';
    return { parked, moving, colorMode, homeContext };
  }, [s.vehicle.gear, s.vehicle.speedKph, s.settings.appearance, s.settings.ambientDaylight, s.nav.active]);
}

export const useTrack = () => {
  const { media } = useSystem();
  return TRACKS[media.trackIndex];
};

export const contactById = (id: string | null) =>
  CONTACTS.find((c) => c.id === id) ?? null;
