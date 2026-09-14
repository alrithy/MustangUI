/* ============================================================
   FORMATTING
   Latin digits throughout: Gulf-market vehicles, road signage and
   clusters use them, and tabular Latin figures stay legible at a
   glance. Units are abbreviated, which also sidesteps Arabic's
   plural rules for values that change every second.
   ============================================================ */

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/** 24-hour clock. Unambiguous at a glance, no ص/م glyph to parse. */
export function clockTime(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function longDate(d: Date = new Date()): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Arrival clock time, `minutes` from now. */
export function arrivalTime(minutes: number, from: Date = new Date()): string {
  return clockTime(new Date(from.getTime() + minutes * 60_000));
}

/** Maneuver distance. Coarse buckets — a driver cannot use metre precision. */
export function maneuverDistance(metres: number): { value: string; unit: string } {
  if (metres >= 1000) return { value: (metres / 1000).toFixed(1), unit: 'كم' };
  if (metres >= 500) return { value: String(Math.round(metres / 100) * 100), unit: 'م' };
  if (metres >= 100) return { value: String(Math.round(metres / 50) * 50), unit: 'م' };
  return { value: String(Math.max(0, Math.round(metres / 10) * 10)), unit: 'م' };
}

export function distanceKm(km: number): { value: string; unit: string } {
  if (km < 1) return { value: String(Math.round(km * 1000 / 50) * 50), unit: 'م' };
  return { value: km < 10 ? km.toFixed(1) : String(Math.round(km)), unit: 'كم' };
}

/** Trip / ETA duration. Hours only appear once they exist. */
export function duration(minutes: number): { value: string; unit: string } {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return { value: String(m), unit: 'د' };
  return { value: `${Math.floor(m / 60)}:${pad(m % 60)}`, unit: 'س' };
}

/** m:ss for media position and call duration. */
export function timecode(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Relative time for the call log. */
export function relativeTime(agoMin: number): string {
  if (agoMin < 1) return 'الآن';
  if (agoMin < 60) return `قبل ${Math.round(agoMin)} د`;
  if (agoMin < 24 * 60) return `قبل ${Math.round(agoMin / 60)} س`;
  const days = Math.round(agoMin / (24 * 60));
  return days === 1 ? 'أمس' : `قبل ${days} أيام`;
}

export const temperature = (c: number) => `${Math.round(c)}°`;
export const climateTemp = (c: number) => c.toFixed(1);

/** Two-letter monogram for contact avatars.
 *  Arabic family names almost all begin with the definite article, so
 *  "محمد الدوسري" has to yield مد, not ما. */
export function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 2 && w.startsWith('ال') ? w.slice(2) : w));
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

/** Deterministic index into a palette, so a contact keeps its colour. */
export function hashIndex(seed: string, buckets: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % buckets;
}
