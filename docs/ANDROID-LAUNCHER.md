# Mustang Android launcher — V1

A native Android Home candidate that hosts the approved Mustang HMI
offline, in a WebView, behind a narrow bridge.

The web module at the repository root stays the source of truth for the
interface. Android is additive: it does not fork the UI, and it does not
change what the UI looks like.

Baseline: `claude/epic-planck-99768l`.

---

## Why a WebView shell

The HMI is approved as it is. Rewriting it natively would mean
re-approving every screen, and rewriting it in Compose or Flutter would
throw away the part that is actually finished. Bundling it into a
launcher shell keeps the approved pixels and buys the things only a
native app can have: the Home intent, MediaSession, package launching,
an honest black cold start, and a recovery path.

The cost is the bridge, and the bridge is where the care goes.

## Layout

```
android/                        the launcher
  app/src/main/java/app/mustang/launcher/
    MainActivity.java           window, WebView, asset serving, recovery
    NativeBridge.java           the entire JS-reachable surface
    MediaHub.java               MediaSession -> HMI, event-driven
    AppCatalog.java             curated package resolution + launching
    SystemMonitor.java          network / GPS / Bluetooth, event-driven
    VehicleDataProvider.java    the seam for a real vehicle source
    RecoveryPanel.java          native failsafe
    MediaAccessService.java     notification listener (media only)
    Receivers.java              API 33+ receiver registration
src/platform/                   the web side of the bridge
  host.ts                       transport; the only module that knows
  appMap.ts                     HMI tile id -> native capability id
  HostBoundary.tsx              root failure -> native recovery
scripts/
  verify-state.cjs              reducer checks, both platform modes
  verify-ui.cjs                 browser checks, both platform modes
  validate-apk.py              proves the APK really contains the HMI
```

## Data provenance

The rule the whole design follows: **never present a value we do not
have.** Each region of the HMI carries a source — `demo`, `live`, or
`unavailable` — and the UI renders accordingly.

| Region | Browser | Head unit V1 |
|---|---|---|
| Vehicle (speed, range, gear, temp) | `demo` simulation | `unavailable` — blanks, no invented numbers |
| Media | `demo` tracks | `live` from MediaSession, or `unavailable` |
| Phone log / contacts | `demo` | `unavailable`; keypad hands off to the system dialer |
| Guidance | `demo` route | `unavailable`; route actions open Maps or Waze |
| Apps | full curated grid | curated grid filtered by what is installed |
| Connectivity | assumed on | real network / GPS provider / Bluetooth adapter |

The prototype's 1 Hz simulation tick is not merely hidden on Android — it
never starts, and every simulation action is inert at the reducer. That is
checked by `scripts/verify-state.cjs`, not left to inspection.

Motion is tri-state. `unknown` is treated as moving, so parked-only
content stays held rather than being released on an assumption, and the
Apps screen says "حالة الوقوف غير متاحة" rather than claiming the car is
parked. This launcher is not a vehicle safety controller and cannot
enforce anything inside another app or SystemUI.

## Startup: black, in one chain

Required order, with no other colour anywhere in it:

1. `windowBackground` black — the system's starting window, painted
   before `onCreate` runs.
2. Android 12+ splash black, with a black "icon" and zero animation
   duration, so the SplashScreen API cannot flash the app icon.
3. Activity decor black.
4. WebView background black, set before the first load.
5. `index.html`'s own inline black — deliberately duplicated from
   `base.css`, because anything in the module graph is by definition too
   late for the first paint.
6. The approved pony sequence, unchanged.

`windowDisablePreview` is deliberately **not** set: suppressing the
starting window trades a black frame for a frozen previous app, which on a
head unit reads as a hang.

Source inspection cannot prove zero white frames on vendor firmware.
Verify by screen-recording real cold starts — see DEVICE-DISCOVERY.md.

## Geometry

This is the part most likely to be got wrong, so it is spelled out.

### The mapping

Android has three pixel units in play:

| Unit | Meaning |
|---|---|
| Physical px | What the panel has. 2400 × 900 on this unit. |
| Android dp | `physical / density`, where `density = densityDpi / 160`. |
| CSS px | What the page lays out in. |

The documented WebView behaviour is that it *"converts your CSS pixel
values to density-independent pixel values, so your web page appears at
the same perceivable size as a medium-density screen — about 160 dpi."*
So by default **1 CSS px = 1 dp**, and the CSS viewport the page receives
is `physical / density`:

| Panel | densityDpi | density | CSS viewport without correction |
|---|---|---|---|
| 2400×900 | 160 | 1.0 | 2400 × 900 |
| 2400×900 | 240 | 1.5 | 1600 × 600 |
| 2400×900 | 320 | 2.0 | 1200 × 450 |
| 2400×900 | 213 (vendor) | 1.33125 | 1803 × 676 |

Only a 160 dpi unit sees the composition the HMI was authored for.

### Why that matters more than it looks

