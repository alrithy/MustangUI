/* ============================================================
   DEMO DATA
   Everything in this file is fabricated for the prototype.
   It is deliberately isolated from the UI so a real HAL /
   MediaSession / navigation provider can replace it wholesale.
   ============================================================ */

import type {
  AppEntry, CallRecord, Contact, Destination, RouteStep, Track,
} from './types';

/* ---------- Media -------------------------------------------------
   A believable mixed Arabic / Latin queue: RTL titles must sit next
   to LTR titles in the same list without either breaking. */
export const TRACKS: Track[] = [
  {
    id: 'tr-01', title: 'ليلة عمر', artist: 'عمرو دياب', album: 'سهران',
    durationSec: 254, art: ['#3a2129', '#8d3a44'], ambient: 'rgba(141,58,68,0.16)',
  },
  {
    id: 'tr-02', title: 'Nightcall', artist: 'Kavinsky', album: 'OutRun',
    durationSec: 258, art: ['#191d2b', '#3c5578'], ambient: 'rgba(60,85,120,0.16)',
  },
  {
    id: 'tr-03', title: 'الأماكن', artist: 'محمد عبده', album: 'ليالي الرياض',
    durationSec: 402, art: ['#231f19', '#7a6440'], ambient: 'rgba(122,100,64,0.16)',
  },
  {
    id: 'tr-04', title: 'زي الهوا', artist: 'عبدالحليم حافظ', album: 'كلاسيكيات',
    durationSec: 331, art: ['#1d2220', '#4d6b5c'], ambient: 'rgba(77,107,92,0.16)',
  },
  {
    id: 'tr-05', title: 'Midnight City', artist: 'M83', album: 'Hurry Up',
    durationSec: 244, art: ['#241b2c', '#6a4a86'], ambient: 'rgba(106,74,134,0.16)',
  },
  {
    id: 'tr-06', title: 'حبيبي يا نور العين', artist: 'عمرو دياب', album: 'نور العين',
    durationSec: 287, art: ['#2b2118', '#8a5f33'], ambient: 'rgba(138,95,51,0.16)',
  },
  {
    id: 'tr-07', title: 'الليل يا ليلى', artist: 'كاظم الساهر', album: 'حافية القدمين',
    durationSec: 368, art: ['#1c1e26', '#414d78'], ambient: 'rgba(65,77,120,0.16)',
  },
  {
    id: 'tr-08', title: 'Redbone', artist: 'Childish Gambino', album: 'Awaken',
    durationSec: 327, art: ['#2a1f14', '#8f6327'], ambient: 'rgba(143,99,39,0.16)',
  },
];

/* ---------- Phone ------------------------------------------------- */
export const CONTACTS: Contact[] = [
  { id: 'c-01', name: 'عبدالله الرشيد', phone: '+966 55 214 8890', favorite: true, relation: 'العمل' },
  { id: 'c-02', name: 'نورة', phone: '+966 50 337 1204', favorite: true, relation: 'العائلة' },
  { id: 'c-03', name: 'خالد المطيري', phone: '+966 56 908 4471', favorite: true },
  { id: 'c-04', name: 'ورشة الصيانة', phone: '+966 11 462 7700', favorite: true, relation: 'خدمة' },
  { id: 'c-05', name: 'سارة العتيبي', phone: '+966 53 771 2098', favorite: false },
  { id: 'c-06', name: 'محمد الدوسري', phone: '+966 54 118 6633', favorite: false },
  { id: 'c-07', name: 'فهد', phone: '+966 59 240 5512', favorite: false },
  { id: 'c-08', name: 'مكتب العليا', phone: '+966 11 299 3140', favorite: false, relation: 'العمل' },
  { id: 'c-09', name: 'ريم القحطاني', phone: '+966 55 640 8172', favorite: false },
  { id: 'c-10', name: 'ياسر', phone: '+966 58 302 9945', favorite: false },
];

export const CALL_LOG: CallRecord[] = [
  { id: 'cl-01', contactId: 'c-02', direction: 'in', agoMin: 14, durationSec: 412 },
  { id: 'cl-02', contactId: 'c-01', direction: 'out', agoMin: 68, durationSec: 96 },
  { id: 'cl-03', contactId: 'c-05', direction: 'missed', agoMin: 140, durationSec: 0 },
  { id: 'cl-04', contactId: 'c-04', direction: 'out', agoMin: 320, durationSec: 233 },
  { id: 'cl-05', contactId: 'c-03', direction: 'in', agoMin: 470, durationSec: 1288 },
  { id: 'cl-06', contactId: 'c-08', direction: 'out', agoMin: 1180, durationSec: 47 },
  { id: 'cl-07', contactId: 'c-06', direction: 'missed', agoMin: 1440, durationSec: 0 },
];

/** The caller used by the incoming-call demo state. */
export const INCOMING_CONTACT_ID = 'c-02';

/* ---------- Navigation --------------------------------------------
   A plausible north-Riyadh commute: العليا -> طريق الملك فهد -> الملقا. */
