# Validation status — Android launcher V1

What was actually run in this environment, and what was not. Anything not
listed as PASS below has not been demonstrated.

## Passed

- **Web build.** `npm ci && npm run build` — TypeScript project build and
  Vite production build, clean. No new runtime dependencies: the app
  still ships only React and ReactDOM.
- **Reducer, both platform modes.** `node scripts/verify-state.cjs` —
  8/8. Covers: the head unit starting with no simulated sources, every
  simulation action being inert at the reducer, live media moving the
  store, revoked media access clearing metadata instead of stranding it,
  navigation and preferences still working, and the browser prototype
  keeping its full simulation and tick.
- **Browser, both platform modes.** `node scripts/verify-ui.cjs` — 15/15
  in headless Chromium at 2400×900. The native pass serves `dist/` from
  `https://appassets.androidplatform.net` with a fake host injected, so
  the real Android code path and bridge protocol are exercised. Covers:
  the approved 2400×900 composition with no horizontal overflow, no
  invented vehicle data (`—`, no lit gear pill), live media replacing
  demo tracks, transport presses reaching the bridge without the UI
  flipping itself, the simulation clock not running, the curated app grid
  with uninstalled entries inert, parked-only content held while motion
  is unverified, the keypad dialling through the bridge, the Home intent
  returning to Home, media-access request, and zero page errors in every
  pass.
- **Screenshots.** Prototype and head-unit renders compared at 2400×900;
  the composition is unchanged. Artifacts in `/tmp/mustang-ui`.
- **Java parse check.** All launcher sources compile past parsing with
  `javac`; the only errors are unresolved `android.*`, `androidx.*` and
  `org.json.*` symbols, which is exactly what an absent SDK produces.
  Zero syntax errors.
- **Android XML.** Every manifest, style, drawable and mipmap is
  well-formed.
- **APK validator.** `scripts/validate-apk.py` tested both ways against a
  zip built from the real `dist/`: passes on a correct bundle, fails on a
  bundle with the pony asset removed.
- **Gradle wrapper.** Generated from the locally installed Gradle 8.14.3
  — a real wrapper JAR, not a fabricated one.

## Not run

- **`assembleDebug` / `lintDebug`. No APK was produced.** The Android
  Gradle Plugin is published only on Google's Maven, and `dl.google.com`
  is blocked by this environment's proxy — verified, not assumed
  (`services.gradle.org`, `repo.maven.apache.org` and
  `plugins.gradle.org` all reachable; `dl.google.com` returns no
  response). The Android SDK could not be downloaded for the same reason.
  The project is complete and buildable; it has not been built here.
  Build locally, or dispatch `.github/workflows/android-debug.yml`.
- **Lint.** Not run, so lint findings are unknown. `abortOnError` is on
  in the build file, but the workflow runs lint as a separate
  non-gating step so an unexpected finding in a future AGP cannot stand
  between a reviewer and an installable APK.
- **Everything requiring the physical head unit.** Cold-start recording,
  OEM splash behaviour, real density and physical touch-target size,
  immersive insets, ignition sleep/wake, app switching, native intents
  against real packages, MediaSession against a real player, memory and
  jank over time, and recovery back to the original launcher. See
  `DEVICE-DISCOVERY.md`.

## Known limits by design

- Vehicle data is unavailable, and shown as unavailable. There is no
  `VehicleDataProvider` implementation that reads anything.
- Motion is unknown on the head unit, and is treated as moving.
- Media seek, shuffle, repeat and queue selection are not available
  through a `MediaController` in general and are not offered.
- Bluetooth adapter state may report `permission_required` on Android
  12+; V1 does not request `BLUETOOTH_CONNECT`, since pairing happens in
  Android's settings, which the HMI links to.
- "GPS enabled" means the provider is on. It is not a fix and is not a
  location.
- The phone-projection receiver package is unset pending discovery.

## Assessment

The web side is verified as far as a browser can verify it, including the
Android code path. The Android side is reviewed, parse-checked and
complete, but **unbuilt and untested**. Treat buildability and on-device
behaviour as open gates, not as claims.