The HMI is not a page that merely gets smaller. Its rem base is derived
from viewport units — `clamp(13px, min(2.24vh, 0.86vw), 20px)` — and
about thirty media queries adjust the layout for genuinely smaller
panels. At a 1200 px viewport the type scale clamps to its floor and the
compact breakpoints fire, so the panel renders the small-screen
compatibility layout, stretched over a 2400 px display. Captured
uncorrected at 320 dpi: the rail label overflows its tile and the range
readout disappears from the drivetrain bar entirely.

That also rules out the obvious fix. Rendering a 2400×900 box and
shrinking it with a CSS `transform: scale()` would not help: media
queries and viewport units are evaluated against the viewport, not
against a transformed ancestor, so all thirty would still read the wrong
width. **The CSS viewport itself has to be 2400.**

### What does not work

`WebView.setInitialScale()`. It is documented as *not* taking screen
density into account, unlike the scale properties in the viewport meta
tag — which makes its meaning relative to dp exactly the thing that
cannot be assumed across vendor firmware. An earlier revision of this
project used `setInitialScale(100)` and asserted it produced a 1:1
CSS-to-physical mapping. That assertion was not verified and is not
relied on.

### What is used

The viewport meta tag, whose scale properties *are* density-aware.
`public/viewport.js` runs in `<head>` before first layout, and only on
the launcher's origin:

1. Measures the dp viewport it was given — `documentElement.clientWidth`.
2. Sets `width=2400` with `initial-scale` pinned to `measured / 2400`.

No density is hardcoded anywhere; the scale is derived from what the
device actually reports. `MainActivity` enables
`setUseWideViewPort(true)` so the meta tag is honoured at all, and
`setLoadWithOverviewMode(true)` as a fallback that fits by width if the
script ever fails to run. `setTextZoom(100)` stops a vendor system
font-size setting from reflowing the panel.

### The result, measured

Verified in Chromium under mobile emulation — the same Blink viewport
path WebView uses — at all four densities above:

| density | dp viewport | page scale | CSS viewport | rendered |
|---|---|---|---|---|
| 1.0 | 2400×900 | 1.0 | 2400×900 | 2400×900 px |
| 1.5 | 1600×600 | 0.66667 | 2400×900 | 2400×900 px |
| 2.0 | 1200×450 | 0.5 | 2400×900 | 2400×900 px |
| 1.33125 | 1803×676 | 0.75125 | 2400×900 | 2400×900 px |

Root font size, touch-target boxes and the shell box are identical at
every density, and the rendered output is the full panel with nothing
cropped and nothing letterboxed.

One trap worth recording: `window.devicePixelRatio` does **not** include
the page scale — Blink keeps that in `visualViewport.scale`. The physical
span of the composition is `cssPx × pageScale × devicePixelRatio`. Using
`devicePixelRatio` alone overstates it by `1/pageScale`.

### Touch targets

Physical target size is `designPx × (panel physical width / 2400)`, which
has no density term in it at all. So the 76 dp automotive minimum holds
as long as the panel is the physical size the design assumes. That is a
question about the glass, not about `densityDpi`, and it is on the
discovery list: measure the panel and check `xdpi`/`ydpi`.

2400×900 remains the composition target. It is **not** an assertion about
this unit's dp — confirm with `wm size` and `wm density`, and with the
diagnostics overlay below.

### Diagnostics

Debug builds carry a panel-diagnostics overlay, opened with the same
long-press on the MUSTANG wordmark that opens the developer panel in the
browser. It reports both halves of the mapping — physical px, density,
densityDpi, WebView measured px from the native side, and
`devicePixelRatio`, `innerWidth`/`innerHeight`, `clientWidth`/
`clientHeight`, `visualViewport` and the applied page scale from the page
— plus a verdict on whether the CSS viewport is the expected 2400.

The same record is written to logcat once at start-up, so it can be read
from a bench without touching the screen:

```sh
adb logcat -s MustangPanel:I
```

Release builds refuse the bridge call and log nothing.

## Offline and security

- `WebViewAssetLoader` serves the bundle from
  `https://appassets.androidplatform.net`. Requests to any other origin
  are refused with 403 by `shouldInterceptRequest`, and
  `shouldOverrideUrlLoading` blocks navigation out of the bundle.
- **No `INTERNET` permission is requested.** The launcher UI cannot make
  a network request even if something tried to.
- The bridge is an origin-scoped, main-frame-only `WebMessageListener`,
  not `addJavascriptInterface` — which cannot be origin-scoped at all. A
  WebView without `WEB_MESSAGE_LISTENER` gets the native recovery panel
  rather than a weaker bridge.
- A CSP is attached to every served response: no frames, no objects, no
  remote scripts, `connect-src 'none'`.
- File and content access, geolocation, multiple windows, zoom and form
  data are all off.

The bridge exposes named methods only. There is no "run this intent", no
"launch this package", no reflection, no shell. `launch` takes a
capability id checked against an allowlist; `dial` takes a string matched
against `[+0-9*#]{1,20}` before it becomes a `tel:` URI.

## Media

Android's only supported route to another app's `MediaSession` is
notification-listener access, so `MediaAccessService` exists purely to be
granted. Its callbacks are empty: no notification content is read,
stored, or forwarded.