export const DESTINATIONS: Destination[] = [
  { id: 'd-home', name: 'المنزل', district: 'حي الملقا', distanceKm: 18.4, etaMin: 21, kind: 'home' },
  { id: 'd-work', name: 'المكتب', district: 'العليا — طريق الملك فهد', distanceKm: 9.7, etaMin: 14, kind: 'work' },
  { id: 'd-r1', name: 'مطار الملك خالد', district: 'طريق المطار', distanceKm: 34.2, etaMin: 27, kind: 'recent' },
  { id: 'd-r2', name: 'بوليفارد الرياض', district: 'حي حطين', distanceKm: 12.6, etaMin: 17, kind: 'recent' },
  { id: 'd-r3', name: 'مركز الملك عبدالله المالي', district: 'طريق الملك فهد', distanceKm: 7.9, etaMin: 11, kind: 'recent' },
];

export const ROUTE_STEPS: RouteStep[] = [
  { id: 's1', kind: 'straight',   road: 'طريق العروبة',        detail: 'ابقَ في المسار الأيمن', distanceM: 900 },
  { id: 's2', kind: 'turn-right', road: 'طريق الملك فهد',       detail: 'اتجه شمالاً',           distanceM: 1400 },
  { id: 's3', kind: 'exit-right', road: 'مخرج 5 — طريق الملك سلمان', detail: 'المسار الأيمن',    distanceM: 3200 },
  { id: 's4', kind: 'slight-left', road: 'طريق أنس بن مالك',    distanceM: 2600 },
  { id: 's5', kind: 'turn-left',  road: 'شارع الملقا',           distanceM: 1100 },
  { id: 's6', kind: 'destination', road: 'المنزل',               detail: 'الوجهة على اليمين',    distanceM: 400 },
];

/* Route polyline in the map's 0..1000 x 0..600 viewBox space.
   The demo route. Turns are filleted rather than square: a real
   guidance line follows a carriageway through an intersection, and a
   90-degree corner is the single strongest tell that a map is drawn
   rather than driven. The radius is deliberately small — a wide sweep
   reads as a racetrack, not a street. */
const ROUTE_POINTS: Array<[number, number]> = [
  [118, 548], [178, 548], [214, 512], [214, 402], [268, 348], [452, 348],
  [486, 314], [486, 214], [540, 160], [742, 160], [812, 182], [862, 206],
];

function filleted(pts: Array<[number, number]>, radius: number) {
  const d: string[] = [`M ${pts[0][0]} ${pts[0][1]}`];
  for (let i = 1; i < pts.length - 1; i += 1) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const ax = cx - ((cx - px) / inLen) * r;
    const ay = cy - ((cy - py) / inLen) * r;
    const bx = cx + ((nx - cx) / outLen) * r;
    const by = cy + ((ny - cy) / outLen) * r;
    d.push(`L ${ax.toFixed(1)} ${ay.toFixed(1)}`, `Q ${cx} ${cy} ${bx.toFixed(1)} ${by.toFixed(1)}`);
  }
  const last = pts[pts.length - 1];
  d.push(`L ${last[0]} ${last[1]}`);
  return d.join(' ');
}

export const ROUTE_PATH = filleted(ROUTE_POINTS, 15);

/* ---------- Apps --------------------------------------------------
   Curated, not a launcher grid dump. Video and browsing are the only
   genuinely restricted entries; everything else stays reachable. */
export const APPS: AppEntry[] = [
  { id: 'a-maps',    name: 'الخرائط',     icon: 'nav',       restricted: false,   target: 'nav' },
  { id: 'a-music',   name: 'الوسائط',     icon: 'music',     restricted: false, target: 'music' },
  { id: 'a-phone',   name: 'الهاتف',      icon: 'phone',     restricted: false, target: 'phone' },
  { id: 'a-radio',   name: 'الراديو',     icon: 'radio',     restricted: false },
  { id: 'a-podcast', name: 'البودكاست',   icon: 'podcast',   restricted: false },
  { id: 'a-cast',    name: 'عرض الهاتف',  icon: 'cast',      restricted: false },
  { id: 'a-fuel',    name: 'محطات الوقود', icon: 'fuel',      restricted: false },
  { id: 'a-bt',      name: 'البلوتوث',    icon: 'bluetooth', restricted: false },
  { id: 'a-car',     name: 'المركبة',     icon: 'car',       restricted: false, target: 'car' },
  { id: 'a-settings',name: 'الإعدادات',   icon: 'settings',  restricted: false, target: 'settings' },
  { id: 'a-video',   name: 'الفيديو',     icon: 'video',     restricted: true },
  { id: 'a-browser', name: 'المتصفح',     icon: 'browser',   restricted: true },
  { id: 'a-gallery', name: 'الصور',       icon: 'gallery',   restricted: true },
  { id: 'a-store',   name: 'المتجر',      icon: 'store',     restricted: true },
];

/* ---------- Weather ------------------------------------------------
   Single-glance only: current, condition, high/low. Not a weather app. */
export const WEATHER = {
  city: 'الرياض',
  tempC: 34,
  highC: 39,
  lowC: 24,
  condition: 'صحو',
};
