/* ============================================================
   NATIVE HOST TRANSPORT
   The only place in the web layer that knows a native host exists.
   Screens never import this: the store adapts it into ordinary
   domain state, so the approved UI keeps reading one shape whether
   it runs in a browser or inside the Android launcher.

   Wire format
     request   { id, method, args }
     reply     { id, ok: true, data } | { id, ok: false, error }
     event     { event, data }            unsolicited, no id

   Events are the primary channel. Polling is reserved for the one
   value that has no Android callback (the wall clock), because a
   QCM6125 pays for every wake the bridge causes.
   ============================================================ */

export type Availability = 'demo' | 'live' | 'unavailable';

export interface NativeMedia {
  /** 'live' once a MediaSession is readable; never 'demo' on device. */
  status: Exclude<Availability, 'demo'>;
  /** Owning player package, shown in place of the demo source label. */
  app?: string;
  appLabel?: string;
  title?: string;
  artist?: string;
  album?: string;
  /** data: URI, re-sent only when the track identity changes. */
  artwork?: string;
  playing?: boolean;
  durationSec?: number;
  positionSec?: number;
  /** Commands the owning session actually advertises. */
  canPlay?: boolean;
  canNext?: boolean;
  canPrevious?: boolean;
}

export interface NativeSystem {
  network: boolean;
  gpsEnabled: boolean;
  /** 'on' | 'off' | 'permission_required' | 'unavailable' */
  bluetooth: string;
  timeMs: number;
  sdk: number;
}

/** One curated HMI entry resolved against real installed packages. */
export interface NativeApp {
  id: string;
  available: boolean;
  label?: string;
}

/** The seam a documented TQ919/MCU integration plugs into later. */
export interface VehicleSnapshot {
  status: Exclude<Availability, 'demo'>;
  parked: boolean | null;
  speedKph: number | null;
  gear: string | null;
  fuelPct: number | null;
  rangeKm: number | null;
  rpm: number | null;
  voltage: number | null;
  coolantC: number | null;
  oilC: number | null;
  tires: unknown;
}

declare global {
  interface Window {
    MustangHost?: {
      postMessage(message: string): void;
      onmessage: ((event: { data: string }) => void) | null;
    };
  }
}

/* The launcher serves the bundle from WebViewAssetLoader's reserved
   origin. Anything else — dev server, Vercel, a file:// preview — is
   the browser prototype and must keep its simulation. */
export const NATIVE_ORIGIN = 'https://appassets.androidplatform.net';
export const isAndroid =
  typeof location !== 'undefined' && location.origin === NATIVE_ORIGIN;

const TIMEOUT_MS = 5000;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: number;
};

const pending = new Map<string, Pending>();
const listeners = new Map<string, Set<(data: unknown) => void>>();
let serial = 0;

function settle(message: { id?: string; ok?: boolean; data?: unknown; error?: string }) {
  const entry = message.id ? pending.get(message.id) : undefined;
  if (!entry || !message.id) return;
  clearTimeout(entry.timer);
  pending.delete(message.id);
  if (message.ok) entry.resolve(message.data);
  else entry.reject(new Error(message.error || 'unavailable'));
}

function deliver(name: string, data: unknown) {
  const set = listeners.get(name);
  if (!set) return;
  /* One bad subscriber must not stop the rest of the fan-out. */
  for (const fn of [...set]) {
    try { fn(data); } catch { /* subscriber faults stay local */ }
  }
}

if (typeof window !== 'undefined' && window.MustangHost) {
  window.MustangHost.onmessage = ({ data }) => {
    try {
      const message = JSON.parse(data);
      if (typeof message.event === 'string') deliver(message.event, message.data);
      else settle(message);
    } catch { /* a malformed frame can never move state */ }
  };
}

/** Ask the host for something. Rejects on timeout — never resolves blind. */
export function request<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const host = typeof window !== 'undefined' ? window.MustangHost : undefined;
    if (!host) { reject(new Error('unavailable')); return; }
    const id = String((serial += 1));
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error('timeout'));
    }, TIMEOUT_MS);
    pending.set(id, { resolve: (v) => resolve(v as T), reject, timer });
    try {
      host.postMessage(JSON.stringify({ id, method, args }));
    } catch {
      clearTimeout(timer);
      pending.delete(id);
      reject(new Error('unavailable'));
    }
  });
}

/** Subscribe to a native push channel. Returns an unsubscribe. */
export function on<T>(event: string, handler: (data: T) => void): () => void {
  const set = listeners.get(event) ?? new Set();
  listeners.set(event, set);
  set.add(handler as (data: unknown) => void);
  return () => { set.delete(handler as (data: unknown) => void); };
}

const NOTICE = 'mustang:notice';

/** Surface a short, human notice in the HMI's own confirm slot. */
export function notify(detail: string) {
  window.dispatchEvent(new CustomEvent(NOTICE, { detail }));
}

export function onNotice(handler: (detail: string) => void): () => void {
  const wrapped = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(NOTICE, wrapped);
  return () => window.removeEventListener(NOTICE, wrapped);
}

/* Reasons the host reports, mapped to something a driver can act on. */
const REASON: Record<string, string> = {
  permission_required: 'يحتاج إذناً من إعدادات أندرويد',
  not_installed: 'التطبيق غير مثبت',
  restricted: 'غير متاح أثناء الحركة',
  no_session: 'لا يوجد مصدر وسائط نشط',
  timeout: 'لم يستجب النظام',
};

/** Fire-and-forget action. A failure tells the driver why, once. */
export function act(method: string, args: Record<string, unknown> = {}) {
  void request(method, args).catch((error: Error) => {
    notify(REASON[error.message] ?? 'الخدمة غير متاحة');
  });
}
