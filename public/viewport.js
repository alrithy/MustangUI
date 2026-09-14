/*
 * Panel viewport adapter — Android launcher only.
 *
 * Why this file exists
 * -------------------
 * The HMI is composed for a 2400x900 panel and its whole scale system
 * assumes it: the rem base is derived from vh/vw, and ~30 media queries
 * adjust the layout for genuinely smaller panels. Both are evaluated
 * against the CSS viewport, so the CSS viewport has to actually be
 * 2400x900 — scaling a rendered 2400x900 box with a CSS transform would
 * leave every one of those queries reading the wrong width.
 *
 * What Android actually does
 * --------------------------
 * WebView converts CSS pixels to *density-independent* pixels so a page
 * looks the same physical size at any density. So by default
 *
 *     CSS viewport width = physical width / density        (density = dpi/160)
 *
 * and a 2400px panel reports 2400 CSS px only at 160 dpi. At 240 dpi it
 * is 1600, at 320 dpi it is 1200.
 *
 * WebView.setInitialScale() is NOT the fix: it is documented as not
 * taking screen density into account, so its meaning relative to dp is
 * exactly the thing we cannot assume across vendor firmware.
 *
 * The documented mechanism is the viewport meta tag, whose scale
 * properties ARE density-aware. Laying out at width=2400 and pinning
 * initial-scale to (measured dp width / 2400) makes 2400 CSS px span the
 * full panel at any density — and the scale is measured here, never
 * assumed, so no density value is hardcoded anywhere.
 *
 * Loaded as a separate file rather than inlined because the launcher
 * serves a `script-src 'self'` CSP, and placed in <head> so it runs
 * before first layout.
 */
(function () {
  'use strict';

  var NATIVE_ORIGIN = 'https://appassets.androidplatform.net';
  var PANEL_WIDTH = 2400;
  var PANEL_HEIGHT = 900;

  /* Read by the diagnostics overlay. Populated in both modes so the
     bench can tell "browser" from "panel, corrected" at a glance. */
  var state = {
    mode: 'browser',
    panelWidth: PANEL_WIDTH,
    panelHeight: PANEL_HEIGHT,
    applied: false,
    /* Viewport as measured BEFORE correction: device-independent px. */
    dipWidth: 0,
    dipHeight: 0,
    scale: 1,
    error: '',
  };
  window.__mustangViewport = state;

  if (window.location.origin !== NATIVE_ORIGIN) return;
  state.mode = 'panel';

  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    state.error = 'no viewport meta tag to adapt';
    return;
  }

  function apply() {
    // Once only. After correction clientWidth reports 2400, so a second
    // pass would compute a scale of 1 and undo the fit.
    if (state.applied) return;

    var width = document.documentElement.clientWidth;
    var height = document.documentElement.clientHeight;
    if (!width) return;

    state.dipWidth = width;
    state.dipHeight = height;
    state.scale = width / PANEL_WIDTH;
    state.applied = true;

    // Height is deliberately not pinned: letting it fall out of the
    // panel's real aspect ratio avoids letterboxing a unit that is not
    // exactly 8:3, and the layout already adapts by height.
    meta.setAttribute('content', [
      'width=' + PANEL_WIDTH,
      'initial-scale=' + state.scale,
      'minimum-scale=' + state.scale,
      'maximum-scale=' + state.scale,
      'user-scalable=no',
      'viewport-fit=cover',
    ].join(', '));
  }

  apply();
  if (!state.applied) {
    document.addEventListener('DOMContentLoaded', apply);
  }
})();
