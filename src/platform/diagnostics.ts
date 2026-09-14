/* ============================================================
   PANEL DIAGNOSTICS
   The numbers that settle whether the approved 2400x900 composition
   is actually landing on the physical panel, gathered from both
   sides of the bridge so they can be compared rather than assumed.

   The page half works anywhere, including the browser prototype.
   The native half is debug-build only.
   ============================================================ */

import { request } from './host';

export const PANEL_WIDTH = 2400;
export const PANEL_HEIGHT = 900;

/** What the viewport adapter in public/viewport.js measured and did. */
export interface ViewportAdapter {
  mode: 'browser' | 'panel';
  panelWidth: number;
  panelHeight: number;
  applied: boolean;
  /** Viewport before correction, in device-independent pixels. */
  dipWidth: number;
  dipHeight: number;
  scale: number;
  error: string;
}

export interface PageMetrics {
  devicePixelRatio: number;
  innerWidth: number;
  innerHeight: number;
  clientWidth: number;
  clientHeight: number;
  visualViewportWidth: number | null;
  visualViewportHeight: number | null;
  visualViewportScale: number | null;
  screenWidth: number;
  screenHeight: number;
  rootFontSizePx: number;
  /**
   * Physical pixels the composition actually occupies.
   *
   * Note devicePixelRatio does NOT include the page scale — Blink keeps
   * that in visualViewport.scale — so the physical span is
   * cssPx x pageScale x devicePixelRatio. Using devicePixelRatio alone
   * overstates it by 1/pageScale on any unit above 160 dpi.
   */
  effectivePhysicalWidth: number;
  effectivePhysicalHeight: number;
  /** True when the CSS viewport is the composition the HMI expects. */
  matchesPanel: boolean;
  /** True when the whole layout viewport is on screen — nothing cropped. */
  fullyVisible: boolean;
}

export interface NativeMetrics {
  panelWidth: number;
  panelHeight: number;
  density: number;
  densityDpi: number;
  scaledDensity: number;
  fontScale: number;
  xdpi: number;
  ydpi: number;
  windowWidthPx: number;
  windowHeightPx: number;
  displayWidthPx: number;
  displayHeightPx: number;
  webViewWidthPx: number;
  webViewHeightPx: number;
  /** CSS viewport the page would have seen with no correction. */
  defaultCssWidth: number;
  defaultCssHeight: number;
  sdk: number;
  release: string;
  model: string;
  device: string;
  board: string;
  hardware: string;
}

declare global {
  interface Window { __mustangViewport?: ViewportAdapter }
}

export function viewportAdapter(): ViewportAdapter | null {
  return window.__mustangViewport ?? null;
}

export function pageMetrics(): PageMetrics {
  const root = document.documentElement;
  const visual = window.visualViewport ?? null;
  const clientWidth = root.clientWidth;
  const clientHeight = root.clientHeight;
  const dpr = window.devicePixelRatio;
  /* The scale the viewport meta asked for, as the engine applied it. */
  const pageScale = visual ? visual.scale : 1;
  return {
    devicePixelRatio: dpr,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth,
    clientHeight,
    visualViewportWidth: visual ? visual.width : null,
    visualViewportHeight: visual ? visual.height : null,
    visualViewportScale: visual ? visual.scale : null,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    rootFontSizePx: parseFloat(getComputedStyle(root).fontSize),
    effectivePhysicalWidth: Math.round(clientWidth * pageScale * dpr),
    effectivePhysicalHeight: Math.round(clientHeight * pageScale * dpr),
    /* Width is the axis the composition is pinned to; height follows the
       unit's real aspect ratio and the layout adapts to it. */
    matchesPanel: Math.abs(clientWidth - PANEL_WIDTH) <= 1,
    fullyVisible: visual === null || visual.width >= clientWidth - 1,
  };
}

/** Native metrics, or null in a browser or a release build. */
export function nativeMetrics(): Promise<NativeMetrics | null> {
  return request<NativeMetrics>('diagnostics').catch(() => null);
}
