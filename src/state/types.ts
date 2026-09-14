/* Domain types for the HMI. All vehicle values here are simulated;
   see state/systemStore.tsx for the demo tick that drives them. */

export type ScreenId =
  | 'home'
  | 'nav'
  | 'music'
  | 'phone'
  | 'apps'
  | 'car'
  | 'settings';

export type ThemeName = 'stealth' | 'gt' | 'night';
export type Appearance = 'auto' | 'day' | 'night';
export type ColorMode = 'day' | 'night';
export type DriveMode = 'normal' | 'sport' | 'track' | 'wet';
export type Gear = 'P' | 'R' | 'N' | 'D';
/** Physical side of the panel, chosen for driver proximity (LHD/RHD). */
export type RailSide = 'left' | 'right';

/** Maneuver vocabulary the guidance panel can render. */
export type ManeuverKind =
  | 'straight'
  | 'turn-right'
  | 'turn-left'
  | 'slight-right'
  | 'slight-left'
  | 'exit-right'
  | 'roundabout'
  | 'merge'
  | 'destination';

export interface RouteStep {
  id: string;
  kind: ManeuverKind;
  /** Arabic road name for the maneuver, e.g. طريق الملك فهد */
  road: string;
  /** Optional sub-instruction, e.g. اتجه نحو المخرج 8 */
  detail?: string;
  /** Metres from the start of this step to the maneuver point. */
  distanceM: number;
}

export interface Destination {
  id: string;
  name: string;
  district: string;
  distanceKm: number;
  etaMin: number;
  kind: 'home' | 'work' | 'recent' | 'poi';
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSec: number;
  /** Two-stop hue pair used to synthesise the album artwork. */
  art: [string, string];
  /** Real cover supplied by a native MediaSession, when there is one.
      Absent means the synthesised motif is used, as in the prototype. */
  artwork?: string;
  /** Ambient tint the Music screen samples from the artwork. */
  ambient: string;
}

export interface Contact {
  id: string;
  name: string;
  /** E.164-ish Saudi demo numbers. */
  phone: string;
  favorite: boolean;
  relation?: string;
}

export interface CallRecord {
  id: string;
  contactId: string;
  direction: 'in' | 'out' | 'missed';
  /** Minutes before "now" that the call happened. */
  agoMin: number;
  durationSec: number;
}

export interface AppEntry {
  id: string;
  name: string;
  /** Icon key in system/icons.tsx */
  icon: string;
  /** Blocked while the vehicle is moving. */
  restricted: boolean;
  target?: ScreenId;
}

export interface TirePressure {
  position: 'fl' | 'fr' | 'rl' | 'rr';
  psi: number;
  tempC: number;
}

export interface VehicleState {
  gear: Gear;
  speedKph: number;
  driveMode: DriveMode;
  fuelPct: number;
  rangeKm: number;
  voltage: number;
  coolantC: number;
  oilC: number;
  outsideC: number;
  odometerKm: number;
  tires: TirePressure[];
  trip: { distanceKm: number; avgKmL: number; durationMin: number; avgSpeed: number };
  rpm: number;
}

export interface ClimateState {
  driverC: number;
  passengerC: number;
  fan: number; // 0..7
  sync: boolean;
  ac: boolean;
  seatHeatDriver: 0 | 1 | 2 | 3;
}

export interface MediaState {
  playing: boolean;
  trackIndex: number;
  positionSec: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  volume: number; // 0..30, head-unit convention
  muted: boolean;
  favorites: string[];
  source: 'bluetooth' | 'usb' | 'radio';
}

export interface NavState {
  active: boolean;
  destination: Destination | null;
  steps: RouteStep[];
  stepIndex: number;
  /** Metres remaining to the next maneuver. */
  toManeuverM: number;
  remainingKm: number;
  etaMin: number;
  /** 0..1 progress used to place the vehicle marker on the route. */
  progress: number;
}

export type CallStatus = 'idle' | 'incoming' | 'active' | 'ended';

export interface PhoneState {
  status: CallStatus;
  contactId: string | null;
  durationSec: number;
  muted: boolean;
  speaker: boolean;
}

export interface SettingsState {
  theme: ThemeName;
  appearance: Appearance;
  railSide: RailSide;
  /** Simulated ambient light sensor, drives Appearance = auto. */
  ambientDaylight: boolean;
  reduceMotion: boolean;
  chimeVolume: number;
  driverAlerts: boolean;
  /** Startup sequence on power-on. */
  startupOn: boolean;
  greetingOn: boolean;
  greetingText: string;
  /** Reserved for the native Android build: a short chime plus the
      spoken greeting at power-on. The web prototype stays silent —
      no autoplay workarounds — but the preference is stored so the
      native layer has something to read on first boot. */
  startupChime: boolean;
}

/** Where a region of the HMI is getting its values right now.
 *  'demo' is the browser prototype's simulation, 'live' is a real
 *  native source, 'unavailable' is an honest blank. The UI must
 *  never present 'unavailable' data as though it were 'live'. */
export type Availability = 'demo' | 'live' | 'unavailable';

export interface SourceState {
  /** Connectivity: GPS provider, data link, Bluetooth adapter. */
  system: Availability;
  vehicle: Availability;
  media: Availability;
  phone: Availability;
  nav: Availability;
  apps: Availability;
}

/** Motion is tri-state because an unverified head unit genuinely
 *  does not know. 'unknown' is treated as moving for anything the
 *  driver should not be reading, and is never labelled as parked. */
export type Motion = 'parked' | 'moving' | 'unknown';

export interface SystemState {
  screen: ScreenId;
  /** Simulation clock, ticks once per second. */
  clock: number;
  /** Provenance of each region. All 'demo' in the browser. */
  sources: SourceState;
  /** Live values from the Android host, when there are any. */
  native: {
    media: import('../platform/host').NativeMedia | null;
    system: import('../platform/host').NativeSystem | null;
    apps: import('../platform/host').NativeApp[];
  };
  vehicle: VehicleState;
  climate: ClimateState;
  media: MediaState;
  nav: NavState;
  phone: PhoneState;
  settings: SettingsState;
  /** App the user tried to open while moving; drives the safety state. */
  blockedApp: string | null;
  devPanelOpen: boolean;
}
