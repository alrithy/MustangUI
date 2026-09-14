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

The bundle is composed for 2400×900 **CSS pixels**. A WebView defaults to
1 CSS px = 1 dp, so on a unit reporting a density other than 1.0 the
layout viewport would come out as 2400/density and the approved
composition would be cropped.

`MainActivity` pins `setInitialScale(100)` and disables the wide-viewport
path, which makes 1 CSS px = 1 physical px and reproduces the approved
geometry at any density. `setTextZoom(100)` stops a vendor system
font-size setting from reflowing the panel.

2400×900 is the composition target. It is **not** an assertion that this
unit's 2400 physical pixels equal 2400 Android dp — confirm with
`wm size` and `wm density` before trusting the result.

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
node scripts/verify-state.cjs                    # reducer, both modes
npm run build && node scripts/verify-ui.cjs      # browser, both modes
```

`verify-ui.cjs` serves `dist/` from the launcher's own origin and injects
a fake native host, so the Android code path — bridge protocol included —
is exercised without an APK or a device. Set `CHROMIUM_PATH` if your
Chromium is not the build Playwright expects.
