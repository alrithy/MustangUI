/* ============================================================
   APP MAPPING
   The curated HMI grid is the product; the Android package list is
   an implementation detail. This is the only translation between
   the two, so the Apps screen never becomes a raw package dump.

   `native: null` means the tile stays an internal HMI screen even
   on device — the Mustang media, vehicle and settings surfaces are
   ours, not a third-party app.
   ============================================================ */

/** HMI app id -> native capability id understood by NativeBridge. */
export const NATIVE_APP: Record<string, string | null> = {
  'a-maps': 'maps',
  'a-podcast': 'waze',
  'a-music': null,
  'a-phone': null,
  'a-radio': null,
  'a-fuel': 'maps',
  'a-cast': 'carplay',
  'a-bt': 'bluetooth',
  'a-car': null,
  'a-settings': null,
  'a-video': 'youtube',
  'a-browser': null,
  'a-gallery': null,
  'a-store': null,
};

/** Tiles whose label changes once they point at a real package. */
export const NATIVE_LABEL: Record<string, string> = {
  'a-podcast': 'Waze',
  'a-fuel': 'محطات الوقود',
};

/** Tiles that exist only in the browser prototype. */
export const DEMO_ONLY = new Set(['a-radio', 'a-browser', 'a-gallery', 'a-store']);
