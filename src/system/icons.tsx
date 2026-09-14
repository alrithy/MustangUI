/* ============================================================
   ICON FAMILY
   One family, one grid (24), one stroke weight. Only transport
   controls and status dots are filled — everything else is a
   1.6 stroke with round caps, so the set reads as a single tool.
   ============================================================ */

import type { CSSProperties, ReactNode } from 'react';

const FILLED = new Set([
  'play', 'pause', 'heart-filled', 'star-filled', 'dot', 'record',
]);

const SHAPES: Record<string, ReactNode> = {
  /* ---- Primary destinations ---- */
  home: <><path d="M3.6 10.4 12 3.9l8.4 6.5V19a1.6 1.6 0 0 1-1.6 1.6H5.2A1.6 1.6 0 0 1 3.6 19z" /><path d="M9.6 20.6v-6.2h4.8v6.2" /></>,
  nav: <path d="M12 3.1 20.2 20.6 12 16.4 3.8 20.6z" />,
  music: <><path d="M9.1 17.4V6.5l9.6-2.1v10.8" /><circle cx="6.9" cy="17.6" r="2.2" /><circle cx="16.5" cy="15.2" r="2.2" /></>,
  phone: <path d="M6.4 3.6h3.1l1.5 4-2.1 1.4a12.6 12.6 0 0 0 6.1 6.1l1.4-2.1 4 1.5v3.1a1.7 1.7 0 0 1-1.8 1.7C10.6 18.7 5.3 13.4 4.7 5.4A1.7 1.7 0 0 1 6.4 3.6z" />,
  apps: <><rect x="3.6" y="3.6" width="7" height="7" rx="1.6" /><rect x="13.4" y="3.6" width="7" height="7" rx="1.6" /><rect x="3.6" y="13.4" width="7" height="7" rx="1.6" /><rect x="13.4" y="13.4" width="7" height="7" rx="1.6" /></>,
  car: <><path d="M2.8 14.6h18.4" /><path d="M4.6 14.6 6.2 9.7a2.3 2.3 0 0 1 2.2-1.6h7.2a2.3 2.3 0 0 1 2.2 1.6l1.6 4.9" /><path d="M4.6 14.6v3M19.4 14.6v3" /><circle cx="7.6" cy="17.6" r="1.9" /><circle cx="16.4" cy="17.6" r="1.9" /></>,
  settings: <path d="M10.37 5.19L10.53 2.72A9.4 9.4 0 0 1 13.47 2.72L13.63 5.19A7 7 0 0 1 15.66 6.03L17.53 4.40A9.4 9.4 0 0 1 19.60 6.47L17.97 8.34A7 7 0 0 1 18.81 10.37L21.28 10.53A9.4 9.4 0 0 1 21.28 13.47L18.81 13.63A7 7 0 0 1 17.97 15.66L19.60 17.53A9.4 9.4 0 0 1 17.53 19.60L15.66 17.97A7 7 0 0 1 13.63 18.81L13.47 21.28A9.4 9.4 0 0 1 10.53 21.28L10.37 18.81A7 7 0 0 1 8.34 17.97L6.47 19.60A9.4 9.4 0 0 1 4.40 17.53L6.03 15.66A7 7 0 0 1 5.19 13.63L2.72 13.47A9.4 9.4 0 0 1 2.72 10.53L5.19 10.37A7 7 0 0 1 6.03 8.34L4.40 6.47A9.4 9.4 0 0 1 6.47 4.40L8.34 6.03A7 7 0 0 1 10.37 5.19Z M12 8.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2z" />,

  /* ---- Maneuvers ---- */
  'mv-straight': <><path d="M12 20.5V4.4" /><path d="M6.9 9.5 12 4.2l5.1 5.3" /></>,
  'mv-right': <><path d="M6 20.5v-8.2a3 3 0 0 1 3-3h9.4" /><path d="M14.4 5.1 19.6 9.3l-5.2 4.2" /></>,
  'mv-left': <><path d="M18 20.5v-8.2a3 3 0 0 0-3-3H5.6" /><path d="M9.6 5.1 4.4 9.3l5.2 4.2" /></>,
  'mv-slight-right': <><path d="M7.4 20.5v-6.7a4 4 0 0 1 1.4-3L17 4.2" /><path d="M12.1 3.9h5.6v5.5" /></>,
  'mv-slight-left': <><path d="M16.6 20.5v-6.7a4 4 0 0 0-1.4-3L7 4.2" /><path d="M11.9 3.9H6.3v5.5" /></>,
  'mv-exit-right': <><path d="M8.4 20.5V9.8a4.4 4.4 0 0 1 1.6-3.4" /><path d="M13.4 20.5v-4.9a4 4 0 0 1 1.5-3.1l4-3.2" /><path d="M14.4 8.3h4.9v4.7" /></>,
  'mv-roundabout': <><path d="M12 20.5v-5.2" /><circle cx="12" cy="10.4" r="4.9" /><path d="M16.9 10.4h3.4" /><path d="M17.6 7.2l3.2 3.2-3.2 3.2" /></>,
  'mv-merge': <><path d="M12 20.5v-7.6" /><path d="M12 12.9 6.6 7.6V4.1" /><path d="M12 12.9l5.4-5.3V4.1" /></>,
  'mv-destination': <><path d="M6.6 20.4V3.9" /><path d="M6.6 4.6h11.2l-2.4 3.9 2.4 3.9H6.6" /></>,

  /* ---- Media ---- */
  play: <path d="M7.6 4.6 19.4 12 7.6 19.4z" />,
  pause: <><rect x="6.6" y="4.6" width="4" height="14.8" rx="1" /><rect x="13.4" y="4.6" width="4" height="14.8" rx="1" /></>,
  next: <><path d="M18.4 5.2v13.6" /><path d="M16 12 6.4 5.4v13.2z" /></>,
  prev: <><path d="M5.6 5.2v13.6" /><path d="M8 12l9.6-6.6v13.2z" /></>,
  shuffle: <><path d="M3.6 6.8h3.1c1.3 0 2.5.6 3.2 1.7l4.2 6.2a3.9 3.9 0 0 0 3.2 1.7h3.1" /><path d="M17.3 3.9l3.1 2.9-3.1 2.9" /><path d="M17.3 14.3l3.1 2.9-3.1 2.9" /><path d="M3.6 17.2h3.1a3.9 3.9 0 0 0 3.2-1.7l.8-1.2" /><path d="M13.3 9.3l.8-1.2a3.9 3.9 0 0 1 3.2-1.7h3.1" /></>,
  repeat: <><path d="M6.6 7.4h10.8a3 3 0 0 1 3 3v1.4" /><path d="M17.4 16.6H6.6a3 3 0 0 1-3-3v-1.4" /><path d="M9 4.6 6.2 7.4 9 10.2" /><path d="M15 13.8l2.8 2.8L15 19.4" /></>,
  'repeat-one': <><path d="M6.6 7.4h10.8a3 3 0 0 1 3 3v1.4" /><path d="M17.4 16.6H6.6a3 3 0 0 1-3-3v-1.4" /><path d="M9 4.6 6.2 7.4 9 10.2" /><path d="M15 13.8l2.8 2.8L15 19.4" /><path d="M11.2 10.4 12.6 9.5v5" /></>,
  heart: <path d="M12 19.8 4.9 13a4.3 4.3 0 0 1 0-6.2 4.6 4.6 0 0 1 6.3 0l.8.8.8-.8a4.6 4.6 0 0 1 6.3 0 4.3 4.3 0 0 1 0 6.2z" />,
  'heart-filled': <path d="M12 19.8 4.9 13a4.3 4.3 0 0 1 0-6.2 4.6 4.6 0 0 1 6.3 0l.8.8.8-.8a4.6 4.6 0 0 1 6.3 0 4.3 4.3 0 0 1 0 6.2z" />,
  queue: <><path d="M3.8 6.4h11M3.8 12h11M3.8 17.6h7" /><path d="M18 9.4v8.2" /><circle cx="16.2" cy="17.9" r="1.9" /><path d="M18 9.4 21 8.6" /></>,
  volume: <><path d="M4.4 9.4h3.2l4.4-3.7v12.6l-4.4-3.7H4.4z" /><path d="M15.6 9.2a3.9 3.9 0 0 1 0 5.6" /><path d="M18.2 6.6a7.5 7.5 0 0 1 0 10.8" /></>,
  'volume-low': <><path d="M4.4 9.4h3.2l4.4-3.7v12.6l-4.4-3.7H4.4z" /><path d="M15.6 9.2a3.9 3.9 0 0 1 0 5.6" /></>,
  mute: <><path d="M4.4 9.4h3.2l4.4-3.7v12.6l-4.4-3.7H4.4z" /><path d="M16 9.6l4.4 4.8M20.4 9.6 16 14.4" /></>,
  radio: <><rect x="2.9" y="8.4" width="18.2" height="11.2" rx="2" /><circle cx="16.4" cy="14" r="2.7" /><path d="M6.4 12.4h4.6M6.4 15.8h4.6" /><path d="M7.2 8.4 16.6 4.4" /></>,
  podcast: <><circle cx="12" cy="8.6" r="3.2" /><path d="M12 11.8v4.4" /><path d="M8 15.6a4.6 4.6 0 0 1 8 0" /><path d="M5.4 18.4a7.4 7.4 0 0 1 13.2 0" /></>,
  bluetooth: <path d="M8.2 7.4 15.8 16 12 19.6V4.4L15.8 8 8.2 16.6" />,

  /* ---- Phone ---- */
  'phone-end': <><path d="M3.2 13.4a13.4 13.4 0 0 1 17.6 0l-1.9 2.5-3.7-1.2v-2.3a12 12 0 0 0-6.4 0v2.3l-3.7 1.2z" /></>,
  'phone-in': <><path d="M6.4 3.6h3.1l1.5 4-2.1 1.4a12.6 12.6 0 0 0 6.1 6.1l1.4-2.1 4 1.5v3.1a1.7 1.7 0 0 1-1.8 1.7C10.6 18.7 5.3 13.4 4.7 5.4A1.7 1.7 0 0 1 6.4 3.6z" /><path d="M20.4 3.6 15.6 8.4" /><path d="M15.6 4.5v3.9h3.9" /></>,
  'phone-out': <><path d="M6.4 3.6h3.1l1.5 4-2.1 1.4a12.6 12.6 0 0 0 6.1 6.1l1.4-2.1 4 1.5v3.1a1.7 1.7 0 0 1-1.8 1.7C10.6 18.7 5.3 13.4 4.7 5.4A1.7 1.7 0 0 1 6.4 3.6z" /><path d="M15.6 8.4 20.4 3.6" /><path d="M20.4 7.5V3.6h-3.9" /></>,
  'phone-missed': <><path d="M6.4 3.6h3.1l1.5 4-2.1 1.4a12.6 12.6 0 0 0 6.1 6.1l1.4-2.1 4 1.5v3.1a1.7 1.7 0 0 1-1.8 1.7C10.6 18.7 5.3 13.4 4.7 5.4A1.7 1.7 0 0 1 6.4 3.6z" /><path d="M15.8 3.8 20.6 8.6M20.6 3.8 15.8 8.6" /></>,
  mic: <><rect x="9.2" y="3.2" width="5.6" height="10.6" rx="2.8" /><path d="M5.8 11.6a6.2 6.2 0 0 0 12.4 0" /><path d="M12 17.8v3" /></>,
  'mic-off': <><path d="M9.2 6v-.2a2.8 2.8 0 0 1 5.6 0v5.6M9.2 9.6v1.6a2.8 2.8 0 0 0 4 2.5" /><path d="M5.8 11.6a6.2 6.2 0 0 0 9.6 5.2M18.2 11.6v.4" /><path d="M12 17.8v3" /><path d="M4.4 3.6 19.6 20.4" /></>,
  speaker: <><rect x="5.4" y="2.9" width="13.2" height="18.2" rx="2.4" /><circle cx="12" cy="14.6" r="3.4" /><path d="M12 6.4h.01" /></>,
  dialpad: <><circle cx="6.6" cy="6" r="1.5" /><circle cx="12" cy="6" r="1.5" /><circle cx="17.4" cy="6" r="1.5" /><circle cx="6.6" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="17.4" cy="12" r="1.5" /><circle cx="6.6" cy="18" r="1.5" /><circle cx="12" cy="18" r="1.5" /><circle cx="17.4" cy="18" r="1.5" /></>,
  star: <path d="m12 3.6 2.6 5.5 5.8.8-4.2 4.2 1 6-5.2-2.9-5.2 2.9 1-6L3.6 9.9l5.8-.8z" />,
  'star-filled': <path d="m12 3.6 2.6 5.5 5.8.8-4.2 4.2 1 6-5.2-2.9-5.2 2.9 1-6L3.6 9.9l5.8-.8z" />,
  person: <><circle cx="12" cy="8" r="3.8" /><path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0" /></>,

  /* ---- Climate ---- */
  fan: <><path d="M12 10.2V3.4c3.1 0 5 1.9 5 3.6s-1.8 3.2-5 3.2z" /><path d="M13.6 12.9l5.9 3.4c-1.55 2.68-4.2 3.15-5.68 2.3s-1.9-3.3-.22-5.7z" /><path d="M10.4 12.9l-5.9 3.4c1.55 2.68 4.2 3.15 5.68 2.3s1.9-3.3.22-5.7z" /><circle cx="12" cy="12" r="1.5" /></>,
  snowflake: <><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" /><path d="M9.6 5.1 12 3l2.4 2.1M9.6 18.9 12 21l2.4-2.1" /><path d="M4.4 10.5 4 7.7l2.7-.9M19.6 13.5l.4 2.8-2.7.9M17.3 6.8l2.7.9-.4 2.8M6.7 17.2l-2.7-.9.4-2.8" /></>,
  'seat-heat': <><path d="M7.4 3.8h3.4a2 2 0 0 1 2 1.8l.6 6.4H8.6a2 2 0 0 1-2-1.8z" /><path d="M8 14.4h8.6a2 2 0 0 1 2 2v3.8" /><path d="M18.6 3.6c-1.1 1-1.1 2 0 3s1.1 2 0 3" /></>,
  plus: <path d="M12 5.4v13.2M5.4 12h13.2" />,
  minus: <path d="M5.4 12h13.2" />,
  sync: <><path d="M4.2 12a7.8 7.8 0 0 1 13.3-5.5l2.3 2.3" /><path d="M19.8 12a7.8 7.8 0 0 1-13.3 5.5l-2.3-2.3" /><path d="M19.8 4.4v4.4h-4.4M4.2 19.6v-4.4h4.4" /></>,
  ac: <><path d="M12 3.4v17.2" /><path d="M4.6 7.7 19.4 16.3M19.4 7.7 4.6 16.3" /><circle cx="12" cy="12" r="2.6" /></>,

  /* ---- Vehicle ---- */
  tire: <><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5" /><path d="M8.4 3.9v16.2M15.6 3.9v16.2" /><path d="M3.9 8.4h16.2M3.9 15.6h16.2" /></>,
  fuel: <><path d="M4.4 20.6V5.2a1.8 1.8 0 0 1 1.8-1.8h5.6a1.8 1.8 0 0 1 1.8 1.8v15.4" /><path d="M3.4 20.6h11.2" /><path d="M5.9 6.4h6.2v3.8H5.9z" /><path d="M13.6 8.4h2.6a1.6 1.6 0 0 1 1.6 1.6v5.6a1.7 1.7 0 0 0 3.4 0V9.4l-2.2-2.6" /></>,
  battery: <><rect x="2.8" y="7.2" width="16.4" height="9.6" rx="1.8" /><path d="M21.2 10.6v2.8" /><path d="M6.6 11.2v1.6M9.4 9.8v4.4M12.2 11.2v1.6" /></>,
  thermo: <><path d="M13.8 13.2V5.4a2.4 2.4 0 0 0-4.8 0v7.8a4.2 4.2 0 1 0 4.8 0z" /><path d="M11.4 8.6v6.6" /></>,
  trip: <><circle cx="12" cy="12" r="8.6" /><path d="M12 7.4V12l3.2 2" /></>,
  info: <><circle cx="12" cy="12" r="8.8" /><path d="M12 10.8v5.4" /><path d="M12 7.8h.01" /></>,
  oil: <><path d="M12 3.6c3.4 4 5.4 6.6 5.4 9.2a5.4 5.4 0 0 1-10.8 0c0-2.6 2-5.2 5.4-9.2z" /></>,
  shield: <><path d="M12 3.4 19.2 6v5.6c0 4.2-2.9 7.6-7.2 9-4.3-1.4-7.2-4.8-7.2-9V6z" /><path d="m9 12 2.2 2.2L15.2 10" /></>,
  gauge: <><path d="M4 16.6a8.8 8.8 0 1 1 16 0" /><path d="M12 16.6 16.2 9.8" /><circle cx="12" cy="16.6" r="1.3" /></>,

  /* ---- Status ---- */
  gps: <><circle cx="12" cy="12" r="3.2" /><circle cx="12" cy="12" r="7.6" /><path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6" /></>,
  signal: <><path d="M4 18.6v-3.2M9.3 18.6v-6.6M14.7 18.6v-10M20 18.6V5.4" /></>,
  wifi: <><path d="M2.6 9.2a13.4 13.4 0 0 1 18.8 0" /><path d="M6.2 12.9a8.3 8.3 0 0 1 11.6 0" /><path d="M9.6 16.5a3.5 3.5 0 0 1 4.8 0" /><path d="M12 19.9h.01" /></>,
  lock: <><rect x="4.8" y="10.2" width="14.4" height="10.2" rx="2" /><path d="M8.2 10.2V7.4a3.8 3.8 0 0 1 7.6 0v2.8" /></>,

  /* ---- Apps ---- */
  video: <><rect x="2.8" y="5.4" width="13.4" height="13.2" rx="2.2" /><path d="m16.2 13 5-3.2v4.4l-5-3.2z" /></>,
  browser: <><circle cx="12" cy="12" r="8.8" /><path d="M3.4 12h17.2" /><path d="M12 3.2a13.6 13.6 0 0 1 0 17.6 13.6 13.6 0 0 1 0-17.6z" /></>,
  gallery: <><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.2" /><circle cx="8.6" cy="9.8" r="1.7" /><path d="m4.2 17.4 4.8-4.6 3.6 3.4 3-2.8 4.2 4" /></>,
  cast: <><rect x="2.8" y="4.6" width="18.4" height="12.6" rx="2.2" /><path d="M8.6 20.6h6.8" /><path d="M12 17.2v3.4" /><path d="M6.6 8.6a5.6 5.6 0 0 1 5.6 5.6" /><path d="M6.6 12.2a2 2 0 0 1 2 2" /></>,
  store: <><path d="M4 9.4h16v9.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M3.2 9.4 5 4.6a1.4 1.4 0 0 1 1.3-.9h11.4a1.4 1.4 0 0 1 1.3.9l1.8 4.8" /><path d="M9.4 13.4h5.2" /></>,

  /* ---- Weather ---- */
  sun: <><circle cx="12" cy="12" r="4.4" /><path d="M12 2.6v2.4M12 19v2.4M4.3 4.3l1.7 1.7M18 18l1.7 1.7M2.6 12H5M19 12h2.4M4.3 19.7 6 18M18 6l1.7-1.7" /></>,
  moon: <path d="M20.2 14.4A8.6 8.6 0 0 1 9.6 3.8a8.8 8.8 0 1 0 10.6 10.6z" />,
  cloud: <path d="M6.8 18.4a4.4 4.4 0 0 1-.5-8.8 5.8 5.8 0 0 1 11.1 1.2 3.8 3.8 0 0 1-.7 7.6z" />,

  /* ---- Utility ---- */
  'chevron-left': <path d="M14.8 4.6 7.4 12l7.4 7.4" />,
  'chevron-right': <path d="M9.2 4.6 16.6 12l-7.4 7.4" />,
  'chevron-down': <path d="M4.6 9.2 12 16.6l7.4-7.4" />,
  close: <path d="M5.4 5.4 18.6 18.6M18.6 5.4 5.4 18.6" />,
  check: <path d="m4.8 12.6 4.8 4.8L19.2 6.6" />,
  search: <><circle cx="10.8" cy="10.8" r="7" /><path d="m15.8 15.8 4.6 4.6" /></>,
  pin: <><path d="M12 21.2s7-6.1 7-11.2a7 7 0 1 0-14 0c0 5.1 7 11.2 7 11.2z" /><circle cx="12" cy="10" r="2.7" /></>,
  briefcase: <><rect x="2.8" y="6.8" width="18.4" height="13" rx="2" /><path d="M8.6 6.8V5.4a1.8 1.8 0 0 1 1.8-1.8h3.2a1.8 1.8 0 0 1 1.8 1.8v1.4" /><path d="M2.8 12.4h18.4" /></>,
  clock: <><circle cx="12" cy="12" r="8.6" /><path d="M12 6.8V12l3.4 2" /></>,
  sliders: <><path d="M3.4 7h10.2M17.6 7h3M3.4 17h3M10.4 17h10.2" /><circle cx="15.6" cy="7" r="2.2" /><circle cx="8.4" cy="17" r="2.2" /></>,
  brightness: <><circle cx="12" cy="12" r="4" /><path d="M12 3.4v2.2M12 18.4v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3.4 12h2.2M18.4 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" /></>,
  plug: <><path d="M8.4 3.4v5.2M15.6 3.4v5.2" /><path d="M5.6 8.6h12.8v3a6.4 6.4 0 0 1-12.8 0z" /><path d="M12 18v3" /></>,
  dot: <circle cx="12" cy="12" r="4" />,
  external: <><path d="M13.4 4.6h6v6" /><path d="M19.4 4.6 10.6 13.4" /><path d="M17 13.8v4.6a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4.6" /></>,
};

export type IconName = keyof typeof SHAPES;

interface IconProps {
  name: string;
  size?: number | string;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

export function Icon({ name, size, className, strokeWidth, style }: IconProps) {
  const shape = SHAPES[name];
  if (!shape) return null;
  const filled = FILLED.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size ?? '1em'}
      height={size ?? '1em'}
      className={className}
      style={style}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth ?? 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shape}
    </svg>
  );
}