`MediaHub` is event-driven — `OnActiveSessionsChangedListener` plus a
`MediaController.Callback` — so the launcher never wakes the CPU to ask
whether anything changed. All of it runs on one background thread;
artwork is bounded to 256 px JPEG and re-encoded only when the track
identity changes, so a player emitting a position update every second
does not push a 40 KB string across the bridge every second.

Transport commands are *requests*. `play` does not flip the UI; the
session's own callback does. A player that ignores the command leaves the
HMI showing what is actually true. Seek, shuffle, repeat and queue
selection are not available from a MediaController in general and are not
pretended to be.

## Apps

Curated, not enumerated. The HMI's tiles map to capability ids in
`src/platform/appMap.ts`; `AppCatalog` resolves each against installed
packages and reports availability. A tile with nothing behind it renders
disabled and marked "غير مثبت" rather than failing when pressed.

`installedApps` exists for discovery and diagnostics, and deliberately
has no counterpart that will launch an arbitrary package from that list.

The phone-projection receiver package is intentionally unset: head-unit
receivers are vendor-specific and this one has not been identified. A
guessed package name would resolve to nothing and look broken.

## Vehicle data

`VehicleDataProvider` has exactly one implementation in V1:
`Unavailable`, which returns null for every field. Nothing probes vendor
services or broadcasts speculative intents — that is how a head unit gets
bricked, and "CAN unknown" is not evidence that CAN is reachable.

When discovery on the physical unit identifies a documented source, it
becomes a second implementation and nothing above it changes. The web
layer already renders an unavailable vehicle correctly.

## Recovery

The app is a Home *candidate*, never an enforced default. There is no
boot receiver and nothing tries to make itself Home.

Native recovery appears on: a WebView without `WEB_MESSAGE_LISTENER`, a
main-frame load error, renderer death, a React root failure reported by
`HostBoundary`, or the HMI failing to report ready within 20 seconds. It
is built from plain framework views — it has to work precisely when the
WebView or the bundle could not be trusted — and offers Retry, Home
settings, and Android settings. If the unit has no Home-settings screen,
it starts the resolved default Home component directly.

**Keep the original launcher installed and enabled.**

Recommended first run: open it as an ordinary app while parked, confirm
offline launch, returning Home, and recovery, and only then consider
selecting it as default Home.

## Navigation

V1 launches installed Google Maps or Waze through intents. The prototype
map art stays as Home presentation and is labelled demo.

No embedded map SDK is bundled. Google's Navigation SDK needs an eligible
billing project and terms review; MapLibre needs a licensed tile source,
a routing engine and an offline-storage plan — a renderer alone is not
navigation. Neither was assumed. `navigationProvider` in `host.ts` is the
seam for replacing the prototype surface later while keeping the chrome.

## Build

Requires JDK 17+, and an Android SDK with platform 35 / build-tools
35.0.0. The Gradle wrapper is committed, so Gradle itself is not a
prerequisite.

```sh
npm ci && npm run build          # the APK bundles this output
cd android
./gradlew assembleDebug          # needs ANDROID_HOME or local.properties
cd ..
python3 scripts/validate-apk.py android/app/build/outputs/apk/debug/app-debug.apk
```

`bundleWeb` copies `dist/` into the APK and fails with a clear message if
you skipped the web build.

`.github/workflows/android-debug.yml` does the same on demand. It is
`workflow_dispatch` only — Actions minutes are constrained, so an APK is
built when someone asks for one, not on every push. GitHub generally
requires a `workflow_dispatch` workflow to exist on the default branch
before offering "Run workflow"; until this branch is merged, build
locally.

## Tests

```sh
npm run verify:state                      # reducer, both platform modes
npm run build && npm run verify:ui        # browser, both platform modes
npm run build && npm run verify:panel     # geometry across four densities
npm run build && npm run verify:failsafe  # what happens when things break
```

`verify-ui.cjs` serves `dist/` from the launcher's own origin and injects
a fake native host, so the Android code path — bridge protocol included —
is exercised without an APK or a device.

`verify-panel.cjs` does the geometry, under Chromium mobile emulation so
the viewport meta runs through the same Blink path WebView uses. It
includes a control case with the correction removed, which both
reproduces the uncorrected bug and calibrates the comparison threshold
against a real regression rather than a guess.

`verify-failsafe.cjs` covers the paths nobody exercises by accident: a
host that never answers, a host that replies with garbage, a host that
refuses an action, and a bundle that cannot mount at all. A launcher that
fails is the Home screen of a car, so these matter more than they would
in a web app.

Set `CHROMIUM_PATH` if your Chromium is not the build Playwright expects.

## Bridge robustness

Everything arriving from the host crosses a trust boundary — media
metadata and app labels originate in third-party apps. Two rules hold it:

- The event envelope is built with the JSON library, never by string
  concatenation, so a payload cannot break out of its frame.
- A push carrying no payload, or a primitive where a record belongs, is
  dropped at the transport. The store's handlers are typed as if the host
  keeps its contract, and letting a malformed frame through would throw
  inside a reducer and take the whole HMI into recovery over one bad
  field. The reducer is total in its own right as well.
